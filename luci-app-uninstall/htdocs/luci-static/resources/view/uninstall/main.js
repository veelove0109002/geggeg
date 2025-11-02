// SPDX-License-Identifier: Apache-2.0
'use strict';
'require view';
'require rpc';
'require ui';

return view.extend({
	// 预加载 iStoreOS 已安装页的中文名称映射
	load: function() {
		var self = this;
		return self._fetchStoreNames();
	},


	// Helper to fetch JSON across different LuCI versions
	_httpJson: function(url, options) {
		options = options || {};
		if (L && L.Request && typeof L.Request.request === 'function') {
			return L.Request.request(url, options).then(function(res){ return res.json(); });
		}
		if (typeof fetch === 'function') {
			options.credentials = 'include';
			return fetch(url, options).then(function(res){
				if (!res.ok) throw new Error('HTTP ' + res.status);
				return res.json();
			});
		}
		return Promise.reject(new Error('No HTTP client available'));
	},

	_storeNames: {},
	_fetchStoreNames: function(){
		var self = this;
		var url = '/cgi-bin/luci/admin/store/pages/installed';
		return self._httpJson(url, { headers: { 'Accept': 'application/json' } }).then(function(res){
			// 兼容返回结构：可能是 { list: [...] } 或 { data: { list: [...] } }
			var list = (res && res.list) || (res && res.data && res.data.list) || [];
			list.forEach(function(item){
				var en = item && (item.pkg || item.name || item.id);
				var zh = item && (item.title || item.cn || item.zh || item.name_cn);
				if (en && zh) {
					// 建立多种键的映射：完整名、去前缀、去前缀去横杆、全小写
					var full = String(en);
					var short = full.replace(/^luci-app-/, '');
					var shortNoDash = short.replace(/-/g, '');
					self._storeNames[full] = zh;
					self._storeNames[short] = zh;
					self._storeNames[shortNoDash] = zh;
					self._storeNames[full.toLowerCase()] = zh;
					self._storeNames[short.toLowerCase()] = zh;
					self._storeNames[shortNoDash.toLowerCase()] = zh;
				}
			});
			return self._storeNames;
		}).catch(function(){ return self._storeNames; });
	},

	pollList: function() {
		var self = this;
		function once(){ return self._httpJson(L.url('admin/vum/uninstall/list'), { headers: { 'Accept': 'application/json' } }); }
		return once().then(function(res){
			if (res && res.packages && res.packages.length > 0) return res;
			// retry up to 2 times with small delay
			return new Promise(function(resolve){ setTimeout(resolve, 300); }).then(once).then(function(r){
				if (r && r.packages && r.packages.length > 0) return r;
				return new Promise(function(resolve){ setTimeout(resolve, 500); }).then(once);
			});
		});
	},

	render: function() {
		var self = this;
		var root = E('div', { 'class': 'cbi-map' }, [
			E('h2', {}, _('高级卸载')),
			E('div', { 'class': 'cbi-section-descr' }, _('选择要卸载的已安装软件包。可选地同时删除其配置文件。')),
			(function(){
				var wrap = E('div', { 'style': 'margin:8px 0; display:flex; align-items:center;' }, []);
				var box = E('div', { 'style': 'flex:1; display:flex; align-items:center; gap:8px; background:#ffffff; border:1px solid #e5e7eb; border-radius:999px; padding:8px 12px;' }, []);
				var icon = E('span', { 'style': 'display:inline-flex; width:18px; height:18px; color:#6b7280;' }, '🔍');
				var input = E('input', { id: 'filter', type: 'text', placeholder: _('按包名或文件名搜索…'), 'style': 'flex:1; border:none; outline:none; box-shadow:none; -webkit-appearance:none; appearance:none; font-size:14px; color:#111827; background:transparent;' });
				var clearBtn = E('button', { id: 'filter-clear', type: 'button', 'style': 'display:none; background:#f3f4f6; border:1px solid #e5e7eb; color:#6b7280; border-radius:999px; padding:2px 8px; font-size:12px;' }, _('清除'));
				box.appendChild(icon); box.appendChild(input); box.appendChild(clearBtn); wrap.appendChild(box);
				input.addEventListener('input', function(){ clearBtn.style.display = input.value ? 'inline-block' : 'none'; });
				clearBtn.addEventListener('click', function(){ input.value=''; clearBtn.style.display='none'; input.dispatchEvent(new Event('input')); });
				return wrap;
			})()
		]);

		// Default icon (inline SVG as data URI)
		var DEFAULT_ICON = 'data:image/svg+xml;base64,' + btoa('<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#6b7280" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="7" width="18" height="14" rx="2" ry="2"/><path d="M9 7V5a3 3 0 0 1 6 0v2"/></svg>');
		// 特殊图标文件名映射（优先）
		var SPECIAL_ICON_MAP = {
			'luci-app-LingTiGameAcc': 'lingti-gameacc',
			'luci-app-baidupcs-web': 'baidupcs-web',
			'luci-app-hd-idle': 'hd-idle',
			'luci-app-feishuvpn': 'feishunet',
			'luci-app-ubuntu2': 'ubuntu',
			'luci-app-cupsd': 'cups',
			'luci-app-wan-mac': 'wan-mac',
			'luci-app-fogvdn': 'openfog',
			'luci-app-syncdial': 'syncdial',
			'luci-app-aliyundrive-webdav': 'aliyundrive-webdav',
			'luci-app-tailscaler': 'tailscale',
			'luci-app-webcontrol': 'webcontrol',
			'luci-app-timecontrol': 'webcontrol',
			'luci-app-control-weburl': 'webcontrol',
			'luci-app-control-webrestriction': 'webcontrol'
		};
		function packageIcon(name){
			// 从 app-icons 目录加载 PNG
			// 规则：luci-app-xxx[-yyy...] -> 移除前缀与横杆，得到 xxx[yyy].png
			// 特殊映射优先
			var base = SPECIAL_ICON_MAP[name];
			if (base) return L.resource('app-icons/' + base + '.png');
			// 例如：luci-app-ddns-go -> ddnsgo.png
			var short = (name || '').replace(/^luci-app-/, '').replace(/-/g, '');
			return L.resource('app-icons/' + short + '.png');
		}

		var grid = E('div', { 'class': 'card-grid', 'style': 'display:block;margin-top:8px;' });
		root.appendChild(grid);

		var NAME_MAP = {
			'luci-app-uninstall': _('高级卸载'),
			'luci-app-ttyd': _('Web终端'),
			'luci-app-samba4': _('文件共享'),
			'luci-app-aria2': _('离线下载'),
			'luci-app-upnp': _('UPnP端口映射'),
			'luci-app-ddns': _('动态域名'),
			'luci-app-ddnsto': _('DDNSTO路由远程'),
			'luci-app-wol': _('网络唤醒'),
			'luci-app-firewall': _('防火墙'),
			'luci-app-transmission': _('BT下载'),
			'luci-app-openvpn': _('OpenVPN'),
			'luci-app-wireguard': _('WireGuard'),
			'luci-app-sqm': _('智能队列管理'),
			'luci-app-adguardhome': _('广告过滤'),
			'luci-app-passwall': _('科学上网'),
			'luci-app-homeassistant': _('家庭助手'),
			'luci-app-dockerman': _('容器管理'),
			'luci-app-zerotier': _('ZeroTier'),
			'luci-app-ksmbd': _('SMB共享'),
			'luci-app-samba': _('Samba共享'),
			'luci-app-turboacc': _('网络加速'),
			'luci-app-mwan3': _('多线多拨'),
			'luci-app-mwan3helper': _('多线助手'),
			'luci-app-vlmcsd': _('KMS激活'),
			'luci-app-cpufreq': _('CPU频率'),
			'luci-app-cpuset': _('CPU集'),
			'luci-app-attendedsysupgrade': _('云升级'),
			'luci-app-statistics': _('统计监控'),
			'luci-app-nlbwmon': _('带宽监控'),
			'luci-app-tinyproxy': _('HTTP代理'),
			'luci-app-shadowsocks-libev': _('Shadowsocks'),
			'luci-app-smartdns': _('SmartDNS'),
			'luci-app-banip': _('IP封禁'),
			'luci-app-hd-idle': _('硬盘休眠'),
			'luci-app-mosdns': _('DNS加速'),
			'luci-app-netdata': _('Netdata监控'),
			'luci-app-minidlna': _('DLNA媒体'),
			'luci-app-frpc': _('Frp客户端'),
			'luci-app-frps': _('Frp服务端'),
			'luci-app-socat': _('端口转发'),
			'luci-app-kodexplorer': _('可道云'),
			'luci-app-qbittorrent': _('qBittorrent'),
			'luci-app-p910nd': _('打印服务器'),
			'luci-app-nft-qos': _('QoS管理'),
			'luci-app-brook': _('Brook代理'),
			'luci-app-openclash': _('OpenClash'),
			'luci-app-serverchan': _('微信通知'),
			'luci-app-alist': _('网盘索引'),
			'luci-app-ttyd': _('Web终端'),
			'luci-app-multiaccountdial': _('多账号多拨'),
			'luci-app-mtphotos': _('MTPhotos相册'),
			'luci-app-msd_lite': _('msd_lite'),
			'luci-app-modem': _('移动通信模组'),
			'luci-app-mfun': _('MFUN'),
			'luci-app-memos': _('Memos知识管理'),
			'luci-app-lucky': _('Lucky'),
			'luci-app-arpbind': _('ARP绑定'),
			'luci-app-LingTiGameAcc': _('灵缇加速器'),
			'luci-app-lanraragi': _('LANraragi电子书'),
			'luci-app-autotimeset': _('定时设置'),
			'luci-app-jackett': _('Jackett'),
			'luci-app-ittools': _('开发工具集'),
			'luci-app-baidupcs-web': _('BaiduPCS-Web'),
			'luci-app-istorepanel': _('1Panel'),
			'luci-app-istoredup': _('iStore分身(iStoreDup)'),
			'luci-app-immich': _('immich相册'),
			'luci-app-htreader': _('HTReader在线读书'),
			'luci-app-homebox': _('Homebox内网测速'),
			'luci-app-homeassistant': _('Home Assistant'),
			'luci-app-heimdall': _('Heimdall'),
			'luci-app-gowebdav': _('Go-WebDAV'),
			'luci-app-gogs': _('Gogs服务'),
			'luci-app-floatip': _('浮动网关'),
			'luci-app-feishuvpn': _('飞鼠p2p组网'),
			'luci-app-excalidraw': _('Excalidraw画板'),
			'luci-app-eqos': _('IP限速'),
			'luci-app-emby': _('Emby影院'),
			'luci-app-drawio': _('DrawIO绘图'),
			'luci-app-dpanel': _('DPanel 可视化面板'),
			'luci-app-chinesesubfinder': _('ChineseSubFinder中文'),
			'luci-app-clouddrive2': _('CloudDrive2'),
			'luci-app-ddns-go': _('DDNS-GO'),
			'luci-app-cupsd': _('CUPS打印服务'),
			'luci-app-cpulimit': _('CPU频率限制'),
			'luci-app-codeserver': _('CodeServer'),
			'luci-app-airconnect': _('AirConnect'),
			'luci-app-ubuntu2': _('Ubuntu'),
			'luci-app-transmission': _('Transmission'),
			'luci-app-aria2': _('Aria2下载器'),
			'luci-app-istoreenhance': _('KSpeeder(原iStore增强)'),
			'luci-app-routerdog': _('路由狗'),
			'luci-app-demon': _('容器魔王'),
			'luci-app-xunyou': _('迅游'),
			'luci-app-jellyfin': _('Jellyfin私有影院'),
			'luci-app-socat': _('Socat端口转发'),
			'luci-app-diskman': _('DiskMan磁盘管理'),
			'luci-app-linkease': _('易有云'),
			'luci-app-fogvdn': _('梨享雾计算OpenFog'),
			'luci-app-oneapi': _('OneAPI'),
			'luci-app-nut': _('Nut'),
			'luci-app-nps': _('Nps内网穿透'),
			'luci-app-npc': _('NPS内网穿透客户端'),
			'uci-app-nlbwmon': _('主机流量统计'),
			'luci-app-nextcloud': _('nextcloud'),
			'luci-app-netdata': _('NetData系统监控'),
			'luci-app-navidrome': _('Navidrome音乐'),
			'luci-app-natpierce': _('皎月连内网穿透'),
			'luci-app-mymind': _('MyMind思维导图'),
			'luci-app-openlist': _('OpenList网盘'),
			'luci-app-rclone': _('Rclone'),
			'luci-app-syncdial': _('多线多拨'),
			'luci-app-sunpanel': _('SunPanel导航页'),
			'luci-app-ap-modem': _('访问AP/光猫'),
			'luci-app-serverchan': _('微信推送ServerChan'),
			'luci-app-runmynas': _('RunMyNAS自定义固件'),
			'luci-app-rtbwmon': _('实时流量'),
			'luci-app-arcadia': _('Arcadia一站式代码运维'),
			'luci-app-rebatedog': _('旺财狗'),
			'luci-app-qbittorrent-ee': _('qBittorrent增强版'),
			'luci-app-pve': _('Proxmox虚拟机(PVE)'),
			'luci-app-pushbot': _('全能推送PushBot'),
			'luci-app-poweroff': _('关机'),
			'luci-app-plex': _('Plex影院'),
			'luci-app-photoprism': _('PhotoPrism相册管理'),
			'luci-app-pgyvpn': _('贝锐蒲公英'),
			'luci-app-penpot': _('Penpot设计平台'),
			'luci-app-owntone': _('Owntone音乐平台'),
			'luci-app-openwebui': _('OpenWebUI'),
			'luci-app-systools': _('系统便利工具'),
			'luci-app-airplay2': _('AirPlay2'),
			'luci-app-xunlei': _('迅雷下载'),
			'luci-app-xteve': _('Xteve'),
			'luci-app-xlnetacc': _('迅雷快鸟'),
			'luci-app-webvirtcloud': _('KVM虚拟机'),
			'luci-app-webcontrol': _('简单网络管控'),
			'luci-app-timecontrol': _('简单网络管控组件1'),
			'luci-app-control-weburl': _('简单网络管控组件2'),
			'luci-app-control-webrestriction': _('简单网络管控'),
			'luci-app-wan-mac': _('MAC地址生成器'),
			'luci-app-vsftpd': _('FTP服务器'),
			'luci-app-vaultwarden': _('Vaultwarden私人密码箱'),
			'luci-app-uugamebooster': _('UU游戏加速器'),
			'luci-app-uptimekuma': _('UptimeKuma'),
			'luci-app-unifi': _('Unifi控制器'),
			'luci-app-uhttpd': _('uHTTPd'),
			'luci-app-udpxy': _('udpxy'),
			'luci-app-alist': _('alist网盘'),
			'luci-app-typecho': _('TypeCho博客'),
			'luci-app-aliyundrive-webdav': _('阿里云盘WebDAV'),
			'luci-app-tailscaler': _('Tailscale')
		};
		function displayName(name, category){
			// iStoreOS 插件优先用商店中文名；否则 fallback 到内置映射或原名
			var zh = null;
			if (category === 'iStoreOS插件类') {
				zh = (name && self && self._storeNames && self._storeNames[name]) || null;
			}
			return zh || NAME_MAP[name] || name;
		}

		function renderCard(pkg){
			var isNew = false;
			if (pkg && pkg.install_time) {
				// install_time from backend is seconds since epoch
				isNew = ((Date.now() / 1000) - pkg.install_time) < 259200; // 3 days
			}
			var img = E('img', { src: packageIcon(pkg.name), alt: pkg.name, width: 56, height: 56, 'style': 'border-radius:10px;background:#f3f4f6;object-fit:contain;border:1px solid #e5e7eb;' });
			img.addEventListener('error', function(){ img.src = DEFAULT_ICON; });
			var titleCn = E('div', { 'style': 'font-weight:600;color:#111827;word-break:break-all;font-size:14px;' }, (pkg.display_name || displayName(pkg.name, pkg.category)));
			var titleEn = E('div', { 'style': 'font-size:12px;color:#6b7280;word-break:break-all;' }, pkg.name);
			var title = E('div', { 'style': 'display:flex; flex-direction:column; gap:2px;' }, [ titleCn, titleEn ]);
			// small inline icons for options
			var ICON_CFG = 'data:image/svg+xml;base64,' + btoa('<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6b7280" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7h18v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z"/><path d="M7 7V5a3 3 0 0 1 6 0v2"/></svg>');
			var ICON_DEP = 'data:image/svg+xml;base64,' + btoa('<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6b7280" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 1 7.07 0l1.41 1.41a5 5 0 1 1-7.07 7.07l-1.41-1.41"/><path d="M14 11a5 5 0 0 1-7.07 0L5.52 9.59a5 5 0 1 1 7.07-7.07L14 3.93"/></svg>');
			
			var verCorner = E('div', { 'style': 'position:absolute; right:12px; bottom:6px; font-size:12px; color:#111827; background:#f3f4f6; padding:2px 8px; border-radius:10px; border:1px solid #e5e7eb;' }, (pkg.version || ''));
			var purgeEl = E('input', { type: 'checkbox', checked: true, 'style': 'display:none;' });
			var makeSwitch = function(el){
				var baseOn = 'display:inline-block;width:36px;height:20px;background:#4f46e5;border-radius:999px;position:relative;transition:all .15s;';
				var baseOff = 'display:inline-block;width:36px;height:20px;background:#e5e7eb;border-radius:999px;position:relative;transition:all .15s;';
				var knobOn = 'position:absolute;top:2px;left:18px;width:16px;height:16px;background:#fff;border-radius:999px;box-shadow:0 1px 2px rgba(0,0,0,.15);';
				var knobOff = 'position:absolute;top:2px;left:2px;width:16px;height:16px;background:#fff;border-radius:999px;box-shadow:0 1px 2px rgba(0,0,0,.15);';
				var sw = E('span', { 'style': el.checked ? baseOn : baseOff });
				sw.appendChild(E('span', { 'style': el.checked ? knobOn : knobOff }));
				sw.addEventListener('click', function(ev){ ev.preventDefault(); el.checked = !el.checked; sw.firstChild.setAttribute('style', el.checked ? knobOn : knobOff); sw.setAttribute('style', el.checked ? baseOn : baseOff); });
				return sw;
			};
			var purgeLabel = E('label', { 'style': 'display:grid; grid-template-columns:16px auto auto; align-items:center; column-gap:6px; line-height:20px;' }, [ E('img', { src: ICON_CFG, width: 16, height: 16, 'style': 'display:inline-block;' }), _('删除配置文件'), makeSwitch(purgeEl) ]);
			var depsEl = E('input', { type: 'checkbox', checked: true, 'style': 'display:none;' });
			var depsLabel = E('label', { 'style': 'display:grid; grid-template-columns:16px auto auto; align-items:center; column-gap:6px; line-height:20px;' }, [ E('img', { src: ICON_DEP, width: 16, height: 16, 'style': 'display:inline-block;' }), _('卸载相关依赖'), makeSwitch(depsEl) ]);
			var cacheEl = E('input', { type: 'checkbox', checked: true, 'style': 'display:none;' });
			var cacheLabel = E('label', { 'style': 'display:grid; grid-template-columns:16px auto auto; align-items:center; column-gap:6px; line-height:20px;' }, [ E('img', { src: ICON_CFG, width: 16, height: 16, 'style': 'display:inline-block;' }), _('清空插件缓存'), makeSwitch(cacheEl) ]);
			var optionsRow = E('div', { 'style': 'display:flex; gap:12px; align-items:center; flex-wrap:wrap;' }, [ purgeLabel, depsLabel, cacheLabel ]);
			var btn = E('button', { type: 'button', 'class': 'btn cbi-button cbi-button-remove' }, _('卸载'));
			btn.addEventListener('click', function(ev){ ev.preventDefault(); ev.stopPropagation(); uninstall(pkg.name, purgeEl.checked, depsEl.checked, pkg.version || '', cacheEl.checked); });
			var metaTop = E('div', { 'style': 'display:flex; align-items:center; gap:8px; flex-wrap:wrap;' }, [ title ]);
			var metaCol = E('div', { 'class': 'pkg-meta', 'style': 'flex:1; display:flex; flex-direction:column; gap:6px;' }, [ metaTop, optionsRow ]);
			var actions = E('div', { 'class': 'pkg-actions', 'style': 'display:flex; align-items:center; margin-left:auto;' }, [ btn ]);
			var children = [ img, metaCol, actions, verCorner ];
			if (pkg.vum_plugin) children.push(E('div', { 'style': 'position:absolute; left:12px; bottom:6px; font-size:11px; color:#fff; background:#4f46e5; padding:2px 6px; border-radius:10px;' }, 'VUM-Plugin'));
			if (isNew) children.push(E('div', { 'style': 'position:absolute; left:12px; top:10px; font-size:11px; color:#fff; background:#f59e0b; padding:2px 6px; border-radius:10px;' }, _('新')));
			var card = E('div', { 'class': 'pkg-card', 'style': 'position:relative; display:flex; align-items:center; gap:12px; padding:14px 16px 36px 16px; border:1px solid #e5e7eb; border-radius:12px; background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%); box-shadow:0 1px 2px rgba(0,0,0,0.04); transition: transform .15s ease, box-shadow .15s ease;' }, children);
			card.addEventListener('mouseenter', function(){ card.style.transform = 'translateY(-2px)'; card.style.boxShadow = '0 6px 16px rgba(0,0,0,0.10)'; });
			card.addEventListener('mouseleave', function(){ card.style.transform = 'translateY(0)'; card.style.boxShadow = '0 1px 2px rgba(0,0,0,0.04)'; });
			return card;
		}

		function renderSection(title, items){
			if (!items || items.length === 0) return;
			var iconMap = {
				'VUM插件类': 'vumc.png',
				'iStoreOS插件类': 'isc.png',
				'其他插件类': 'qtc.png',
				'系统默认插件类': 'xtc.png'
			};
			var icon = iconMap[title] || 'folder.png';
			var header = E('div', { 'style': 'display:flex; align-items:center; justify-content:space-between;' }, [
				E('div', { 'style': 'display:flex; align-items:center; gap:12px;' }, [
					E('img', { src: L.resource('icons/' + icon), 'style': 'width:36px;height:36px; object-fit:contain;' }),
					(function(){
						var gradVUM = 'linear-gradient(90deg, #ede9fe 0%, #c4b5fd 50%, #7c3aed 100%)';
						var gradDefault = 'linear-gradient(90deg, #fff7e6 0%, #f3d081 50%, #e2b34c 100%)';
						var grad = (title === _('VUM插件类')) ? gradVUM : gradDefault;
						return E('h3', { 'style': 'margin:0; font-size:20px; color:#111827; font-weight:800; display:inline-block; padding:8px 12px; border-radius:12px; background: ' + grad + '; box-shadow: inset 0 0 6px rgba(255,255,255,0.6), inset 0 -2px 6px rgba(0,0,0,0.08);' }, title);
					})()
				])
			]);
			var groupGrid = E('div', { 'style': 'display:grid; grid-template-columns:repeat(auto-fill,minmax(320px,1fr)); gap:12px; margin-top:8px;' });
			items.forEach(function(p){ groupGrid.appendChild(renderCard(p)); });
			var section = E('div', { 'style': 'margin-bottom:8px;' }, [ header, groupGrid ]);
			grid.appendChild(section);
		}

		var FILE_SEARCH_CACHE = {};
		var searchSeq = 0;
		function refresh() {
			var curSeq = (++searchSeq);
			self.pollList().then(function(data){
				if (curSeq !== searchSeq) return; // 已过期
				var pkgs = (data && data.packages) || [];
				var q = (document.getElementById('filter').value || '').toLowerCase();
				var base = pkgs.filter(function(p){ return p.name && p.name.indexOf('luci-app-') === 0; });
				var list = base.filter(function(p){
					if (!q) return true;
					var zh = (typeof displayName === 'function') ? displayName(p.name, p.category) : (p.display_name || '');
					var byName = p.name && p.name.toLowerCase().includes(q);
					var byDisp = p.display_name && String(p.display_name).toLowerCase().includes(q);
					var byZh = zh && String(zh).toLowerCase().includes(q);
					return byName || byDisp || byZh;
				});
				function renderWith(listFinal){
					if (curSeq !== searchSeq) return; // 已过期
					while (grid.firstChild) grid.removeChild(grid.firstChild);
					var g_vum = [], g_istore = [], g_default = [], g_manual = [];
					listFinal.forEach(function(p){
						var cat = (p.category || '');
						if (cat === 'VUM插件类') g_vum.push(p);
						else if (cat === 'iStoreOS插件类') g_istore.push(p);
						else if (cat === '系统默认插件类') g_default.push(p);
						else if (cat === '其他插件类') g_manual.push(p);
						else g_manual.push(p);
					});
					renderSection(_('VUM插件类'), g_vum);
					renderSection(_('iStoreOS插件类'), g_istore);
					renderSection(_('其他插件类'), g_manual);
					renderSection(_('系统默认插件类'), g_default);
				}
				if (!q || q.length < 3) { renderWith(list); return; }
				// 文件名匹配（>=3字符才触发），结果缓存
				if (FILE_SEARCH_CACHE[q]) {
					var matchNames = FILE_SEARCH_CACHE[q];
					var nameSet = {};
					list.forEach(function(p){ nameSet[p.name] = true; });
					base.forEach(function(p){ if (matchNames.indexOf(p.name) !== -1) nameSet[p.name] = true; });
					var merged = base.filter(function(p){ return nameSet[p.name]; });
					renderWith(merged);
					return;
				}
				var url = L.url('admin/vum/uninstall/search_files') + '?q=' + encodeURIComponent(q);
				self._httpJson(url, { headers: { 'Accept': 'application/json' } }).then(function(res){
					if (curSeq !== searchSeq) return; // 已过期
					var matchNames = (res && res.packages) || [];
					FILE_SEARCH_CACHE[q] = matchNames;
					var nameSet = {};
					list.forEach(function(p){ nameSet[p.name] = true; });
					base.forEach(function(p){ if (matchNames.indexOf(p.name) !== -1) nameSet[p.name] = true; });
					var merged = base.filter(function(p){ return nameSet[p.name]; });
					renderWith(merged);
				}).catch(function(){ if (curSeq === searchSeq) renderWith(list); });
			}).catch(function(err){
				if (curSeq !== searchSeq) return;
				ui.addNotification(null, E('p', {}, _('加载软件包列表失败: ') + String(err)), 'danger');
			});
		}

		function uninstall(name, purge, removeDeps, version, clearCache) {
			var confirmFn = function(msg, desc){
				return new Promise(function(resolve){
					var titleRow = E('div', { 'style': 'display:flex; align-items:center; gap:8px;' }, [
						E('span', { 'style': 'display:inline-flex;width:28px;height:28px;background:#fee2e2;color:#b91c1c;border-radius:999px;align-items:center;justify-content:center;font-weight:700;' }, '!'),
						E('span', { 'style': 'font-weight:600;font-size:16px;color:#111827;' }, _('卸载确认'))
					]);
					var zhHeader = displayName(name);
					var headerName = zhHeader && zhHeader !== name ? (zhHeader + ' (' + name + ')') : name;
					var headerInfo = E('div', { 'style': 'margin-top:8px; display:flex; align-items:center; justify-content:space-between;' }, [
						E('div', { 'style': 'font-size:18px; font-weight:700; color:#111827;' }, headerName),
						E('div', { 'style': 'display:flex; align-items:center; gap:10px;' }, [
							E('span', { 'style': 'font-size:12px; color:#6b7280; background:#f3f4f6; border:1px solid #e5e7eb; border-radius:999px; padding:2px 8px;' }, (version || '')),
							E('img', { src: packageIcon(name), 'style': 'width:32px; height:32px; border-radius:6px; background:#f3f4f6; border:1px solid #e5e7eb; object-fit:contain;' })
						])
					]);
					var warnBar = E('div', { 'style': 'margin-top:8px; border-radius:8px; padding:8px 10px; background: linear-gradient(90deg, #fff1f2 0%, #ffe4e6 50%, #fecaca 100%); color:#7f1d1d; display:flex; align-items:center; gap:8px;' }, [
						E('span', { 'style': 'display:inline-flex;width:20px;height:20px;background:#fca5a5;color:#7f1d1d;border-radius:999px;align-items:center;justify-content:center;font-weight:700;' }, '!'),
						E('span', {}, _('此操作将卸载插件，可能影响系统功能，请谨慎操作。'))
					]);
					var body = E('div', { 'style': 'margin-top:8px;color:#374151;line-height:1.6;' }, [
						E('div', {}, msg),
						desc ? E('div', { 'style': 'margin-top:4px;color:#6b7280;' }, desc) : ''
					]);
					var cancelBtn = E('button', { 'class': 'btn', 'style': 'background:#eef2ff;color:#1f2937;border-radius:999px;padding:6px 14px;' }, _('取消'));
					var okBtn = E('button', { 'class': 'btn', 'style': 'background:#2563eb;color:#fff;border-radius:999px;padding:6px 14px;' }, _('确定'));
					var footer = E('div', { 'style':'margin-top:12px;display:flex;gap:8px;justify-content:flex-end;' }, [ cancelBtn, okBtn ]);
					var modal = ui.showModal(headerName, [ titleRow, headerInfo, warnBar, body, footer ]);
					var overlay = modal && modal.parentNode; if (overlay) { overlay.style.display = 'flex'; overlay.style.alignItems = 'center'; overlay.style.justifyContent = 'center'; }
					cancelBtn.addEventListener('click', function(){ ui.hideModal(modal); resolve(false); });
					okBtn.addEventListener('click', function(){ ui.hideModal(modal); resolve(true); });
				});
			};
			var zhName = displayName(name);
			var fullName = zhName && zhName !== name ? (zhName + ' (' + name + ')') : name;
			var descParts = [];
			if (purge) descParts.push(_('同时删除配置文件。'));
			if (removeDeps) descParts.push(_('同时卸载相关依赖。'));
			if (clearCache) descParts.push(_('同时清空插件缓存。'));
			return confirmFn((_('确定卸载包 %s ？').format ? _('确定卸载包 %s ？').format(fullName) : '确定卸载包 ' + fullName + ' ？'), descParts.join(' ')).then(function(ok) {
				if (!ok) return;

				// 日志弹窗
				var statusBar = E('div', { 'style': 'display:flex; align-items:center; justify-content:space-between; gap:8px; margin-bottom:8px;' }, [
					E('div', { 'style': 'display:flex; align-items:center; gap:8px;' }, [
						E('span', { 'style': 'display:inline-flex;width:22px;height:22px;background:#fde68a;color:#92400e;border-radius:999px;align-items:center;justify-content:center;font-weight:700;' }, '…'),
						E('span', { 'style': 'font-weight:600;color:#f59e0b;' }, _('正在卸载'))
					]),
					E('div', { 'style': 'display:flex; align-items:center; gap:10px;' }, [
						E('span', { 'style': 'font-size:12px; color:#6b7280; background:#f3f4f6; border:1px solid #e5e7eb; border-radius:999px; padding:2px 8px;' }, (version || '')),
						E('img', { src: packageIcon(name), 'style': 'width:24px; height:24px; border-radius:6px; background:#f3f4f6; border:1px solid #e5e7eb; object-fit:contain;' })
					])
				]);
				var log = E('pre', { 'style': 'max-height:260px;overflow:auto;background:linear-gradient(180deg,#0b1024 0%,#0f1633 100%);color:#cbd5e1;padding:10px;border-radius:8px; box-shadow: inset 0 0 8px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.06); transition: filter .15s ease;' }, '');
				log.addEventListener('mouseenter', function(){ log.style.filter = 'brightness(1.08)'; });
				log.addEventListener('mouseleave', function(){ log.style.filter = 'none'; });
				var closeBtn = E('button', { 'class': 'btn', disabled: true }, _('关闭'));
				var zhName2 = displayName(name);
				var fullName2 = zhName2 && zhName2 !== name ? (zhName2 + ' (' + name + ')') : name;
				var startTs = Date.now();
				var elapsedEl = E('span', { 'style': 'font-size:12px;color:#6b7280;' }, '0s');
				var timer = setInterval(function(){ var s = Math.floor((Date.now() - startTs) / 1000); elapsedEl.textContent = s + 's'; }, 1000);
				var progressTrack = E('div', { 'style': 'height:6px;border-radius:999px;background:#0f1838;overflow:hidden;' });
				var progressBar = E('div', { 'style': 'height:6px;width:0%;background:#22c55e;box-shadow:0 0 8px rgba(34,197,94,.6);transition: width .25s ease;' });
				progressTrack.appendChild(progressBar);
				function setProgress(p){ progressBar.style.width = Math.max(0, Math.min(100, p)) + '%'; }
				var statusIconEl = E('span', { 'style': 'display:inline-flex;width:22px;height:22px;background:#fde68a;color:#92400e;border-radius:999px;align-items:center;justify-content:center;font-weight:700;' }, '…');
				var statusTextEl = E('span', { 'style': 'font-weight:600;color:#f59e0b;' }, _('正在卸载'));
				var statusBar = E('div', { 'style': 'display:flex; flex-direction:column; gap:8px; margin-bottom:8px;' }, [
					E('div', { 'style': 'display:flex; align-items:center; justify-content:space-between; gap:8px;' }, [
						E('div', { 'style': 'display:flex; align-items:center; gap:8px;' }, [ statusIconEl, statusTextEl, elapsedEl ]),
						E('div', { 'style': 'display:flex; align-items:center; gap:10px;' }, [
							E('span', { 'style': 'font-size:12px; color:#6b7280; background:#f3f4f6; border:1px solid #e5e7eb; border-radius:999px; padding:2px 8px;' }, (version || '')),
							E('img', { src: packageIcon(name), 'style': 'width:24px; height:24px; border-radius:6px; background:#f3f4f6; border:1px solid #e5e7eb; object-fit:contain;' })
						])
					]),
					E('div', { 'style': 'font-size:15px;font-weight:700;color:#e5e7eb;' }, fullName2),
					progressTrack
				]);
				var modal = ui.showModal(_('正在卸载…') + ' ' + fullName2, [
					statusBar,
					log,
					E('div', { 'style':'margin-top:10px;display:flex;gap:8px;justify-content:flex-end;' }, [ closeBtn ])
				]);
				var overlay = modal && modal.parentNode; if (overlay) { overlay.style.display = 'flex'; overlay.style.alignItems = 'center'; overlay.style.justifyContent = 'center'; }
				function println(s){ log.appendChild(document.createTextNode(String(s) + '\n')); log.scrollTop = log.scrollHeight; }
				var opSuccess = false;
				function enableClose(){
					closeBtn.disabled = false;
					closeBtn.textContent = opSuccess ? _('返回列表') : _('查看详情');
					closeBtn.addEventListener('click', function(){
						if (opSuccess) { ui.hideModal(modal); window.location.reload(); }
						else { log.style.maxHeight = '420px'; log.scrollTop = log.scrollHeight; }
					});
				}

				var token = (L.env && (L.env.token || L.env.csrf_token)) || '';
				var removeUrl = L.url('admin/vum/uninstall/remove') + (token ? ('?token=' + encodeURIComponent(token)) : '');
				var formBody = 'package=' + encodeURIComponent(name) + '&purge=' + (purge ? '1' : '0') + '&removeDeps=' + (removeDeps ? '1' : '0') + '&clearCache=' + (clearCache ? '1' : '0');

				println('> POST ' + removeUrl);
				println('> body: ' + formBody);
				setProgress(25);
				return self._httpJson(removeUrl, {
					method: 'POST',
					headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8', 'Accept': 'application/json', 'X-CSRF-Token': token },
					body: formBody
				}).then(function(res){
					println('< Response: ' + JSON.stringify(res));
					if (res && res.ok) {
						setProgress(100);
						println(_('卸载成功'));
						clearInterval(timer);
						statusIconEl.textContent = '✓';
						statusIconEl.setAttribute('style', 'display:inline-flex;width:22px;height:22px;background:#dcfce7;color:#065f46;border-radius:999px;align-items:center;justify-content:center;font-weight:700;');
						statusTextEl.textContent = _('卸载完成');
						statusTextEl.setAttribute('style', 'font-weight:600;color:#065f46;');
						var statusDone = E('div', { 'style': 'display:flex; align-items:center; gap:8px; margin:8px 0 0 0;' }, [
							E('span', { 'style': 'display:inline-flex;width:22px;height:22px;background:#dcfce7;color:#065f46;border-radius:999px;align-items:center;justify-content:center;font-weight:700;' }, '✓'),
							E('span', { 'style': 'font-weight:600;color:#065f46;' }, _('卸载完成'))
						]);
						log.parentNode.insertBefore(statusDone, log.nextSibling);
						opSuccess = true;
						enableClose();
						ui.addNotification(null, E('p', {}, _('卸载成功')), 'success');
						refresh();
						return;
					}
					println('! POST 失败或返回非成功，尝试 GET…');
					var q = L.url('admin/vum/uninstall/remove') + '?' +
						(token ? ('token=' + encodeURIComponent(token) + '&') : '') +
						('package=' + encodeURIComponent(name) + '&purge=' + (purge ? '1' : '0') + '&removeDeps=' + (removeDeps ? '1' : '0'));
					println('> GET ' + q);
					setProgress(60);
					return self._httpJson(q, { method: 'GET', headers: { 'Accept': 'application/json' } }).then(function(r2){
						println('< Response: ' + JSON.stringify(r2));
						if (r2 && r2.ok) {
							setProgress(100);
							println(_('卸载成功'));
							clearInterval(timer);
							statusIconEl.textContent = '✓';
							statusIconEl.setAttribute('style', 'display:inline-flex;width:22px;height:22px;background:#dcfce7;color:#065f46;border-radius:999px;align-items:center;justify-content:center;font-weight:700;');
							statusTextEl.textContent = _('卸载完成');
							statusTextEl.setAttribute('style', 'font-weight:600;color:#065f46;');
							opSuccess = true;
							ui.addNotification(null, E('p', {}, _('卸载成功')), 'success');
							refresh();
						} else {
							setProgress(100);
							clearInterval(timer);
							progressBar.style.background = '#ef4444';
							progressBar.style.boxShadow = '0 0 8px rgba(239,68,68,.6)';
							println(_('卸载失败'));
							statusIconEl.textContent = '✕';
							statusIconEl.setAttribute('style', 'display:inline-flex;width:22px;height:22px;background:#fee2e2;color:#7f1d1d;border-radius:999px;align-items:center;justify-content:center;font-weight:700;');
							statusTextEl.textContent = _('卸载失败');
							statusTextEl.setAttribute('style', 'font-weight:600;color:#7f1d1d;');
							ui.addNotification(null, E('p', {}, _('卸载失败')), 'danger');
						}
						enableClose();
					});
				}).catch(function(err){
					println('! Error: ' + String(err));
					setProgress(100);
					clearInterval(timer);
					progressBar.style.background = '#ef4444';
					progressBar.style.boxShadow = '0 0 8px rgba(239,68,68,.6)';
					statusIconEl.textContent = '✕';
					statusIconEl.setAttribute('style', 'display:inline-flex;width:22px;height:22px;background:#fee2e2;color:#7f1d1d;border-radius:999px;align-items:center;justify-content:center;font-weight:700;');
					statusTextEl.textContent = _('卸载失败');
					statusTextEl.setAttribute('style', 'font-weight:600;color:#7f1d1d;');
					var statusFail2 = E('div', { 'style': 'display:flex; align-items:center; gap:8px; margin:8px 0 0 0;' }, [
						E('span', { 'style': 'display:inline-flex;width:22px;height:22px;background:#fee2e2;color:#7f1d1d;border-radius:999px;align-items:center;justify-content:center;font-weight:700;' }, '✕'),
						E('span', { 'style': 'font-weight:600;color:#7f1d1d;' }, _('卸载失败'))
					]);
					log.parentNode.insertBefore(statusFail2, log.nextSibling);
					ui.addNotification(null, E('p', {}, _('卸载失败') + '：' + String(err)), 'danger');
					enableClose();
				});
			});
		}

		var searchTimer;
		root.addEventListener('input', function(ev) {
			if (ev.target && ev.target.id === 'filter') {
				if (searchTimer) clearTimeout(searchTimer);
				searchTimer = setTimeout(refresh, 250);
			}
		});
		root.addEventListener('click', function(ev){ if (ev.target && ev.target.id === 'filter-clear') { if (searchTimer) clearTimeout(searchTimer); searchTimer = setTimeout(refresh, 10); } });

		// 拉取自身版本并显示徽标
		self._httpJson(L.url('admin/vum/uninstall/version'), { headers: { 'Accept': 'application/json' } }).then(function(res){
			var v = res && res.version;
			var el = document.getElementById('uninstall-version');
			if (el && v && v.length > 0) { el.textContent = v; el.style.display = 'inline-block'; }
		}).catch(function(){});

		refresh();
		return root;
	}

});