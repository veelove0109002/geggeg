-- SPDX-License-Identifier: Apache-2.0

module("luci.controller.uninstall", package.seeall)

function index()
	if not nixio.fs.access('/etc/config') then
		return
	end

	entry({ 'admin', 'vum' }, firstchild(), _('VUM插件库'), 60).dependent = true
	entry({ 'admin', 'vum', 'uninstall' }, view('uninstall/main'), _('高级卸载'), 90).acl_depends = { 'luci-app-uninstall' }
	entry({ 'admin', 'vum' }, firstchild(), _('VUM插件库'), 60).icon = '/luci-static/resources/icons/vumcj.svg'

	local e
	e = entry({ 'admin', 'vum', 'uninstall', 'list' }, call('action_list'))
	e.leaf = true
	e.acl_depends = { 'luci-app-uninstall' }

	e = entry({ 'admin', 'vum', 'uninstall', 'remove' }, call('action_remove'))
	e.leaf = true
	e.acl_depends = { 'luci-app-uninstall' }

	e = entry({ 'admin', 'vum', 'uninstall', 'search_files' }, call('action_search_files'))
	e.leaf = true
	e.acl_depends = { 'luci-app-uninstall' }

	e = entry({ 'admin', 'vum', 'uninstall', 'version' }, call('action_version'))
	e.leaf = true
	e.acl_depends = { 'luci-app-uninstall' }

	e = entry({ 'admin', 'vum', 'uninstall', 'check_update' }, call('action_check_update'))
	e.leaf = true
	e.acl_depends = { 'luci-app-uninstall' }

	e = entry({ 'admin', 'vum', 'uninstall', 'upgrade' }, call('action_upgrade'))
	e.leaf = true
	e.acl_depends = { 'luci-app-uninstall' }

	e = entry({ 'admin', 'vum', 'uninstall', 'report_icon' }, call('action_report_icon'))
	e.leaf = true
	e.acl_depends = { 'luci-app-uninstall' }

	e = entry({ 'admin', 'vum', 'uninstall', 'report_uninstall' }, call('action_report_uninstall'))
	e.leaf = true
	e.acl_depends = { 'luci-app-uninstall' }

	e = entry({ 'admin', 'vum', 'uninstall', 'history_log' }, call('action_history_log'))
	e.leaf = true
	e.acl_depends = { 'luci-app-uninstall' }

	e = entry({ 'admin', 'vum', 'uninstall', 'announcement' }, call('action_announcement'))
	e.leaf = true
	e.acl_depends = { 'luci-app-uninstall' }

	e = entry({ 'admin', 'vum', 'uninstall', 'save_collapse_state' }, call('action_save_collapse_state'))
	e.leaf = true
	e.acl_depends = { 'luci-app-uninstall' }

	e = entry({ 'admin', 'vum', 'uninstall', 'get_collapse_state' }, call('action_get_collapse_state'))
	e.leaf = true
	e.acl_depends = { 'luci-app-uninstall' }

	e = entry({ 'admin', 'vum', 'uninstall', 'save_lock_state' }, call('action_save_lock_state'))
	e.leaf = true
	e.acl_depends = { 'luci-app-uninstall' }

	e = entry({ 'admin', 'vum', 'uninstall', 'get_lock_state' }, call('action_get_lock_state'))
	e.leaf = true
	e.acl_depends = { 'luci-app-uninstall' }
end

local http = require 'luci.http'
local sys = require 'luci.sys'
local ipkg = require 'luci.model.ipkg'
local json = require 'luci.jsonc'
local fs = require 'nixio.fs'
local util = require 'luci.util'

local function json_response(tbl, code)
	code = code or 200
	http.status(code, '')
	-- Avoid client/proxy caching
	http.header('Cache-Control', 'no-cache, no-store, must-revalidate')
	http.header('Pragma', 'no-cache')
	http.header('Expires', '0')
	http.prepare_content('application/json')
	http.write(json.stringify(tbl or {}))
end

-- 查询 luci-app-uninstall 当前已安装版本
function action_version()
	local status_path = fs.stat('/usr/lib/opkg/status') and '/usr/lib/opkg/status' or (fs.stat('/var/lib/opkg/status') and '/var/lib/opkg/status' or nil)
	local ver
	if status_path then
		local s = fs.readfile(status_path) or ''
		local name, installed
		for line in s:gmatch('[^\n\r]*') do
			local n = line:match('^Package:%s*(.+)$')
			if n then
				if name == 'luci-app-uninstall' and installed and not ver then break end
				name, installed = n, false
			end
			local st = line:match('^Status:%s*(.+)$')
			if st and st:match('installed') then installed = true end
			local v = line:match('^Version:%s*(.+)$')
			if v and name == 'luci-app-uninstall' and installed then ver = v end
		end
	end
	json_response({ version = ver or '' })
end

-- 在线检测 luci-app-uninstall 可用版本（来源：plugin.vumstar.com/download）
function action_check_update()
	-- 当前已安装版本
	local status_path = fs.stat('/usr/lib/opkg/status') and '/usr/lib/opkg/status' or (fs.stat('/var/lib/opkg/status') and '/var/lib/opkg/status' or nil)
	local cur
	if status_path then
		local s = fs.readfile(status_path) or ''
		local name, installed
		for line in s:gmatch('[^\n\r]*') do
			local n = line:match('^Package:%s*(.+)$')
			if n then
				if name == 'luci-app-uninstall' and installed and cur then break end
				name, installed = n, false
			end
			local st = line:match('^Status:%s*(.+)$')
			if st and st:match('installed') then installed = true end
			local v = line:match('^Version:%s*(.+)$')
			if v and name == 'luci-app-uninstall' and installed then cur = v end
		end
	end
	-- 远端版本信息
	local latest, url, changelog
	local endpoints = {
		'https://plugin.vumstar.com/download/version.json'
	}
	local body = ''
	for _, u in ipairs(endpoints) do
		body = sys.exec("wget -qO- '" .. u .. "' 2>/dev/null") or ''
		if not body or #body == 0 then body = sys.exec("uclient-fetch -qO- '" .. u .. "' 2>/dev/null") or '' end
		if body and #body > 0 then
			local ok, data = pcall(json.parse, body)
			if ok and type(data) == 'table' then
				latest = data.latest or data.version or latest
				url = data.url or url
				changelog = data.changelog or changelog
				break
			end
		end
	end
	-- 回退：尝试纯文本版本与固定下载地址
	if not latest or #latest == 0 then
		local txts = {
			'https://plugin.vumstar.com/download/version.txt'
		}
		for _, u in ipairs(txts) do
			local t = sys.exec("wget -qO- '" .. u .. "' 2>/dev/null") or ''
			if not t or #t == 0 then t = sys.exec("uclient-fetch -qO- '" .. u .. "' 2>/dev/null") or '' end
			if t and #t > 0 then latest = (t:gsub('%s+$',''):gsub('^%s+','')); break end
		end
	end
	-- 固定下载地址（无需返回 url 给前端）
	url = 'https://plugin.vumstar.com/download/luci-app-uninstall.ipk'
	-- 若无法获取 latest，也不影响在线更新；为了前端确认，标记 available=true
	json_response({ current = cur or '', latest = latest or '', available = true, changelog = changelog or '' })
end

-- 在线升级 luci-app-uninstall（来源：plugin.vumstar.com/download）
function action_upgrade()
	local log = {}
	local function append(s) log[#log+1] = s end
	append('=== Upgrade from plugin.vumstar.com/download ===')

	local runf = '/tmp/luci-app-uninstall.run'

	local function validate_run(path)
		local st = fs.stat(path)
		if not st or st.size <= 1024 then return false, '文件过小或不存在' end
		local f = io.open(path, 'rb')
		if not f then return false, '无法读取文件' end
		local header = f:read(2) or ''
		f:close()
		-- 简单判断：脚本通常以 #! 开头
		if header ~= '#!' then return false, '非有效安装脚本（缺少 shebang）' end
		return true
	end

	local function fetch(url)
		append('> Download: ' .. url)
		-- 清理旧文件
		sys.call(string.format("rm -f %q >/dev/null 2>&1", runf))
		-- 优先 uclient-fetch，再尝试 wget，最后尝试 curl（若存在）
		local rc = sys.call(string.format("uclient-fetch -L -O %q '%s' >/dev/null 2>&1", runf, url))
		if rc ~= 0 then rc = sys.call(string.format("wget --no-check-certificate -O %q '%s' >/dev/null 2>&1", runf, url)) end
		if rc ~= 0 then rc = sys.call(string.format("command -v curl >/dev/null 2>&1 && curl -L -o %q '%s' >/dev/null 2>&1 || true", runf, url)) end
		local ok, reason = validate_run(runf)
		if not ok then
			append('! 下载内容无效：' .. (reason or ''))
			return false
		end
		return true
	end

	-- 候选下载地址：1) 固定 .run 地址 2) 版本 JSON 中提供的 url（若可获取）
	local candidates = {
		'https://plugin.vumstar.com/download/luci-app-uninstall.run'
	}
	-- 尝试读取版本 JSON 获取精确地址（若提供 .run）
	do
		local endpoints = { 'https://plugin.vumstar.com/download/version.json' }
		for _, u in ipairs(endpoints) do
			local body = sys.exec("wget -qO- '" .. u .. "' 2>/dev/null") or ''
			if not body or #body == 0 then body = sys.exec("uclient-fetch -qO- '" .. u .. "' 2>/dev/null") or '' end
			if body and #body > 0 then
				local ok, data = pcall(json.parse, body)
				if ok and type(data) == 'table' and data.url and #data.url > 0 then
					local u2 = tostring(data.url)
					if u2:match('%.run$') then table.insert(candidates, 1, u2) end
					break
				end
			end
		end
	end

	local got
	for _, url in ipairs(candidates) do
		if fetch(url) then got = url; break end
	end
	if not got then
		append('! 下载失败（所有候选地址不可用）')
		return json_response({ ok = false, log = table.concat(log, "\n") }, 500)
	end

	-- 执行安装脚本
	append('+ sh ' .. runf)
	sys.call(string.format('chmod +x %q >/dev/null 2>&1', runf))
	local tmpout = '/tmp/upgrade-uninstall-run.txt'
	local rc = sys.call(string.format("/bin/sh %q >%s 2>&1", runf, tmpout))
	local out = fs.readfile(tmpout) or ''
	append(out)

	-- 清理并重载 LuCI
	sys.call('rm -f /tmp/luci-indexcache >/dev/null 2>&1')
	sys.call('rm -rf /tmp/luci-modulecache/* >/dev/null 2>&1')
	sys.call('[ -x /etc/init.d/uhttpd ] && /etc/init.d/uhttpd reload >/dev/null 2>&1')
	sys.call('[ -x /etc/init.d/nginx ] && /etc/init.d/nginx reload >/dev/null 2>&1')
	return json_response({ ok = (rc == 0), log = table.concat(log, "\n") })
end

-- 根据文件名关键词匹配：返回包含该文件的已安装包名列表
function action_search_files()
	local q = http.formvalue('q') or ''
	q = tostring(q):gsub('^%s+', ''):gsub('%s+$', '')
	if q == '' then return json_response({ packages = {} }) end
	-- opkg files <pkg> 遍历成本高；这里通过解析 status 文件的 Conffiles 字段与常见安装目录兜底匹配
	-- 1) 先构建已安装包列表
	local installed = {}
	local status_path = fs.stat('/usr/lib/opkg/status') and '/usr/lib/opkg/status' or (fs.stat('/var/lib/opkg/status') and '/var/lib/opkg/status' or nil)
	if status_path then
		local s = fs.readfile(status_path) or ''
		local cur
		for line in s:gmatch('[^\n\r]*') do
			local n = line:match('^Package:%s*(.+)$')
			if n then cur = n end
			local st = line:match('^Status:%s*(.+)$')
			if st and st:match('installed') and cur then installed[#installed+1] = cur end
		end
	end
	-- 2) 仅检查 luci-app-* 包，且限制扫描与匹配数量，避免卡顿
	local matches = {}
	local scanned = 0
	for _, name in ipairs(installed) do
		if name:match('^luci%-app%-') then
			scanned = scanned + 1
			local out = sys.exec(string.format("opkg files '%s' 2>/dev/null", name)) or ''
			local hit
			for line in out:gmatch('[^\n]+') do
				if line:match('^/[^%s]+') then
					if line:lower():find(q, 1, true) then hit = true; break end
				end
			end
			if hit then matches[#matches+1] = name end
			if #matches >= 100 or scanned >= 400 then break end
		end
	end
	return json_response({ packages = matches, scanned = scanned })
end

function action_list()
	local pkgs = {}
	-- iStoreOS installed list (if present)
	local istore_list = {}
	-- 1) 读取 iStoreOS 本地记录文件
	if fs.stat('/etc/istoreos/installed.list') then
		local content = fs.readfile('/etc/istoreos/installed.list') or ''
		for line in content:gmatch('[^\n\r]+') do
			local n = line:match('^%s*([^%s#]+)')
			if n and #n > 0 then istore_list[n] = true end
		end
	end
	-- 2) 解析 iStoreOS 已安装页面：/cgi-bin/luci/admin/store/pages/installed
	local function collect_istore_from_page()
		-- 使用当前请求的会话 Cookie 访问 API，避免跳登录页
		local host = (http.getenv and http.getenv('HTTP_HOST')) or '127.0.0.1'
		local cookie = (http.getcookie and http.getcookie('sysauth')) or ''
		local hdr = " --header 'Accept: application/json'"
		if cookie and #cookie > 0 then hdr = hdr .. string.format(" --header 'Cookie: sysauth=%s' ", cookie) end
		local urls = {
			string.format('http://%s/cgi-bin/luci/admin/api/store/installed', host),
			string.format('http://%s/cgi-bin/luci/admin/store/api/installed', host),
			string.format('http://%s/cgi-bin/luci/admin/store/installed?format=json', host),
			string.format('http://%s/cgi-bin/luci/admin/store/pages/installed?format=json', host),
			string.format('http://%s/cgi-bin/luci/admin/store/pages/installed', host),
		}
		local body = ''
		for _, u in ipairs(urls) do
			body = sys.exec("wget -qO-" .. hdr .. " '" .. u .. "' 2>/dev/null") or ''
			if not body or #body == 0 then
				body = sys.exec("uclient-fetch -qO-" .. hdr .. " '" .. u .. "' 2>/dev/null") or ''
			end
			if body and #body > 0 then break end
		end
		if not body or #body == 0 then return end
		-- 诊断输出：保存获取的响应到 /tmp，便于排查
		local ok_w = pcall(function() fs.writefile('/tmp/istoreos_installed_response.txt', body) end)
		if not ok_w then end
		-- 优先尝试解析 JSON
		local ok, data = pcall(json.parse, body)
		if ok and type(data) == 'table' then
			-- 尝试常见字段结构：列表或对象数组，包含包名/name/pkg 与中文标题字段
			local function add_item(en, zh)
				if type(en) == 'string' and #en > 0 then
					istore_list[en] = true
					if type(zh) == 'string' and #zh > 0 then istore_list[(en..'|zh')] = zh end
				end
			end
			local function handle(it)
				local en = it and (it.name or it.pkg or it.package)
				local zh = it and (it.title or it.cn or it.zh or it.name_cn)
				add_item(en, zh)
			end
			if data.items and type(data.items) == 'table' then
				for _, it in ipairs(data.items) do handle(it) end
			elseif data.list and type(data.list) == 'table' then
				for _, it in ipairs(data.list) do handle(it) end
			elseif data[1] ~= nil then
				for _, it in ipairs(data) do
					if type(it) == 'string' then add_item(it, nil)
					elseif type(it) == 'table' then handle(it) end
				end
			else
				-- 兜底：从 JSON 文本中提取 luci-app-* 模式
				for n in body:gmatch('luci%-app%-[%w%_%-%]+') do istore_list[n] = true end
			end
			return
		end
		-- 回退：从 HTML 文本中提取 luci-app-* 名称
		for name in body:gmatch('luci%-app%-[%w%_%-%]+') do
			istore_list[name] = true
		end
	end
	pcall(collect_istore_from_page)
	-- 3) 基于 opkg 源与索引列表判断：凡来自 repo.istoreos.com 的源内的包，归入 iStoreOS
	local function collect_istore_from_feeds()
		local feeds = {}
		local cf = fs.readfile('/etc/opkg/customfeeds.conf') or ''
		for line in cf:gmatch('[^\n\r]+') do
			local n,u = line:match('^%s*src_gz%s+([%w%-%_]+)%s+([^%s]+)')
			if not n then n,u = line:match('^%s*src%s+([%w%-%_]+)%s+([^%s]+)') end
			if n and u then feeds[n] = u end
		end
		local list_dirs = { '/tmp/opkg-lists', '/usr/lib/opkg/lists' }
		for _, d in ipairs(list_dirs) do
			local it = fs.dir(d)
			if it then
				for fname in it do
					local path = d .. '/' .. fname
					local url = feeds[fname] or ''
					local is_istore = url:match('repo%.istoreos%.com') ~= nil
					local content = fs.readfile(path) or ''
					if is_istore and content and #content > 0 then
						for line in content:gmatch('[^\n\r]*') do
							local p = line:match('^Package:%s*(.+)$')
							if p then istore_list[p] = true end
						end
					end
				end
			end
		end
	end
	pcall(collect_istore_from_feeds)
	-- 4) 解析 opkg 安装日志：凡从 repo.istoreos.com 下载的 ipk，对应包归入 iStoreOS
	local function collect_istore_from_logs()
		local paths = { '/var/log/opkg.log', '/var/log/opkg/opkg.log', '/var/log/opkg' }
		for _, p in ipairs(paths) do
			local st = fs.stat(p)
			if st and st.type == 'reg' then
				local content = fs.readfile(p) or ''
				for line in content:gmatch('[^\n\r]+') do
					local url = line:match('Downloading%s+(%S+)')
					if url and url:match('repo%.istoreos%.com') then
						local file = url:match('/([^/%s]+)%.ipk$')
						if file then
							local name = file:match('^(.-)_%d') or file:match('^(.-)%-%d') or file:match('^(luci%-app%-%w+)')
							if name and #name > 0 then istore_list[name] = true end
						end
					end
					local inst = line:match('Installing%s+([^%s]+)')
					if inst and inst:match('^luci%-app%-') then istore_list[inst] = true end
				end
			elseif st and st.type == 'dir' then
				local it = fs.dir(p)
				if it then
					for fname in it do
						local fpath = p .. '/' .. fname
						local content = fs.readfile(fpath) or ''
						for line in content:gmatch('[^\n\r]+') do
							local url = line:match('Downloading%s+(%S+)')
							if url and url:match('repo%.istoreos%.com') then
								local file = url:match('/([^/%s]+)%.ipk$')
								if file then
									local name = file:match('^(.-)_%d') or file:match('^(.-)%-%d') or file:match('^(luci%-app%-%w+)')
									if name and #name > 0 then istore_list[name] = true end
								end
							end
							local inst = line:match('Installing%s+([^%s]+)')
							if inst and inst:match('^luci%-app%-') then istore_list[inst] = true end
						end
					end
				end
			end
		end
	end
	pcall(collect_istore_from_logs)

	-- Prefer parsing status file directly for stability (only include installed packages)
	local function parse_status(path)
		local s = fs.readfile(path)
		if not s or #s == 0 then return end
		local name, ver, is_installed, install_time, vum_tag
		-- 系统默认插件白名单
		local default_apps = {
			['luci-app-cifs-mount']=true, ['luci-app-cpufreq']=true, ['luci-app-ddns']=true,
			['luci-app-diskman']=true, ['luci-app-dockerman']=true, ['luci-app-fan']=true,
			['luci-app-filetransfer']=true, ['luci-app-firewall']=true, ['luci-app-hd-idle']=true,
			['luci-app-mergerfs']=true, ['luci-app-nfs']=true, ['luci-app-oaf']=true,
			['luci-app-ota']=true, ['luci-app-package-manager']=true, ['luci-app-samba4']=true,
			['luci-app-ttyd']=true, ['luci-app-unishare']=true, ['luci-app-upnp']=true,
			['luci-app-wol']=true
		}
		for line in s:gmatch("[^\n\r]*") do
			local n = line:match("^Package:%s*(.+)$")
			if n then
				-- starting a new record, flush previous if exists and installed
				if name and is_installed then
					local cat
					if vum_tag and (vum_tag == '1' or vum_tag == 'yes' or vum_tag == 'true') then
						cat = 'VUM-Plugin类'
					elseif name == 'luci-app-uninstall' then
						cat = 'VUM-Plugin类'
					elseif istore_list[name] or name:match('^app%-meta%-.+') then
						cat = 'iStoreOS插件类'
					elseif default_apps[name] then
						cat = '系统默认插件类'
					elseif name:match('^luci%-app%-') then
						cat = '其他插件类'
					end
					local vp = false
					if vum_tag then
						local v = tostring(vum_tag):lower()
						vp = (v == '1' or v == 'yes' or v == 'true')
					end
					if name == 'luci-app-uninstall' then vp = true end
					-- 追加中文显示名：若来自 iStoreOS 页面解析，带入中文字段
					local display_name
					if cat == 'iStoreOS插件类' then
						local zh = istore_list[name .. '|zh']
						if zh and #zh > 0 then display_name = zh end
					end
					pkgs[#pkgs+1] = { name = name, version = ver or '', install_time = install_time, category = cat, vum_plugin = vp, display_name = display_name }
				end
				name, ver, is_installed, install_time, vum_tag = n, nil, false, nil, nil
			end
			local v = line:match("^Version:%s*(.+)$")
			if v then ver = v end
			local it = line:match("^Installed%-Time:%s*(%d+)$")
			if it then install_time = tonumber(it) end
			local st = line:match("^Status:%s*(.+)$")
			if st and st:match("installed") then is_installed = true end
			local vt = line:match("^[Vv][Uu][Mm]%-[Pp]lugin:%s*(.+)$")
			if vt then vum_tag = vt end
		end
		if name and is_installed then
			local cat
			if vum_tag and (vum_tag == '1' or vum_tag == 'yes' or vum_tag == 'true') then
				cat = 'VUM-Plugin类'
			elseif name == 'luci-app-uninstall' then
				cat = 'VUM-Plugin类'
			elseif istore_list[name] or name:match('^app%-meta%-.+') then
				cat = 'iStoreOS插件类'
			elseif default_apps[name] then
				cat = '系统默认插件类'
			elseif name:match('^luci%-app%-') then
				cat = '其他插件类'
			end
			local vp = false
			if vum_tag then
				local v = tostring(vum_tag):lower()
				vp = (v == '1' or v == 'yes' or v == 'true')
			end
			if name == 'luci-app-uninstall' then vp = true end
			-- 追加中文显示名：若来自 iStoreOS 页面解析，带入中文字段
			local display_name
			if cat == 'iStoreOS插件类' then
				local zh = istore_list[name .. '|zh']
				if zh and #zh > 0 then display_name = zh end
			end
			pkgs[#pkgs+1] = { name = name, version = ver or '', install_time = install_time, category = cat, vum_plugin = vp, display_name = display_name }
		end
	end

	if fs.stat('/usr/lib/opkg/status') then
		parse_status('/usr/lib/opkg/status')
	elseif fs.stat('/var/lib/opkg/status') then
		parse_status('/var/lib/opkg/status')
	end

	if #pkgs == 0 then
		-- Fallback: `opkg list-installed`
		local out = sys.exec("opkg list-installed 2>/dev/null") or ''
		for line in out:gmatch("[^\n]+") do
			local n, v = line:match("^([^%s]+)%s+-%s+(.+)$")
			if n then pkgs[#pkgs+1] = { name = n, version = v or '' } end
		end
	end

	-- build installed name set and detect iStoreOS meta packages
	local installed = {}
	for _, p in ipairs(pkgs) do installed[p.name] = true end
	local meta_apps = {}
	for name,_ in pairs(installed) do
		local app = name:match('^app%-meta%-(.+)$')
		if app then meta_apps[app] = true end
	end
	-- 额外补充：即使 app-meta-* 当前不处于已安装状态，也从整个 status 文件中收集（用于历史安装来源识别）
	local function collect_meta_apps_from_status_any()
		local status_path = fs.stat('/usr/lib/opkg/status') and '/usr/lib/opkg/status' or (fs.stat('/var/lib/opkg/status') and '/var/lib/opkg/status' or nil)
		if not status_path then return end
		local s = fs.readfile(status_path)
		if not s or #s == 0 then return end
		local cur_meta_app
		for line in s:gmatch("[^\n\r]*") do
			local n = line:match('^Package:%s*(.+)$')
			if n then
				cur_meta_app = n:match('^app%-meta%-(.+)$')
				if cur_meta_app and #cur_meta_app > 0 then meta_apps[cur_meta_app] = true end
			end
			-- 如果是当前的 app-meta-* 记录，解析其 Depends，把所有 luci-app-* 加入映射
			if cur_meta_app then
				local deps = line:match('^Depends:%s*(.+)$')
				if deps and #deps > 0 then
					for dep in deps:gmatch('([^,%s]+)') do
						local app = dep:match('^luci%-app%-(.+)$')
						if app and #app > 0 then meta_apps[app] = true end
						-- 额外指定：socat 强制归类到 iStoreOS
						if dep == 'luci-app-socat' then meta_apps['socat'] = true end
					end
				end
			end
		end
	end
	pcall(collect_meta_apps_from_status_any)

	-- mark whether package looks like a LuCI app, and categorize by source
	for _, p in ipairs(pkgs) do
		p.is_app = (p.name and p.name:match('^luci%-app%-')) and true or false
		if p.is_app then
			local app = p.name:match('^luci%-app%-(.+)$')
			-- 优先规则：若由 app-meta-* 映射或强制指定，则归入 iStoreOS（覆盖之前的“手动安装”分类）
			if app and (meta_apps[app] or p.name == 'luci-app-socat') then
				p.category = 'iStoreOS插件类'
			elseif not p.category then
				p.category = '其他插件类'
			end
		end
	end
	-- 额外安全校验：有些包（例如 luci-app-ssr-plus）在特殊卸载流程后可能留下“幽灵记录”
	-- 这里以 `opkg list-installed` 为准，过滤掉不在实际已安装列表中的 LuCI 应用项
	do
		local out = sys.exec("opkg list-installed 2>/dev/null") or ''
		local installed_set = {}
		for line in (out or ''):gmatch('[^\n]+') do
			local n = line:match("^([^%s]+)%s+-%s+")
			if n and #n > 0 then installed_set[n] = true end
		end
		if next(installed_set) ~= nil then
			local filtered = {}
			for _, p in ipairs(pkgs) do
				if p.is_app then
					-- 仅对 LuCI 应用进行严格交叉校验
					if installed_set[p.name] then
						filtered[#filtered+1] = p
					end
				else
					-- 非 LuCI 应用保持原逻辑
					filtered[#filtered+1] = p
				end
			end
			pkgs = filtered
		end
	end
	-- de-duplicate by package name, prefer records with version and latest install_time
	local uniq = {}
	for _, p in ipairs(pkgs) do
		local exist = uniq[p.name]
		if not exist then
			uniq[p.name] = p
		else
			local function score(x)
				local s = (tonumber(x.install_time or 0) or 0)
				if x.version and #x.version > 0 then s = s + 1000000000 end
				return s
			end
			if score(p) > score(exist) then uniq[p.name] = p end
		end
	end
	local dedup = {}
	for _, v in pairs(uniq) do dedup[#dedup+1] = v end

	-- sort: latest install_time desc, then name asc
	local function cmp(a, b)
		local at = tonumber(a.install_time or 0) or 0
		local bt = tonumber(b.install_time or 0) or 0
		if at ~= bt then return at > bt end
		return (a.name or '') < (b.name or '')
	end
	table.sort(dedup, cmp)
	json_response({ packages = dedup, count = #dedup })
end

local function collect_conffiles(pkg)
	-- Try to get files list before uninstall
	local out = sys.exec(string.format("opkg files '%s' 2>/dev/null", pkg)) or ''
	local files = {}
	for line in out:gmatch("[^\n]+") do
		if line:match('^/[^%s]+') then
			files[#files+1] = line
		end
	end
	return files
end

-- 检查包是否仍处于已安装状态
local function is_installed(pkg)
	local status_path = fs.stat('/usr/lib/opkg/status') and '/usr/lib/opkg/status' or (fs.stat('/var/lib/opkg/status') and '/var/lib/opkg/status' or nil)
	if not status_path then return false end
	local s = fs.readfile(status_path)
	if not s or #s == 0 then return false end
	local name, installed
	for line in s:gmatch("[^\n\r]*") do
		local n = line:match("^Package:%s*(.+)$")
		if n then
			-- flush previous
			if name == pkg and installed then return true end
			name, installed = n, false
		end
		local st = line:match("^Status:%s*(.+)$")
		if st and st:match('installed') then installed = true end
	end
	return (name == pkg and installed) and true or false
end

-- 收集需要一起卸载的关联/依赖包
local function collect_related_packages(pkg)
	local related = {}
	local app = pkg:match('^luci%-app%-(.+)$')
	-- whatdepends: 反向依赖者列表
	local wd = sys.exec(string.format("opkg whatdepends '%s' 2>/dev/null", pkg)) or ''
	for line in wd:gmatch("[^\n]+") do
		local name = line:match("^%s*([^%s]+)%s*$")
		if name and name ~= pkg then related[#related+1] = name end
	end
	-- 基于模式的常见关联包
	if app then
		-- 语言包
		local status_path = fs.stat('/usr/lib/opkg/status') and '/usr/lib/opkg/status' or (fs.stat('/var/lib/opkg/status') and '/var/lib/opkg/status' or nil)
		if status_path then
			local s = fs.readfile(status_path) or ''
			for name in s:gmatch('Package:%s*(luci%-i18n%-' .. app .. '%-[%w%-%_]+)') do
				related[#related+1] = name
			end
		end
		-- meta 包和本体
		related[#related+1] = 'app-meta-' .. app
		related[#related+1] = app
	end
	-- 去重
	local seen, uniq = {}, {}
	for _, n in ipairs(related) do
		if n and not seen[n] then seen[n] = true; uniq[#uniq+1] = n end
	end
	return uniq
end

local function remove_confs(files)
	local removed = {}
	for _, f in ipairs(files or {}) do
		-- only remove under /etc to be safe
		if f:sub(1,5) == '/etc/' and fs.stat(f) then
			fs.remove(f)
			removed[#removed+1] = f
		end
		-- also remove any corresponding symlinks in /etc/rc.d
		if f:sub(1,12) == '/etc/init.d/' then
			local base = f:match('/etc/init.d/(.+)$')
			if base then
				local d = '/etc/rc.d'
				local h = fs.dir(d)
				if h then
					for n in h do
						if n:match(base) then
							local p = d .. '/' .. n
							if fs.lstat(p) then fs.remove(p) end
							removed[#removed+1] = p
						end
					end
				end
			end
		end
	end
	return removed
end

-- 强力清理：确保重新安装后是“全新未配置”状态
local function purge_everything(app)
	local removed = {}
	local function rm(p)
		local st = fs.stat(p)
		if st and st.type == 'reg' then fs.remove(p); removed[#removed+1] = p end
		if st and st.type == 'dir' then sys.call(string.format("rm -rf %q >/dev/null 2>&1", p)); removed[#removed+1] = p end
	end
	-- configs
	rm('/etc/config/' .. app)
	rm('/etc/config/luci-app-' .. app)
	-- init scripts and rc.d links
	rm('/etc/init.d/' .. app)
	local rd = '/etc/rc.d'
	local it = fs.dir(rd)
	if it then for n in it do if n:match(app) then rm(rd .. '/' .. n) end end end
	-- app specific dirs
	rm('/etc/' .. app)
	rm('/usr/share/' .. app)
	rm('/var/etc/' .. app)
	rm('/var/run/' .. app)
	rm('/run/' .. app)
	-- LuCI caches
	rm('/tmp/luci-indexcache')
	sys.call('rm -rf /tmp/luci-modulecache/* >/dev/null 2>&1')
	-- UCI runtime state
	local vs = '/var/state'
	local dit = fs.dir(vs)
	if dit then for n in dit do if n:match(app) then rm(vs .. '/' .. n) end end end
	return removed
end

-- 清理 iStore 相关的缓存和状态文件
local function clear_istore_state(pkg)
	local removed = {}
	-- 1) 从 /etc/istoreos/installed.list 文件中移除包名
	local installed_list_path = '/etc/istoreos/installed.list'
	if fs.stat(installed_list_path) then
		local content = fs.readfile(installed_list_path) or ''
		local lines = {}
		local modified = false
		-- 按行处理，保留空行和注释
		for line in content:gmatch('[^\n\r]*') do
			-- 匹配包名（忽略前导空格，忽略注释行）
			local name = line:match('^%s*([^%s#]+)')
			if name and name == pkg then
				modified = true
				-- 不添加这一行（移除包名）
			else
				-- 保留这一行（包括空行、注释等）
				lines[#lines+1] = line
			end
		end
		-- 如果有修改，重写文件
		if modified then
			-- 重建文件内容，保留原有的换行符
			local new_content = table.concat(lines, '\n')
			-- 如果原文件以换行符结尾，保持这个格式
			if content:match('\n%s*$') or content:match('\r\n%s*$') then
				if #new_content > 0 and not new_content:match('\n%s*$') then
					new_content = new_content .. '\n'
				end
			end
			local ok, err = pcall(function()
				-- 使用临时文件确保原子性写入
				local tmp_path = installed_list_path .. '.tmp'
				fs.writefile(tmp_path, new_content)
				sys.call(string.format("mv %q %q >/dev/null 2>&1", tmp_path, installed_list_path))
			end)
			if ok then
				removed[#removed+1] = installed_list_path .. ' (removed ' .. pkg .. ')'
			end
		end
	end
	
	-- 2) 清理 iStore 相关的缓存文件
	local istore_cache_paths = {
		'/tmp/istoreos_installed_response.txt',
		'/tmp/istore_cache',
		'/var/cache/istore',
	}
	for _, path in ipairs(istore_cache_paths) do
		if fs.stat(path) then
			if fs.stat(path).type == 'dir' then
				sys.call(string.format("rm -rf %q >/dev/null 2>&1", path))
			else
				fs.remove(path)
			end
			removed[#removed+1] = path
		end
	end
	-- 清理通配符匹配的缓存文件
	sys.call("rm -f /tmp/istore_*.json >/dev/null 2>&1")
	sys.call("rm -f /tmp/*istore*.cache >/dev/null 2>&1")
	sys.call("rm -f /var/cache/istore* >/dev/null 2>&1")
	
	-- 3) 清理 LuCI 缓存（确保 iStore 页面能刷新）
	sys.call('rm -f /tmp/luci-indexcache >/dev/null 2>&1')
	sys.call('rm -rf /tmp/luci-modulecache/* >/dev/null 2>&1')
	
	-- 4) 尝试触发 iStore 的缓存刷新（通过删除可能的缓存文件）
	-- iStore 可能缓存了已安装列表，需要清理
	local possible_istore_cache = {
		'/tmp/.istore_cache',
		'/tmp/istore_installed_cache',
		'/var/lib/istore/cache',
		'/var/cache/luci-istore',
	}
	for _, cache_path in ipairs(possible_istore_cache) do
		if fs.stat(cache_path) then
			if fs.stat(cache_path).type == 'dir' then
				sys.call(string.format("rm -rf %q >/dev/null 2>&1", cache_path))
			else
				fs.remove(cache_path)
			end
			removed[#removed+1] = cache_path
		end
	end
	
	return removed
end

local function clear_caches(app)
	local removed = {}
	-- 1) 清理 LuCI 相关缓存
	local luci_paths = {
		'/tmp/luci-indexcache',
		'/tmp/luci-modulecache'
	}
	for _, p in ipairs(luci_paths) do
		local st = fs.stat(p)
		if st then
			local cmd = st.type == 'dir' and string.format("rm -rf %q", p .. '/*') or string.format("rm -f %q", p)
			sys.call(cmd .. ' >/dev/null 2>&1')
			removed[#removed+1] = p
		end
	end
	-- 2) 清理 opkg 列表与缓存（不会影响系统正常使用）
	local opkg_paths = { '/tmp/opkg-lists', '/var/lib/opkg/lists', '/var/cache/opkg' }
	for _, d in ipairs(opkg_paths) do
		local st = fs.stat(d)
		if st and st.type == 'dir' then
			sys.call(string.format("rm -rf %q >/dev/null 2>&1", d .. '/*'))
			removed[#removed+1] = d
		end
	end
	-- 3) 清理 /tmp、/var/tmp、/var/run、/run 下命中 app 名称的项
	local dirs = { '/tmp', '/var/tmp', '/var/cache', '/var/run', '/run' }
	for _, d in ipairs(dirs) do
		local it = fs.dir(d)
		if it then
			for n in it do
				if n and (n:match(app) or n:match('^' .. (app or '') .. '[-_]?')) then
					local p = d .. '/' .. n
					local st = fs.stat(p)
					if st then
						sys.call(string.format("rm -rf %q >/dev/null 2>&1", p))
						removed[#removed+1] = p
					end
				end
			end
		end
	end
	return removed
end

function action_remove()
	-- 优先从表单获取参数，避免读取原始内容后导致表单解析失效
	local pkg = http.formvalue('package')
	local purge = (http.formvalue('purge') == '1')
	local remove_deps = (http.formvalue('removeDeps') == '1')
	local clear_cache = (http.formvalue('clearCache') == '1')
	
	-- 如果表单中没有 package，尝试从 URL 查询参数获取
	if (not pkg or pkg == '') then
		local query = http.getenv('QUERY_STRING') or ''
		if query and #query > 0 then
			for pair in query:gmatch('([^&]+)') do
				local key, val = pair:match('([^=]+)=?(.*)')
				if key == 'package' then
					pkg = val
				elseif key == 'purge' then
					purge = (val == '1')
				elseif key == 'removeDeps' then
					remove_deps = (val == '1')
				elseif key == 'clearCache' then
					clear_cache = (val == '1')
				end
			end
		end
	end
	
	-- 若表单未提供，则尝试解析 JSON 请求体
	if (not pkg or pkg == '') then
		local body = http.content() or ''
		if body and #body > 0 then
			-- 尝试解析 JSON
			local ok, data = pcall(json.parse, body)
			if ok and data then
				pkg = data.package or pkg
				if data.purge ~= nil then purge = data.purge and true or false end
				if data.removeDeps ~= nil then remove_deps = data.removeDeps and true or false end
				if data.clearCache ~= nil then clear_cache = data.clearCache and true or false end
			else
				-- 尝试解析 URL 编码的表单数据（application/x-www-form-urlencoded）
				for key, val in body:gmatch('([^&=]+)=([^&]*)') do
					key = key:gsub('+', ' '):gsub('%%(%x%x)', function(h) return string.char(tonumber(h, 16)) end)
					val = val:gsub('+', ' '):gsub('%%(%x%x)', function(h) return string.char(tonumber(h, 16)) end)
					if key == 'package' then
						pkg = val
					elseif key == 'purge' then
						purge = (val == '1')
					elseif key == 'removeDeps' then
						remove_deps = (val == '1')
					elseif key == 'clearCache' then
						clear_cache = (val == '1')
					end
				end
			end
		end
	end

	if not pkg or pkg == '' then
		return json_response({ ok = false, message = 'Missing package' }, 400)
	end

	local function append_log(buf, line)
		buf[#buf+1] = line
	end

	-- If uninstalling PassWall, perform thorough cleanup mirroring the provided script
	if pkg == 'luci-app-passwall' or pkg == 'passwall' then
		local log = {}
		append_log(log, '=== PassWall 卸载流程开始 ===')

		-- [1/6] 停止并禁用服务
		if fs.access('/etc/init.d/passwall') then
			append_log(log, '+ /etc/init.d/passwall stop')
			sys.call('/etc/init.d/passwall stop >/dev/null 2>&1')
			append_log(log, '+ /etc/init.d/passwall disable')
			sys.call('/etc/init.d/passwall disable >/dev/null 2>&1')
		end

		-- [2/6] 卸载包
		append_log(log, '+ opkg update')
		sys.call('opkg update >/dev/null 2>&1')
		append_log(log, '+ opkg remove luci-i18n-passwall-zh-cn')
		sys.call("opkg remove luci-i18n-passwall-zh-cn >/dev/null 2>&1")
		append_log(log, '+ opkg remove luci-app-passwall')
		sys.call("opkg remove luci-app-passwall >/dev/null 2>&1")
		append_log(log, '+ opkg autoremove')
		sys.call("opkg autoremove >/dev/null 2>&1")

		-- [3/6] 删除配置与残留文件（不可逆）
		local function rm(cmd)
			append_log(log, '+ ' .. cmd)
			sys.call(cmd .. ' >/dev/null 2>&1')
		end
		if purge then
			rm('rm -f /etc/config/passwall')
		else
			append_log(log, '# 已根据用户选择保留 PassWall 配置文件')
		end
		rm('rm -f /usr/lib/lua/luci/controller/passwall.lua')
		rm('rm -rf /usr/lib/lua/luci/controller/passwall')
		rm('rm -rf /usr/lib/lua/luci/model/cbi/passwall')
		rm('rm -rf /usr/lib/lua/luci/view/passwall')
		rm('rm -rf /usr/share/passwall')
		rm('rm -rf /usr/share/passwall2')
		rm("rm -f /usr/bin/passwall*")
		rm("rm -f /usr/sbin/passwall*")
		rm('rm -f /etc/init.d/passwall')
		rm("find /etc/rc.d -maxdepth 1 -type l -name '*passwall*' -exec rm -f {} +")
		rm("rm -f /etc/uci-defaults/*passwall*")
		rm("find /etc/hotplug.d -type f -name '*passwall*' -exec rm -f {} +")
		rm('rm -rf /tmp/passwall* /var/run/passwall* /var/log/passwall*')

		-- [4/6] 移除可能的计划任务
		if fs.access('/etc/crontabs/root') then
			append_log(log, "+ sed -i '/passwall/d' /etc/crontabs/root")
			sys.call("sed -i '/passwall/d' /etc/crontabs/root >/dev/null 2>&1")
			append_log(log, '+ /etc/init.d/cron reload')
			sys.call('/etc/init.d/cron reload >/dev/null 2>&1')
		end

		-- [5/6] 刷新 LuCI 缓存并重载 Web/防火墙
		rm('rm -f /tmp/luci-indexcache')
		rm('rm -rf /tmp/luci-modulecache/*')
		-- luci-reload 如果可用
		sys.call('command -v luci-reload >/dev/null 2>&1 && luci-reload')
		-- 重载常见服务
		sys.call('[ -x /etc/init.d/uhttpd ] && /etc/init.d/uhttpd reload >/dev/null 2>&1')
		sys.call('[ -x /etc/init.d/nginx ] && /etc/init.d/nginx reload >/dev/null 2>&1')
		sys.call('[ -x /etc/init.d/firewall ] && /etc/init.d/firewall reload >/dev/null 2>&1')

		-- [6/6] sync
		append_log(log, '+ sync')
		sys.call('sync >/dev/null 2>&1')

		return json_response({ ok = true, message = table.concat(log, "\n") })
	end

	-- If uninstalling OpenClash, perform thorough cleanup based on reference script
	if pkg == 'luci-app-openclash' or pkg == 'openclash' then
		local log = {}
		append_log(log, '=== OpenClash 卸载流程开始（无残留） ===')

		-- [1/6] 停止并禁用服务
		if fs.access('/etc/init.d/openclash') then
			append_log(log, '+ /etc/init.d/openclash stop')
			sys.call('/etc/init.d/openclash stop >/dev/null 2>&1')
			append_log(log, '+ /etc/init.d/openclash disable')
			sys.call('/etc/init.d/openclash disable >/dev/null 2>&1')
		end

		-- [2/6] 卸载包
		append_log(log, '+ opkg update')
		sys.call('opkg update >/dev/null 2>&1')
		append_log(log, '+ opkg remove luci-i18n-openclash-zh-cn')
		sys.call("opkg remove luci-i18n-openclash-zh-cn >/dev/null 2>&1")
		append_log(log, '+ opkg remove luci-app-openclash')
		sys.call("opkg remove luci-app-openclash >/dev/null 2>&1")
		append_log(log, '+ opkg autoremove')
		sys.call("opkg autoremove >/dev/null 2>&1")

		-- [3/6] 删除配置与残留文件（不可逆）
		local function rm(cmd)
			append_log(log, '+ ' .. cmd)
			sys.call(cmd .. ' >/dev/null 2>&1')
		end
		if purge then
			rm('rm -rf /etc/openclash')
			rm('rm -f /etc/config/openclash')
		else
			append_log(log, '# 已根据用户选择保留 OpenClash 配置文件')
		end
		rm('rm -f /usr/lib/lua/luci/controller/openclash.lua')
		rm('rm -rf /usr/lib/lua/luci/controller/openclash')
		rm('rm -rf /usr/lib/lua/luci/model/cbi/openclash')
		rm('rm -rf /usr/lib/lua/luci/view/openclash')
		rm('rm -rf /usr/share/openclash')
		rm('rm -f /usr/bin/clash')
		rm('rm -f /etc/init.d/openclash')
		rm("find /etc/rc.d -maxdepth 1 -type l -name '*openclash*' -exec rm -f {} +")
		rm("rm -f /etc/uci-defaults/*openclash*")
		rm("find /etc/hotplug.d -type f -name '*openclash*' -exec rm -f {} +")
		rm('rm -rf /tmp/openclash* /var/run/openclash*')

		-- [4/6] 移除可能的计划任务
		if fs.access('/etc/crontabs/root') then
			append_log(log, "+ sed -i '/openclash/d' /etc/crontabs/root")
			sys.call("sed -i '/openclash/d' /etc/crontabs/root >/dev/null 2>&1")
			append_log(log, '+ /etc/init.d/cron reload')
			sys.call('/etc/init.d/cron reload >/dev/null 2>&1')
		end

		-- [5/6] 刷新 LuCI 缓存并重载 Web/防火墙
		rm('rm -f /tmp/luci-indexcache')
		rm('rm -rf /tmp/luci-modulecache/*')
		sys.call('command -v luci-reload >/dev/null 2>&1 && luci-reload')
		sys.call('[ -x /etc/init.d/uhttpd ] && /etc/init.d/uhttpd reload >/dev/null 2>&1')
		sys.call('[ -x /etc/init.d/nginx ] && /etc/init.d/nginx reload >/dev/null 2>&1')
		sys.call('[ -x /etc/init.d/firewall ] && /etc/init.d/firewall reload >/dev/null 2>&1')

		-- [6/6] sync
		append_log(log, '+ sync')
		sys.call('sync >/dev/null 2>&1')

		-- 清理 iStore 记录及缓存
		local removed_istore = clear_istore_state('luci-app-openclash')
		for _, item in ipairs(removed_istore or {}) do
			append_log(log, '+ cleared: ' .. item)
		end

		return json_response({
			ok = true,
			message = table.concat(log, "\n"),
			removed_istore = removed_istore
		})
	end

	-- 通用卸载逻辑（保留原行为）
	local files
	if purge then
		files = collect_conffiles(pkg)
	end

	-- 在卸载前收集所有相关的包名（用于后续清理 iStore 状态）
	local related_pkgs_for_istore = { pkg }
	local app = pkg:match('^luci%-app%-(.+)$')
	if app then
		-- 添加 app-meta-* 包
		related_pkgs_for_istore[#related_pkgs_for_istore+1] = 'app-meta-' .. app
		
		-- 收集语言包
		local status_path = fs.stat('/usr/lib/opkg/status') and '/usr/lib/opkg/status' or (fs.stat('/var/lib/opkg/status') and '/var/lib/opkg/status' or nil)
		if status_path then
			local s = fs.readfile(status_path) or ''
			for name in s:gmatch('Package:%s*(luci%-i18n%-' .. app .. '%-[%w%-%_]+)') do
				if is_installed(name) then
					related_pkgs_for_istore[#related_pkgs_for_istore+1] = name
				end
			end
		end
	end

	-- 尝试停止 init 脚本（兼容 luci-app- 前缀）
	sys.call(string.format("/etc/init.d/%q stop >/dev/null 2>&1", pkg))
	if app then
		sys.call(string.format("/etc/init.d/%q stop >/dev/null 2>&1", app))
	end
	
	-- 对于 luci-app-* 包，先尝试移除相关的语言包和 meta 包（避免 autoremove 时 prerm 失败）
	-- 使用与用户成功的命令相同的格式：opkg --force-removal-of-dependent-packages --autoremove remove [package]
	-- 注意：不需要预防性移除，因为用户成功的命令已经能处理依赖关系
	-- 注释掉预防性移除，直接使用用户成功的命令格式
	--[[
	if app then
		local status_path = fs.stat('/usr/lib/opkg/status') and '/usr/lib/opkg/status' or (fs.stat('/var/lib/opkg/status') and '/var/lib/opkg/status' or nil)
		if status_path then
			local s = fs.readfile(status_path) or ''
			-- 先移除 app-meta-* 包（如果存在）
			local meta_pkg = 'app-meta-' .. app
			if is_installed(meta_pkg) then
				sys.call(string.format("opkg --force-removal-of-dependent-packages --autoremove remove '%s' >/dev/null 2>&1", meta_pkg))
			end
			-- 再移除语言包
			for name in s:gmatch('Package:%s*(luci%-i18n%-' .. app .. '%-[%w%-%_]+)') do
				if is_installed(name) then
					sys.call(string.format("opkg --force-removal-of-dependent-packages --autoremove remove '%s' >/dev/null 2>&1", name))
				end
			end
		end
	end
	--]]

	-- 卸载包（依据退出码判断成功）
	local tmpout = '/tmp/opkg-remove-output.txt'
	local function run_remove(cmd)
		local rc = sys.call(cmd)
		local out = fs.readfile(tmpout) or ''
		return rc, out
	end
	
	-- 检测输出中是否包含 prerm 脚本失败的错误
	local function detect_prerm_failure(output)
		if not output then return false end
		local lower_output = output:lower()
		-- 检测各种 prerm 脚本失败的错误模式
		return lower_output:match('prerm script failed') ~= nil or
		       lower_output:match('prerm.*failed') ~= nil or
		       lower_output:match('failed prerm scripts') ~= nil or
		       lower_output:match('pkg_run_script.*failed') ~= nil or
		       lower_output:match('opkg_remove_pkg.*prerm script failed') ~= nil or
		       lower_output:match('not removing package.*prerm script failed') ~= nil or
		       output:match('--force%-remove') ~= nil or  -- 如果输出提示使用 --force-remove
		       lower_output:match('no packages removed') ~= nil  -- 如果没有包被移除，可能是 prerm 失败
	end
	
	-- 从输出中提取失败的包名（用于后续强制移除）
	local function extract_failed_packages(output)
		local failed = {}
		if not output then return failed end
		-- 匹配模式：not removing package "package-name", prerm script failed
		for pkg_name in output:gmatch('not removing package "([^"]+)"') do
			failed[#failed+1] = pkg_name
		end
		-- 匹配模式：opkg_remove_pkg: not removing package "package-name", prerm script failed
		for pkg_name in output:gmatch('opkg_remove_pkg: not removing package "([^"]+)"') do
			failed[#failed+1] = pkg_name
		end
		return failed
	end
	
	-- 对于 luci-app-* 包，使用与用户成功的命令相同的格式
	-- 用户成功的命令：opkg --force-removal-of-dependent-packages --autoremove remove luci-app-ubuntu2
	-- 注意：选项顺序和位置很重要，--force-removal-of-dependent-packages 和 --autoremove 应该作为全局选项
	local cmd
	local is_app = pkg:match('^luci%-app%-.+') ~= nil
	if is_app then
		-- 对于 luci-app，使用用户成功的命令格式（全局选项在前，remove 命令在后）
		-- 如果 prerm 脚本失败，再尝试添加 --force-remove
		cmd = string.format("opkg --force-removal-of-dependent-packages --autoremove remove '%s' >%s 2>&1", pkg, tmpout)
	else
		-- 对于非 luci-app 包，正常卸载
		cmd = string.format("opkg remove --autoremove '%s' >%s 2>&1", pkg, tmpout)
	end
	local rc, output = run_remove(cmd)
	local success = (rc == 0) or (not is_installed(pkg))
	
	-- 检测 prerm 脚本失败
	local prerm_failed = detect_prerm_failure(output)
	local no_packages_removed = output:lower():match('no packages removed') ~= nil
	
	-- 如果检测到 "No packages removed" 和 prerm 失败，说明有 orphaned 包的 prerm 脚本失败导致整个操作失败
	-- 这种情况下，我们需要先单独强制移除有问题的包，然后再移除主包
	if (not success) and prerm_failed and no_packages_removed then
		local failed_pkgs = extract_failed_packages(output)
		-- 先强制移除所有失败的包（通常是语言包）- 使用所有强制选项
		for _, failed_pkg in ipairs(failed_pkgs) do
			if is_installed(failed_pkg) then
				output = (output or '') .. "\n[force-remove-failed] Attempting to force remove: " .. failed_pkg
				local force_cmd = string.format("opkg remove --force-depends --force-removal-of-dependent-packages --force-remove '%s' >%s 2>&1", failed_pkg, tmpout)
				local force_rc, force_out = run_remove(force_cmd)
				output = (output or '') .. "\n[force-remove-failed] " .. (force_out or '')
				-- 即使失败也继续，因为可能包已经不存在了
			end
		end
		
		-- 强制移除所有相关的语言包和 meta 包（预防性）- 使用之前收集的包列表
		for _, related_pkg in ipairs(related_pkgs_for_istore) do
			-- 只处理语言包和 meta 包，跳过主包（主包稍后处理）
			if related_pkg ~= pkg and (related_pkg:match('^luci%-i18n%-') or related_pkg:match('^app%-meta%-')) then
				if is_installed(related_pkg) then
					output = (output or '') .. "\n[force-remove-related] Attempting to force remove: " .. related_pkg
					local force_cmd = string.format("opkg remove --force-depends --force-removal-of-dependent-packages --force-remove '%s' >%s 2>&1", related_pkg, tmpout)
					local force_rc, force_out = run_remove(force_cmd)
					output = (output or '') .. "\n[force-remove-related] " .. (force_out or '')
				end
			end
		end
		
		-- 现在再次尝试移除主包（使用用户成功的命令格式）
		local retry_cmd = string.format("opkg --force-removal-of-dependent-packages --autoremove remove '%s' >%s 2>&1", pkg, tmpout)
		rc, local_output = run_remove(retry_cmd)
		output = (output or '') .. "\n[retry-main] " .. (local_output or '')
		success = (rc == 0) or (not is_installed(pkg))
		
		-- 如果还是失败且是 luci-app，尝试添加 --force-remove（处理 prerm 脚本失败）
		if not success and is_app then
			retry_cmd = string.format("opkg --force-removal-of-dependent-packages --autoremove --force-remove remove '%s' >%s 2>&1", pkg, tmpout)
			rc, local_output = run_remove(retry_cmd)
			output = (output or '') .. "\n[retry-force] " .. (local_output or '')
			success = (rc == 0) or (not is_installed(pkg))
		end
		
		-- 最后运行 autoremove 清理剩余的 orphaned 包
		if success then
			sys.call('opkg autoremove >/dev/null 2>&1')
		end
	end
	
	-- 若提示依赖阻塞，则强制卸载（仅针对 luci-app-*）。若选择"同时卸载相关依赖"，按强制策略处理。
	if (not success) and not no_packages_removed then
		local dependent_warn = output:lower():match('dependent') or output:match('print_dependents_warning')
		if is_app and (dependent_warn or remove_deps) then
			-- 使用用户成功的命令格式
			local force_cmd = string.format("opkg --force-removal-of-dependent-packages --autoremove remove '%s' >%s 2>&1", pkg, tmpout)
			rc, local_output = run_remove(force_cmd)
			output = (output or '') .. "\n[force-deps] " .. (local_output or '')
			success = (rc == 0) or (not is_installed(pkg))
			prerm_failed = detect_prerm_failure(local_output) or prerm_failed
			
			-- 如果还是失败，尝试添加 --force-remove（处理 prerm 脚本失败）
			if not success and prerm_failed then
				force_cmd = string.format("opkg --force-removal-of-dependent-packages --autoremove --force-remove remove '%s' >%s 2>&1", pkg, tmpout)
				rc, local_output = run_remove(force_cmd)
				output = (output or '') .. "\n[force-deps-force] " .. (local_output or '')
				success = (rc == 0) or (not is_installed(pkg))
			end
		end
	end
	
	-- 如果检测到 prerm 脚本失败但还没有处理，使用用户成功的命令格式
	if (not success) and prerm_failed and not no_packages_removed then
		if is_app then
			-- 对于 luci-app，使用用户成功的命令格式，然后尝试添加 --force-remove
			local force_remove_cmd = string.format("opkg --force-removal-of-dependent-packages --autoremove remove '%s' >%s 2>&1", pkg, tmpout)
			rc, local_output = run_remove(force_remove_cmd)
			output = (output or '') .. "\n[force-all] " .. (local_output or '')
			success = (rc == 0) or (not is_installed(pkg))
			
			-- 如果还是失败，尝试添加 --force-remove
			if not success then
				force_remove_cmd = string.format("opkg --force-removal-of-dependent-packages --autoremove --force-remove remove '%s' >%s 2>&1", pkg, tmpout)
				rc, local_output = run_remove(force_remove_cmd)
				output = (output or '') .. "\n[force-all-force] " .. (local_output or '')
				success = (rc == 0) or (not is_installed(pkg))
			end
		else
			-- 对于非 luci-app 包，只使用 --force-remove
			local force_remove_cmd = string.format("opkg remove --autoremove --force-remove '%s' >%s 2>&1", pkg, tmpout)
			rc, local_output = run_remove(force_remove_cmd)
			output = (output or '') .. "\n[force-remove] " .. (local_output or '')
			success = (rc == 0) or (not is_installed(pkg))
		end
	end
	
	-- 若选择同时卸载依赖且目标包已卸载成功，则继续卸载关联包
	if success and remove_deps then
		local rel = collect_related_packages(pkg)
		for _, name in ipairs(rel) do
			if is_installed(name) then
				-- 先尝试正常卸载
				local cmd2 = string.format("opkg remove --autoremove '%s' >%s 2>&1", name, tmpout)
				local rc2, out2 = run_remove(cmd2)
				local dep_success = (rc2 == 0) or (not is_installed(name))
				-- 如果失败，尝试强制卸载
				if not dep_success then
					local dep_prerm_failed = detect_prerm_failure(out2)
					if dep_prerm_failed then
						-- prerm 脚本失败，使用 --force-remove
						cmd2 = string.format("opkg remove --autoremove --force-remove '%s' >%s 2>&1", name, tmpout)
						rc2, out2 = run_remove(cmd2)
						dep_success = (rc2 == 0) or (not is_installed(name))
					end
					-- 如果还是失败，尝试所有强制选项
					if not dep_success then
						cmd2 = string.format("opkg remove --autoremove --force-depends --force-removal-of-dependent-packages --force-remove '%s' >%s 2>&1", name, tmpout)
						rc2, out2 = run_remove(cmd2)
						dep_success = (rc2 == 0) or (not is_installed(name))
					end
				end
				output = (output or '') .. "\n[dep] " .. (out2 or '')
			end
		end
	end
	-- 自动清理未使用依赖
	sys.call('opkg autoremove >/dev/null 2>&1')

	-- 清理 iStore 相关状态（如果卸载成功，或者包真的不在系统中了）
	-- 注意：即使 opkg 返回错误，只要包真的从系统中移除了，就应该清理 iStore 状态
	local removed_istore = {}
	local actually_removed = (not is_installed(pkg))  -- 检查包是否真的不在系统中了
	if success or actually_removed then
		-- 清理所有相关的包（包括主包、app-meta-*, luci-i18n-* 等）
		for _, related_pkg in ipairs(related_pkgs_for_istore) do
			-- 检查包是否真的不在系统中了
			if not is_installed(related_pkg) then
				local pkg_removed = clear_istore_state(related_pkg)
				for _, item in ipairs(pkg_removed) do
					removed_istore[#removed_istore+1] = item
				end
			end
		end
		
		-- 如果主包真的被移除了，更新 success 状态
		if actually_removed and not success then
			success = true
			output = (output or '') .. "\n[note] Package was actually removed from system, updating status"
		end
		
		-- 重载 web 服务器以确保 iStore 页面刷新
		sys.call('[ -x /etc/init.d/uhttpd ] && /etc/init.d/uhttpd reload >/dev/null 2>&1')
		sys.call('[ -x /etc/init.d/nginx ] && /etc/init.d/nginx reload >/dev/null 2>&1')
		
		-- 强制清理 iStore 可能使用的所有缓存
		-- 包括可能的 opkg status 缓存
		sys.call('rm -f /tmp/istoreos_installed_response.txt >/dev/null 2>&1')
		sys.call('rm -f /tmp/istore_*.json >/dev/null 2>&1')
		sys.call('rm -f /tmp/*istore*.cache >/dev/null 2>&1')
		sys.call('rm -rf /var/cache/istore* >/dev/null 2>&1')
	end

	local removed_caches = {}
	if success and clear_cache then
		local appname = pkg:match('^luci%-app%-(.+)$') or pkg
		removed_caches = clear_caches(appname)
	end

	local removed_confs = {}
	local removed_force = {}
	if purge then
		removed_confs = remove_confs(files)
		-- also remove common config and symlinks by app name
		local appname = pkg:match('^luci%-app%-(.+)$') or pkg
		removed_force = purge_everything(appname)
	end

	json_response({
		ok = success,
		message = output or '',
		removed_configs = removed_confs,
		removed_caches = removed_caches,
		removed_force = removed_force,
		removed_istore = removed_istore
	})
end

-- 上报图标问题
function action_report_icon()
	local pkg_name = nil
	local user_comment = ''
	
	-- 方法1: 尝试从表单获取
	pkg_name = http.formvalue('package')
	user_comment = http.formvalue('comment') or ''
	
	-- 方法2: 如果表单为空,尝试从 URL 参数获取
	if not pkg_name or pkg_name == '' then
		local params = http.formvalue()
		if params and type(params) == 'table' then
			pkg_name = params.package or params['package']
			user_comment = params.comment or params['comment'] or ''
		end
	end
	
	-- 方法3: 尝试解析 JSON 请求体
	if not pkg_name or pkg_name == '' then
		local body = http.content() or ''
		if body and #body > 0 then
			-- 尝试解析 JSON
			local ok, data = pcall(json.parse, body)
			if ok and data and type(data) == 'table' then
				pkg_name = data.package or pkg_name
				user_comment = data.comment or user_comment or ''
			else
				-- 尝试解析 URL 编码的表单数据
				for k, v in body:gmatch('([^&=]+)=([^&]*)') do
					if k == 'package' then
						pkg_name = v:gsub('+', ' '):gsub('%%(%x%x)', function(h)
							return string.char(tonumber(h, 16))
						end)
					elseif k == 'comment' then
						user_comment = v:gsub('+', ' '):gsub('%%(%x%x)', function(h)
							return string.char(tonumber(h, 16))
						end)
					end
				end
			end
		end
	end
	
	-- 调试信息：记录接收到的参数
	local debug_info = string.format(
		"[REPORT_ICON] package=%s, comment=%s, content_type=%s, method=%s",
		tostring(pkg_name or 'nil'),
		tostring(user_comment or 'nil'),
		tostring(http.getenv('CONTENT_TYPE') or 'nil'),
		tostring(http.getenv('REQUEST_METHOD') or 'nil')
	)
	sys.exec("logger -t luci-app-uninstall '" .. debug_info .. "'")
	
	if not pkg_name or pkg_name == '' then
		return json_response({ ok = false, message = '缺少包名参数' }, 400)
	end
	
	-- 构建上报数据
	local report_data = {
		package = pkg_name,
		comment = user_comment,
		type = 'icon',  -- 标记为图标问题
		timestamp = os.time(),
		device_info = {
			hostname = sys.hostname() or '',
			model = sys.exec('uname -m 2>/dev/null'):gsub('%s+$','') or '',
			system = sys.exec('uname -s 2>/dev/null'):gsub('%s+$','') or ''
		}
	}
	
	-- 发送到后台服务器
	local report_url = 'https://tb.vumstar.com/report.php'
	local json_data = json.stringify(report_data)
	local tmpfile = '/tmp/icon_report_data.json'
	
	-- 写入临时文件
	local f = io.open(tmpfile, 'w')
	if f then
		f:write(json_data)
		f:close()
	else
		return json_response({ ok = false, message = '无法创建临时文件' }, 500)
	end
	
	-- 尝试使用 curl/wget/uclient-fetch 发送请求
	local success = false
	local response = ''
	
	-- 优先使用 curl (支持 POST JSON 并获取 HTTP 状态码)
	local curl_cmd = string.format(
		"curl -w '\\nHTTP_CODE:%%{http_code}' -X POST -H 'Content-Type: application/json' -d @%q '%s' 2>&1",
		tmpfile, report_url
	)
	local rc = sys.call(curl_cmd .. ' >/tmp/icon_report_response.txt 2>&1')
	
	-- 读取响应
	response = fs.readfile('/tmp/icon_report_response.txt') or ''
	
	-- 提取 HTTP 状态码
	local http_code = response:match('HTTP_CODE:(%d+)')
	
	-- 记录详细日志
	local log_msg = string.format(
		"[REPORT_ICON] curl_rc=%d, http_code=%s, response_len=%d",
		rc, tostring(http_code or 'nil'), #response
	)
	sys.exec("logger -t luci-app-uninstall '" .. log_msg .. "'")
	
	-- 判断是否成功: curl 返回码为0 且 HTTP状态码为 2xx
	if rc == 0 and http_code and tonumber(http_code) >= 200 and tonumber(http_code) < 300 then
		success = true
		-- 移除状态码行，只保留响应体
		response = response:gsub('\nHTTP_CODE:%d+$', '')
	else
		-- 如果 curl 失败，尝试 wget
		local wget_cmd = string.format(
			"wget --post-file=%q --header='Content-Type: application/json' -O /tmp/icon_report_response.txt '%s' 2>&1",
			tmpfile, report_url
		)
		rc = sys.call(wget_cmd .. ' >/tmp/wget_output.txt 2>&1')
		
		if rc == 0 then
			response = fs.readfile('/tmp/icon_report_response.txt') or ''
			-- wget 成功下载表示 HTTP 请求成功
			if #response > 0 then
				success = true
				sys.exec("logger -t luci-app-uninstall '[REPORT_ICON] wget success, response_len=" .. #response .. "'")
			end
		else
			-- 最后尝试 uclient-fetch
			local uclient_cmd = string.format(
				"uclient-fetch --post-file=%q -O /tmp/icon_report_response.txt '%s' 2>&1",
				tmpfile, report_url
			)
			rc = sys.call(uclient_cmd .. ' >/tmp/uclient_output.txt 2>&1')
			
			if rc == 0 then
				response = fs.readfile('/tmp/icon_report_response.txt') or ''
				if #response > 0 then
					success = true
					sys.exec("logger -t luci-app-uninstall '[REPORT_ICON] uclient success, response_len=" .. #response .. "'")
				end
			end
		end
	end
	
	-- 保留临时文件用于调试 (可选，调试完成后可删除)
	-- sys.call('rm -f ' .. tmpfile .. ' /tmp/icon_report_response.txt /tmp/wget_output.txt /tmp/uclient_output.txt')
	
	if success then
		-- 尝试解析服务器响应，验证是否真的成功
		local server_ok = false
		local ok_result, server_data = pcall(json.parse, response)
		if ok_result and server_data and type(server_data) == 'table' then
			server_ok = server_data.ok or server_data.success
		end
		
		-- 记录服务器响应
		sys.exec("logger -t luci-app-uninstall '[REPORT_ICON] server_ok=" .. tostring(server_ok) .. ", response=" .. response:sub(1, 200) .. "'")
		
		return json_response({ 
			ok = true, 
			message = '图标问题已成功上报,感谢您的反馈!',
			package = pkg_name,
			debug = {
				http_code = http_code,
				server_response = server_ok
			}
		})
	else
		-- 记录失败详情
		sys.exec("logger -t luci-app-uninstall '[REPORT_ICON] FAILED: " .. response:sub(1, 200) .. "'")
		
		return json_response({ 
			ok = false, 
			message = '上报失败,请检查网络连接或服务器状态',
			details = response:sub(1, 500),  -- 限制错误信息长度
			http_code = http_code
		}, 500)
	end
end

-- 上报卸载问题
function action_report_uninstall()
	local pkg_name = nil
	local user_comment = ''
	
	-- 方法1: 尝试从表单获取
	pkg_name = http.formvalue('package')
	user_comment = http.formvalue('comment') or ''
	
	-- 方法2: 如果表单为空,尝试从 URL 参数获取
	if not pkg_name or pkg_name == '' then
		local params = http.formvalue()
		if params and type(params) == 'table' then
			pkg_name = params.package or params['package']
			user_comment = params.comment or params['comment'] or ''
		end
	end
	
	-- 方法3: 尝试解析 JSON 请求体
	if not pkg_name or pkg_name == '' then
		local body = http.content() or ''
		if body and #body > 0 then
			-- 尝试解析 JSON
			local ok, data = pcall(json.parse, body)
			if ok and data and type(data) == 'table' then
				pkg_name = data.package or pkg_name
				user_comment = data.comment or user_comment or ''
			else
				-- 尝试解析 URL 编码的表单数据
				for k, v in body:gmatch('([^&=]+)=([^&]*)') do
					if k == 'package' then
						pkg_name = v:gsub('+', ' '):gsub('%%(%x%x)', function(h)
							return string.char(tonumber(h, 16))
						end)
					elseif k == 'comment' then
						user_comment = v:gsub('+', ' '):gsub('%%(%x%x)', function(h)
							return string.char(tonumber(h, 16))
						end)
					end
				end
			end
		end
	end
	
	-- 调试信息：记录接收到的参数
	local debug_info = string.format(
		"[REPORT_UNINSTALL] package=%s, comment=%s, content_type=%s, method=%s",
		tostring(pkg_name or 'nil'),
		tostring(user_comment or 'nil'),
		tostring(http.getenv('CONTENT_TYPE') or 'nil'),
		tostring(http.getenv('REQUEST_METHOD') or 'nil')
	)
	sys.exec("logger -t luci-app-uninstall '" .. debug_info .. "'")
	
	if not pkg_name or pkg_name == '' then
		return json_response({ ok = false, message = '缺少包名参数' }, 400)
	end
	
	-- 构建上报数据
	local report_data = {
		package = pkg_name,
		comment = user_comment,
		type = 'uninstall',  -- 标记为卸载问题
		timestamp = os.time(),
		device_info = {
			hostname = sys.hostname() or '',
			model = sys.exec('uname -m 2>/dev/null'):gsub('%s+$','') or '',
			system = sys.exec('uname -s 2>/dev/null'):gsub('%s+$','') or ''
		}
	}
	
	-- 发送到后台服务器
	local report_url = 'https://tb.vumstar.com/report.php'
	local json_data = json.stringify(report_data)
	local tmpfile = '/tmp/uninstall_report_data.json'
	
	-- 写入临时文件
	local f = io.open(tmpfile, 'w')
	if f then
		f:write(json_data)
		f:close()
	else
		return json_response({ ok = false, message = '无法创建临时文件' }, 500)
	end
	
	-- 尝试使用 curl/wget/uclient-fetch 发送请求
	local success = false
	local response = ''
	
	-- 优先使用 curl (支持 POST JSON 并获取 HTTP 状态码)
	local curl_cmd = string.format(
		"curl -w '\\nHTTP_CODE:%%{http_code}' -X POST -H 'Content-Type: application/json' -d @%q '%s' 2>&1",
		tmpfile, report_url
	)
	local rc = sys.call(curl_cmd .. ' >/tmp/uninstall_report_response.txt 2>&1')
	
	-- 读取响应
	response = fs.readfile('/tmp/uninstall_report_response.txt') or ''
	
	-- 提取 HTTP 状态码
	local http_code = response:match('HTTP_CODE:(%d+)')
	
	-- 记录详细日志
	local log_msg = string.format(
		"[REPORT_UNINSTALL] curl_rc=%d, http_code=%s, response_len=%d",
		rc, tostring(http_code or 'nil'), #response
	)
	sys.exec("logger -t luci-app-uninstall '" .. log_msg .. "'")
	
	-- 判断是否成功: curl 返回码为0 且 HTTP状态码为 2xx
	if rc == 0 and http_code and tonumber(http_code) >= 200 and tonumber(http_code) < 300 then
		success = true
		-- 移除状态码行，只保留响应体
		response = response:gsub('\nHTTP_CODE:%d+$', '')
	else
		-- 如果 curl 失败，尝试 wget
		local wget_cmd = string.format(
			"wget --post-file=%q --header='Content-Type: application/json' -O /tmp/uninstall_report_response.txt '%s' 2>&1",
			tmpfile, report_url
		)
		rc = sys.call(wget_cmd .. ' >/tmp/wget_output.txt 2>&1')
		
		if rc == 0 then
			response = fs.readfile('/tmp/uninstall_report_response.txt') or ''
			-- wget 成功下载表示 HTTP 请求成功
			if #response > 0 then
				success = true
				sys.exec("logger -t luci-app-uninstall '[REPORT_UNINSTALL] wget success, response_len=" .. #response .. "'")
			end
		else
			-- 最后尝试 uclient-fetch
			local uclient_cmd = string.format(
				"uclient-fetch --post-file=%q -O /tmp/uninstall_report_response.txt '%s' 2>&1",
				tmpfile, report_url
			)
			rc = sys.call(uclient_cmd .. ' >/tmp/uclient_output.txt 2>&1')
			
			if rc == 0 then
				response = fs.readfile('/tmp/uninstall_report_response.txt') or ''
				if #response > 0 then
					success = true
					sys.exec("logger -t luci-app-uninstall '[REPORT_UNINSTALL] uclient success, response_len=" .. #response .. "'")
				end
			end
		end
	end
	
	-- 保留临时文件用于调试 (可选，调试完成后可删除)
	-- sys.call('rm -f ' .. tmpfile .. ' /tmp/uninstall_report_response.txt /tmp/wget_output.txt /tmp/uclient_output.txt')
	
	if success then
		-- 尝试解析服务器响应，验证是否真的成功
		local server_ok = false
		local ok_result, server_data = pcall(json.parse, response)
		if ok_result and server_data and type(server_data) == 'table' then
			server_ok = server_data.ok or server_data.success
		end
		
		-- 记录服务器响应
		sys.exec("logger -t luci-app-uninstall '[REPORT_UNINSTALL] server_ok=" .. tostring(server_ok) .. ", response=" .. response:sub(1, 200) .. "'")
		
		return json_response({ 
			ok = true, 
			message = '卸载问题已成功上报,感谢您的反馈!',
			package = pkg_name,
			debug = {
				http_code = http_code,
				server_response = server_ok
			}
		})
	else
		-- 记录失败详情
		sys.exec("logger -t luci-app-uninstall '[REPORT_UNINSTALL] FAILED: " .. response:sub(1, 200) .. "'")
		
		return json_response({ 
			ok = false, 
			message = '上报失败,请检查网络连接或服务器状态',
			details = response:sub(1, 500),  -- 限制错误信息长度
			http_code = http_code
		}, 500)
	end
end

-- 从HTML中解析更新日志
local function parse_changelog_from_html(html)
	local logs = {}
	if not html or #html == 0 then
		return logs
	end
	
	-- 先移除HTML标签，保留文本内容
	local text = html:gsub('<[^>]+>', '\n')  -- 将HTML标签替换为换行
	text = text:gsub('&nbsp;', ' ')          -- 替换&nbsp;
	text = text:gsub('&lt;', '<')            -- 替换&lt;
	text = text:gsub('&gt;', '>')            -- 替换&gt;
	text = text:gsub('&amp;', '&')           -- 替换&amp;
	text = text:gsub('\n%s*\n+', '\n')       -- 合并多个换行
	text = text:gsub('^%s+', '')             -- 移除开头空白
	text = text:gsub('%s+$', '')             -- 移除结尾空白
	
	-- 查找所有版本号位置
	local versions = {}
	local pos = 1
	while true do
		local start_pos, version = text:find('v(%d+%.%d+%.%d+)', pos)
		if not start_pos then break end
		
		-- 查找对应的日期（在版本号后面，格式：YYYY-MM-DD）
		local date_start = text:find('%d%d%d%d%-%d%d%-%d%d', start_pos)
		if date_start then
			local date_end, date = text:find('(%d%d%d%d%-%d%d%-%d%d)', date_start)
			if date_end then
				-- 查找下一个版本号的位置，作为当前版本内容的结束位置
				local next_version_pos = text:find('v%d+%.%d+%.%d+', date_end + 1)
				local content_end = next_version_pos or (#text + 1)
				
				-- 提取内容（从日期后到下一个版本号前）
				local content = text:sub(date_end + 1, content_end - 1)
				content = content:gsub('^%s+', '')     -- 移除开头空白
				content = content:gsub('%s+$', '')     -- 移除结尾空白
				content = content:gsub('\n%s*\n+', '\n')  -- 合并多个换行
				
				-- 处理列表项格式（* 开头的内容）
				content = content:gsub('\n*%*%s*', '\n• ')  -- 将 * 转换为 • 
				content = content:gsub('^%s+', '')          -- 移除开头空白
				
				if #content > 0 then
					table.insert(versions, {
						pos = start_pos,
						version = 'v' .. version,
						date = date,
						content = content
					})
				end
			end
		end
		
		pos = start_pos + 1
	end
	
	-- 按位置排序（从新到旧）
	table.sort(versions, function(a, b) return a.pos > b.pos end)
	
	-- 转换为日志格式
	for _, v in ipairs(versions) do
		table.insert(logs, {
			version = v.version,
			date = v.date,
			changelog = v.content
		})
	end
	
	return logs
end

-- 获取历史更新日志
function action_history_log()
	local logs = {}
	
	-- 优先从 xzversion.json 获取更新日志
	local xzversion_url = 'https://plugin.vumstar.com/download/xzversion.json'
	local xzversion_body = sys.exec("wget -qO- '" .. xzversion_url .. "' 2>/dev/null") or ''
	if not xzversion_body or #xzversion_body == 0 then 
		xzversion_body = sys.exec("uclient-fetch -qO- '" .. xzversion_url .. "' 2>/dev/null") or '' 
	end
	
	if xzversion_body and #xzversion_body > 0 then
		local ok, data = pcall(json.parse, xzversion_body)
		if ok and type(data) == 'table' then
			-- 支持多种数据格式
			if data.logs and type(data.logs) == 'table' then
				-- 如果是 logs 数组格式
				logs = data.logs
			elseif data.history and type(data.history) == 'table' then
				-- 如果是 history 数组格式
				logs = data.history
			elseif data.changelog and type(data.changelog) == 'table' then
				-- 如果是 changelog 数组格式
				logs = data.changelog
			elseif type(data) == 'table' and #data > 0 then
				-- 如果是数组格式
				logs = data
			elseif data.latest and data.changelog then
				-- 如果是单个版本格式，转换为数组
				logs = {{
					version = 'v' .. tostring(data.latest),
					date = data.date or os.date('%Y-%m-%d'),
					changelog = tostring(data.changelog)
				}}
			end
		end
	end
	
	-- 如果从 xzversion.json 获取失败，尝试从其他 JSON API 获取
	if #logs == 0 then
		local endpoints = {
			'https://plugin.vumstar.com/download/history.json',
			'https://plugin.vumstar.com/download/changelog.json'
		}
		
		local body = ''
		for _, u in ipairs(endpoints) do
			body = sys.exec("wget -qO- '" .. u .. "' 2>/dev/null") or ''
			if not body or #body == 0 then 
				body = sys.exec("uclient-fetch -qO- '" .. u .. "' 2>/dev/null") or '' 
			end
			if body and #body > 0 then
				local ok, data = pcall(json.parse, body)
				if ok and type(data) == 'table' then
					-- 支持多种数据格式
					if data.logs and type(data.logs) == 'table' then
						logs = data.logs
					elseif data.history and type(data.history) == 'table' then
						logs = data.history
					elseif data.changelog and type(data.changelog) == 'table' then
						logs = data.changelog
					elseif type(data) == 'table' and #data > 0 then
						-- 如果是数组格式
						logs = data
					end
					if #logs > 0 then break end
				end
			end
		end
	end
	
	-- 如果远程获取失败，尝试从当前版本信息中获取最新日志
	if #logs == 0 then
		local latest, changelog
		local version_url = 'https://plugin.vumstar.com/download/version.json'
		local version_body = sys.exec("wget -qO- '" .. version_url .. "' 2>/dev/null") or ''
		if not version_body or #version_body == 0 then 
			version_body = sys.exec("uclient-fetch -qO- '" .. version_url .. "' 2>/dev/null") or '' 
		end
		if version_body and #version_body > 0 then
			local ok, data = pcall(json.parse, version_body)
			if ok and type(data) == 'table' then
				latest = data.latest or data.version
				changelog = data.changelog
				if latest and changelog then
					logs = {{
						version = latest,
						date = os.date('%Y-%m-%d'),
						changelog = changelog
					}}
				end
			end
		end
	end
	
	-- 如果远程获取失败，使用本地历史版本信息作为后备
	if #logs == 0 then
		logs = {
			{
				version = 'v1.0.2',
				date = '2025-11-8',
				changelog = '新增 上报卸载问题功能，在软件卡片左下角，如发现有软件卸载失败或者仍有残留的可以及时上报，我们会在第一时间进行修复。\n\n根据用户上报openlist和openlist2两个软件图标问题进行补全\n\n优化升级图标的动态效果提示，第一时间能够提示用户在线更新至最新版本获得更完善的功能'
			},
			{
				version = 'v1.0.1',
				date = '2025-11-8',
				changelog = '新增图标上报功能，在软件卡片左下角，当安装的插件或手动安装的插件没有图标显示叹号图标的时候，可以点击上报图标功能，我们会及时补全它的图标。'
			},
			{
				version = 'v1.0.0',
				date = '2025-11-7',
				changelog = '批量卸载栏可以跟随滑动，方便多选后执行批量卸载操作\n\n修复搜索后出现升级图标的BUG'
			},
			{
				version = 'v0.9.9',
				date = '2025-11-6',
				changelog = '调整卡片长度布局比例更合理\n\n修复已知BUG'
			},
			{
				version = 'v0.9.8',
				date = '2025-11-6',
				changelog = '新增批量删除功能\n\n突显了卸载完成后的返回按钮\n\n折叠卸载日志使卸载更沉浸'
			},
			{
				version = 'v0.9.7',
				date = '2025-11-6',
				changelog = '修复了之前安装过DDNSTO路由远程和易有云，会导致无法安装本插件的BUG\n\n修复了安装好插件后再安装DDNSTO路由远程和易有云会失败的BUG'
			}
		}
	end
	
	-- 确保日志格式正确
	local formatted_logs = {}
	for _, log in ipairs(logs) do
		if type(log) == 'table' then
			-- 支持 latest 字段，转换为 version
			local version = log.version or log.ver or log.latest or ''
			if version and version:sub(1, 1) ~= 'v' then
				version = 'v' .. tostring(version)
			end
			table.insert(formatted_logs, {
				version = tostring(version),
				date = tostring(log.date or log.time or ''),
				changelog = tostring(log.changelog or log.content or log.text or '')
			})
		end
	end
	
	return json_response({ 
		ok = true, 
		logs = formatted_logs,
		count = #formatted_logs
	})
end

-- 获取公告数据
function action_announcement()
	local announcements = {}
	
	-- 从 xzgg.json 获取公告数据
	local announcement_url = 'https://plugin.vumstar.com/download/xzgg.json'
	local announcement_body = sys.exec("wget -qO- '" .. announcement_url .. "' 2>/dev/null") or ''
	if not announcement_body or #announcement_body == 0 then 
		announcement_body = sys.exec("uclient-fetch -qO- '" .. announcement_url .. "' 2>/dev/null") or '' 
	end
	
	if announcement_body and #announcement_body > 0 then
		local ok, data = pcall(json.parse, announcement_body)
		if ok and type(data) == 'table' then
			-- 支持数组格式
			if type(data) == 'table' and #data > 0 then
				announcements = data
			elseif data.announcements and type(data.announcements) == 'table' then
				announcements = data.announcements
			elseif data.list and type(data.list) == 'table' then
				announcements = data.list
			elseif data.latest or data.changelog or data.content or data.text then
				-- 如果是单个公告对象，转换为数组
				announcements = {data}
			end
		end
	end
	
	-- 确保公告格式正确
	local formatted_announcements = {}
	for _, ann in ipairs(announcements) do
		if type(ann) == 'table' then
			table.insert(formatted_announcements, {
				latest = ann.latest or ann.version or ann.ver or '',
				date = ann.date or ann.time or '',
				changelog = ann.changelog or ann.content or ann.text or ''
			})
		end
	end
	
	return json_response({ 
		ok = true, 
		announcements = formatted_announcements,
		count = #formatted_announcements
	})
end

-- 保存折叠状态到系统文件
function action_save_collapse_state()
	-- 使用 /var/lib 目录，通常有写入权限（系统级别，跨浏览器）
	local state_dir = '/var/lib/luci-app-uninstall'
	local state_file = state_dir .. '/collapse-state.json'
	
	-- 确保目录存在（使用 sys.call 更可靠）
	if not fs.stat(state_dir) then
		local mkdir_result = sys.call(string.format("mkdir -p %q", state_dir))
		if mkdir_result ~= 0 then
			return json_response({ 
				ok = false, 
				message = '创建目录失败: ' .. state_dir
			}, 500)
		end
	end
	
	local data = {}
	local body = http.content() or ''
	local content_type = http.getenv('CONTENT_TYPE') or ''
	
	-- 方法1: 优先从表单获取（LuCI 对表单支持更好）
	local section = http.formvalue('section') or ''
	local collapsed = http.formvalue('collapsed') or 'false'
	if section and #section > 0 then
		data[section] = (collapsed == 'true' or collapsed == true)
	end
	
	-- 方法2: 如果表单为空，尝试从请求体解析数据
	if not data or not next(data) then
		if body and #body > 0 then
			-- 检查 Content-Type
			if content_type:match('application/x%-www%-form%-urlencoded') then
				-- 解析 URL 编码的表单数据
				local body_section, body_collapsed
				for key, val in body:gmatch('([^&=]+)=([^&]*)') do
					-- URL 解码
					key = key:gsub('+', ' '):gsub('%%(%x%x)', function(h) return string.char(tonumber(h, 16)) end)
					val = val:gsub('+', ' '):gsub('%%(%x%x)', function(h) return string.char(tonumber(h, 16)) end)
					if key == 'section' then
						body_section = val
					elseif key == 'collapsed' then
						body_collapsed = val
					end
				end
				-- 如果从 body 中获取到 section 和 collapsed，使用它们
				if body_section and #body_section > 0 then
					data[body_section] = (body_collapsed == 'true' or body_collapsed == true)
				end
			elseif content_type:match('application/json') then
				-- 尝试解析 JSON
				local ok, state = pcall(json.parse, body)
				if ok and state and type(state) == 'table' then
					-- JSON 数据可能是 { "sectionName": true } 格式
					for k, v in pairs(state) do
						if type(k) == 'string' then
							data[k] = (v == true or v == 'true')
						end
					end
				end
			end
		end
	end
	
	-- 如果没有数据，返回错误（添加调试信息）
	if not data or not next(data) then
		local request_method = http.getenv('REQUEST_METHOD') or 'unknown'
		local body_len = body and #body or 0
		return json_response({ 
			ok = false, 
			message = '没有接收到数据',
			debug = {
				content_type = content_type,
				request_method = request_method,
				body_length = body_len,
				body_preview = body and body:sub(1, 100) or '',
				form_section = section,
				form_collapsed = collapsed
			}
		}, 400)
	end
	
	-- 读取现有状态
	local existing_state = {}
	if fs.stat(state_file) then
		local content = fs.readfile(state_file) or '{}'
		local ok, parsed = pcall(json.parse, content)
		if ok and type(parsed) == 'table' then
			existing_state = parsed
		end
	end
	
	-- 合并新状态
	for k, v in pairs(data) do
		existing_state[k] = v
	end
	
	-- 保存到文件（使用临时文件方式，更可靠）
	local content = json.stringify(existing_state)
	local tmp_file = state_file .. '.tmp'
	
	-- 先写入临时文件
	local write_ok, write_err = pcall(function()
		fs.writefile(tmp_file, content)
	end)
	
	if write_ok then
		-- 移动临时文件到目标位置
		local mv_ok = sys.call(string.format("mv -f %q %q >/dev/null 2>&1", tmp_file, state_file))
		if mv_ok == 0 then
			-- 设置文件权限
			sys.call(string.format("chmod 644 %q >/dev/null 2>&1", state_file))
			return json_response({ 
				ok = true, 
				message = '状态已保存'
			})
		else
			-- 如果移动失败，尝试直接写入
			local direct_ok, direct_err = pcall(function()
				fs.writefile(state_file, content)
			end)
			if direct_ok then
				sys.call(string.format("chmod 644 %q >/dev/null 2>&1", state_file))
				return json_response({ 
					ok = true, 
					message = '状态已保存'
				})
			else
				return json_response({ 
					ok = false, 
					message = '保存失败: ' .. tostring(direct_err)
				}, 500)
			end
		end
	else
		return json_response({ 
			ok = false, 
			message = '保存失败: ' .. tostring(write_err)
		}, 500)
	end
end

-- 从系统文件读取折叠状态（系统级别，跨浏览器）
function action_get_collapse_state()
	-- 使用 /var/lib 目录，通常有写入权限
	local state_dir = '/var/lib/luci-app-uninstall'
	local state_file = state_dir .. '/collapse-state.json'
	local state = {}
	
	if fs.stat(state_file) then
		local content = fs.readfile(state_file) or '{}'
		local ok, parsed = pcall(json.parse, content)
		if ok and type(parsed) == 'table' then
			state = parsed
		end
	end
	
	return json_response({ 
		ok = true, 
		state = state
	})
end

-- 保存锁状态到系统文件
function action_save_lock_state()
	-- 使用 /var/lib 目录，通常有写入权限（系统级别，跨浏览器）
	local state_dir = '/var/lib/luci-app-uninstall'
	local state_file = state_dir .. '/lock-state.json'
	
	-- 确保目录存在（使用 sys.call 更可靠）
	if not fs.stat(state_dir) then
		local mkdir_result = sys.call(string.format("mkdir -p %q", state_dir))
		if mkdir_result ~= 0 then
			return json_response({ 
				ok = false, 
				message = '创建目录失败: ' .. state_dir
			}, 500)
		end
	end
	
	local data = {}
	local body = http.content() or ''
	local content_type = http.getenv('CONTENT_TYPE') or ''
	
	-- 方法1: 优先从表单获取（LuCI 对表单支持更好）
	local package = http.formvalue('package') or ''
	local locked = http.formvalue('locked') or 'false'
	if package and #package > 0 then
		data[package] = (locked == 'true' or locked == true)
	end
	
	-- 方法2: 如果表单为空，尝试从请求体解析数据
	if not data or not next(data) then
		if body and #body > 0 then
			-- 检查 Content-Type
			if content_type:match('application/x%-www%-form%-urlencoded') then
				-- 解析 URL 编码的表单数据
				local body_package, body_locked
				for key, val in body:gmatch('([^&=]+)=([^&]*)') do
					-- URL 解码
					key = key:gsub('+', ' '):gsub('%%(%x%x)', function(h) return string.char(tonumber(h, 16)) end)
					val = val:gsub('+', ' '):gsub('%%(%x%x)', function(h) return string.char(tonumber(h, 16)) end)
					if key == 'package' then
						body_package = val
					elseif key == 'locked' then
						body_locked = val
					end
				end
				-- 如果从 body 中获取到 package 和 locked，使用它们
				if body_package and #body_package > 0 then
					data[body_package] = (body_locked == 'true' or body_locked == true)
				end
			elseif content_type:match('application/json') then
				-- 尝试解析 JSON
				local ok, state = pcall(json.parse, body)
				if ok and state and type(state) == 'table' then
					-- JSON 数据可能是 { "packageName": true } 格式
					for k, v in pairs(state) do
						if type(k) == 'string' then
							data[k] = (v == true or v == 'true')
						end
					end
				end
			end
		end
	end
	
	-- 如果没有数据，返回错误
	if not data or not next(data) then
		return json_response({ 
			ok = false, 
			message = '没有接收到数据'
		}, 400)
	end
	
	-- 读取现有状态
	local existing_state = {}
	if fs.stat(state_file) then
		local content = fs.readfile(state_file) or '{}'
		local ok, parsed = pcall(json.parse, content)
		if ok and type(parsed) == 'table' then
			existing_state = parsed
		end
	end
	
	-- 合并新状态
	for k, v in pairs(data) do
		existing_state[k] = v
	end
	
	-- 保存到文件（使用临时文件方式，更可靠）
	local content = json.stringify(existing_state)
	local tmp_file = state_file .. '.tmp'
	
	-- 先写入临时文件
	local write_ok, write_err = pcall(function()
		fs.writefile(tmp_file, content)
	end)
	
	if write_ok then
		-- 移动临时文件到目标位置
		local mv_ok = sys.call(string.format("mv -f %q %q >/dev/null 2>&1", tmp_file, state_file))
		if mv_ok == 0 then
			-- 设置文件权限
			sys.call(string.format("chmod 644 %q >/dev/null 2>&1", state_file))
			return json_response({ 
				ok = true, 
				message = '状态已保存'
			})
		else
			-- 如果移动失败，尝试直接写入
			local direct_ok, direct_err = pcall(function()
				fs.writefile(state_file, content)
			end)
			if direct_ok then
				sys.call(string.format("chmod 644 %q >/dev/null 2>&1", state_file))
				return json_response({ 
					ok = true, 
					message = '状态已保存'
				})
			else
				return json_response({ 
					ok = false, 
					message = '保存失败: ' .. tostring(direct_err)
				}, 500)
			end
		end
	else
		return json_response({ 
			ok = false, 
			message = '保存失败: ' .. tostring(write_err)
		}, 500)
	end
end

-- 从系统文件读取锁状态（系统级别，跨浏览器）
function action_get_lock_state()
	-- 使用 /var/lib 目录，通常有写入权限
	local state_dir = '/var/lib/luci-app-uninstall'
	local state_file = state_dir .. '/lock-state.json'
	local state = {}
	
	if fs.stat(state_file) then
		local content = fs.readfile(state_file) or '{}'
		local ok, parsed = pcall(json.parse, content)
		if ok and type(parsed) == 'table' then
			state = parsed
		end
	end
	
	return json_response({ 
		ok = true, 
		state = state
	})
end
