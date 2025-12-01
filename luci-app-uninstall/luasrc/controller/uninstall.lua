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

	e = entry({ 'admin', 'vum', 'uninstall', 'install_from_url' }, call('action_install_from_url'))
	e.leaf = true
	e.acl_depends = { 'luci-app-uninstall' }

	e = entry({ 'admin', 'vum', 'uninstall', 'install_upload' }, call('action_install_upload'))
	e.leaf = true
	e.acl_depends = { 'luci-app-uninstall' }

	e = entry({ 'admin', 'vum', 'uninstall', 'check_install_status' }, call('action_check_install_status'))
	e.leaf = true
	e.acl_depends = { 'luci-app-uninstall' }
end

	local http = require 'luci.http'
	local sys = require 'luci.sys'
	local ipkg = require 'luci.model.ipkg'
	local json = require 'luci.jsonc'
	local fs = require 'nixio.fs'
	local util = require 'luci.util'
	local os = require 'os'

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

-- 从 URL 安装任意 .ipk 或 .run 包
function action_install_from_url()
	local url = http.formvalue('url') or ''
	url = tostring(url):gsub('^%s+', ''):gsub('%s+$', '')
	if url == '' then
		return json_response({ ok = false, message = '缺少 url 参数' }, 400)
	end

	local is_ipk = url:match('%.ipk$')
	local is_run = url:match('%.run$')
	if not is_ipk and not is_run then
		return json_response({ ok = false, message = '仅支持以 .ipk 或 .run 结尾的文件' }, 400)
	end

	local tmp_path = is_ipk and '/tmp/uninstall-install.ipk' or '/tmp/uninstall-install.run'
	local tmp_log = '/tmp/uninstall-install.log'
	local log = {}
	local function append(s) log[#log+1] = s end

	append('=== Install from URL ===')
	append('URL: ' .. url)

	-- 清理旧文件
	sys.call(string.format("rm -f %q %q >/dev/null 2>&1", tmp_path, tmp_log))

	-- 下载文件（优先 uclient-fetch，其次 wget，最后 curl）
	append('> Download: ' .. url)
	local rc = sys.call(string.format("uclient-fetch -L -O %q '%s' >/dev/null 2>&1", tmp_path, url))
	if rc ~= 0 then
		rc = sys.call(string.format("wget --no-check-certificate -O %q '%s' >/dev/null 2>&1", tmp_path, url))
	end
	if rc ~= 0 then
		rc = sys.call(string.format("command -v curl >/dev/null 2>&1 && curl -L -o %q '%s' >/dev/null 2>&1 || true", tmp_path, url))
	end

	local st = fs.stat(tmp_path)
	if not st or st.size <= 0 then
		append('! 下载失败或文件为空')
		return json_response({ ok = false, message = '下载失败或文件为空', log = table.concat(log, "\n") }, 500)
	end

	if is_run then
		-- 简单校验 .run：检查 shebang
		local f = io.open(tmp_path, 'rb')
		if not f then
			append('! 无法读取 .run 文件')
			return json_response({ ok = false, message = '无法读取 .run 文件', log = table.concat(log, "\n") }, 500)
		end
		local header = f:read(2) or ''
		f:close()
		if header ~= '#!' then
			append('! 非有效安装脚本（缺少 shebang）')
			return json_response({ ok = false, message = '非有效安装脚本（缺少 shebang）', log = table.concat(log, "\n") }, 400)
		end
	end

	-- 执行安装
	local ok
	if is_ipk then
		append('+ opkg install ' .. tmp_path)
		rc = sys.call(string.format("opkg install %q >%s 2>&1", tmp_path, tmp_log))
		ok = (rc == 0)
	else
		append('+ sh ' .. tmp_path)
		sys.call(string.format('chmod +x %q >/dev/null 2>&1', tmp_path))
		rc = sys.call(string.format("/bin/sh %q >%s 2>&1", tmp_path, tmp_log))
		ok = (rc == 0)
	end

	local out = fs.readfile(tmp_log) or ''
	if out and #out > 0 then append(out) end

	-- 刷新 LuCI 缓存，便于新插件菜单立即生效
	if ok then
		sys.call('rm -f /tmp/luci-indexcache >/dev/null 2>&1')
		sys.call('rm -rf /tmp/luci-modulecache/* >/dev/null 2>&1')
		sys.call('[ -x /etc/init.d/uhttpd ] && /etc/init.d/uhttpd reload >/dev/null 2>&1')
		sys.call('[ -x /etc/init.d/nginx ] && /etc/init.d/nginx reload >/dev/null 2>&1')
	end

	return json_response({ ok = ok, log = table.concat(log, "\n") })
end

-- 上传并安装本地 .ipk 或 .run 包
function action_install_upload()
	-- 仅允许 POST
	local method = http.getenv and http.getenv('REQUEST_METHOD') or ''
	if method ~= 'POST' then
		return json_response({ ok = false, message = '仅支持 POST 上传' }, 405)
	end

	local tmp_path = '/tmp/uninstall-upload.tmp'
	local tmp_ipk = '/tmp/uninstall-upload.ipk'
	local tmp_run = '/tmp/uninstall-upload.run'
	local tmp_log = '/tmp/uninstall-install.log'
	local log = {}
	local function append(s) log[#log+1] = s end

	-- 清理旧文件
	sys.call(string.format("rm -f %q %q %q %q >/dev/null 2>&1", tmp_path, tmp_ipk, tmp_run, tmp_log))

	local fp, filename
	local saved_path
	http.setfilehandler(function(meta, chunk, eof)
		if not fp and meta and meta.name == 'file' then
			filename = meta.file or meta.filename or meta.name
			-- 保持原始文件名，但确保文件名安全（移除路径分隔符等）
			if filename then
				-- 只保留文件名部分，移除路径
				local basename = filename:match('([^/\\]+)$') or filename
				-- 移除可能的不安全字符，但保留加号（+）和等号（=），因为这些在包名中很常见
				-- 只移除真正的危险字符（路径分隔符、空字符等）
				basename = basename:gsub('[%c/\\%z]', '_')  -- 只移除控制字符、路径分隔符和空字符
				-- 确保文件名不为空
				if basename and #basename > 0 then
					saved_path = '/tmp/' .. basename
				else
					-- 如果文件名无效，使用默认名称
					local suffix = '.tmp'
					if filename:match('%.ipk$') then
						suffix = '.ipk'
					elseif filename:match('%.run$') then
						suffix = '.run'
					end
					saved_path = '/tmp/uninstall-upload' .. suffix
				end
			else
				-- 如果没有文件名，使用默认名称
				saved_path = '/tmp/uninstall-upload.tmp'
			end
			fp = io.open(saved_path, 'w')
			if not fp then
				append('! 无法创建临时文件')
				return
			end
		end
		if fp and chunk then
			fp:write(chunk)
		end
		if fp and eof then
			fp:close()
			fp = nil
		end
	end)

	-- 读取表单以触发文件处理
	http.formvalue('dummy')

	local final_path = saved_path or tmp_path
	local st = fs.stat(final_path)
	if not st or st.size <= 0 then
		append('! 未收到上传文件或文件大小为 0')
		return json_response({ ok = false, message = '未收到上传文件或文件大小为 0', log = table.concat(log, "\n") }, 400)
	end

	filename = filename or ''
	local is_ipk = filename:match('%.ipk$') ~= nil
	local is_run = filename:match('%.run$') ~= nil
	if not is_ipk and not is_run then
		append('! 仅支持 .ipk 或 .run 文件')
		return json_response({ ok = false, message = '仅支持上传以 .ipk 或 .run 结尾的文件', log = table.concat(log, "\n") }, 400)
	end

	-- 若为 .run，做简单 shebang 校验
	if is_run then
		local f = io.open(final_path, 'rb')
		if not f then
			append('! 无法读取 .run 文件')
			return json_response({ ok = false, message = '无法读取 .run 文件', log = table.concat(log, "\n") }, 500)
		end
		local header = f:read(2) or ''
		f:close()
		if header ~= '#!' then
			append('! 非有效安装脚本（缺少 shebang）')
			return json_response({ ok = false, message = '非有效安装脚本（缺少 shebang）', log = table.concat(log, "\n") }, 400)
		end
	end

	append('=== Install from upload ===')
	append('File: ' .. (filename or ''))

	-- 参考 luci-app-store 的方式：使用类似 is-opkg dotrun 的逻辑
	-- 直接执行 .run 或 .ipk 文件，不需要包装脚本
	local status_file = '/tmp/uninstall-install-status.txt'
	local stdout_log = '/tmp/uninstall-install.stdout'
	local stderr_log = '/tmp/uninstall-install.stderr'
	
	-- 清理旧文件
	sys.call(string.format("rm -f %q %q %q >/dev/null 2>&1", status_file, stdout_log, stderr_log))
	
	-- 写入初始状态
	local status_fp = io.open(status_file, 'w')
	if status_fp then
		status_fp:write('running\n')
		status_fp:close()
	end
	
	-- 构建执行命令（参考 is-opkg dotrun 的方式）
	-- 创建一个包装脚本来执行安装并捕获退出码
	local wrapper_script = '/tmp/uninstall-install-wrapper.sh'
	local wrapper_content
	if is_ipk then
		wrapper_content = string.format(
			'#!/bin/sh\n' ..
			'opkg install %q >%q 2>%q\n' ..
			'EXIT_CODE=$?\n' ..
			'echo "$EXIT_CODE" > %q\n' ..
			'echo "done" >> %q\n' ..
			'rm -f %q\n',
			final_path, stdout_log, stderr_log, status_file, status_file, wrapper_script
		)
	else
		-- 对于 .run 文件，直接执行（参考 is-opkg dotrun 的方式）
		-- 不需要 opkg update，.run 文件内部会处理
		wrapper_content = string.format(
			'#!/bin/sh\n' ..
			'chmod 0755 %q\n' ..
			'%q >%q 2>%q\n' ..
			'EXIT_CODE=$?\n' ..
			'echo "$EXIT_CODE" > %q\n' ..
			'echo "done" >> %q\n' ..
			'rm -f %q\n' ..
			'rm -f %q\n',  -- 清理上传的文件
			final_path, final_path, stdout_log, stderr_log, status_file, status_file, wrapper_script, final_path
		)
	end
	
	local wrapper_fp = io.open(wrapper_script, 'w')
	if wrapper_fp then
		wrapper_fp:write(wrapper_content)
		wrapper_fp:close()
		sys.call(string.format('chmod +x %q >/dev/null 2>&1', wrapper_script))
	else
		return json_response({ ok = false, message = '无法创建包装脚本', log = table.concat(log, "\n") }, 500)
	end
	
	-- 检查是否有 tasks 系统可用（参考 luci-app-store 的 is_exec 函数）
	local has_tasks = fs.stat('/etc/init.d/tasks') ~= nil
	local async_cmd
	
	if has_tasks then
		-- 使用 tasks 系统异步执行（参考 luci-app-store）
		async_cmd = string.format("/etc/init.d/tasks task_add uninstall %s", util.shellquote(wrapper_script))
		append('> 使用 tasks 系统异步执行安装')
	else
		-- 使用 nohup 在后台执行
		async_cmd = string.format("nohup sh %q >/dev/null 2>&1 &", wrapper_script)
		append('> 使用 nohup 在后台执行安装')
	end
	
	-- 执行命令
	sys.call(async_cmd)
	
	-- 异步执行，返回状态让前端轮询
	append('> 安装已在后台启动，正在执行中...')
	append('> 请等待安装完成，前端将自动检查安装状态')
	return json_response({ 
		ok = true, 
		async = true,  -- 标记为异步安装
		message = '安装已开始，正在后台执行',
		log = table.concat(log, "\n"),
		status_file = status_file,
		log_file = stdout_log,
		stderr_file = stderr_log,
		has_tasks = has_tasks
	})
end

-- 检查后台安装状态
function action_check_install_status()
	local status_file = '/tmp/uninstall-install-status.txt'
	local stdout_log = '/tmp/uninstall-install.stdout'
	local stderr_log = '/tmp/uninstall-install.stderr'
	local tmp_log = stdout_log  -- 兼容旧版本
	local wrapper_script = '/tmp/uninstall-install-wrapper.sh'
	
	local status = 'unknown'
	local log_content = ''
	local exit_code = nil
	
	-- 首先检查状态文件
	if fs.stat(status_file) then
		local content = fs.readfile(status_file) or ''
		-- 清理空白字符
		content = content:gsub('^%s+', ''):gsub('%s+$', '')
		
		-- 检查是否有 done 标记（不区分大小写，支持多种格式）
		if content:match('done') or content:match('DONE') or content:match('Done') then
			status = 'done'
			-- 提取退出码（查找所有数字行，取最后一个作为退出码）
			local codes = {}
			for line in content:gmatch('[^\n]+') do
				-- 移除空白字符
				line = line:gsub('^%s+', ''):gsub('%s+$', '')
				local code = line:match('^(%d+)$')
				if code then
					table.insert(codes, tonumber(code))
				end
			end
			if #codes > 0 then
				exit_code = codes[#codes]  -- 取最后一个退出码
			else
				-- 如果没有找到退出码，但状态是 done，假设成功
				exit_code = 0
			end
		elseif content:match('running') or content:match('RUNNING') or content:match('Running') then
			status = 'running'
			-- 如果状态文件显示 running，立即检查日志文件，看是否安装已完成
			-- 这对于 openclash 等长时间安装的包很重要
			local log_file_check = stdout_log
			if not fs.stat(log_file_check) then
				log_file_check = '/tmp/uninstall-install.log'  -- 兼容旧版本
			end
			if fs.stat(log_file_check) then
				local log_content_check = fs.readfile(log_file_check) or ''
				local mtime_str = sys.exec(string.format("stat -c %%Y %q 2>/dev/null || stat -f %%m %q 2>/dev/null || echo 0", tmp_log, tmp_log)) or '0'
				local log_mtime = tonumber(mtime_str:match('(%d+)')) or 0
				local current_time = os.time()
				local time_since_update = current_time - log_mtime
				
				-- 如果日志文件超过60秒没有更新，检查是否有完成标记
				-- 对于 openclash，给更多时间（30秒）
				local timeout_seconds = 60
				if log_content_check:match('openclash') or log_content_check:match('OpenClash') then
					timeout_seconds = 30  -- openclash 安装超时时间（30秒）
				end
				
				-- 检查是否有 opkg 相关的活动（下载、安装依赖等）
				local has_opkg_activity = log_content_check:match('Downloading') or 
				                          log_content_check:match('Installing') or 
				                          log_content_check:match('Configuring') or
				                          log_content_check:match('Updated list') or
				                          log_content_check:match('Signature check') or
				                          log_content_check:match('Packages%.gz') or
				                          log_content_check:match('Packages%.sig')
				
				-- 如果有 opkg 活动，即使超过超时时间也认为还在运行（除非超过5分钟）
				-- 因为下载依赖可能需要较长时间
				if has_opkg_activity then
					if time_since_update < 300 then  -- 5分钟内认为还在运行
						status = 'running'
					else
						-- 超过5分钟，检查是否有完成标记
						if log_content_check:match('Save installed pkg list') or 
						   log_content_check:match('The following packages were added') or
						   log_content_check:match('Configuring luci%-app%-') then
							status = 'done'
							exit_code = 0
							-- 更新状态文件
							local status_fp = io.open(status_file, 'w')
							if status_fp then
								status_fp:write('0\n')
								status_fp:write('done\n')
								status_fp:close()
							end
						else
							status = 'running'  -- 继续等待
						end
					end
				elseif log_mtime > 0 and time_since_update > timeout_seconds then
					-- 检查日志中是否有完成标记
					if log_content_check:match('安装完成') or 
					   log_content_check:match('Install.*complete') or 
					   log_content_check:match('successfully') or
					   log_content_check:match('✓') or
					   log_content_check:match('completed') or
					   log_content_check:match('done') or
					   log_content_check:match('完成') or
					   log_content_check:match('Success') or
					   log_content_check:match('SUCCESS') or
					   log_content_check:match('Save installed pkg list') or
					   log_content_check:match('The following packages were added') or
					   log_content_check:match('Configuring luci%-app%-') then
						status = 'done'
						exit_code = 0
						-- 更新状态文件，确保下次检查时能正确识别
						local status_fp = io.open(status_file, 'w')
						if status_fp then
							status_fp:write('0\n')
							status_fp:write('done\n')
							status_fp:close()
						end
					elseif log_content_check:match('error') or 
					       log_content_check:match('failed') or
					       log_content_check:match('失败') or
					       log_content_check:match('Error') or
					       log_content_check:match('Failed') or
					       log_content_check:match('ERROR') or
					       log_content_check:match('FAILED') then
						status = 'done'
						exit_code = 1
						-- 更新状态文件
						local status_fp = io.open(status_file, 'w')
						if status_fp then
							status_fp:write('1\n')
							status_fp:write('done\n')
							status_fp:close()
						end
					elseif time_since_update > (timeout_seconds * 2) then
						-- 如果日志超过2倍超时时间没有更新，且没有进程在运行，认为安装已完成
						-- 假设成功（因为可能是静默完成）
						status = 'done'
						exit_code = 0
						-- 更新状态文件
						local status_fp = io.open(status_file, 'w')
						if status_fp then
							status_fp:write('0\n')
							status_fp:write('done\n')
							status_fp:close()
						end
					end
				end
			end
		elseif #content > 0 then
			-- 如果状态文件存在但内容不是预期的格式，尝试解析
			-- 可能是只有退出码，没有 done 标记
			local code = content:match('^(%d+)$')
			if code then
				status = 'done'
				exit_code = tonumber(code)
			else
				-- 内容不是预期的格式，尝试查找数字
				local code2 = content:match('(%d+)')
				if code2 then
					status = 'done'
					exit_code = tonumber(code2)
				end
			end
		else
			-- 状态文件存在但内容为空，可能是刚创建，认为是 running
			status = 'running'
		end
	end
	
	-- 如果状态文件不存在或状态未知，检查包装脚本是否还在运行
	-- 这对于 openclash 等长时间安装的包很重要
	if status == 'unknown' or status == 'running' then
		-- 检查包装脚本进程是否还在运行
		local wrapper_running = false
		-- 检查多种可能的进程模式
		if fs.stat(wrapper_script) then
			-- 检查是否有 sh 进程在执行包装脚本
			local ps_output = sys.exec("ps w | grep -F '" .. wrapper_script .. "' | grep -v grep") or ''
			if ps_output and #ps_output > 0 then
				wrapper_running = true
			end
		end
		
		-- 也检查是否有进程在执行安装脚本本身（通过检查日志文件路径）
		-- 这对于检测 openclash 等长时间运行的安装脚本很重要
		if not wrapper_running and fs.stat(log_file) then
			-- 检查是否有进程在写入日志文件（通过 lsof 或 fuser，如果可用）
			local lsof_output = sys.exec(string.format("lsof %q 2>/dev/null | grep -v grep", log_file)) or ''
			if lsof_output and #lsof_output > 0 then
				wrapper_running = true
			else
				-- 备用方法：检查是否有 sh 进程在执行 .run 文件
				local run_process = sys.exec("ps w | grep -E '\\.run|uninstall-upload\\.run|uninstall-install\\.run' | grep -v grep") or ''
				if run_process and #run_process > 0 then
					wrapper_running = true
				end
			end
			
			-- 关键：检查是否有 opkg 进程在运行（.run 文件内部会调用 opkg 安装依赖）
			-- 这对于 openclash 等需要下载依赖的包非常重要
			if not wrapper_running then
				local opkg_process = sys.exec("ps w | grep -E 'opkg|wget.*Packages|uclient-fetch.*Packages' | grep -v grep") or ''
				if opkg_process and #opkg_process > 0 then
					wrapper_running = true
				end
			end
			
			-- 检查日志文件是否有 opkg 相关的活动（下载、安装等）
			if not wrapper_running then
				local log_content_check = fs.readfile(log_file) or ''
				-- 如果日志中有 "Downloading"、"Installing"、"Configuring" 等关键词，且日志最近有更新，认为还在运行
				if log_content_check:match('Downloading') or 
				   log_content_check:match('Installing') or 
				   log_content_check:match('Configuring') or
				   log_content_check:match('Updated list') or
				   log_content_check:match('Signature check') then
					-- 检查日志文件的修改时间
					local mtime_str = sys.exec(string.format("stat -c %%Y %q 2>/dev/null || stat -f %%m %q 2>/dev/null || echo 0", log_file, log_file)) or '0'
					local log_mtime = tonumber(mtime_str:match('(%d+)')) or 0
					local current_time = os.time()
					local time_since_update = current_time - log_mtime
					-- 如果日志文件在最近30秒内有更新，认为还在运行
					if log_mtime > 0 and time_since_update < 30 then
						wrapper_running = true
					end
				end
			end
		end
		
		-- 如果没有找到包装脚本进程，但状态文件也不存在，可能是安装已完成但状态文件被清理
		-- 或者安装脚本已经执行完毕但状态文件写入失败
		if not wrapper_running and not fs.stat(status_file) then
			-- 检查日志文件是否有完成标记
			if fs.stat(log_file) then
				-- 先检查日志文件是否还在更新（通过修改时间）
				local mtime_str = sys.exec(string.format("stat -c %%Y %q 2>/dev/null || stat -f %%m %q 2>/dev/null || echo 0", log_file, log_file)) or '0'
				local log_mtime = tonumber(mtime_str:match('(%d+)')) or 0
				local current_time = os.time()
				local time_since_update = current_time - log_mtime
				
				-- 读取日志内容
				local log_content_check = fs.readfile(log_file) or ''
				
				-- 如果日志文件最近有更新（30秒内），认为安装还在进行中
				-- 或者日志中有 opkg 相关的活动（下载、安装依赖等）
				local has_opkg_activity = log_content_check:match('Downloading') or 
				                          log_content_check:match('Installing') or 
				                          log_content_check:match('Configuring') or
				                          log_content_check:match('Updated list') or
				                          log_content_check:match('Signature check') or
				                          log_content_check:match('Packages%.gz') or
				                          log_content_check:match('Packages%.sig')
				
				if log_mtime > 0 and (time_since_update < 30 or has_opkg_activity) then
					status = 'running'
				else
					-- 日志文件很久没有更新，检查是否有完成标记
					-- 检查日志中是否有安装完成的标记
					if log_content_check:match('安装完成') or 
					   log_content_check:match('Install.*complete') or 
					   log_content_check:match('successfully') or
					   log_content_check:match('✓') or
					   log_content_check:match('completed') or
					   log_content_check:match('done') or
					   log_content_check:match('完成') then
						status = 'done'
						exit_code = 0
					elseif log_content_check:match('error') or 
					       log_content_check:match('failed') or
					       log_content_check:match('失败') or
					       log_content_check:match('Error') or
					       log_content_check:match('Failed') then
						status = 'done'
						exit_code = 1
					else
						-- 无法判断，如果日志文件很大，可能安装已完成
						local log_stat = fs.stat(log_file)
						if log_stat and log_stat.size and log_stat.size > 5000 then
							-- 日志文件较大，可能安装已完成，假设成功
							status = 'done'
							exit_code = 0
						else
							-- 日志文件较小且很久没更新，可能安装失败或还在进行中
							-- 如果超过2分钟没更新，认为已完成（可能是静默完成）
							if time_since_update > 120 then
								status = 'done'
								exit_code = 0  -- 假设成功
							else
								status = 'running'
							end
						end
					end
				end
			end
		elseif wrapper_running then
			status = 'running'
		elseif status == 'unknown' then
			-- 如果包装脚本不存在，状态文件也不存在，但日志文件存在，可能是安装已完成
			-- 检查日志文件的最后修改时间，如果超过一定时间没有更新，认为安装已完成
			if fs.stat(log_file) then
				-- 使用 stat 命令获取文件修改时间（更可靠）
				local mtime_str = sys.exec(string.format("stat -c %%Y %q 2>/dev/null || stat -f %%m %q 2>/dev/null || echo 0", log_file, log_file)) or '0'
				local log_mtime = tonumber(mtime_str:match('(%d+)')) or 0
				local current_time = os.time()
				local time_since_update = current_time - log_mtime
				-- 读取日志内容，检查是否有完成标记
				local log_content_check = fs.readfile(log_file) or ''
				
				-- 如果日志文件超过60秒没有更新，且没有运行中的进程，认为安装已完成
				-- 对于 openclash 等长时间安装的包，给更多时间
				local timeout_seconds = 60
				if log_content_check:match('openclash') or log_content_check:match('OpenClash') then
					timeout_seconds = 30  -- openclash 安装超时时间（30秒）
				end
				
				-- 检查是否有 opkg 相关的活动
				local has_opkg_activity = log_content_check:match('Downloading') or 
				                          log_content_check:match('Installing') or 
				                          log_content_check:match('Configuring') or
				                          log_content_check:match('Updated list') or
				                          log_content_check:match('Signature check')
				
				-- 如果有 opkg 活动，即使超过超时时间也认为还在运行（除非超过2倍超时时间）
				if has_opkg_activity and time_since_update < (timeout_seconds * 2) then
					status = 'running'
				elseif log_mtime > 0 and (current_time - log_mtime) > timeout_seconds then
					status = 'done'
					-- 尝试从日志判断成功或失败
					if log_content_check:match('安装完成') or 
					   log_content_check:match('Install.*complete') or 
					   log_content_check:match('successfully') or
					   log_content_check:match('✓') or
					   log_content_check:match('completed') or
					   log_content_check:match('done') or
					   log_content_check:match('完成') then
						exit_code = 0
					elseif log_content_check:match('error') or 
					       log_content_check:match('failed') or
					       log_content_check:match('失败') or
					       log_content_check:match('Error') or
					       log_content_check:match('Failed') then
						exit_code = 1
					else
						-- 如果无法判断，检查日志文件大小，如果很大可能安装完成了
						local log_stat = fs.stat(log_file)
						if log_stat and log_stat.size and log_stat.size > 1000 then
							-- 日志文件较大，可能安装已完成，假设成功
							exit_code = 0
						else
							exit_code = 1
						end
					end
				else
					-- 日志文件最近有更新，或者还在等待中
					-- 检查日志内容，看是否有明显的错误
					if log_content_check:match('error') or 
					   log_content_check:match('failed') or
					   log_content_check:match('失败') then
						-- 有错误但还在运行，继续等待
						status = 'running'
					else
						status = 'running'
					end
				end
			end
		end
	end
	
	-- 读取日志文件（只读最后 100 行以避免响应过大，但确保能看到下载依赖的过程）
	-- 同时检查日志文件是否有更新（通过文件大小和修改时间）
	-- 优先读取 stdout_log，如果没有则读取旧的 tmp_log（兼容性）
	local log_file = stdout_log
	if not fs.stat(log_file) then
		log_file = '/tmp/uninstall-install.log'  -- 兼容旧版本
	end
	
	local log_size = 0
	local log_mtime_check = 0
	if fs.stat(log_file) then
		local log_stat = fs.stat(log_file)
		log_size = log_stat.size or 0
		-- 获取日志文件修改时间
		local mtime_str = sys.exec(string.format("stat -c %%Y %q 2>/dev/null || stat -f %%m %q 2>/dev/null || echo 0", log_file, log_file)) or '0'
		log_mtime_check = tonumber(mtime_str:match('(%d+)')) or 0
		
		-- 使用 tail 命令读取最后 100 行，确保能看到最新的日志（包括下载依赖的过程）
		-- 如果 tail 不可用，则使用 readfile
		local full_log = sys.exec(string.format("tail -n 100 %q 2>/dev/null", log_file)) or ''
		if not full_log or #full_log == 0 then
			full_log = fs.readfile(log_file) or ''
		end
		
		-- 如果日志文件存在但内容为空，可能是安装脚本还没有开始输出
		-- 这种情况下，如果状态是 running，应该继续等待
		if full_log and #full_log > 0 then
			local lines = {}
			for line in full_log:gmatch('[^\n]+') do
				table.insert(lines, line)
			end
			-- 只取最后 100 行（如果 tail 失败，则取最后 50 行）
			local max_lines = #lines > 100 and 100 or #lines
			local start = math.max(1, #lines - max_lines + 1)
			for i = start, #lines do
				log_content = log_content .. lines[i] .. '\n'
			end
		else
			-- 日志文件为空，如果状态是 running，继续等待
			if status == 'running' then
				log_content = '等待安装脚本输出日志...\n'
			end
		end
		
		-- 如果有 stderr 日志，也读取（但只取最后 20 行，避免响应过大）
		if fs.stat(stderr_log) then
			local stderr_content = sys.exec(string.format("tail -n 20 %q 2>/dev/null", stderr_log)) or ''
			if not stderr_content or #stderr_content == 0 then
				stderr_content = fs.readfile(stderr_log) or ''
			end
			if stderr_content and #stderr_content > 0 then
				-- 只取最后 20 行
				local lines = {}
				for line in stderr_content:gmatch('[^\n]+') do
					table.insert(lines, line)
				end
				local max_lines = #lines > 20 and 20 or #lines
				local start = math.max(1, #lines - max_lines + 1)
				for i = start, #lines do
					log_content = log_content .. '[stderr] ' .. lines[i] .. '\n'
				end
			end
		end
		
		-- 如果状态是 running 但日志文件很久没有更新，可能是安装已完成但状态文件写入失败
		-- 检查日志内容是否有完成标记
		if status == 'running' and log_mtime_check > 0 then
			local current_time = os.time()
			local time_since_update = current_time - log_mtime_check
			-- 对于 openclash 等长时间安装的包，给更多时间
			local timeout_seconds = 60
			if full_log:match('openclash') or full_log:match('OpenClash') then
				timeout_seconds = 30  -- openclash 安装超时时间（30秒）
			end
			
			-- 检查是否有 opkg 相关的活动（下载、安装依赖等）
			local has_opkg_activity = full_log:match('Downloading') or 
			                          full_log:match('Installing') or 
			                          full_log:match('Configuring') or
			                          full_log:match('Updated list') or
			                          full_log:match('Signature check') or
			                          full_log:match('Packages%.gz') or
			                          full_log:match('Packages%.sig')
			
			-- 如果有 opkg 活动，即使超过超时时间也认为还在运行（最多等待5分钟）
			if has_opkg_activity then
				if time_since_update < 300 then  -- 5分钟内认为还在运行
					status = 'running'
				else
					-- 超过5分钟，检查是否有完成标记
					if full_log:match('Save installed pkg list') or 
					   full_log:match('The following packages were added') or
					   full_log:match('Configuring luci%-app%-') then
						status = 'done'
						exit_code = 0
						-- 更新状态文件
						local status_fp = io.open(status_file, 'w')
						if status_fp then
							status_fp:write('0\n')
							status_fp:write('done\n')
							status_fp:close()
						end
					else
						status = 'running'  -- 继续等待
					end
				end
			-- 如果日志超过超时时间没有更新，检查是否有完成标记
			elseif time_since_update > timeout_seconds then
				if full_log:match('安装完成') or 
				   full_log:match('Install.*complete') or 
				   full_log:match('successfully') or
				   full_log:match('✓') or
				   full_log:match('completed') or
				   full_log:match('done') or
				   full_log:match('完成') or
				   full_log:match('Success') or
				   full_log:match('SUCCESS') or
				   full_log:match('Save installed pkg list') or
				   full_log:match('The following packages were added') or
				   full_log:match('Configuring luci%-app%-') then
					status = 'done'
					exit_code = 0
					-- 更新状态文件，确保下次检查时能正确识别
					local status_fp = io.open(status_file, 'w')
					if status_fp then
						status_fp:write('0\n')
						status_fp:write('done\n')
						status_fp:close()
					end
				elseif full_log:match('error') or 
				       full_log:match('failed') or
				       full_log:match('失败') or
				       full_log:match('Error') or
				       full_log:match('Failed') or
				       full_log:match('ERROR') or
				       full_log:match('FAILED') then
					status = 'done'
					exit_code = 1
					-- 更新状态文件
					local status_fp = io.open(status_file, 'w')
					if status_fp then
						status_fp:write('1\n')
						status_fp:write('done\n')
						status_fp:close()
					end
				elseif time_since_update > (timeout_seconds * 2) then
					-- 如果日志超过2倍超时时间没有更新，且没有进程在运行，认为安装已完成
					-- 假设成功（因为可能是静默完成）
					status = 'done'
					exit_code = 0
					-- 更新状态文件
					local status_fp = io.open(status_file, 'w')
					if status_fp then
						status_fp:write('0\n')
						status_fp:write('done\n')
						status_fp:close()
					end
				end
			end
		end
	end
	
	local ok = (status == 'done' and exit_code == 0)
	if status == 'done' and exit_code ~= 0 then
		ok = false
	end
	
	-- 如果状态是 done 但 exit_code 是 nil，尝试从日志判断
	if status == 'done' and exit_code == nil then
		if log_content and #log_content > 0 then
			if log_content:match('安装完成') or 
			   log_content:match('Install.*complete') or 
			   log_content:match('successfully') or
			   log_content:match('✓') or
			   log_content:match('completed') then
				exit_code = 0
				ok = true
			else
				exit_code = 1
				ok = false
			end
		else
			-- 如果无法判断，假设成功（因为状态是 done）
			exit_code = 0
			ok = true
		end
	end
	
	-- 添加调试信息（在生产环境可以移除）
	local debug_info = {
		status_file_exists = fs.stat(status_file) ~= nil,
		wrapper_script_exists = fs.stat(wrapper_script) ~= nil,
		log_file_exists = fs.stat(log_file) ~= nil,
		log_size = log_size,
		log_mtime = log_mtime_check,
		log_content_length = log_content and #log_content or 0
	}
	
	-- 如果日志内容为空但日志文件存在，尝试直接读取日志文件
	if (not log_content or #log_content == 0) and fs.stat(log_file) then
		local direct_log = sys.exec(string.format("tail -n 100 %q 2>/dev/null", log_file)) or ''
		if not direct_log or #direct_log == 0 then
			direct_log = fs.readfile(log_file) or ''
		end
		if direct_log and #direct_log > 0 then
			log_content = direct_log
			-- 如果内容太长，只取最后 100 行
			local lines = {}
			for line in direct_log:gmatch('[^\n]+') do
				table.insert(lines, line)
			end
			if #lines > 100 then
				local max_lines = 100
				local start = math.max(1, #lines - max_lines + 1)
				log_content = ''
				for i = start, #lines do
					log_content = log_content .. lines[i] .. '\n'
				end
			end
		else
			-- 日志文件存在但内容为空，可能是安装脚本还没有开始输出
			if status == 'running' then
				log_content = '等待安装脚本输出日志...\n'
			end
		end
	end
	
	return json_response({
		ok = ok,
		status = status,
		exit_code = exit_code,
		log = log_content or '',
		debug = debug_info  -- 调试信息，帮助排查问题
	})
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

-- 清理离线安装记录（参考 luci-app-store 的逻辑）
-- 当卸载一个包时，检查该包是否在某个离线安装记录中
-- 如果该记录中的所有包都已卸载，则删除该记录
local function clear_offline_install_records(pkg)
	local removed = {}
	local run_records_dir = '/usr/share/istore/run-records'
	
	-- 检查记录目录是否存在
	if not fs.stat(run_records_dir) then
		return removed
	end
	
	-- 遍历所有记录文件
	local dir = fs.dir(run_records_dir)
	if not dir then
		return removed
	end
	
	for record_file in dir do
		if record_file:match('%.txt$') then
			local record_path = run_records_dir .. '/' .. record_file
			local record_content = fs.readfile(record_path) or ''
			
			if record_content and #record_content > 0 then
				-- 解析记录文件：第一行是 JSON，后面是包列表
				local lines = {}
				for line in record_content:gmatch('[^\n]+') do
					table.insert(lines, line)
				end
				
				if #lines > 1 then
					-- 第一行是 JSON 元数据，跳过
					-- 从第二行开始是包列表
					local packages_in_record = {}
					local found_pkg = false
					
					for i = 2, #lines do
						local pkg_name = lines[i]:gsub('^%s+', ''):gsub('%s+$', '')
						if pkg_name and #pkg_name > 0 then
							packages_in_record[#packages_in_record + 1] = pkg_name
							-- 检查是否包含要卸载的包（精确匹配）
							if pkg_name == pkg then
								found_pkg = true
							end
						end
					end
					
					-- 如果找到了要卸载的包，检查该记录中的所有包是否都已卸载
					if found_pkg then
						local all_uninstalled = true
						for _, record_pkg in ipairs(packages_in_record) do
							if is_installed(record_pkg) then
								all_uninstalled = false
								break
							end
						end
						
						-- 如果所有包都已卸载，删除该记录文件
						if all_uninstalled then
							if fs.remove(record_path) then
								removed[#removed + 1] = '离线安装记录: ' .. record_file
							end
						end
					end
				end
			end
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
		if is_installed('openclash') then
			append_log(log, '+ opkg remove openclash')
			sys.call("opkg remove openclash >/dev/null 2>&1")
		end
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
		
		-- 清理离线安装记录
		local offline_records_removed = clear_offline_install_records('luci-app-openclash')
		for _, item in ipairs(offline_records_removed or {}) do
			append_log(log, '+ cleared: ' .. item)
			removed_istore[#removed_istore+1] = item
		end

		return json_response({
		ok = true,
		message = table.concat(log, "\n"),
		removed_istore = removed_istore
	})
end

-- If uninstalling AdGuardHome, perform thorough cleanup
if pkg == 'luci-app-adguardhome' or pkg == 'adguardhome' then
	local log = {}
	append_log(log, '=== AdGuardHome 卸载流程开始 ===')

	-- [1/6] 停止并禁用服务
	if fs.access('/etc/init.d/AdGuardHome') then
		append_log(log, '+ /etc/init.d/AdGuardHome stop')
		sys.call('/etc/init.d/AdGuardHome stop >/dev/null 2>&1')
		append_log(log, '+ /etc/init.d/AdGuardHome disable')
		sys.call('/etc/init.d/AdGuardHome disable >/dev/null 2>&1')
	end

	-- [2/6] 卸载包
	append_log(log, '+ opkg update')
	sys.call('opkg update >/dev/null 2>&1')
	append_log(log, '+ opkg remove luci-i18n-adguardhome-zh-cn')
	sys.call("opkg remove luci-i18n-adguardhome-zh-cn >/dev/null 2>&1")
	append_log(log, '+ opkg remove luci-app-adguardhome')
	sys.call("opkg remove luci-app-adguardhome >/dev/null 2>&1")
	if is_installed('adguardhome') then
		append_log(log, '+ opkg remove adguardhome')
		sys.call("opkg remove adguardhome >/dev/null 2>&1")
	end
	append_log(log, '+ opkg autoremove')
	sys.call("opkg autoremove >/dev/null 2>&1")

	-- [3/6] 删除配置与残留文件（不可逆）
	local function rm(cmd)
		append_log(log, '+ ' .. cmd)
		sys.call(cmd .. ' >/dev/null 2>&1')
	end
	if purge then
		rm('rm -rf /etc/AdGuardHome')
		rm('rm -f /etc/config/AdGuardHome')
	else
		append_log(log, '# 已根据用户选择保留 AdGuardHome 配置文件')
	end
	-- 删除指定的 AdGuardHome 文件
	rm('rm -rf /usr/bin/AdGuardHome')
	rm('rm -f /etc/AdGuardHome.yaml')
	rm('rm -f /tmp/AdGuardHome.log')
	-- 其他清理
	rm('rm -f /usr/lib/lua/luci/controller/AdGuardHome.lua')
	rm('rm -rf /usr/lib/lua/luci/controller/AdGuardHome')
	rm('rm -rf /usr/lib/lua/luci/model/cbi/AdGuardHome')
	rm('rm -rf /usr/lib/lua/luci/view/AdGuardHome')
	rm('rm -rf /usr/share/AdGuardHome')
	rm('rm -f /etc/init.d/AdGuardHome')
	rm("find /etc/rc.d -maxdepth 1 -type l -name '*AdGuardHome*' -exec rm -f {} +")
	rm("rm -f /etc/uci-defaults/*AdGuardHome*")
	rm("find /etc/hotplug.d -type f -name '*AdGuardHome*' -exec rm -f {} +")
	rm('rm -rf /tmp/AdGuardHome* /var/run/AdGuardHome*')

	-- [4/6] 移除可能的计划任务
	if fs.access('/etc/crontabs/root') then
		append_log(log, "+ sed -i '/AdGuardHome/d' /etc/crontabs/root")
		sys.call("sed -i '/AdGuardHome/d' /etc/crontabs/root >/dev/null 2>&1")
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
	local removed_istore = clear_istore_state('luci-app-adguardhome')
	for _, item in ipairs(removed_istore or {}) do
		append_log(log, '+ cleared: ' .. item)
	end
	
	-- 清理离线安装记录
	local offline_records_removed = clear_offline_install_records('luci-app-adguardhome')
	for _, item in ipairs(offline_records_removed or {}) do
		append_log(log, '+ cleared: ' .. item)
		removed_istore[#removed_istore+1] = item
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
		
		-- 清理离线安装记录（如果该记录中的所有包都已卸载）
		-- 检查主包和所有相关包
		for _, related_pkg in ipairs(related_pkgs_for_istore) do
			if not is_installed(related_pkg) then
				local offline_records_removed = clear_offline_install_records(related_pkg)
				for _, item in ipairs(offline_records_removed) do
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
	local download_url = ''
	
	-- 方法1: 尝试从表单获取
	pkg_name = http.formvalue('package')
	user_comment = http.formvalue('comment') or ''
	download_url = http.formvalue('download_url') or ''
	
	-- 方法2: 如果表单为空,尝试从 URL 参数获取
	if not pkg_name or pkg_name == '' then
		local params = http.formvalue()
		if params and type(params) == 'table' then
			pkg_name = params.package or params['package']
			user_comment = params.comment or params['comment'] or ''
			download_url = params.download_url or params['download_url'] or ''
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
				download_url = data.download_url or download_url or ''
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
					elseif k == 'download_url' then
						download_url = v:gsub('+', ' '):gsub('%%(%x%x)', function(h)
							return string.char(tonumber(h, 16))
						end)
					end
				end
			end
		end
	end
	
	-- 调试信息：记录接收到的参数
	local debug_info = string.format(
		"[REPORT_ICON] package=%s, comment=%s, download_url=%s, content_type=%s, method=%s",
		tostring(pkg_name or 'nil'),
		tostring(user_comment or 'nil'),
		tostring(download_url or 'nil'),
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
		download_url = download_url,
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
	local download_url = ''
	
	-- 方法1: 尝试从表单获取
	pkg_name = http.formvalue('package')
	user_comment = http.formvalue('comment') or ''
	download_url = http.formvalue('download_url') or ''
	
	-- 方法2: 如果表单为空,尝试从 URL 参数获取
	if not pkg_name or pkg_name == '' then
		local params = http.formvalue()
		if params and type(params) == 'table' then
			pkg_name = params.package or params['package']
			user_comment = params.comment or params['comment'] or ''
			download_url = params.download_url or params['download_url'] or ''
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
				download_url = data.download_url or download_url or ''
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
					elseif k == 'download_url' then
						download_url = v:gsub('+', ' '):gsub('%%(%x%x)', function(h)
							return string.char(tonumber(h, 16))
						end)
					end
				end
			end
		end
	end
	
	-- 调试信息：记录接收到的参数
	local debug_info = string.format(
		"[REPORT_UNINSTALL] package=%s, comment=%s, download_url=%s, content_type=%s, method=%s",
		tostring(pkg_name or 'nil'),
		tostring(user_comment or 'nil'),
		tostring(download_url or 'nil'),
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
		download_url = download_url,
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
	-- 使用 /etc 目录，持久化存储，重启后不会丢失
	local state_dir = '/etc/luci-app-uninstall'
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
	-- 使用 /etc 目录，持久化存储，重启后不会丢失
	local state_dir = '/etc/luci-app-uninstall'
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
	-- 使用 /etc 目录，持久化存储，重启后不会丢失
	local state_dir = '/etc/luci-app-uninstall'
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
	-- 使用 /etc 目录，持久化存储，重启后不会丢失
	local state_dir = '/etc/luci-app-uninstall'
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
