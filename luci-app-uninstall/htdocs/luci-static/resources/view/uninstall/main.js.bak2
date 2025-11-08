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
		var selectedPackages = {}; // 存储选中的包
		var selectAllState = false; // 全选状态
		
		// 添加美化的复选框样式
		var styleEl = E('style', {}, `
			.custom-checkbox-wrapper {
				position: relative;
				display: inline-flex;
				align-items: center;
				justify-content: center;
				cursor: pointer;
			}
			.custom-checkbox-wrapper input[type="checkbox"] {
				position: absolute;
				opacity: 0;
				width: 0;
				height: 0;
				margin: 0;
				padding: 0;
			}
			.custom-checkbox {
				position: relative;
				width: 22px;
				height: 22px;
				border: 2px solid #d1d5db;
				border-radius: 6px;
				background: #ffffff;
				transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
				display: flex;
				align-items: center;
				justify-content: center;
				box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
			}
			.custom-checkbox:hover {
				border-color: #4f46e5;
				box-shadow: 0 2px 4px rgba(79, 70, 229, 0.15);
				transform: scale(1.05);
			}
			.custom-checkbox-wrapper input[type="checkbox"]:checked + .custom-checkbox {
				background: linear-gradient(135deg, #4f46e5 0%, #6366f1 100%);
				border-color: #4f46e5;
				box-shadow: 0 2px 8px rgba(79, 70, 229, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2);
			}
			.custom-checkbox-wrapper input[type="checkbox"]:checked + .custom-checkbox:hover {
				background: linear-gradient(135deg, #6366f1 0%, #818cf8 100%);
				box-shadow: 0 4px 12px rgba(79, 70, 229, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.2);
				transform: scale(1.08);
			}
			.custom-checkbox::after {
				content: '';
				position: absolute;
				width: 5px;
				height: 10px;
				border: solid white;
				border-width: 0 2px 2px 0;
				transform: rotate(45deg) scale(0);
				transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1);
				opacity: 0;
			}
			.custom-checkbox-wrapper input[type="checkbox"]:checked + .custom-checkbox::after {
				transform: rotate(45deg) scale(1);
				opacity: 1;
			}
			.custom-checkbox-wrapper input[type="checkbox"]:indeterminate + .custom-checkbox {
				background: linear-gradient(135deg, #6366f1 0%, #818cf8 100%);
				border-color: #6366f1;
			}
			.custom-checkbox-wrapper input[type="checkbox"]:indeterminate + .custom-checkbox::after {
				content: '';
				width: 10px;
				height: 2px;
				border: none;
				background: white;
				transform: scale(1);
				opacity: 1;
				border-radius: 1px;
			}
			.custom-checkbox-wrapper input[type="checkbox"]:focus + .custom-checkbox {
				outline: 2px solid rgba(79, 70, 229, 0.3);
				outline-offset: 2px;
			}
			.custom-checkbox-wrapper.pkg-checkbox-wrapper {
				margin-right: 8px;
			}
			.custom-checkbox-wrapper.select-all-checkbox-wrapper {
				display: inline-flex;
			}
		`);
		document.head.appendChild(styleEl);
		
		var root = E('div', { 'class': 'cbi-map' }, [
			E('h2', {}, _('高级卸载')),
			E('div', { 'class': 'cbi-section-descr' }, _('选择要卸载的已安装软件包。可选地同时删除其配置文件。')),
			(function(){
				var wrap = E('div', { 'style': 'margin:8px 0; display:flex; align-items:center;' }, []);
				var box = E('div', { 'style': 'flex:1; display:flex; align-items:center; gap:8px; background:#ffffff; border:1px solid #e5e7eb; border-radius:999px; padding:8px 12px;' }, []);
				var icon = E('img', { src: L.resource('icons/ss.svg'), 'style': 'display:inline-block; width:22px; height:22px; object-fit:contain;' });
				var input = E('input', { id: 'filter', type: 'text', placeholder: _('按包名或文件名搜索…'), 'style': 'flex:1; border:none; outline:none; box-shadow:none; -webkit-appearance:none; appearance:none; font-size:14px; color:#111827; background:transparent;' });
				var clearBtn = E('button', { id: 'filter-clear', type: 'button', 'style': 'display:none; background:#f3f4f6; border:1px solid #e5e7eb; color:#6b7280; border-radius:999px; padding:2px 8px; font-size:12px;' }, _('清除'));
				box.appendChild(icon); box.appendChild(input); box.appendChild(clearBtn); wrap.appendChild(box);
				input.addEventListener('input', function(){ clearBtn.style.display = input.value ? 'inline-block' : 'none'; });
				clearBtn.addEventListener('click', function(){ input.value=''; clearBtn.style.display='none'; input.dispatchEvent(new Event('input')); });
				return wrap;
			})(),
			// 批量操作工具栏
			(function(){
				var toolbar = E('div', { 
					id: 'batch-toolbar',
					'style': 'margin:8px 0; display:flex; align-items:center; gap:12px; padding:10px 16px; background:linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%); border:1px solid #bae6fd; border-radius:12px; box-shadow:0 2px 4px rgba(0,0,0,0.05); position:sticky; top:0; z-index:100; backdrop-filter:saturate(160%) blur(6px); -webkit-backdrop-filter:saturate(160%) blur(6px);'
				}, []);
				
				// 全选复选框 - 美化版本
				var selectAllCheckbox = E('input', { type: 'checkbox', id: 'select-all' });
				var selectAllCheckboxWrapper = E('div', { 'class': 'custom-checkbox-wrapper select-all-checkbox-wrapper' }, [
					selectAllCheckbox,
					E('span', { 'class': 'custom-checkbox' })
				]);
				var selectAllLabel = E('label', { 
					'for': 'select-all',
					'style': 'display:inline-flex; align-items:center; gap:8px; cursor:pointer; font-weight:600; color:#0369a1; user-select:none; line-height:1;'
				}, [
					selectAllCheckboxWrapper,
					E('span', { 'style': 'line-height:1; display:inline-block; vertical-align:middle;' }, _('全选'))
				]);
				
				// 已选数量显示
				var selectedCount = E('span', { 
					id: 'selected-count',
					'style': 'font-size:13px; color:#6b7280; padding:4px 12px; background:#ffffff; border:1px solid #e5e7eb; border-radius:999px;'
				}, _('已选: 0'));
				
				// 批量卸载按钮
				var batchUninstallBtn = E('button', {
					id: 'batch-uninstall-btn',
					type: 'button',
					'class': 'btn cbi-button cbi-button-remove',
					'style': 'margin-left:auto; opacity:0.5; cursor:not-allowed;',
					disabled: true
				}, _('批量卸载'));
				
				toolbar.appendChild(selectAllLabel);
				toolbar.appendChild(selectedCount);
				toolbar.appendChild(batchUninstallBtn);
				
				return toolbar;
			})()
		]);

		// Default icon (使用 wz.png)
		var DEFAULT_ICON = L.resource('icons/wz.png');
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
			'luci-app-control-webrestriction': 'webcontrol',
			'luci-app-argon-config': 'zt',
			'luci-app-quickstart': 'ks',
			'luci-app-store': 'istoreos',
			'luci-app-nikki': 'niki',
			'luci-app-passwall': 'ps',
			'luci-app-cloudflared': 'ct',
			'luci-app-adguardhome': 'ad',
			'luci-app-openclash': 'oc',
			'luci-app-cifs-mount': 'cifs',
			'luci-app-cpufreq': 'cpu',
			'luci-app-ddns': 'ddns',
			'luci-app-diskman': 'disk',
			'luci-app-dockerman': 'docker',
			'luci-app-fan': 'fs',
			'luci-app-filetransfer': 'wj',
			'luci-app-firewall': 'fhq',
			'luci-app-hd-idle': 'ypxm',
			'luci-app-mergerfs': 'hbwj',
			'luci-app-nfs': 'nfs',
			'luci-app-oaf': 'oaf',
			'luci-app-ota': 'ota',
			'luci-app-package-manager': 'gl',
			'luci-app-samba4': 'gx',
			'luci-app-ttyd': 'zd',
			'luci-app-unishare': 'lh',
			'luci-app-upnp': 'upnp',
			'luci-app-wol': 'hx'
		};
		function packageIcon(name){
			// 从 app-icons 目录加载 PNG
			// 规则：luci-app-xxx[-yyy...] -> 移除前缀与横杆，得到 xxx[yyy].png
			// 特殊映射优先
			var base = SPECIAL_ICON_MAP[name];
			if (base) return L.resource('app-icons/' + base + '.png');
			if (name === 'luci-app-uninstall') return L.resource('app-icons/gjxz.png');
			// 例如：luci-app-ddns-go -> ddnsgo.png
			var short = (name || '').replace(/^luci-app-/, '').replace(/-/g, '');
			return L.resource('app-icons/' + short + '.png');
		}

		var grid = E('div', { 'class': 'card-grid', 'style': 'display:block;margin-top:8px;' });
		root.appendChild(grid);

		var NAME_MAP = {
			'luci-app-uninstall': _('高级卸载'),
			'luci-app-cifs-mount': _('挂载cifs'),
			'luci-app-fan': _('风扇'),
			'luci-app-filetransfer': _('文件传输'),
			'luci-app-mergerfs': _('合并文件系统'),
			'luci-app-nfs': _('NFS'),
			'luci-app-oaf': _('OAF'),
			'luci-app-ota': _('OTA'),
			'luci-app-package-manager': _('软件包管理器'),
			'luci-app-unishare': _('联合共享'),
			'luci-app-argon-config': _('Argon 主题设置'),
			'luci-app-quickstart': _('快速开始'),
			'luci-app-store': _('iStore'),
			'luci-app-ttyd': _('Web终端'),
			'luci-app-samba4': _('文件共享'),
			'luci-app-aria2': _('离线下载'),
			'luci-app-upnp': _('UPnP端口映射'),
			'luci-app-ddns': _('动态域名'),
			'luci-app-nikki': _('NIKKI'),
			'luci-app-cloudflared': _('Cloudflare Tunnel'),
			'luci-app-ddnsto': _('DDNSTO路由远程'),
			'luci-app-wol': _('网络唤醒'),
			'luci-app-firewall': _('防火墙'),
			'luci-app-transmission': _('BT下载'),
			'luci-app-openvpn': _('OpenVPN'),
			'luci-app-wireguard': _('WireGuard'),
			'luci-app-sqm': _('智能队列管理'),
			'luci-app-adguardhome': _('AdguardHome'),
			'luci-app-passwall': _('PassWall'),
			'luci-app-cloudflared': _('Cloudflare Tunnel'),
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
			// 批量选择复选框 - 美化版本
			var checkbox = E('input', { 
				type: 'checkbox',
				'class': 'pkg-checkbox',
				'data-pkg-name': pkg.name
			});
			checkbox.checked = selectedPackages[pkg.name] || false;
			var checkboxWrapper = E('div', { 'class': 'custom-checkbox-wrapper pkg-checkbox-wrapper' }, [
				checkbox,
				E('span', { 'class': 'custom-checkbox' })
			]);
			// 点击包装器也能切换复选框
			checkboxWrapper.addEventListener('click', function(ev){
				ev.preventDefault();
				ev.stopPropagation();
				checkbox.checked = !checkbox.checked;
				checkbox.dispatchEvent(new Event('change'));
			});
			checkbox.addEventListener('change', function(){
				if (this.checked) {
					selectedPackages[pkg.name] = { 
						name: pkg.name, 
						version: pkg.version || '',
						purge: purgeEl.checked,
						deps: depsEl.checked,
						cache: cacheEl.checked
					};
				} else {
					delete selectedPackages[pkg.name];
				}
				updateBatchUI();
			});
			
		var img = E('img', { src: packageIcon(pkg.name), alt: pkg.name, width: 56, height: 56, 'style': 'border-radius:10px;background:#f3f4f6;object-fit:contain;border:1px solid #e5e7eb;' });
		img.addEventListener('error', function(){ img.src = DEFAULT_ICON; });
			
			var titleCn = E('div', { 'style': 'font-weight:600;color:#111827;word-break:break-all;font-size:14px;' }, (pkg.display_name || displayName(pkg.name, pkg.category)));
			var titleEn = E('div', { 'style': 'font-size:12px;color:#6b7280;word-break:break-all;' }, pkg.name);
			var title = E('div', { 'style': 'display:flex; flex-direction:column; gap:2px;' }, [ titleCn, titleEn ]);
			// small inline icons for options
			var ICON_PURGE = L.resource('app-icons/pz.png');
			var ICON_CACHE = L.resource('app-icons/qk.png');
			var ICON_DEP = 'data:image/svg+xml;base64,' + btoa('<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6b7280" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 1 7.07 0l1.41 1.41a5 5 0 1 1-7.07 7.07l-1.41-1.41"/><path d="M14 11a5 5 0 0 1-7.07 0L5.52 9.59a5 5 0 1 1 7.07-7.07L14 3.93"/></svg>');
			function optionIcon(src){
				return E('span', { 'style': 'display:inline-flex;width:18px;height:18px;align-items:center;justify-content:center;' }, [
					E('img', { src: src, width: 16, height: 16, 'style': 'display:inline-block;object-fit:contain;' })
				]);
			}
			
			var verCorner = E('div', { 'style': 'position:absolute; right:12px; bottom:6px; font-size:12px; color:#111827; background:#f3f4f6; padding:2px 8px; border-radius:10px; border:1px solid #e5e7eb;' }, (pkg.version || ''));
			if (pkg && pkg.name === 'luci-app-uninstall') verCorner.id = 'uninstall-card-version';
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
			var purgeLabel = E('label', { 'style': 'display:grid; grid-template-columns:18px auto auto; align-items:center; column-gap:6px; line-height:20px;' }, [ optionIcon(ICON_PURGE), _('删除配置文件'), makeSwitch(purgeEl) ]);
			var depsEl = E('input', { type: 'checkbox', checked: true, 'style': 'display:none;' });
			var depsLabel = E('label', { 'style': 'display:grid; grid-template-columns:18px auto auto; align-items:center; column-gap:6px; line-height:20px;' }, [ optionIcon(ICON_DEP), _('卸载相关依赖'), makeSwitch(depsEl) ]);
			var cacheEl = E('input', { type: 'checkbox', checked: true, 'style': 'display:none;' });
			var cacheLabel = E('label', { 'style': 'display:grid; grid-template-columns:18px auto auto; align-items:center; column-gap:6px; line-height:20px;' }, [ optionIcon(ICON_CACHE), _('清空插件缓存'), makeSwitch(cacheEl) ]);
			var optionsRow = E('div', { 'style': 'display:flex; gap:12px; align-items:center; flex-wrap:wrap;' }, [ purgeLabel, depsLabel, cacheLabel ]);
			var btn = E('button', { type: 'button', 'class': 'btn cbi-button cbi-button-remove' }, _('卸载'));
			btn.addEventListener('click', function(ev){ ev.preventDefault(); ev.stopPropagation(); uninstall(pkg.name, purgeEl.checked, depsEl.checked, pkg.version || '', cacheEl.checked); });
			var metaTop = E('div', { 'style': 'display:flex; align-items:center; gap:8px; flex-wrap:wrap;' }, [ title ]);
		var metaCol = E('div', { 'class': 'pkg-meta', 'style': 'flex:1; display:flex; flex-direction:column; gap:6px;' }, [ metaTop, optionsRow ]);
		var actions = E('div', { 'class': 'pkg-actions', 'style': 'display:flex; align-items:center; margin-left:auto;' }, [ btn ]);
		var children = [ checkboxWrapper, img, metaCol, actions, verCorner ];
		if (pkg.vum_plugin) children.push(E('div', { 'style': 'position:absolute; left:12px; bottom:6px; font-size:11px; color:#fff; background:#4f46e5; padding:2px 6px; border-radius:10px;' }, 'VUM-Plugin'));
		if (isNew) children.push(E('img', { src: L.resource('icons/new.png'), 'style': 'position:absolute; left:12px; top:8px; width:24px; height:24px; object-fit:contain;' }));
		
	// 在卡片左下角添加上报图标按钮(排除 luci-app-uninstall 自身)
	if (pkg && pkg.name !== 'luci-app-uninstall') {
		var reportIconBtn = E('button', {
			type: 'button',
			title: _('上报图标问题'),
			'style': 'position:absolute; left:' + (pkg.vum_plugin ? '100px' : '12px') + '; bottom:6px; width:28px; height:28px; padding:0; background:#ffffff; border:1px solid #e5e7eb; border-radius:50%; display:flex; align-items:center; justify-content:center; cursor:pointer; box-shadow:0 1px 3px rgba(0,0,0,0.1); transition:all .15s ease; color:#6b7280; overflow:hidden;'
		}, [
			E('img', { 
				src: L.resource('icons/copy.png'), 
				alt: 'report', 
				width: 16, 
				height: 16,
				'style': 'display:block; object-fit:contain;'
			})
		]);
		reportIconBtn.addEventListener('mouseenter', function(){ 
			this.style.transform = 'translateY(-2px)'; 
			this.style.background = '#ff6b6b';
			this.style.borderColor = '#ff6b6b';
			this.style.boxShadow = '0 3px 8px rgba(255,107,107,0.3)';
			this.style.color = '#ffffff';
		});
		reportIconBtn.addEventListener('mouseleave', function(){ 
			this.style.transform = 'translateY(0)'; 
			this.style.background = '#ffffff';
			this.style.borderColor = '#e5e7eb';
			this.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
			this.style.color = '#6b7280';
		});
		reportIconBtn.addEventListener('click', function(ev){
			ev.preventDefault();
			ev.stopPropagation();
			reportIcon(pkg.name);
		});
		children.push(reportIconBtn);
	}
			// 顶部右侧：仅在“高级卸载”卡片上展示图标按钮与远端版本
			if (pkg && pkg.name === 'luci-app-uninstall') {
				var actionsTop = E('div', { 'style': 'position:absolute; right:10px; top:8px; display:flex; gap:8px; align-items:center; z-index:1000; pointer-events:auto;' }, [
					E('span', { id: 'remote-version', 'style': 'font-size:12px; color:#111827; background:#e0f2fe; border:1px solid #93c5fd; border-radius:999px; padding:2px 8px; display:none; pointer-events:none;' }, ''),
					E('button', { id: 'update-action', type: 'button', 'style': 'width:32px;height:32px; padding:0; display:none; align-items:center; justify-content:center; border-radius:50% !important; background:#ffffff; border:1px solid #e5e7eb; box-shadow:0 2px 6px rgba(0,0,0,0.06); cursor:pointer; line-height:0; box-sizing:border-box; overflow:hidden; user-select:none;' }, [
						E('span', { 'style': 'display:inline-flex; width:20px; height:20px; border-radius:50%; overflow:hidden;' }, [
							E('img', { src: L.resource('icons/update.png'), alt: 'update', 'style': 'width:20px;height:20px; object-fit:contain; display:block; image-rendering:auto;' })
						])
					])
				]);
				children.push(actionsTop);
			}
			var card = E('div', { 'class': 'pkg-card', 'style': 'position:relative; display:flex; align-items:center; gap:12px; padding:20px 16px 42px 16px; border:1px solid #e5e7eb; border-radius:12px; background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%); box-shadow:0 1px 2px rgba(0,0,0,0.04); transition: transform .15s ease, box-shadow .15s ease; overflow:visible;' }, children);
			card.addEventListener('mouseenter', function(){ card.style.transform = 'translateY(-2px)'; card.style.boxShadow = '0 6px 16px rgba(0,0,0,0.10)'; });
			card.addEventListener('mouseleave', function(){ card.style.transform = 'translateY(0)'; card.style.boxShadow = '0 1px 2px rgba(0,0,0,0.04)'; });
			return card;
		}

		// 更新批量操作UI
		function updateBatchUI() {
			var count = Object.keys(selectedPackages).length;
			var countEl = document.getElementById('selected-count');
			var batchBtn = document.getElementById('batch-uninstall-btn');
			var selectAllCb = document.getElementById('select-all');
			
			if (countEl) countEl.textContent = _('已选: ') + count;
			
			if (batchBtn) {
				if (count > 0) {
					batchBtn.disabled = false;
					batchBtn.style.opacity = '1';
					batchBtn.style.cursor = 'pointer';
				} else {
					batchBtn.disabled = true;
					batchBtn.style.opacity = '0.5';
					batchBtn.style.cursor = 'not-allowed';
				}
			}
			
			// 更新全选复选框状态
			if (selectAllCb) {
				var allCheckboxes = document.querySelectorAll('.pkg-checkbox');
				var checkedCount = document.querySelectorAll('.pkg-checkbox:checked').length;
				selectAllCb.checked = allCheckboxes.length > 0 && checkedCount === allCheckboxes.length;
				selectAllCb.indeterminate = checkedCount > 0 && checkedCount < allCheckboxes.length;
			}
		}
		
		function renderSection(title, items){
			if (!items || items.length === 0) return;
			var iconMap = {
				'VUM-Plugin类': 'vumc.png',
				'iStoreOS插件类': 'isc.png',
				'其他插件类': 'qtc.png',
				'系统默认插件类': 'xtc.png'
			};
			var icon = iconMap[title] || 'folder.png';
			var header = E('div', { 'style': 'display:flex; align-items:center; justify-content:space-between;' }, [
				E('div', { 'style': 'display:flex; align-items:center; gap:12px;' }, [
					E('img', { src: L.resource('icons/' + icon), 'style': 'width:36px;height:36px; object-fit:contain;' }),
					(function(){
						// 统一使用 iStoreOS 插件类的渐变色（半透明果冻玻璃效果）
						var grad = 'linear-gradient(90deg, rgba(240,245,255,0.6) 0%, rgba(230,240,255,0.6) 50%, rgba(219,228,255,0.6) 100%)';
						var style = 'margin:0; font-size:20px; color:rgba(17,24,39,0.72); font-weight:800; display:inline-block; padding:8px 16px; border-radius:14px; background: ' + grad + '; backdrop-filter: saturate(160%) blur(10px); -webkit-backdrop-filter: saturate(160%) blur(10px); border:1px solid rgba(255,255,255,0.45); box-shadow: 0 2px 8px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.25)';
						return E('h3', { 'style': style }, title);
					})()
				])
			]);
			var groupGrid = E('div', { 'style': 'display:grid; grid-template-columns:repeat(auto-fill,minmax(380px,1fr)); gap:12px; margin-top:8px;' });
			items.forEach(function(p){ groupGrid.appendChild(renderCard(p)); });
			var section = E('div', { 'style': 'margin-bottom:8px;' }, [ header, groupGrid ]);
			grid.appendChild(section);
		}

		function checkUpdate(){
			self._httpJson(L.url('admin/vum/uninstall/check_update'), { headers: { 'Accept': 'application/json' } }).then(function(res){
				var cur = (res && res.current) || (function(){ var el = document.getElementById('uninstall-card-version'); return el ? (el.textContent||'').trim() : ''; })();
				var latest = (res && res.latest) || '';
				var badge = document.getElementById('remote-version');
				var btn = document.getElementById('update-action');
				if (badge) badge.textContent = latest || '';
				if (latest && cur && latest === cur) {
					if (badge) badge.style.display = 'none';
					if (btn) btn.style.display = 'none';
				} else {
					if (badge) badge.style.display = latest ? 'inline-block' : 'none';
					if (btn) btn.style.display = 'inline-flex';
				}
				/* 静默：仅更新徽标/按钮可见性，不弹全局通知 */
			}).catch(function(err){ /* silent */ });
		}
		function doUpgrade(){
			// 进度 + 日志 UI
			var statusIconEl = E('span', { 'style': 'display:inline-flex;width:22px;height:22px;background:#fde68a;color:#92400e;border-radius:999px;align-items:center;justify-content:center;font-weight:700;' }, '…');
			var statusTextEl = E('span', { 'style': 'font-weight:600;color:#f59e0b;' }, _('正在升级'));
			var elapsedEl = E('span', { 'style': 'font-size:12px;color:#6b7280;' }, '0s');
			var progressTrack = E('div', { 'style': 'height:6px;border-radius:999px;background:#0f1838;overflow:hidden;' });
			var progressBar = E('div', { 'style': 'height:6px;width:0%;background:#22c55e;box-shadow:0 0 8px rgba(34,197,94,.6);transition: width .25s ease;' });
			progressTrack.appendChild(progressBar);
			function setProgress(p){ progressBar.style.width = Math.max(0, Math.min(100, p)) + '%'; }
			var topRow = E('div', { 'style': 'display:flex; align-items:center; justify-content:space-between; gap:8px;' }, [
				E('div', { 'style': 'display:flex; align-items:center; gap:8px;' }, [ statusIconEl, statusTextEl, elapsedEl ]),
				E('div', { 'style': 'display:flex; align-items:center; gap:10px;' }, [
					E('span', { 'style': 'font-size:12px; color:#6b7280; background:#f3f4f6; border:1px solid #e5e7eb; border-radius:999px; padding:2px 8px;' }, _('在线升级')),
					E('img', { src: L.resource('icons/update.png'), 'style': 'width:20px; height:20px; border-radius:6px; background:#f3f4f6; border:1px solid #e5e7eb; object-fit:contain;' })
				])
			]);
			var statusBar = E('div', { 'style': 'display:flex; flex-direction:column; gap:8px; margin-bottom:8px;' }, [
				topRow,
				E('div', { 'style': 'font-size:15px;font-weight:700;color:#e5e7eb;' }, _('luci-app-uninstall')),
				progressTrack
			]);
			// 日志折叠/展开按钮
			var logExpanded = false;
			var toggleLogBtn = E('button', { 
				type: 'button',
				'class': 'btn',
				'style': 'font-size:12px; padding:4px 10px; background:#f3f4f6; border:1px solid #e5e7eb; color:#6b7280; border-radius:6px; cursor:pointer;'
			}, _('展开日志'));
			
			var log = E('pre', { 'style': 'max-height:0;overflow:hidden;background:linear-gradient(180deg,#0b1024 0%,#0f1633 100%);color:#cbd5e1;padding:0 10px;border-radius:8px; box-shadow: inset 0 0 8px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.06); transition: max-height .3s ease, padding .3s ease;' }, '');
			
			toggleLogBtn.addEventListener('click', function(){
				logExpanded = !logExpanded;
				if (logExpanded) {
					log.style.maxHeight = '260px';
					log.style.padding = '10px';
					log.style.overflow = 'auto';
					toggleLogBtn.textContent = _('折叠日志');
					toggleLogBtn.style.background = '#e0f2fe';
					toggleLogBtn.style.color = '#0369a1';
				} else {
					log.style.maxHeight = '0';
					log.style.padding = '0 10px';
					log.style.overflow = 'hidden';
					toggleLogBtn.textContent = _('展开日志');
					toggleLogBtn.style.background = '#f3f4f6';
					toggleLogBtn.style.color = '#6b7280';
				}
			});
			
			function println(s){ log.appendChild(document.createTextNode(String(s) + '\n')); log.scrollTop = log.scrollHeight; }
			var closeBtn = E('button', { 'class': 'btn', disabled: true }, _('关闭'));
			var logSection = E('div', { 'style': 'display:flex; flex-direction:column; gap:8px;' }, [
				E('div', { 'style': 'display:flex; align-items:center; justify-content:space-between;' }, [
					E('span', { 'style': 'font-size:13px; color:#6b7280; font-weight:600;' }, _('执行日志')),
					toggleLogBtn
				]),
				log
			]);
			var modal = ui.showModal(_('正在升级…') + ' luci-app-uninstall', [ statusBar, logSection, E('div', { 'style':'margin-top:10px;display:flex;gap:8px;justify-content:flex-end;' }, [ closeBtn ]) ]);
			var overlay = modal && modal.parentNode; if (overlay) { overlay.style.display = 'flex'; overlay.style.alignItems = 'center'; overlay.style.justifyContent = 'center'; }
			var startTs = Date.now();
			var timer = setInterval(function(){ var s = Math.floor((Date.now() - startTs) / 1000); elapsedEl.textContent = s + 's'; }, 1000);
			// 模拟阶段性进度（请求未返回前最多到 90%）
			setProgress(10);
			var autoProg = 10;
			var progTimer = setInterval(function(){ if (autoProg < 90) { autoProg += 1; setProgress(autoProg); } }, 300);
			// 执行请求
			println('> GET ' + L.url('admin/vum/uninstall/upgrade'));
			self._httpJson(L.url('admin/vum/uninstall/upgrade'), { headers: { 'Accept': 'application/json' } }).then(function(res){
				println('< ' + JSON.stringify(res));
				clearInterval(progTimer);
				clearInterval(timer);
				if (res && res.ok) {
					setProgress(100);
					statusIconEl.textContent = '✓';
					statusIconEl.setAttribute('style', 'display:inline-flex;width:22px;height:22px;background:#dcfce7;color:#065f46;border-radius:999px;align-items:center;justify-content:center;font-weight:700;');
					statusTextEl.textContent = _('升级完成');
					statusTextEl.setAttribute('style', 'font-weight:600;color:#065f46;');
					closeBtn.disabled = false;
					closeBtn.textContent = _('返回页面');
					closeBtn.addEventListener('click', function(){ ui.hideModal(modal); window.location.reload(); });
				} else {
					setProgress(100);
					progressBar.style.background = '#ef4444';
					progressBar.style.boxShadow = '0 0 8px rgba(239,68,68,.6)';
					statusIconEl.textContent = '✕';
					statusIconEl.setAttribute('style', 'display:inline-flex;width:22px;height:22px;background:#fee2e2;color:#7f1d1d;border-radius:999px;align-items:center;justify-content:center;font-weight:700;');
					statusTextEl.textContent = _('升级失败');
					statusTextEl.setAttribute('style', 'font-weight:600;color:#7f1d1d;');
					closeBtn.disabled = false;
					closeBtn.textContent = _('关闭');
					closeBtn.addEventListener('click', function(){ ui.hideModal(modal); });
				}
			}).catch(function(err){
				clearInterval(progTimer);
				clearInterval(timer);
				println('! ' + String(err));
				setProgress(100);
				progressBar.style.background = '#ef4444';
				progressBar.style.boxShadow = '0 0 8px rgba(239,68,68,.6)';
				statusIconEl.textContent = '✕';
				statusIconEl.setAttribute('style', 'display:inline-flex;width:22px;height:22px;background:#fee2e2;color:#7f1d1d;border-radius:999px;align-items:center;justify-content:center;font-weight:700;');
				statusTextEl.textContent = _('升级失败');
				statusTextEl.setAttribute('style', 'font-weight:600;color:#7f1d1d;');
				closeBtn.disabled = false;
				closeBtn.textContent = _('关闭');
				closeBtn.addEventListener('click', function(){ ui.hideModal(modal); });
			});
		}
		function updateAction(){
			self._httpJson(L.url('admin/vum/uninstall/check_update'), { headers: { 'Accept': 'application/json' } }).then(function(res){
				var cur = (res && res.current) || (function(){ var el = document.getElementById('uninstall-card-version'); return el ? (el.textContent||'').trim() : ''; })();
				var latest = (res && res.latest) || '';
				var has = !!(res && res.available);
				var badge = document.getElementById('remote-version');
				if (badge) { badge.textContent = latest || ''; badge.style.display = latest ? 'inline-block' : 'none'; }
				if (has) {
					// 有新版本，弹出确认后再升级
					var msg = E('div', { 'style': 'max-width:520px;' }, [
						E('div', { 'style': 'display:flex; align-items:center; gap:8px; margin:0 0 8px 0;' }, [
							E('img', { src: packageIcon('luci-app-uninstall'), 'style': 'width:28px; height:28px; border-radius:6px; background:#f3f4f6; border:1px solid #e5e7eb; object-fit:contain;' }),
							E('span', { 'style': 'font-weight:600;color:#111827;' }, _('高级卸载'))
						]),
						E('p', { 'style': 'margin:0 0 8px 0;' }, _('检测到新版本：') + (latest || '')),
						E('p', { 'style': 'margin:0 0 8px 0; color:#6b7280;' }, _('当前版本：') + (cur || '')),
						res && res.changelog ? E('pre', { 'style': 'margin:8px 0 0 0; white-space:pre-wrap; background:#f3f4f6; color:#374151; padding:8px; border-radius:6px;' }, String(res.changelog)) : E('span', {}, '')
					]);
					var modal = ui.showModal(_('确认升级到最新版本？'), [
						msg,
						E('div', { 'style':'margin-top:10px;display:flex;gap:8px;justify-content:flex-end;' }, [
							E('button', { 'class': 'btn', id: 'cancel-upgrade' }, _('取消')),
							E('button', { 'class': 'btn cbi-button cbi-button-apply', id: 'confirm-upgrade' }, _('立即升级'))
						])
					]);
					var overlay = modal && modal.parentNode; if (overlay) { overlay.style.display = 'flex'; overlay.style.alignItems = 'center'; overlay.style.justifyContent = 'center'; }
					var cancelBtn = modal.querySelector('#cancel-upgrade');
					var okBtn = modal.querySelector('#confirm-upgrade');
					if (cancelBtn) cancelBtn.addEventListener('click', function(){ ui.hideModal(modal); });
					if (okBtn) okBtn.addEventListener('click', function(){ ui.hideModal(modal); doUpgrade(); });
				} else if (res && res.url) {
					var msg2 = E('div', { 'style': 'max-width:520px;' }, [
						E('p', { 'style': 'margin:0 0 8px 0;' }, _('未获取到最新版本号，但提供了升级包。')),
						E('p', { 'style': 'margin:0 0 8px 0; color:#6b7280;' }, _('当前版本：') + (cur || '')),
						E('code', { 'style': 'display:inline-block; padding:2px 6px; background:#f3f4f6; border:1px solid #e5e7eb; border-radius:6px; color:#374151;' }, String(res.url || ''))
					]);
					var modal2 = ui.showModal(_('是否按提供地址进行升级？'), [
						msg2,
						E('div', { 'style':'margin-top:10px;display:flex;gap:8px;justify-content:flex-end;' }, [
							E('button', { 'class': 'btn', id: 'cancel-upgrade' }, _('取消')),
							E('button', { 'class': 'btn cbi-button cbi-button-apply', id: 'confirm-upgrade' }, _('立即升级'))
						])
					]);
					var overlay2 = modal2 && modal2.parentNode; if (overlay2) { overlay2.style.display = 'flex'; overlay2.style.alignItems = 'center'; overlay2.style.justifyContent = 'center'; }
					var cancelBtn2 = modal2.querySelector('#cancel-upgrade');
					var okBtn2 = modal2.querySelector('#confirm-upgrade');
					if (cancelBtn2) cancelBtn2.addEventListener('click', function(){ ui.hideModal(modal2); });
					if (okBtn2) okBtn2.addEventListener('click', function(){ ui.hideModal(modal2); doUpgrade(); });
				}
			}).catch(function(err){ /* silent */ });
		}

		function updateAction(){
			self._httpJson(L.url('admin/vum/uninstall/check_update'), { headers: { 'Accept': 'application/json' } }).then(function(res){
				var cur = (res && res.current) || (function(){ var el = document.getElementById('uninstall-card-version'); return el ? (el.textContent||'').trim() : ''; })();
				var latest = (res && res.latest) || '';
				var has = !!(res && res.available);
				var badge = document.getElementById('remote-version');
				if (badge) { badge.textContent = latest || ''; badge.style.display = latest ? 'inline-block' : 'none'; }
				if (has) {
					var msg = E('div', { 'style': 'max-width:520px;' }, [
						E('div', { 'style': 'display:flex; align-items:center; gap:8px; margin:0 0 8px 0;' }, [
							E('img', { src: packageIcon('luci-app-uninstall'), 'style': 'width:28px; height:28px; border-radius:6px; background:#f3f4f6; border:1px solid #e5e7eb; object-fit:contain;' }),
							E('span', { 'style': 'font-weight:600;color:#111827;' }, _('高级卸载'))
						]),
						E('p', { 'style': 'margin:0 0 8px 0;' }, _('检测到新版本：') + (latest || '')),
						E('p', { 'style': 'margin:0 0 8px 0; color:#6b7280;' }, _('当前版本：') + (cur || '')),
						res && res.changelog ? E('pre', { 'style': 'margin:8px 0 0 0; white-space:pre-wrap; background:#f3f4f6; color:#374151; padding:8px; border-radius:6px;' }, String(res.changelog)) : E('span', {}, '')
					]);
					var modal = ui.showModal(_('确认升级到最新版本？'), [
						msg,
						E('div', { 'style':'margin-top:10px;display:flex;gap:8px;justify-content:flex-end;' }, [
							E('button', { 'class': 'btn', id: 'cancel-upgrade' }, _('取消')),
							E('button', { 'class': 'btn cbi-button cbi-button-apply', id: 'confirm-upgrade' }, _('立即升级'))
						])
					]);
					var overlay = modal && modal.parentNode; if (overlay) { overlay.style.display = 'flex'; overlay.style.alignItems = 'center'; overlay.style.justifyContent = 'center'; }
					var cancelBtn = modal.querySelector('#cancel-upgrade');
					var okBtn = modal.querySelector('#confirm-upgrade');
					if (cancelBtn) cancelBtn.addEventListener('click', function(){ ui.hideModal(modal); });
					if (okBtn) okBtn.addEventListener('click', function(){ ui.hideModal(modal); doUpgrade(); });
				} else if (res && res.url) {
					var msg2 = E('div', { 'style': 'max-width:520px;' }, [
						E('p', { 'style': 'margin:0 0 8px 0;' }, _('未获取到最新版本号，但提供了升级包。')),
						E('p', { 'style': 'margin:0 0 8px 0; color:#6b7280;' }, _('当前版本：') + (cur || '')),
						E('code', { 'style': 'display:inline-block; padding:2px 6px; background:#f3f4f6; border:1px solid #e5e7eb; border-radius:6px; color:#374151;' }, String(res.url || ''))
					]);
					var modal2 = ui.showModal(_('是否按提供地址进行升级？'), [
						msg2,
						E('div', { 'style':'margin-top:10px;display:flex;gap:8px;justify-content:flex-end;' }, [
							E('button', { 'class': 'btn', id: 'cancel-upgrade' }, _('取消')),
							E('button', { 'class': 'btn cbi-button cbi-button-apply', id: 'confirm-upgrade' }, _('立即升级'))
						])
					]);
					var overlay2 = modal2 && modal2.parentNode; if (overlay2) { overlay2.style.display = 'flex'; overlay2.style.alignItems = 'center'; overlay2.style.justifyContent = 'center'; }
					var cancelBtn2 = modal2.querySelector('#cancel-upgrade');
					var okBtn2 = modal2.querySelector('#confirm-upgrade');
					if (cancelBtn2) cancelBtn2.addEventListener('click', function(){ ui.hideModal(modal2); });
					if (okBtn2) okBtn2.addEventListener('click', function(){ ui.hideModal(modal2); doUpgrade(); });
				}
				// 无更新：静默不弹全局通知
			}).catch(function(err){ /* silent */ });
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
						if (cat === 'VUM-Plugin类') g_vum.push(p);
						else if (cat === 'iStoreOS插件类') g_istore.push(p);
						else if (cat === '系统默认插件类') g_default.push(p);
						else if (cat === '其他插件类') g_manual.push(p);
						else g_manual.push(p);
					});
					renderSection(_('VUM-Plugin类'), g_vum);
					renderSection(_('iStoreOS插件类'), g_istore);
					renderSection(_('其他插件类'), g_manual);
					renderSection(_('系统默认插件类'), g_default);
					// 渲染后重新检查升级状态，避免按钮误显
					try { checkUpdate(); } catch (e) {}
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
			});
		}

		// 批量卸载函数
		function batchUninstall() {
			var packages = Object.values(selectedPackages);
			if (packages.length === 0) {
				ui.addNotification(null, E('p', {}, _('请先选择要卸载的软件包')), 'warning');
				return;
			}
			
			// 确认对话框
			var confirmFn = function(){
				return new Promise(function(resolve){
					var titleRow = E('div', { 'style': 'display:flex; align-items:center; gap:8px;' }, [
						E('span', { 'style': 'display:inline-flex;width:28px;height:28px;background:#fee2e2;color:#b91c1c;border-radius:999px;align-items:center;justify-content:center;font-weight:700;' }, '!'),
						E('span', { 'style': 'font-weight:600;font-size:16px;color:#111827;' }, _('批量卸载确认'))
					]);
					
					var pkgList = E('div', { 'style': 'max-height:200px; overflow:auto; margin:12px 0; padding:12px; background:#f9fafb; border:1px solid #e5e7eb; border-radius:8px;' }, []);
					packages.forEach(function(pkg, idx){
						var zhName = displayName(pkg.name);
						var fullName = zhName && zhName !== pkg.name ? (zhName + ' (' + pkg.name + ')') : pkg.name;
						pkgList.appendChild(E('div', { 'style': 'padding:4px 0; color:#374151;' }, (idx + 1) + '. ' + fullName));
					});
					
					var warnBar = E('div', { 'style': 'margin-top:8px; border-radius:8px; padding:8px 10px; background: linear-gradient(90deg, #fff1f2 0%, #ffe4e6 50%, #fecaca 100%); color:#7f1d1d; display:flex; align-items:center; gap:8px;' }, [
						E('span', { 'style': 'display:inline-flex;width:20px;height:20px;background:#fca5a5;color:#7f1d1d;border-radius:999px;align-items:center;justify-content:center;font-weight:700;' }, '!'),
						E('span', {}, _('即将卸载 ') + packages.length + _(' 个软件包，此操作不可撤销！'))
					]);
					
					var cancelBtn = E('button', { 'class': 'btn', 'style': 'background:#eef2ff;color:#1f2937;border-radius:999px;padding:6px 14px;' }, _('取消'));
					var okBtn = E('button', { 'class': 'btn', 'style': 'background:#dc2626;color:#fff;border-radius:999px;padding:6px 14px;' }, _('确定卸载'));
					var footer = E('div', { 'style':'margin-top:12px;display:flex;gap:8px;justify-content:flex-end;' }, [ cancelBtn, okBtn ]);
					
					var modal = ui.showModal(_('批量卸载确认'), [ titleRow, pkgList, warnBar, footer ]);
					var overlay = modal && modal.parentNode; if (overlay) { overlay.style.display = 'flex'; overlay.style.alignItems = 'center'; overlay.style.justifyContent = 'center'; }
					
					cancelBtn.addEventListener('click', function(){ ui.hideModal(modal); resolve(false); });
					okBtn.addEventListener('click', function(){ ui.hideModal(modal); resolve(true); });
				});
			};
			
			return confirmFn().then(function(ok){
				if (!ok) return;
				
				// 执行批量卸载
				var currentIndex = 0;
				var successCount = 0;
				var failCount = 0;
				
				// 创建进度弹窗
				var progressText = E('div', { 'style': 'font-size:15px; font-weight:600; color:#111827; margin-bottom:8px;' }, _('正在批量卸载...'));
				var progressBar = E('div', { 'style': 'height:8px; background:#e5e7eb; border-radius:999px; overflow:hidden; margin-bottom:12px;' }, [
					E('div', { id: 'batch-progress-bar', 'style': 'height:100%; width:0%; background:#22c55e; transition:width .3s ease;' })
				]);
				var statusText = E('div', { id: 'batch-status', 'style': 'font-size:13px; color:#6b7280; margin-bottom:8px;' }, '');
				
				var logExpanded = false;
				var toggleLogBtn = E('button', { 
					type: 'button',
					'class': 'btn',
					'style': 'font-size:12px; padding:4px 10px; background:#f3f4f6; border:1px solid #e5e7eb; color:#6b7280; border-radius:6px; cursor:pointer;'
				}, _('展开日志'));
				
				var log = E('pre', { 'style': 'max-height:0;overflow:hidden;background:linear-gradient(180deg,#0b1024 0%,#0f1633 100%);color:#cbd5e1;padding:0 10px;border-radius:8px; box-shadow: inset 0 0 8px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.06); transition: max-height .3s ease, padding .3s ease;' }, '');
				
				toggleLogBtn.addEventListener('click', function(){
					logExpanded = !logExpanded;
					if (logExpanded) {
						log.style.maxHeight = '260px';
						log.style.padding = '10px';
						log.style.overflow = 'auto';
						toggleLogBtn.textContent = _('折叠日志');
						toggleLogBtn.style.background = '#e0f2fe';
						toggleLogBtn.style.color = '#0369a1';
					} else {
						log.style.maxHeight = '0';
						log.style.padding = '0 10px';
						log.style.overflow = 'hidden';
						toggleLogBtn.textContent = _('展开日志');
						toggleLogBtn.style.background = '#f3f4f6';
						toggleLogBtn.style.color = '#6b7280';
					}
				});
				
				var logSection = E('div', { 'style': 'display:flex; flex-direction:column; gap:8px;' }, [
					E('div', { 'style': 'display:flex; align-items:center; justify-content:space-between;' }, [
						E('span', { 'style': 'font-size:13px; color:#6b7280; font-weight:600;' }, _('执行日志')),
						toggleLogBtn
					]),
					log
				]);
				
				var closeBtn = E('button', { 'class': 'btn', disabled: true }, _('关闭'));
				var modal = ui.showModal(_('批量卸载进度'), [
					progressText,
					progressBar,
					statusText,
					logSection,
					E('div', { 'style':'margin-top:10px;display:flex;gap:8px;justify-content:flex-end;' }, [ closeBtn ])
				]);
				var overlay = modal && modal.parentNode; if (overlay) { overlay.style.display = 'flex'; overlay.style.alignItems = 'center'; overlay.style.justifyContent = 'center'; }
				
				function println(s){ log.appendChild(document.createTextNode(String(s) + '\n')); log.scrollTop = log.scrollHeight; }
				
				// 递归卸载每个包
				function uninstallNext() {
					if (currentIndex >= packages.length) {
						// 全部完成
						var progressBarEl = document.getElementById('batch-progress-bar');
						if (progressBarEl) progressBarEl.style.width = '100%';
						
						progressText.textContent = _('批量卸载完成');
						progressText.style.color = successCount === packages.length ? '#065f46' : '#92400e';
						
						var statusEl = document.getElementById('batch-status');
						if (statusEl) {
							statusEl.textContent = _('成功: ') + successCount + _(' 个，失败: ') + failCount + _(' 个');
							statusEl.style.color = failCount > 0 ? '#dc2626' : '#059669';
						}
						
						closeBtn.disabled = false;
						closeBtn.textContent = _('完成');
						closeBtn.setAttribute('style', 'background:#22c55e; color:#fff; border:none; font-weight:600; border-radius:6px; padding:8px 16px;');
						closeBtn.addEventListener('click', function(){ 
							ui.hideModal(modal); 
							// 清空选择
							selectedPackages = {};
							window.location.reload();
						});
						return;
					}
					
					var pkg = packages[currentIndex];
					var zhName = displayName(pkg.name);
					var fullName = zhName && zhName !== pkg.name ? (zhName + ' (' + pkg.name + ')') : pkg.name;
					
					var statusEl = document.getElementById('batch-status');
					if (statusEl) statusEl.textContent = _('正在卸载: ') + fullName + ' (' + (currentIndex + 1) + '/' + packages.length + ')';
					
					println('\n[' + (currentIndex + 1) + '/' + packages.length + '] ' + _('开始卸载: ') + fullName);
					
					var token = (L.env && (L.env.token || L.env.csrf_token)) || '';
					var removeUrl = L.url('admin/vum/uninstall/remove') + (token ? ('?token=' + encodeURIComponent(token)) : '');
					var formBody = 'package=' + encodeURIComponent(pkg.name) + '&purge=' + (pkg.purge ? '1' : '0') + '&removeDeps=' + (pkg.deps ? '1' : '0') + '&clearCache=' + (pkg.cache ? '1' : '0');
					
				println('> POST ' + removeUrl);
				println('> body: ' + formBody);
				
				self._httpJson(removeUrl, {
					method: 'GET',
					headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8', 'Accept': 'application/json', 'X-CSRF-Token': token },
					body: formBody
				}).then(function(res){
					println('< Response: ' + JSON.stringify(res));
					if (res && res.ok) {
						println('✓ ' + _('卸载成功: ') + fullName);
						successCount++;
						currentIndex++;
						var progressBarEl = document.getElementById('batch-progress-bar');
						if (progressBarEl) progressBarEl.style.width = ((currentIndex / packages.length) * 100) + '%';
						uninstallNext();
						return;
					}
					// POST失败，尝试GET
					println('! POST 失败或返回非成功，尝试 GET…');
					var getUrl = L.url('admin/vum/uninstall/remove') + '?' +
						(token ? ('token=' + encodeURIComponent(token) + '&') : '') +
						('package=' + encodeURIComponent(pkg.name) + '&purge=' + (pkg.purge ? '1' : '0') + '&removeDeps=' + (pkg.deps ? '1' : '0') + '&clearCache=' + (pkg.cache ? '1' : '0'));
					println('> GET ' + getUrl);
					return self._httpJson(getUrl, { method: 'GET', headers: { 'Accept': 'application/json' } }).then(function(r2){
						println('< Response: ' + JSON.stringify(r2));
						if (r2 && r2.ok) {
							println('✓ ' + _('卸载成功: ') + fullName);
							successCount++;
						} else {
							println('✗ ' + _('卸载失败: ') + fullName);
							failCount++;
						}
						currentIndex++;
						var progressBarEl = document.getElementById('batch-progress-bar');
						if (progressBarEl) progressBarEl.style.width = ((currentIndex / packages.length) * 100) + '%';
						uninstallNext();
					});
				}).catch(function(err){
					println('! Error: ' + String(err));
					failCount++;
					currentIndex++;
					var progressBarEl = document.getElementById('batch-progress-bar');
					if (progressBarEl) progressBarEl.style.width = ((currentIndex / packages.length) * 100) + '%';
					uninstallNext();
				});
				}
				
				uninstallNext();
			});
		}
		
		// 上报图标问题函数
		function reportIcon(pkgName) {
			var zhName = displayName(pkgName);
			var fullName = zhName && zhName !== pkgName ? (zhName + ' (' + pkgName + ')') : pkgName;
			
			// 创建上报对话框
			var inputComment = E('textarea', {
				placeholder: _('可选:描述图标的问题,例如"图标显示不正确"、"缺少图标"等'),
				'style': 'width:100%; min-height:80px; padding:8px; border:1px solid #e5e7eb; border-radius:6px; font-size:13px; resize:vertical; font-family:inherit;'
			}, '');
			
			var titleRow = E('div', { 'style': 'display:flex; align-items:center; gap:8px; margin-bottom:12px;' }, [
				E('span', { 'style': 'display:inline-flex;width:28px;height:28px;background:#fff3cd;color:#856404;border-radius:999px;align-items:center;justify-content:center;font-weight:700;' }, '!'),
				E('span', { 'style': 'font-weight:600;font-size:16px;color:#111827;' }, _('上报图标问题'))
			]);
			
			var pkgInfo = E('div', { 'style': 'margin-bottom:12px; padding:10px; background:#f8f9fa; border:1px solid #e5e7eb; border-radius:8px;' }, [
				E('div', { 'style': 'display:flex; align-items:center; gap:8px; margin-bottom:6px;' }, [
					E('img', { src: packageIcon(pkgName), 'style': 'width:32px; height:32px; border-radius:6px; background:#f3f4f6; border:1px solid #e5e7eb; object-fit:contain;' }),
					E('div', {}, [
						E('div', { 'style': 'font-weight:600; color:#111827;' }, fullName),
						E('div', { 'style': 'font-size:12px; color:#6b7280;' }, pkgName)
					])
				]),
				E('div', { 'style': 'font-size:12px; color:#6b7280; margin-top:4px;' }, _('将向开发者上报此应用的图标问题'))
			]);
			
			var inputSection = E('div', { 'style': 'margin-bottom:12px;' }, [
				E('label', { 'style': 'display:block; font-size:13px; color:#374151; margin-bottom:6px; font-weight:500;' }, _('问题描述')),
				inputComment
			]);
			
			var cancelBtn = E('button', { 'class': 'btn', 'style': 'background:#f3f4f6;color:#1f2937;border-radius:999px;padding:6px 14px;' }, _('取消'));
			var submitBtn = E('button', { 'class': 'btn cbi-button-apply', 'style': 'background:#3b82f6;color:#fff;border-radius:999px;padding:6px 14px;' }, _('提交上报'));
			var footer = E('div', { 'style':'margin-top:12px;display:flex;gap:8px;justify-content:flex-end;' }, [ cancelBtn, submitBtn ]);
			
			var modal = ui.showModal(_('上报图标问题'), [ titleRow, pkgInfo, inputSection, footer ]);
			var overlay = modal && modal.parentNode; 
			if (overlay) { 
				overlay.style.display = 'flex'; 
				overlay.style.alignItems = 'center'; 
				overlay.style.justifyContent = 'center'; 
			}
			
			cancelBtn.addEventListener('click', function(){ ui.hideModal(modal); });
			submitBtn.addEventListener('click', function(){
				var comment = inputComment.value.trim();
				
				// 禁用按钮防止重复提交
				submitBtn.disabled = true;
				submitBtn.textContent = _('提交中...');
				submitBtn.style.opacity = '0.6';
				
				// 发送上报请求 - 使用 GET 方法 + URL 参数(更兼容)
				var token = (L.env && (L.env.token || L.env.csrf_token)) || '';
				var reportUrl = L.url('admin/vum/uninstall/report_icon') + 
					'?package=' + encodeURIComponent(pkgName) + 
					'&comment=' + encodeURIComponent(comment) +
					(token ? ('&token=' + encodeURIComponent(token)) : '');
				
				self._httpJson(reportUrl, {
					method: 'GET',
					headers: { 
						'Accept': 'application/json'
					}
				}).then(function(res){
					// 在弹窗内显示结果，而不是使用顶部通知条
					if (res && res.ok) {
						// 成功：替换弹窗内容为成功提示
						var modalBody = modal.querySelector('.modal-body');
						if (modalBody) {
							modalBody.innerHTML = '';
							modalBody.appendChild(
								E('div', { 'style': 'text-align:center; padding:30px 20px;' }, [
									E('div', { 'style': 'width:60px; height:60px; margin:0 auto 16px; background:#10b981; border-radius:50%; display:flex; align-items:center; justify-content:center;' }, [
										E('span', { 'style': 'color:#fff; font-size:32px; font-weight:bold;' }, '✓')
									]),
									E('div', { 'style': 'font-size:18px; font-weight:600; color:#111827; margin-bottom:8px;' }, _('上报成功')),
									E('div', { 'style': 'font-size:14px; color:#6b7280;' }, _('感谢您的反馈！'))
								])
							);
						}
						// 2秒后自动关闭
						setTimeout(function(){ ui.hideModal(modal); }, 2000);
					} else {
						// 失败：在弹窗内显示错误
						var modalBody = modal.querySelector('.modal-body');
						if (modalBody) {
							modalBody.innerHTML = '';
							var errorDiv = E('div', { 'style': 'text-align:center; padding:30px 20px;' }, [
								E('div', { 'style': 'width:60px; height:60px; margin:0 auto 16px; background:#ef4444; border-radius:50%; display:flex; align-items:center; justify-content:center;' }, [
									E('span', { 'style': 'color:#fff; font-size:32px; font-weight:bold;' }, '✕')
								]),
								E('div', { 'style': 'font-size:18px; font-weight:600; color:#111827; margin-bottom:8px;' }, _('上报失败')),
								E('div', { 'style': 'font-size:14px; color:#6b7280;' }, (res && res.message) || _('未知错误')),
								E('button', { 
									'class': 'btn cbi-button-apply',
									'style': 'margin-top:16px; background:#3b82f6; color:#fff; border-radius:999px; padding:6px 20px;'
								}, _('关闭'))
							]);
							modalBody.appendChild(errorDiv);
							// 为关闭按钮添加事件监听
							var closeBtn = errorDiv.querySelector('button');
							if (closeBtn) {
								closeBtn.addEventListener('click', function(){ ui.hideModal(modal); });
							}
						}
					}
				}).catch(function(err){
					// 网络错误：在弹窗内显示
					var modalBody = modal.querySelector('.modal-body');
					if (modalBody) {
						modalBody.innerHTML = '';
						var errorDiv = E('div', { 'style': 'text-align:center; padding:30px 20px;' }, [
							E('div', { 'style': 'width:60px; height:60px; margin:0 auto 16px; background:#ef4444; border-radius:50%; display:flex; align-items:center; justify-content:center;' }, [
								E('span', { 'style': 'color:#fff; font-size:32px; font-weight:bold;' }, '✕')
							]),
							E('div', { 'style': 'font-size:18px; font-weight:600; color:#111827; margin-bottom:8px;' }, _('上报失败')),
							E('div', { 'style': 'font-size:14px; color:#6b7280;' }, _('请检查网络连接')),
							E('button', { 
								'class': 'btn cbi-button-apply',
								'style': 'margin-top:16px; background:#3b82f6; color:#fff; border-radius:999px; padding:6px 20px;'
							}, _('关闭'))
						]);
						modalBody.appendChild(errorDiv);
						// 为关闭按钮添加事件监听
						var closeBtn = errorDiv.querySelector('button');
						if (closeBtn) {
							closeBtn.addEventListener('click', function(){ ui.hideModal(modal); });
						}
					}
				});
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
				// 日志折叠/展开按钮
				var logExpanded = false;
				var toggleLogBtn = E('button', { 
					type: 'button',
					'class': 'btn',
					'style': 'font-size:12px; padding:4px 10px; background:#f3f4f6; border:1px solid #e5e7eb; color:#6b7280; border-radius:6px; cursor:pointer;'
				}, _('展开日志'));
				
				var log = E('pre', { 'style': 'max-height:0;overflow:hidden;background:linear-gradient(180deg,#0b1024 0%,#0f1633 100%);color:#cbd5e1;padding:0 10px;border-radius:8px; box-shadow: inset 0 0 8px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.06); transition: max-height .3s ease, padding .3s ease, filter .15s ease;' }, '');
				
				toggleLogBtn.addEventListener('click', function(){
					logExpanded = !logExpanded;
					if (logExpanded) {
						log.style.maxHeight = '260px';
						log.style.padding = '10px';
						log.style.overflow = 'auto';
						toggleLogBtn.textContent = _('折叠日志');
						toggleLogBtn.style.background = '#e0f2fe';
						toggleLogBtn.style.color = '#0369a1';
					} else {
						log.style.maxHeight = '0';
						log.style.padding = '0 10px';
						log.style.overflow = 'hidden';
						toggleLogBtn.textContent = _('展开日志');
						toggleLogBtn.style.background = '#f3f4f6';
						toggleLogBtn.style.color = '#6b7280';
					}
				});
				
				log.addEventListener('mouseenter', function(){ if (logExpanded) log.style.filter = 'brightness(1.08)'; });
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
				var logSection = E('div', { 'style': 'display:flex; flex-direction:column; gap:8px;' }, [
					E('div', { 'style': 'display:flex; align-items:center; justify-content:space-between;' }, [
						E('span', { 'style': 'font-size:13px; color:#6b7280; font-weight:600;' }, _('执行日志')),
						toggleLogBtn
					]),
					log
				]);
				var modal = ui.showModal(_('正在卸载…') + ' ' + fullName2, [
					statusBar,
					logSection,
					E('div', { 'style':'margin-top:10px;display:flex;gap:8px;justify-content:flex-end;' }, [ closeBtn ])
				]);
				var overlay = modal && modal.parentNode; if (overlay) { overlay.style.display = 'flex'; overlay.style.alignItems = 'center'; overlay.style.justifyContent = 'center'; }
				function println(s){ log.appendChild(document.createTextNode(String(s) + '\n')); log.scrollTop = log.scrollHeight; }
				var opSuccess = false;
				function enableClose(){
					closeBtn.disabled = false;
					closeBtn.textContent = opSuccess ? _('返回列表') : _('查看详情');
				if (opSuccess) closeBtn.setAttribute('style', 'background:#22c55e; color:#fff; border:none; font-weight:600;');
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
					method: 'GET',
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
		// 全选/取消全选
		root.addEventListener('change', function(ev){
			if (ev.target && ev.target.id === 'select-all') {
				var checked = ev.target.checked;
				// 全选时显示风险提示
				if (checked) {
					var totalCount = document.querySelectorAll('.pkg-checkbox').length;
					if (totalCount > 0) {
						var warnModal = ui.showModal(_('风险警告'), [
							E('div', { 'style': 'display:flex; align-items:center; gap:12px; margin-bottom:16px;' }, [
								E('span', { 'style': 'display:inline-flex;width:48px;height:48px;background:#fee2e2;color:#dc2626;border-radius:999px;align-items:center;justify-content:center;font-weight:700;font-size:24px;' }, '!'),
								E('div', { 'style': 'flex:1;' }, [
									E('div', { 'style': 'font-weight:600;font-size:16px;color:#111827;margin-bottom:4px;' }, _('全部卸载可能导致系统崩溃')),
									E('div', { 'style': 'font-size:14px;color:#6b7280;' }, _('您即将卸载所有 ') + totalCount + _(' 个软件包'))
								])
							]),
							E('div', { 'style': 'background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:12px;margin-bottom:16px;' }, [
								E('div', { 'style': 'font-weight:600;color:#991b1b;margin-bottom:8px;' }, _('⚠️ 严重警告：')),
								E('ul', { 'style': 'margin:0;padding-left:20px;color:#7f1d1d;' }, [
									E('li', {}, _('卸载系统核心插件可能导致路由器无法正常工作')),
									E('li', {}, _('可能需要重新刷机才能恢复系统')),
									E('li', {}, _('建议仅卸载您确认不需要的插件'))
								])
							]),
							E('div', { 'style':'margin-top:16px;display:flex;gap:8px;justify-content:flex-end;' }, [
								E('button', { 'class': 'btn', id: 'cancel-select-all', 'style': 'background:#eef2ff;color:#1f2937;border-radius:999px;padding:6px 14px;' }, _('取消全选')),
								E('button', { 'class': 'btn', id: 'confirm-select-all', 'style': 'background:#dc2626;color:#fff;border-radius:999px;padding:6px 14px;font-weight:600;' }, _('我知道风险，继续'))
							])
						]);
						var warnOverlay = warnModal && warnModal.parentNode;
						if (warnOverlay) { warnOverlay.style.display = 'flex'; warnOverlay.style.alignItems = 'center'; warnOverlay.style.justifyContent = 'center'; }
						
						var cancelBtn = warnModal.querySelector('#cancel-select-all');
						var confirmBtn = warnModal.querySelector('#confirm-select-all');
						
						if (cancelBtn) {
							cancelBtn.addEventListener('click', function() {
								ui.hideModal(warnModal);
								// 取消全选
								ev.target.checked = false;
								var checkboxes = document.querySelectorAll('.pkg-checkbox');
								checkboxes.forEach(function(cb) { cb.checked = false; cb.dispatchEvent(new Event('change')); });
							});
						}
						
						if (confirmBtn) {
							confirmBtn.addEventListener('click', function() {
								ui.hideModal(warnModal);
								// 继续全选
								var checkboxes = document.querySelectorAll('.pkg-checkbox');
								checkboxes.forEach(function(cb) {
									if (cb.checked !== checked) {
										cb.checked = checked;
										cb.dispatchEvent(new Event('change'));
									}
								});
							});
						}
						return; // 阻止默认的全选行为，等待用户确认
					}
				}
				var checkboxes = document.querySelectorAll('.pkg-checkbox');
				checkboxes.forEach(function(cb){
					if (cb.checked !== checked) {
						cb.checked = checked;
						cb.dispatchEvent(new Event('change'));
					}
				});
			}
		});
		
		root.addEventListener('click', function(ev){
			if (!ev.target) return;
			var t = ev.target;
			if (t.id === 'batch-uninstall-btn' || (t.closest && t.closest('#batch-uninstall-btn'))) {
				ev.preventDefault();
				ev.stopPropagation();
				batchUninstall();
				return;
			}
			if (t.id === 'filter-clear') { if (searchTimer) clearTimeout(searchTimer); searchTimer = setTimeout(refresh, 10); return; }
			// 兼容点击图标或内部元素：优先用 closest
			if (t.closest) {
				var btn = t.closest('#update-action');
				if (btn) { ev.preventDefault(); ev.stopPropagation(); updateAction(); return; }
			}
			// 兜底向上遍历
			while (t && t !== root) {
				if (t.id === 'update-action') { ev.preventDefault(); ev.stopPropagation(); updateAction(); return; }
				t = t.parentNode;
			}
		});

		// 拉取自身版本并显示徽标
		self._httpJson(L.url('admin/vum/uninstall/version'), { headers: { 'Accept': 'application/json' } }).then(function(res){
			var v = res && res.version;
			var el = document.getElementById('uninstall-version');
			if (el && v && v.length > 0) { el.textContent = v; el.style.display = 'inline-block'; }
		}).catch(function(){});

		// 隐藏页面底部“保存&应用/保存/复位”按钮，但不影响弹窗内按钮
		var hideGlobalActions = function(){
			var actions = document.querySelector('.cbi-page-actions');
			if (actions) {
				actions.style.display = 'none';
				// 仅作用于该容器内部，避免误伤弹窗按钮
				['apply','save','reset'].forEach(function(k){
					var btns = actions.querySelectorAll('.cbi-button-' + k + ', button');
					btns.forEach(function(b){ b.style.display = 'none'; });
				});
				// 按文案兜底（同样限制在容器内）
				var allBtns = actions.querySelectorAll('button');
				allBtns.forEach(function(b){
					var t = (b.textContent || '').trim();
					if (t === '保存&应用' || t === '保存' || t === '复位') b.style.display = 'none';
				});
			}
		};
		// 初次隐藏 + 监听 DOM 变化以防主题重新插入
		hideGlobalActions();
		var mo = new MutationObserver(function(){ hideGlobalActions(); });
		mo.observe(document.body || document.documentElement, { childList: true, subtree: true });

		refresh();
		// 自动拉取远端版本以显示徽标
		setTimeout(function(){ try { checkUpdate(); } catch(e){} }, 500);
		return root;
	}

});