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
		// 对于 POST 请求，优先使用 fetch，因为 L.Request.request 可能不支持 body
		if (options.method && options.method.toUpperCase() === 'POST' && typeof fetch === 'function') {
			options.credentials = 'include';
			return fetch(url, options).then(function(res){
				if (!res.ok) throw new Error('HTTP ' + res.status);
				return res.json();
			});
		}
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

			/* 自定义文件上传按钮 */
			.file-upload-wrapper {
				margin-top: 12px;
				width: 100%;
				display: flex;
				flex-direction: column;
				gap: 6px;
			}
			.file-upload-control {
				display: flex;
				align-items: center;
				gap: 12px;
				flex-wrap: wrap;
			}
			.file-upload-input {
				position: absolute;
				width: 1px;
				height: 1px;
				padding: 0;
				margin: -1px;
				overflow: hidden;
				clip: rect(0, 0, 0, 0);
				border: 0;
			}
			.file-upload-label {
				display: inline-flex;
				align-items: center;
				gap: 8px;
				padding: 8px 16px;
				border-radius: 999px;
				background: linear-gradient(135deg, #3b82f6 0%, #6366f1 50%, #8b5cf6 100%);
				color: #fff;
				font-weight: 600;
				font-size: 13px;
				cursor: pointer;
				box-shadow: 0 4px 12px rgba(79, 70, 229, 0.25), inset 0 1px 0 rgba(255,255,255,0.2);
				transition: all .2s ease;
			}
			.file-upload-label:hover {
				transform: translateY(-1px);
				box-shadow: 0 6px 16px rgba(79, 70, 229, 0.35), inset 0 1px 0 rgba(255,255,255,0.25);
			}
			.file-upload-icon {
				display: inline-flex;
				width: 20px;
				height: 20px;
				border-radius: 6px;
				background: rgba(255,255,255,0.2);
				align-items: center;
				justify-content: center;
				font-size: 12px;
			}
			.file-upload-filename {
				flex: 1;
				min-width: 140px;
				font-size: 13px;
				color: #6b7280;
				padding: 8px 12px;
				border-radius: 10px;
				background: #f9fafb;
				border: 1px dashed #d1d5db;
				transition: border-color .2s ease, color .2s ease;
			}
			.file-upload-filename[data-has-file="1"] {
				border-color: #6366f1;
				color: #111827;
				background: rgba(99,102,241,0.08);
			}
			@media screen and (max-width: 480px) {
				.file-upload-control {
					flex-direction: column;
					align-items: stretch;
				}
				.file-upload-label {
					justify-content: center;
					width: 100%;
				}
			}

			.install-progress-spinner {
				width: 40px;
				height: 40px;
				border-radius: 999px;
				border: 3px solid rgba(59, 130, 246, 0.2);
				border-top-color: #3b82f6;
				animation: uninstall-spin 0.8s linear infinite;
				margin: 0 auto 12px;
			}

			.install-progress-bar {
				width: 100%;
				height: 6px;
				background: #e5e7eb;
				border-radius: 999px;
				overflow: hidden;
				margin-top: 10px;
			}

			.install-progress-bar-fill {
				width: 45%;
				height: 100%;
				background: linear-gradient(90deg, #3b82f6 0%, #6366f1 100%);
				animation: uninstall-progress 1.2s ease-in-out infinite;
				filter: drop-shadow(0 0 6px rgba(59, 130, 246, 0.4));
			}

			.install-stuck-help-btn {
				display: inline-flex;
				align-items: center;
				gap: 4px;
				font-size: 12px;
				padding: 4px 10px;
				border-radius: 999px;
				border: 1px dashed rgba(249, 115, 22, 0.9);
				background: rgba(254, 243, 199, 0.15);
				color: #f97316;
				font-weight: 600;
				cursor: pointer;
				animation: install-help-blink 1.4s ease-in-out infinite;
				box-shadow: 0 2px 6px rgba(249, 115, 22, 0.15);
				transition: transform 0.2s ease, box-shadow 0.2s ease;
			}

			.install-stuck-help-btn:hover {
				transform: translateY(-1px);
				box-shadow: 0 4px 10px rgba(249, 115, 22, 0.25);
			}

			@keyframes install-help-blink {
				0% { opacity: 0.4; box-shadow: 0 0 0 0 rgba(249, 115, 22, 0.3); }
				50% { opacity: 1; box-shadow: 0 0 0 6px rgba(249, 115, 22, 0); }
				100% { opacity: 0.6; box-shadow: 0 0 0 0 rgba(249, 115, 22, 0); }
			}

			@keyframes uninstall-spin {
				from { transform: rotate(0deg); }
				to { transform: rotate(360deg); }
			}

			@keyframes uninstall-progress {
				0% { margin-left: -50%; }
				50% { margin-left: 50%; }
				100% { margin-left: -20%; }
			}
			
			/* 更新按钮闪烁动画 */
			@keyframes update-pulse {
				0%, 100% {
					box-shadow: 0 2px 6px rgba(0,0,0,0.06), 0 0 0 0 rgba(59, 130, 246, 0.7);
					transform: scale(1);
				}
				50% {
					box-shadow: 0 2px 6px rgba(0,0,0,0.06), 0 0 0 6px rgba(59, 130, 246, 0);
					transform: scale(1.05);
				}
			}
			@keyframes update-glow {
				0%, 100% {
					filter: brightness(1);
				}
				50% {
					filter: brightness(1.2);
				}
			}
			#update-action {
				animation: update-pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
			}
			#update-action img {
				animation: update-glow 2s ease-in-out infinite;
			}
			
			/* 默认样式：垃圾桶图标隐藏 */
			#batch-uninstall-btn .trash-icon {
				display: none;
			}
			
			/* 移动端响应式样式 */
			@media screen and (max-width: 768px) {
				#batch-toolbar {
					flex-wrap: wrap;
					padding: 8px 12px;
					gap: 8px;
					position: relative;
				}
				
				#search-section.search-expanded {
					z-index: 200;
					box-shadow: 0 4px 12px rgba(0,0,0,0.15);
					background: #ffffff !important;
					border-color: #3b82f6 !important;
				}
				
				#search-section.search-expanded #filter {
					font-size: 16px !important;
				}
				
				#search-section.mobile-collapsed {
					flex: 0 0 auto !important;
					width: auto !important;
					min-width: 0 !important;
					padding: 6px !important;
					gap: 0 !important;
					display: flex !important;
					align-items: center !important;
					justify-content: flex-start !important;
					background: rgba(255, 255, 255, 0.75) !important;
					border: 1px solid rgba(186, 230, 253, 0.6) !important;
					border-radius: 999px !important;
					box-shadow: none !important;
				}
				
				#search-container.mobile-icon-only {
					flex: 0 0 auto !important;
					width: auto !important;
					min-width: 0 !important;
					margin: 0 !important;
				}
				
				#search-section.mobile-collapsed #filter,
				#search-section.mobile-collapsed .search-clear-btn {
					display: none !important;
				}
				
				#search-section.mobile-collapsed img.search-icon {
					display: block !important;
					margin: 0 !important;
					opacity: 0.75;
				}
				
				#batch-toolbar > div:first-child {
					flex: 1 1 100%;
					justify-content: flex-start;
					flex-wrap: wrap;
					gap: 8px;
				}
				
				#selected-count {
					font-size: 12px;
					padding: 3px 10px;
				}
				
				/* 768px以下仍然隐藏垃圾桶图标，只在480px以下显示 */
				#batch-uninstall-btn .trash-icon {
					display: none;
				}
				
				#batch-uninstall-btn .btn-text {
					display: inline;
				}
				
				#batch-uninstall-btn {
					padding: 6px 12px;
					min-width: 40px;
				}
				
				#batch-toolbar > div:nth-child(2) {
					flex: 1 1 100%;
					margin: 0;
					order: 3;
					min-width: 0;
				}
				
				#filter {
					font-size: 14px;
					min-width: 0;
				}
				
				#filter::placeholder {
					overflow: hidden;
					text-overflow: ellipsis;
					white-space: nowrap;
				}
				
			#announcement-bell-btn {
				margin-left: 0;
				flex: 0 0 auto;
				padding: 6px 12px;
				min-width: 36px;
			}
				
			#install-local-btn {
				margin-left: 0;
				flex: 0 0 auto;
				padding: 6px 12px;
				font-size: 13px;
				white-space: nowrap;
			}
				
			#install-local-btn span {
				display: none;
			}
				
			#install-local-btn img {
				margin: 0;
			}
				
			#history-log-btn {
				margin-left: 0;
				flex: 0 0 auto;
				padding: 6px 12px;
				font-size: 13px;
				white-space: nowrap;
			}
				
			#history-log-btn span {
				display: none;
			}
				
			#history-log-btn img {
				margin: 0;
			}
				
				#announcement-panel {
					width: 100%;
					margin-left: 0;
					margin-right: 0;
					border-radius: 0 0 8px 8px;
				}
				
				#announcement-panel.show {
					margin-top: 6px;
					padding: 14px;
					border-top: 1px solid #bae6fd;
					border-radius: 12px;
				}
			}
			
			@media screen and (max-width: 480px) {
				#batch-toolbar {
					padding: 6px 10px;
					gap: 6px;
				}
				
				#batch-toolbar > div:first-child {
					gap: 6px;
				}
				
				#batch-toolbar label[for="select-all"] {
					font-size: 13px;
				}
				
				#batch-toolbar label[for="select-all"] span {
					font-size: 13px;
				}
				
				#selected-count {
					font-size: 11px;
					padding: 2px 8px;
				}
				
				#batch-uninstall-btn {
					font-size: 12px;
					padding: 4px 10px;
					position: relative;
					display: flex;
					align-items: center;
					justify-content: center;
					gap: 6px;
				}
				
				/* 手机版（480px以下）显示垃圾桶图标 */
				#batch-uninstall-btn .trash-icon {
					display: block !important;
					width: 18px;
					height: 18px;
					fill: currentColor;
				}
				
				#batch-uninstall-btn .btn-text {
					display: none !important;
				}
				
				#batch-toolbar > div:nth-child(2) {
					padding: 5px 10px;
				}
				
				#batch-toolbar > div:nth-child(2) img {
					width: 16px;
					height: 16px;
				}
				
				#filter {
					font-size: 13px;
					min-width: 0;
				}
				
				#filter::placeholder {
					font-size: 12px;
					overflow: hidden;
					text-overflow: ellipsis;
					white-space: nowrap;
				}
				
				#filter-clear {
					font-size: 11px;
					padding: 2px 6px;
				}
				
			#announcement-bell-btn {
				padding: 5px 10px;
				min-width: 36px;
			}
				
			#install-local-btn {
				padding: 5px 10px;
				min-width: 36px;
			}
				
			#history-log-btn {
				padding: 5px 10px;
				min-width: 36px;
			}
				
				#announcement-panel {
					width: 100%;
					font-size: 13px;
					margin-left: 0;
					margin-right: 0;
					border-radius: 0 0 8px 8px;
				}
				
				#announcement-panel.show {
					margin-top: 6px;
					padding: 12px;
					border-top: 1px solid #bae6fd;
					border-radius: 12px;
				}
				
				#announcement-content {
					font-size: 13px;
				}
			}
			
			/* 公告面板样式 - 在工具栏外部下拉 */
			#announcement-panel {
				position: relative;
				width: 100%;
				background: #ffffff;
				border: 1px solid transparent;
				border-top: none;
				border-radius: 0 0 12px 12px;
				box-shadow: none;
				padding: 0;
				margin-top: 0;
				margin-left: 0;
				margin-right: 0;
				opacity: 0;
				visibility: hidden;
				max-height: 0;
				overflow: hidden;
				transform: translateY(-10px);
				transition: max-height 0.3s ease-out, opacity 0.3s ease-out, transform 0.3s ease-out, visibility 0.3s ease-out, padding 0.3s ease-out, border-color 0.3s ease-out, box-shadow 0.3s ease-out, margin-top 0.3s ease-out;
			}
			
			#announcement-panel.show {
				margin-top: 8px;
				opacity: 1;
				visibility: visible;
				max-height: 500px;
				padding: 16px;
				transform: translateY(0);
				border-color: #bae6fd;
				border-top: 1px solid #bae6fd;
				border-radius: 12px;
				box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
				overflow-y: auto;
			}
			
			/* 当公告面板展开时，保持工具栏的圆角（因为现在有间距了） */
			#batch-toolbar.announcement-open {
				border-radius: 12px !important;
			}
			
			#announcement-content {
				color: #374151;
				line-height: 1.6;
				font-size: 14px;
				word-wrap: break-word;
				white-space: pre-wrap;
			}
			
			#announcement-bell-btn {
				position: relative;
				background: #ffffff;
				border: 1px solid #d1d5db;
				border-radius: 8px;
				padding: 6px 12px;
				cursor: pointer;
				transition: all 0.2s;
				display: flex;
				align-items: center;
				justify-content: center;
				min-width: 40px;
				height: 36px;
			}
			
			#announcement-bell-btn:hover {
				background: #f9fafb;
				border-color: #9ca3af;
				transform: translateY(-1px);
				box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
			}
			
			#announcement-bell-btn.active {
				background: #fef3c7;
				border-color: #f59e0b;
			}
			
			#announcement-bell-btn svg {
				width: 20px;
				height: 20px;
				display: block;
				vertical-align: middle;
			}
			
			#announcement-bell-btn:hover svg {
				transform: scale(1.1);
				transition: transform 0.2s ease;
			}
			
			#announcement-bell-btn.active svg {
				animation: bell-ring 0.5s ease-in-out;
			}
			
			@keyframes bell-ring {
				0%, 100% { transform: rotate(0deg) scale(1); }
				10%, 30% { transform: rotate(-8deg) scale(1.05); }
				20%, 40% { transform: rotate(8deg) scale(1.05); }
				50% { transform: rotate(0deg) scale(1); }
			}
			
			/* 搜索区域容器 */
			#search-container {
				position: relative;
				flex: 1;
				display: flex;
				align-items: center;
				margin: 0 12px;
				min-width: 0;
			}
			
			/* 搜索框区域 */
			#search-section {
				display: flex;
				align-items: center;
				gap: 8px;
				flex: 1;
				min-width: 0;
			}

			/* ====================== */
			/* 黑色主题（卸载页面专用，**仅调整卡片与搜索区域**） */
			/* ====================== */
			/* 搜索框区域：略微提亮，做成胶囊玻璃感，背景色沿用全局 */
			body.luci-uninstall-dark #batch-toolbar {
				background: linear-gradient(135deg, rgba(15,23,42,0.92) 0%, rgba(15,23,42,0.96) 60%, rgba(30,64,175,0.85) 100%) !important;
				border-color: rgba(59,130,246,0.45) !important;
				box-shadow: 0 16px 40px rgba(15,23,42,0.9) !important;
			}

			body.luci-uninstall-dark #search-section {
				background: radial-gradient(circle at left, rgba(59,130,246,0.22), transparent 60%), rgba(15,23,42,0.95);
				border-color: rgba(148,163,184,0.7);
			}

			body.luci-uninstall-dark #filter {
				background: transparent;
				color: #e5e7eb;
				border-color: transparent;
			}

			body.luci-uninstall-dark #filter::placeholder {
				color: #9ca3af;
			}

			/* 卡片：做成悬浮的深色卡片，整体协调 Argon 深色背景 */
			body.luci-uninstall-dark .pkg-card {
				background: radial-gradient(circle at top left, rgba(59,130,246,0.28), transparent 60%),
				            radial-gradient(circle at bottom right, rgba(139,92,246,0.22), transparent 60%),
				            linear-gradient(145deg, rgba(15,23,42,0.98), rgba(15,23,42,0.96)) !important;
				border-color: rgba(30,64,175,0.8) !important;
				box-shadow: 0 18px 45px rgba(15,23,42,0.95) !important;
			}

			body.luci-uninstall-dark .pkg-card:hover {
				box-shadow: 0 24px 60px rgba(15,23,42,1) !important;
			}

			/* 卡片内文字整体提亮 */
			body.luci-uninstall-dark .pkg-card,
			body.luci-uninstall-dark .pkg-card * {
				color: #e5e7eb;
			}

			/* 软件名称在深色模式下改为浅色 */
			body.luci-uninstall-dark .pkg-card div[style*='font-weight:600;color:#111827'] {
				color: #e5e7eb !important;
			}

			/* 版本角标在暗色下改为玻璃感浅灰 */
			body.luci-uninstall-dark #uninstall-card-version,
			body.luci-uninstall-dark .pkg-card div[style*='bottom:6px; font-size:12px;'] {
				background: rgba(15,23,42,0.9) !important;
				color: #e5e7eb !important;
				border-color: rgba(148,163,184,0.55) !important;
			}

			/* 卡片底部的报告按钮在暗色下做成轻微高亮 */
			body.luci-uninstall-dark .pkg-card button[title='上报图标问题'],
			body.luci-uninstall-dark .pkg-card button[title='上报卸载问题'] {
				background: rgba(15,23,42,1) !important;
				border-color: rgba(148,163,184,0.65) !important;
				color: #e5e7eb !important;
				box-shadow: 0 4px 12px rgba(15,23,42,0.8) !important;
			}

			body.luci-uninstall-dark .pkg-card button[title='上报图标问题']:hover:not(:disabled) {
				background: rgba(248,113,113,0.95) !important;
				border-color: rgba(248,113,113,1) !important;
				box-shadow: 0 6px 16px rgba(248,113,113,0.5) !important;
			}

			body.luci-uninstall-dark .pkg-card button[title='上报卸载问题']:hover:not(:disabled) {
				background: rgba(245,158,11,0.95) !important;
				border-color: rgba(245,158,11,1) !important;
				box-shadow: 0 6px 16px rgba(245,158,11,0.5) !important;
			}

			/* 深色模式下上报按钮图标为灰白色 */
			body.luci-uninstall-dark .pkg-card button[title='上报图标问题'] img,
			body.luci-uninstall-dark .pkg-card button[title='上报卸载问题'] img {
				filter: brightness(0) saturate(100%) invert(0.7) !important;
			}

			/* 深色模式下选项图标为灰白色 */
			body.luci-uninstall-dark .pkg-card .pkg-meta label img {
				filter: brightness(0) saturate(100%) invert(0.7) !important;
			}

			/* 深色模式下弹窗中的"卸载确认"和"批量卸载确认"文本 - 备用方案 */
			body.luci-uninstall-dark .cbi-modal span[style*='color:#111827'],
			body.luci-uninstall-dark .cbi-modal span[style*='color: #111827'] {
				color: #e5e7eb !important;
			}

			/* 深色模式下弹窗中的软件标题 - 备用方案 */
			body.luci-uninstall-dark .cbi-modal div[style*='color:#111827'],
			body.luci-uninstall-dark .cbi-modal div[style*='color: #111827'] {
				color: #e5e7eb !important;
			}
		`);
		document.head.appendChild(styleEl);

		// 读取 / 初始化卸载页面黑色主题状态（只对本页面生效）
		var darkKey = 'uninstallDarkTheme';
		function applyDarkThemeFromStorage() {
			if (!document || !document.body) return;
			var val = null;
			try {
				val = window.localStorage ? window.localStorage.getItem(darkKey) : null;
			} catch (e) {}
			var enable = (val === '1');
			if (enable) {
				document.body.classList.add('luci-uninstall-dark');
			} else {
				document.body.classList.remove('luci-uninstall-dark');
			}
		}
		applyDarkThemeFromStorage();
		
		var root = E('div', { 'class': 'cbi-map' }, [
			E('h2', {}, _('高级卸载')),
			E('div', { 'class': 'cbi-section-descr' }, _('选择要卸载的已安装软件包。可选地同时删除其配置文件。')),
			// 批量操作工具栏
			(function(){
				var toolbar = E('div', { 
					id: 'batch-toolbar',
					'style': 'margin:0; display:flex; align-items:center; gap:12px; padding:10px 16px; background:linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%); border:1px solid #bae6fd; border-radius:12px; box-shadow:0 2px 4px rgba(0,0,0,0.05); backdrop-filter:saturate(160%) blur(6px); -webkit-backdrop-filter:saturate(160%) blur(6px); flex-wrap:nowrap;'
				}, []);
				
				// 左侧：批量操作区域（缩短）
				var batchSection = E('div', { 
					'style': 'display:flex; align-items:center; gap:12px; flex:0 0 auto;'
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
				
				// 直接绑定全选事件处理，避免依赖事件委托在部分环境下不触发
				selectAllCheckbox.addEventListener('change', function(ev) {
					var checked = ev.target.checked;
					// 全选时弹出风险提示（仅统计未锁定的复选框）
					if (checked) {
						var totalCount = Array.from(document.querySelectorAll('.pkg-checkbox')).filter(function(cb) { return !cb.disabled; }).length;
						if (totalCount > 0) {
							var isDark = document.body && document.body.classList.contains('luci-uninstall-dark');
							var textColor = isDark ? '#e5e7eb' : '#111827';
							var warnModal = ui.showModal(_('风险警告'), [
								E('div', { 'style': 'display:flex; align-items:center; gap:12px; margin-bottom:16px;' }, [
									E('span', { 'style': 'display:inline-flex;width:48px;height:48px;background:#fee2e2;color:#dc2626;border-radius:999px;align-items:center;justify-content:center;font-weight:700;font-size:24px;' }, '!'),
									E('div', { 'style': 'flex:1;' }, [
										E('div', { 'style': 'font-weight:600;font-size:16px;color:' + textColor + ';margin-bottom:4px;' }, _('全部卸载可能导致系统崩溃')),
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
									(function(){
										var riskGradient = 'linear-gradient(135deg, #dc2626 0%, #ef4444 50%, #f87171 100%)';
										var riskGradientHover = 'linear-gradient(135deg, #b91c1c 0%, #dc2626 50%, #ef4444 100%)';
										var riskBtn = E('button', { 
											'class': 'btn', 
											id: 'confirm-select-all', 
											'style': 'background:' + riskGradient + '; color:#fff; border:none; border-radius:999px; padding:6px 14px; font-weight:600; box-shadow:0 2px 8px rgba(220,38,38,0.3), inset 0 1px 0 rgba(255,255,255,0.2); transition:all 0.2s;'
										}, _('我知道风险，继续'));
										riskBtn.addEventListener('mouseenter', function(){ this.style.background = riskGradientHover; this.style.boxShadow = '0 4px 12px rgba(220,38,38,0.4), inset 0 1px 0 rgba(255,255,255,0.2)'; });
										riskBtn.addEventListener('mouseleave', function(){ this.style.background = riskGradient; this.style.boxShadow = '0 2px 8px rgba(220,38,38,0.3), inset 0 1px 0 rgba(255,255,255,0.2)'; });
										return riskBtn;
									})()
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
									checkboxes.forEach(function(cb) { 
										if (!cb.disabled) {
											cb.checked = false; 
											cb.dispatchEvent(new Event('change'));
										}
									});
								});
							}
							
							if (confirmBtn) {
								confirmBtn.addEventListener('click', function() {
									ui.hideModal(warnModal);
									// 继续全选
									var checkboxes = document.querySelectorAll('.pkg-checkbox');
									checkboxes.forEach(function(cb) {
										if (!cb.disabled && cb.checked !== checked) {
											cb.checked = checked;
											// 使用可冒泡的事件，提升兼容性
											cb.dispatchEvent(new Event('change', { bubbles: true }));
											// 双保险：直接同步 selectedPackages，避免某些环境下 change 未生效
											try {
												var name = cb.getAttribute('data-pkg-name');
												if (name) {
													if (checked) {
														// 默认选项值（与单项选择一致）
														selectedPackages[name] = {
															name: name,
															version: '',
															purge: true,
															deps: true,
															cache: true
														};
													} else {
														delete selectedPackages[name];
													}
												}
											} catch(e){}
										}
									});
									updateBatchUI();
								});
							}
							return; // 等待用户确认后再继续
						}
					}
					// 未勾选或无需确认的场景，直接同步各项
					var checkboxes = document.querySelectorAll('.pkg-checkbox');
					checkboxes.forEach(function(cb){
						if (!cb.disabled && cb.checked !== checked) {
							cb.checked = checked;
							// 使用可冒泡的事件，提升兼容性
							cb.dispatchEvent(new Event('change', { bubbles: true }));
							// 双保险：直接同步 selectedPackages
							try {
								var name = cb.getAttribute('data-pkg-name');
								if (name) {
                                    if (checked) {
                                        selectedPackages[name] = {
                                            name: name,
                                            version: '',
                                            purge: true,
                                            deps: true,
                                            cache: true
                                        };
                                    } else {
                                        delete selectedPackages[name];
                                    }
								}
							} catch(e){}
						}
					});
					updateBatchUI();
				});
				
				// 已选数量显示
				var selectedCount = E('span', { 
					id: 'selected-count',
					'style': 'font-size:13px; color:#6b7280; padding:4px 12px; background:#ffffff; border:1px solid #e5e7eb; border-radius:999px;'
				}, _('已选: 0'));
				
				// 批量卸载按钮
				var batchUninstallGradient = 'linear-gradient(135deg, #dc2626 0%, #ef4444 50%, #f87171 100%)';
				var batchUninstallGradientHover = 'linear-gradient(135deg, #b91c1c 0%, #dc2626 50%, #ef4444 100%)';
				// 垃圾桶图标 SVG
				var trashIconSvg = '<svg class="trash-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" preserveAspectRatio="xMidYMid meet" style="overflow:visible;"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" fill="currentColor"/></svg>';
				var batchUninstallBtn = E('button', {
					id: 'batch-uninstall-btn',
					type: 'button',
					'class': 'btn cbi-button cbi-button-remove',
					'style': 'opacity:0.5; cursor:not-allowed; background:' + batchUninstallGradient + '; color:#fff; border:none; box-shadow:0 2px 8px rgba(220,38,38,0.3), inset 0 1px 0 rgba(255,255,255,0.2); transition:all 0.2s;',
					disabled: true
				});
				// 添加文本和图标
				var btnText = E('span', { 'class': 'btn-text' }, _('批量卸载'));
				var btnIcon = E('span');
				btnIcon.innerHTML = trashIconSvg;
				batchUninstallBtn.appendChild(btnText);
				batchUninstallBtn.appendChild(btnIcon);
				// 为批量卸载按钮添加悬停效果（在按钮启用后）
				setTimeout(function() {
					var btn = document.getElementById('batch-uninstall-btn');
					if (btn) {
						var addHoverEffect = function() {
							if (btn.disabled || btn._hoverAdded) return;
							btn._hoverAdded = true;
							btn.addEventListener('mouseenter', function() {
								if (!this.disabled) {
									this.style.background = batchUninstallGradientHover;
									this.style.boxShadow = '0 4px 12px rgba(220,38,38,0.4), inset 0 1px 0 rgba(255,255,255,0.3)';
									this.style.transform = 'translateY(-1px)';
								}
							});
							btn.addEventListener('mouseleave', function() {
								if (!this.disabled) {
									this.style.background = batchUninstallGradient;
									this.style.boxShadow = '0 2px 8px rgba(220,38,38,0.3), inset 0 1px 0 rgba(255,255,255,0.2)';
									this.style.transform = 'translateY(0)';
								}
							});
						};
						// 监听按钮状态变化
						var observer = new MutationObserver(function() {
							if (!btn.disabled) {
								addHoverEffect();
							}
						});
						observer.observe(btn, { attributes: true, attributeFilter: ['disabled'] });
						// 立即检查一次
						if (!btn.disabled) {
							addHoverEffect();
						}
					}
				}, 100);
				
				batchSection.appendChild(selectAllLabel);
				batchSection.appendChild(selectedCount);
				batchSection.appendChild(batchUninstallBtn);
				
				// 中间：搜索框容器（包含搜索框和公告面板）
				var searchContainer = E('div', { 
					id: 'search-container'
				}, []);
				
				// 搜索框
				var searchSection = E('div', { 
					id: 'search-section',
					'style': 'flex:1; display:flex; align-items:center; gap:8px; background:#ffffff; border:1px solid #bae6fd; border-radius:999px; padding:6px 12px; transition:all 0.3s ease;'
				}, []);
				var searchIcon = E('img', { 
					src: L.resource('icons/ss.svg'), 
					'class': 'search-icon',
					'style': 'display:inline-block; width:18px; height:18px; object-fit:contain; opacity:0.6;'
				});
				var searchInput = E('input', { 
					id: 'filter', 
					type: 'text', 
					placeholder: _('按包名或文件名搜索…'), 
					'style': 'flex:1; border:none; outline:none; box-shadow:none; -webkit-appearance:none; appearance:none; font-size:14px; color:#111827; background:transparent;'
				});
				var clearBtn = E('button', { 
					id: 'filter-clear', 
					type: 'button', 
					'class': 'search-clear-btn',
					'style': 'display:none; background:#f3f4f6; border:1px solid #e5e7eb; color:#6b7280; border-radius:999px; padding:2px 8px; font-size:12px; cursor:pointer;' 
				}, _('清除'));
				searchSection.appendChild(searchIcon);
				searchSection.appendChild(searchInput);
				searchSection.appendChild(clearBtn);
				
				// 公告面板
				var announcementContent = E('div', {
					id: 'announcement-content'
				}, _('正在加载公告...'));
				
				var announcementPanel = E('div', {
					id: 'announcement-panel'
				}, [announcementContent]);
				
				// 获取公告数据的函数
				var announcementDataLoaded = false;
				var loadAnnouncementData = function() {
					// 如果已经加载过，不再重复加载
					if (announcementDataLoaded) return;
					
					// 显示加载状态
					announcementContent.innerHTML = '<div style="text-align:center; padding:20px; color:#6b7280;">' + 
						'<div style="width:24px; height:24px; margin:0 auto 8px; border:3px solid #e5e7eb; border-top-color:#6366f1; border-radius:50%; animation:spin 1s linear infinite;"></div>' +
						_('正在加载公告...') + '</div>';
					
					// 添加旋转动画
					if (!document.getElementById('announcement-spin-style')) {
						var spinStyle = E('style', { id: 'announcement-spin-style' }, '@keyframes spin { to { transform: rotate(360deg); } }');
						document.head.appendChild(spinStyle);
					}
					
					// 从后端API获取公告数据（避免CORS问题）
					var announcementUrl = L.url('admin/vum/uninstall/announcement');
					
					// 使用现有的 _httpJson 方法
					self._httpJson(announcementUrl, { 
						headers: { 'Accept': 'application/json' } 
					}).then(function(res) {
						announcementDataLoaded = true;
						
						if (res && res.ok && res.announcements && res.announcements.length > 0) {
							// 获取最新的公告（第一个）
							var latestAnnouncement = res.announcements[0];
							var content = latestAnnouncement.changelog || '';
							
							// 格式化显示内容
							var displayContent = '';
							
							// 显示日期和版本（如果有）
							if (latestAnnouncement.date || latestAnnouncement.latest) {
								displayContent += '<div style="display:flex; align-items:center; gap:8px; margin-bottom:12px; padding-bottom:8px; border-bottom:1px solid #e5e7eb;">';
								if (latestAnnouncement.latest) {
									displayContent += '<span style="font-size:12px; font-weight:600; color:#6366f1; background:#eef2ff; padding:2px 8px; border-radius:4px;">' + latestAnnouncement.latest + '</span>';
								}
								if (latestAnnouncement.date) {
									displayContent += '<span style="font-size:12px; color:#9ca3af;">' + latestAnnouncement.date + '</span>';
								}
								displayContent += '</div>';
							}
							
							// 显示公告内容
							if (content) {
								// 处理换行和格式，保留原有的换行符
								content = content.replace(/\n/g, '<br>');
								// 处理列表项格式（如果包含序号）
								content = content.replace(/[①-⑨]/g, function(match) {
									return '<span style="color:#6366f1; font-weight:600;">' + match + '</span>';
								});
								displayContent += '<div style="line-height:1.8; color:#374151;">' + content + '</div>';
							} else {
								displayContent += '<div style="text-align:center; padding:20px; color:#6b7280;">' + _('暂无公告内容') + '</div>';
							}
							
							announcementContent.innerHTML = displayContent;
						} else {
							announcementContent.innerHTML = '<div style="text-align:center; padding:20px; color:#6b7280;">' + 
								_('暂无公告') + '</div>';
						}
					}).catch(function(err) {
						console.error('加载公告失败:', err);
						announcementContent.innerHTML = '<div style="text-align:center; padding:20px; color:#dc2626;">' + 
							_('加载公告失败，请稍后重试') + '</div>';
					});
				};
				
				searchContainer.appendChild(searchSection);
				searchInput.addEventListener('input', function(){ clearBtn.style.display = searchInput.value ? 'inline-block' : 'none'; });
				clearBtn.addEventListener('click', function(e){
					// 清空搜索框
					searchInput.value=''; 
					clearBtn.style.display='none';
					// 立即触发刷新 - 清除搜索定时器并立即调用 refresh
					if (window.searchTimer) {
						clearTimeout(window.searchTimer);
						window.searchTimer = null;
					}
					// 如果 refresh 函数已经定义，直接调用（优先）
					if (typeof window.refreshUninstallList === 'function') {
						window.refreshUninstallList();
					} else {
						// 如果 refresh 函数还未定义，触发 input 事件
						var inputEvent = new Event('input', { bubbles: true, cancelable: true });
						searchInput.dispatchEvent(inputEvent);
					}
					// 在手机上，清除后保持展开状态并聚焦
					if (checkMobile() && !isExpanded) {
						expandSearch();
					} else if (checkMobile()) {
						searchInput.focus();
					}
				});
				
				// 手机上点击搜索框时自动展开
				var isExpanded = false;
				function checkMobile() {
					return window.innerWidth <= 768;
				}
				function updateSearchLayout() {
					if (checkMobile()) {
						if (!isExpanded) {
							searchSection.classList.add('mobile-collapsed');
							searchContainer.classList.add('mobile-icon-only');
						} else {
							searchContainer.classList.remove('mobile-icon-only');
						}
					} else {
						searchSection.classList.remove('mobile-collapsed');
						searchContainer.classList.remove('mobile-icon-only');
					}
				}
				updateSearchLayout();
				function expandSearch() {
					if (!checkMobile() || isExpanded) return;
					isExpanded = true;
					searchSection.classList.remove('mobile-collapsed');
					searchContainer.classList.remove('mobile-icon-only');
					searchSection.classList.add('search-expanded');
				// 隐藏其他元素，让搜索框占据更多空间
				var batchSection = toolbar.querySelector('div:first-child');
				var installBtn = document.getElementById('install-local-btn');
				var historyBtn = document.getElementById('history-log-btn');
				var bellBtn = document.getElementById('announcement-bell-btn');
				if (batchSection) batchSection.style.display = 'none';
				if (installBtn) installBtn.style.display = 'none';
				if (historyBtn) historyBtn.style.display = 'none';
				if (bellBtn) bellBtn.style.display = 'none';
					// 让搜索框占据全宽
					searchContainer.style.flex = '1 1 100%';
					searchContainer.style.margin = '0';
					searchContainer.style.order = '1';
					searchSection.style.flex = '1 1 100%';
					// 关闭公告面板（如果打开）
					if (window.announcementVisible) {
						window.announcementVisible = false;
						announcementPanel.classList.remove('show');
						announcementBellBtn.classList.remove('active');
						// 恢复工具栏圆角
						toolbar.classList.remove('announcement-open');
						// 更新图标渐变色
						if (announcementBellBtn.updateGradient) {
							announcementBellBtn.updateGradient(false);
						}
					}
					// 聚焦到输入框
					setTimeout(function() { searchInput.focus(); }, 100);
					updateSearchLayout();
				}
				function collapseSearch() {
					if (!isExpanded) return;
					isExpanded = false;
					searchSection.classList.remove('search-expanded');
				// 恢复其他元素
				var batchSection = toolbar.querySelector('div:first-child');
				var installBtn = document.getElementById('install-local-btn');
				var historyBtn = document.getElementById('history-log-btn');
				var bellBtn = document.getElementById('announcement-bell-btn');
				if (batchSection) batchSection.style.display = 'flex';
				if (installBtn) installBtn.style.display = '';
				if (historyBtn) historyBtn.style.display = '';
				if (bellBtn) bellBtn.style.display = '';
					// 恢复搜索框样式
					searchContainer.style.flex = '';
					searchContainer.style.margin = '';
					searchContainer.style.order = '';
					searchSection.style.flex = '';
					searchInput.blur();
					updateSearchLayout();
				}
				// 点击搜索区域时展开（如果还没展开）
				searchSection.addEventListener('click', function(e) {
					// 如果点击的是清空按钮，不展开
					if (e.target === clearBtn || clearBtn.contains(e.target)) {
						return;
					}
					if (checkMobile() && !isExpanded) {
						expandSearch();
					}
				});
				searchInput.addEventListener('focus', function() {
					if (checkMobile() && !isExpanded) {
						expandSearch();
					}
				});
				// 点击外部区域时收起（仅在手机上）
				document.addEventListener('click', function(e) {
					if (checkMobile() && isExpanded) {
						// 检查点击的目标是否在搜索区域内
						var target = e.target;
						if (target !== searchSection && !searchSection.contains(target) && target !== searchInput && target !== clearBtn) {
							// 如果输入框有内容，不收起；如果没有内容，收起
							if (!searchInput.value || searchInput.value.trim() === '') {
								collapseSearch();
							}
						}
					}
				});
				// 监听窗口大小变化，如果从手机切换到桌面，自动收起
				window.addEventListener('resize', function() {
					if (!checkMobile() && isExpanded) {
						collapseSearch();
					}
					updateSearchLayout();
				});
				
				// 根据屏幕宽度动态调整 placeholder 文字
				function updatePlaceholder() {
					var width = window.innerWidth || document.documentElement.clientWidth;
					if (width <= 480) {
						searchInput.placeholder = _('搜索…');
					} else if (width <= 768) {
						searchInput.placeholder = _('搜索包名或文件名…');
					} else {
						searchInput.placeholder = _('按包名或文件名搜索…');
					}
				}
				// 初始化
				updatePlaceholder();
				// 监听窗口大小变化
				var resizeTimer;
				window.addEventListener('resize', function() {
					clearTimeout(resizeTimer);
					resizeTimer = setTimeout(updatePlaceholder, 100);
				});
				
				// 公告铃铛按钮 - 使用渐变色图标
				// 生成唯一的ID以避免多个实例冲突
				var bellGradientId = 'bellGradient_' + Date.now();
				var bellGradientActiveId = 'bellGradientActive_' + Date.now();
				
				// 使用更清晰的铃铛图标路径
				var bellIconSvg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" preserveAspectRatio="xMidYMid meet" style="display:block;overflow:visible;">' +
					'<defs>' +
					'<linearGradient id="' + bellGradientId + '" x1="0%" y1="0%" x2="100%" y2="100%">' +
					'<stop offset="0%" style="stop-color:#3b82f6;stop-opacity:1" />' +
					'<stop offset="50%" style="stop-color:#6366f1;stop-opacity:1" />' +
					'<stop offset="100%" style="stop-color:#8b5cf6;stop-opacity:1" />' +
					'</linearGradient>' +
					'<linearGradient id="' + bellGradientActiveId + '" x1="0%" y1="0%" x2="100%" y2="100%">' +
					'<stop offset="0%" style="stop-color:#f59e0b;stop-opacity:1" />' +
					'<stop offset="50%" style="stop-color:#f97316;stop-opacity:1" />' +
					'<stop offset="100%" style="stop-color:#ea580c;stop-opacity:1" />' +
					'</linearGradient>' +
					'</defs>' +
					'<path d="M12 2c-1.1 0-2 .9-2 2v.29C7.12 5.14 5 7.82 5 11v6l-2 2v1h18v-1l-2-2v-6c0-3.18-2.12-5.86-5-6.71V4c0-1.1-.9-2-2-2zm0 3c.55 0 1 .45 1 1v1.07C15.36 7.27 17 9.47 17 12v5.83l.17.17H6.83L7 17.83V12c0-2.53 1.64-4.73 4-4.93V6c0-.55.45-1 1-1zm0 13c-1.1 0-2-.9-2-2h4c0 1.1-.9 2-2 2z" fill="url(#' + bellGradientId + ')" stroke="none"/>' +
					'</svg>';
				var announcementBellBtn = E('button', {
					id: 'announcement-bell-btn',
					type: 'button',
					title: _('公告'),
					'style': 'position:relative;'
				});
				announcementBellBtn.innerHTML = bellIconSvg;
				
				// 更新图标渐变色的函数（保存到按钮元素上以便全局访问）
				announcementBellBtn.updateGradient = function(isActive) {
					var svg = this.querySelector('svg');
					if (svg) {
						var paths = svg.querySelectorAll('path');
						var gradientId = isActive ? bellGradientActiveId : bellGradientId;
						paths.forEach(function(path) {
							path.setAttribute('fill', 'url(#' + gradientId + ')');
						});
					}
				};
				
				// 公告按钮点击事件
				window.announcementVisible = false;
				announcementBellBtn.addEventListener('click', function(e) {
					e.preventDefault();
					e.stopPropagation();
					window.announcementVisible = !window.announcementVisible;
					if (window.announcementVisible) {
						announcementPanel.classList.add('show');
						this.classList.add('active');
						this.updateGradient(true);
						// 调整工具栏圆角
						toolbar.classList.add('announcement-open');
						// 加载公告数据
						loadAnnouncementData();
					} else {
						announcementPanel.classList.remove('show');
						this.classList.remove('active');
						this.updateGradient(false);
						// 恢复工具栏圆角
						toolbar.classList.remove('announcement-open');
					}
				});
				
				// 初始化图标渐变色
				announcementBellBtn.updateGradient(false);
				
				// 点击外部区域关闭公告面板
				var announcementClickHandler = function(e) {
					if (window.announcementVisible) {
						var target = e.target;
						if (!announcementPanel.contains(target) && 
							target !== announcementBellBtn && 
							!announcementBellBtn.contains(target)) {
							window.announcementVisible = false;
							announcementPanel.classList.remove('show');
							announcementBellBtn.classList.remove('active');
							// 恢复工具栏圆角
							var toolbar = document.getElementById('batch-toolbar');
							if (toolbar) toolbar.classList.remove('announcement-open');
							// 更新图标渐变色
							if (announcementBellBtn.updateGradient) {
								announcementBellBtn.updateGradient(false);
							}
						}
					}
				};
				document.addEventListener('click', announcementClickHandler);
				
				// 右侧：本地安装 + 查看历史更新日志按钮
				var installGradient = 'linear-gradient(135deg, #10b981 0%, #059669 50%, #047857 100%)';
				var installGradientHover = 'linear-gradient(135deg, #059669 0%, #047857 50%, #065f46 100%)';
				var installBtn = E('button', {
					id: 'install-local-btn',
					type: 'button',
					'class': 'btn',
					'style': 'margin-left:auto; background:' + installGradient + '; color:#fff; border:none; border-radius:8px; padding:6px 14px; font-weight:500; cursor:pointer; transition:all 0.2s; display:flex; align-items:center; gap:6px; box-shadow:0 2px 8px rgba(16,185,129,0.3), inset 0 1px 0 rgba(255,255,255,0.2);'
				}, [
				E('img', {
					src: L.resource('icons/install.png'),
					alt: 'install',
					width: 16,
					height: 16,
					'style': 'display:block; object-fit:contain; filter:brightness(0) invert(1);'
				}),
					E('span', {}, _('安装 .ipk / .run'))
				]);
				installBtn.addEventListener('mouseenter', function(){
					this.style.background = installGradientHover;
					this.style.transform = 'translateY(-1px)';
					this.style.boxShadow = '0 4px 12px rgba(16,185,129,0.4), inset 0 1px 0 rgba(255,255,255,0.3)';
				});
				installBtn.addEventListener('mouseleave', function(){
					this.style.background = installGradient;
					this.style.transform = 'translateY(0)';
					this.style.boxShadow = '0 2px 8px rgba(16,185,129,0.3), inset 0 1px 0 rgba(255,255,255,0.2)';
				});

				// 历史更新日志按钮
				var historyLogGradient = 'linear-gradient(135deg, #3b82f6 0%, #6366f1 50%, #8b5cf6 100%)';
				var historyLogGradientHover = 'linear-gradient(135deg, #2563eb 0%, #4f46e5 50%, #7c3aed 100%)';
				var historyLogBtn = E('button', {
					id: 'history-log-btn',
					type: 'button',
					'class': 'btn',
					'style': 'margin-left:8px; background:' + historyLogGradient + '; color:#fff; border:none; border-radius:8px; padding:6px 16px; font-weight:500; cursor:pointer; transition:all 0.2s; display:flex; align-items:center; gap:6px; box-shadow:0 2px 8px rgba(99,102,241,0.3), inset 0 1px 0 rgba(255,255,255,0.2);'
				}, [
					E('img', { 
						src: L.resource('icons/update.svg'), 
						alt: 'history', 
						width: 16, 
						height: 16,
						'style': 'display:block; object-fit:contain; filter:brightness(0) invert(1);'
					}),
					E('span', {}, _('查看历史更新日志'))
				]);
				
				// 按钮悬停效果
				historyLogBtn.addEventListener('mouseenter', function(){ 
					this.style.background = historyLogGradientHover;
					this.style.transform = 'translateY(-1px)';
					this.style.boxShadow = '0 4px 12px rgba(99,102,241,0.4), inset 0 1px 0 rgba(255,255,255,0.3)';
				});
				historyLogBtn.addEventListener('mouseleave', function(){
					this.style.background = historyLogGradient;
					this.style.transform = 'translateY(0)';
					this.style.boxShadow = '0 2px 8px rgba(99,102,241,0.3), inset 0 1px 0 rgba(255,255,255,0.2)';
				});

				// 深色模式切换按钮
				var isDarkInitial = document.body && document.body.classList.contains('luci-uninstall-dark');
				var darkToggle = E('button', {
					id: 'uninstall-theme-toggle',
					type: 'button',
					'class': 'btn',
					'style': 'margin-left:8px; background:rgba(15,23,42,0.9); color:#e5e7eb; border:1px solid rgba(148,163,184,0.8); border-radius:999px; padding:6px 12px; font-size:12px; cursor:pointer; display:flex; align-items:center; gap:6px; box-shadow:0 2px 6px rgba(15,23,42,0.7); transition:all 0.2s;'
				}, [
					E('span', { 'class': 'theme-toggle-dot', 'style': 'display:inline-block;width:8px;height:8px;border-radius:999px;background:' + (isDarkInitial ? '#22c55e' : '#9ca3af') + '; box-shadow:0 0 0 3px rgba(148,163,184,0.3);' }),
					E('span', { 'class': 'theme-toggle-text' }, isDarkInitial ? _('深色模式: 开') : _('深色模式: 关'))
				]);

				function updateDarkToggleUI(isDark) {
					if (!darkToggle) return;
					var dot = darkToggle.querySelector('.theme-toggle-dot');
					var text = darkToggle.querySelector('.theme-toggle-text');
					if (dot) {
						dot.style.background = isDark ? '#22c55e' : '#9ca3af';
						dot.style.boxShadow = isDark ? '0 0 0 3px rgba(34,197,94,0.35)' : '0 0 0 3px rgba(148,163,184,0.3)';
					}
					if (text) {
						text.textContent = isDark ? _('深色模式: 开') : _('深色模式: 关');
					}
				}

				darkToggle.addEventListener('mouseenter', function() {
					this.style.transform = 'translateY(-1px)';
					this.style.boxShadow = '0 4px 10px rgba(15,23,42,0.75)';
				});
				darkToggle.addEventListener('mouseleave', function() {
					this.style.transform = 'translateY(0)';
					this.style.boxShadow = '0 2px 6px rgba(15,23,42,0.7)';
				});

				darkToggle.addEventListener('click', function() {
					if (!document || !document.body) return;
					var isDark = document.body.classList.toggle('luci-uninstall-dark');
					try {
						if (window.localStorage) {
							window.localStorage.setItem(darkKey, isDark ? '1' : '0');
						}
					} catch (e) {}
					updateDarkToggleUI(isDark);
				});
				
				toolbar.appendChild(batchSection);
				toolbar.appendChild(searchContainer);
				toolbar.appendChild(announcementBellBtn);
				toolbar.appendChild(installBtn);
				toolbar.appendChild(darkToggle);
				toolbar.appendChild(historyLogBtn);
				
				// 创建包装器，包含工具栏和公告面板
				var toolbarWrapper = E('div', {
					'style': 'position: sticky; top: 0; z-index: 100; margin: 8px 0;'
				}, []);
				
				toolbarWrapper.appendChild(toolbar);
				toolbarWrapper.appendChild(announcementPanel);
				
				return toolbarWrapper;
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
			'luci-app-passwall2': 'ssr2',
			'luci-app-opkg': 'pkg',
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
			'luci-app-wol': 'hx',
			'luci-app-openlist': 'openlist',
			'luci-app-openlist2': 'openlist2',
			'luci-app-homeproxy': 'homeproxy',
			'luci-app-ipsec-vpnd': 'ipsec-vpnd',
			'luci-app-natmap': 'natmap',
			'luci-app-nastools': 'nastools',
			'luci-app-dufs': 'dufs',
			'luci-app-easytier': 'easytier',
			'luci-app-mosdns': 'mosdns',
			'luci-app-openvpn': 'openvpn',
			'luci-app-openvpn-server': 'openvpn-server',
			'luci-app-wireguard': 'wireguard',
			'luci-app-wechatpush': 'wechatpush',
			'luci-app-rtp2httpd': 'rtp2httpd',
			'luci-app-ap-modem': 'ap-modem',
			'luci-app-filebrowser-go': 'filebrowser-go',
			'luci-app-5GSmartCase': '5GSmartCase',
			'luci-app-ssr-plus': 'ssr',
			'luci-app-taskplan': 'taskplan',
			'luci-app-filemanager': 'filemanager',
			'luci-app-unblockneteasemusic': 'unblockneteasemusic',
			'luci-app-turboacc': 'turboacc',
			'luci-app-watchdog': 'watchdog',
			'luci-app-oled': 'oled',
			'luci-app-bypass': 'bypass',
			'luci-app-trojan-server': 'trojan',
			'luci-app-qbittorrent-ee': 'qBittorrent',
			'luci-app-virtualhere': 'virtualhere'
		};
		function packageIcon(name, category){
			// 从 app-icons 目录加载 PNG
			// 规则：luci-app-xxx[-yyy...] -> 移除前缀与横杆，得到 xxx[yyy].png
			// 特殊映射优先
			// DDNSTO 与 LinkEase 图标按分类单独处理
			if (name === 'luci-app-ddnsto' || name === 'luci-app-linkease') {
				var baseName = (name === 'luci-app-ddnsto') ? 'ddnsto' : 'linkease';
				// iStoreOS 插件类走 app-icons，其它分类走 icons
				if (category === 'iStoreOS插件类') {
					return L.resource('app-icons/' + baseName + '.png');
				} else {
					return L.resource('icons/' + baseName + '.png');
				}
			}
			if (name === 'luci-app-smartdns') {
				// SmartDNS 图标在 icons 目录下，直接引用
				return L.resource('icons/smartdns.png');
			}
			if (name === 'luci-app-advancedplus') {
				return L.resource('icons/advancedplus.png');
			}
			if (name === 'luci-app-wolplus') {
				// 电源Plus 图标在 icons 目录下
				return L.resource('icons/wolplus.png');
			}
			if (name === 'luci-app-watchcat-plus') {
			// Watchcat Plus 图标在 icons 目录下
			return L.resource('icons/watchcat.png');
		}
		// 特殊处理：使用指定的图标路径
		if (name === 'luci-app-virtualhere') {
			return '/luci-static/resources/icons/virtualhere.png';
		}
		if (name === 'luci-app-qbittorrent-ee') {
			return '/luci-static/resources/icons/qBittorrentee.png';
		}
		// 指定使用 icons 目录下图标的应用
		if (name === 'luci-app-syncthing') {
			return L.resource('icons/syncthing.png');
		}
		if (name === 'luci-app-adblock-fast') {
			return L.resource('icons/adblock-fast.png');
		}
		var base = SPECIAL_ICON_MAP[name];
		if (base) return L.resource('app-icons/' + base + '.png');
		if (name === 'luci-app-uninstall') return L.resource('app-icons/gjxz.png');
			// 例如：luci-app-ddns-go -> ddnsgo.png
			var short = (name || '').replace(/^luci-app-/, '').replace(/-/g, '');
			return L.resource('app-icons/' + short + '.png');
		}

		var grid = E('div', { 'class': 'card-grid', 'style': 'display:block;margin-top:8px;' });
		root.appendChild(grid);

		// 兜底：根据锁状态强制同步复选框可交互性，避免意外禁用导致无法选择
		function ensureInteractiveCheckboxes() {
			try {
				var checkboxes = document.querySelectorAll('.pkg-checkbox');
				checkboxes.forEach(function(cb){
					var name = cb.getAttribute('data-pkg-name') || '';
					var locked = !!(window.lockStateCache && window.lockStateCache[name] === true);
					cb.disabled = locked ? true : false;
					// 同步包装器可视和交互状态
					var wrapper = cb.parentElement;
					if (wrapper && wrapper.classList && wrapper.classList.contains('custom-checkbox-wrapper')) {
						wrapper.style.opacity = locked ? '0.5' : '1';
						wrapper.style.cursor = locked ? 'not-allowed' : 'pointer';
						wrapper.style.pointerEvents = locked ? 'auto' : 'auto'; // 始终允许事件穿透到自定义点击逻辑
					}
				});
			} catch(e) {}
		}

		var NAME_MAP = {
			'luci-app-uninstall': _('高级卸载'),
			'luci-app-advancedplus': _('AdvancedPlus'),
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
			'luci-app-wolplus': _('电源Plus'),
			'luci-app-watchcat-plus': _('Watchcat Plus'),
			'luci-app-firewall': _('防火墙'),
			'luci-app-transmission': _('BT下载'),
			'luci-app-openvpn': _('OpenVpn'),
			'luci-app-wireguard': _('WireGuard'),
			'luci-app-homeproxy': _('Homeproxy'),
			'luci-app-ipsec-vpnd': _('IPsec VPN'),
			'luci-app-natmap': _('NatMap'),
			'luci-app-nastools': _('NasTools'),
			'luci-app-dufs': _('Dufs'),
			'luci-app-easytier': _('Easytier'),
			'luci-app-mosdns': _('Mosdns'),
			'luci-app-openvpn-server': _('OpenVpn Server'),
			'luci-app-sqm': _('智能队列管理'),
			'luci-app-adguardhome': _('AdguardHome'),
			'luci-app-passwall': _('PassWall'),
			'luci-app-passwall2': _('PASSWALL2'),
			'luci-app-opkg': _('OPKG'),
			'luci-app-cloudflared': _('Cloudflare Tunnel'),
			'luci-app-homeassistant': _('家庭助手'),
			'luci-app-dockerman': _('容器管理'),
			'luci-app-zerotier': _('ZeroTier'),
			'luci-app-ksmbd': _('SMB共享'),
			'luci-app-samba': _('Samba共享'),
			'luci-app-turboacc': _('Turbo Acc网络加速插件'),
			'luci-app-taskplan': _('Task Plan'),
			'luci-app-filemanager': _('File Manager'),
			'luci-app-unblockneteasemusic': _('解锁网易云音乐'),
			'luci-app-watchdog': _('看门狗'),
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
			'luci-app-openlist2': _('OpenList网盘2'),
			'luci-app-rclone': _('Rclone'),
			'luci-app-syncdial': _('多线多拨'),
			'luci-app-sunpanel': _('SunPanel导航页'),
			'luci-app-ap-modem': _('AP-Modem'),
			'luci-app-wechatpush': _('Wechat Push'),
			'luci-app-rtp2httpd': _('rtp2httpd'),
			'luci-app-filebrowser-go': _('filebrowser-go'),
			'luci-app-5GSmartCase': _('5GSmartCase'),
			'luci-app-serverchan': _('微信推送ServerChan'),
			'luci-app-runmynas': _('RunMyNAS自定义固件'),
			'luci-app-rtbwmon': _('实时流量'),
			'luci-app-arcadia': _('Arcadia一站式代码运维'),
			'luci-app-rebatedog': _('旺财狗'),
			'luci-app-qbittorrent-ee': _('qBittorrent-ee'),
			'luci-app-virtualhere': _('VirtualHere'),
			'luci-app-pve': _('Proxmox虚拟机(PVE)'),
			// 额外名称映射
			'luci-app-syncthing': _('SyncThing'),
			'luci-app-adblock-fast': _('快速广告拦截'),
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
			'luci-app-tailscaler': _('Tailscale'),
			'luci-app-ssr-plus': _('SSR Plus'),
			'luci-app-oled': _('OLED'),
			'luci-app-bypass': _('Bypass'),
			'luci-app-trojan-server': 'trojan-server'
		};
		function displayName(name, category){
			// iStoreOS 插件优先用商店中文名；否则 fallback 到内置映射或原名
			var zh = null;
			if (category === 'iStoreOS插件类') {
				zh = (name && self && self._storeNames && self._storeNames[name]) || null;
			}
			return zh || NAME_MAP[name] || name;
		}

		// 已知没有界面的软件列表（黑名单）
		var NO_UI_PACKAGES = {
			'luci-app-cifs-mount': true,
			'luci-app-mergerfs': true,
			'luci-app-nfs': true,
			'luci-app-oaf': true,
			'luci-app-package-manager': true,
			'luci-app-unishare': true,
			'luci-app-cpufreq': true,
			'luci-app-cpuset': true,
			'luci-app-hd-idle': true,
			'luci-app-turboacc': true,
			'luci-app-mwan3': true,
			'luci-app-mwan3helper': true,
			'luci-app-vlmcsd': true,
			'luci-app-attendedsysupgrade': true,
			'luci-app-statistics': true,
			'luci-app-nlbwmon': true,
			'luci-app-tinyproxy': true,
			'luci-app-shadowsocks-libev': true,
			'luci-app-banip': true,
			'luci-app-minidlna': true,
			'luci-app-frpc': true,
			'luci-app-frps': true,
			'luci-app-socat': true,
			'luci-app-kodexplorer': true
		};

		// URL 可用性检查缓存
		var urlCheckCache = {};

		// 检查 URL 是否可用（异步）
		function checkUrlAvailable(url, callback) {
			if (!url) {
				callback(false);
				return;
			}
			
			// 检查缓存
			if (urlCheckCache.hasOwnProperty(url)) {
				callback(urlCheckCache[url]);
				return;
			}
			
			// 使用 HEAD 请求检查 URL 是否存在，失败时回退到 GET
			if (typeof fetch === 'function') {
				fetch(url, {
					method: 'HEAD',
					credentials: 'include',
					cache: 'no-cache'
				}).then(function(response) {
					// 200-299 或 302/301 重定向都认为可用；否则尝试 GET 回退
					var available = response.ok || (response.status >= 300 && response.status < 400);
					if (available) {
						urlCheckCache[url] = true;
						callback(true);
					} else {
						// 回退 GET
						fetch(url, {
							method: 'GET',
							credentials: 'include',
							cache: 'no-cache'
						}).then(function(res2){
							var ok2 = res2.ok || (res2.status >= 300 && res2.status < 400);
							urlCheckCache[url] = ok2;
							callback(ok2);
						}).catch(function(){
							urlCheckCache[url] = false;
							callback(false);
						});
					}
				}).catch(function() {
					// HEAD 失败回退到 GET
					fetch(url, {
						method: 'GET',
						credentials: 'include',
						cache: 'no-cache'
					}).then(function(res2){
						var ok2 = res2.ok || (res2.status >= 300 && res2.status < 400);
						urlCheckCache[url] = ok2;
						callback(ok2);
					}).catch(function(){
						urlCheckCache[url] = false;
						callback(false);
					});
				});
			} else {
				// 如果没有 fetch，使用 XMLHttpRequest
				var xhr = new XMLHttpRequest();
				xhr.open('HEAD', url, true);
				xhr.withCredentials = true;
				xhr.onreadystatechange = function() {
					if (xhr.readyState === 4) {
						var available = (xhr.status >= 200 && xhr.status < 300) || (xhr.status >= 300 && xhr.status < 400);
						if (available) {
							urlCheckCache[url] = true;
							callback(true);
						} else {
							// 回退到 GET
							var xhr2 = new XMLHttpRequest();
							xhr2.open('GET', url, true);
							xhr2.withCredentials = true;
							xhr2.onreadystatechange = function() {
								if (xhr2.readyState === 4) {
									var ok2 = (xhr2.status >= 200 && xhr2.status < 300) || (xhr2.status >= 300 && xhr2.status < 400);
									urlCheckCache[url] = ok2;
									callback(ok2);
								}
							};
							xhr2.onerror = function() {
								urlCheckCache[url] = false;
								callback(false);
							};
							xhr2.send();
						}
					}
				};
				xhr.onerror = function() {
					// 回退到 GET
					var xhr2 = new XMLHttpRequest();
					xhr2.open('GET', url, true);
					xhr2.withCredentials = true;
					xhr2.onreadystatechange = function() {
						if (xhr2.readyState === 4) {
							var ok2 = (xhr2.status >= 200 && xhr2.status < 300) || (xhr2.status >= 300 && xhr2.status < 400);
							urlCheckCache[url] = ok2;
							callback(ok2);
						}
					};
					xhr2.onerror = function() {
						urlCheckCache[url] = false;
						callback(false);
					};
					xhr2.send();
				};
				xhr.send();
			}
		}

		// 获取软件对应的 URL 路径
		function getAppUrl(pkgName){
			if (!pkgName || pkgName === 'luci-app-uninstall') return null;
			// 移除 luci-app- 前缀
			var appName = pkgName.replace(/^luci-app-/, '');
			// 特殊映射
			var specialUrls = {
				'wireguard': '/cgi-bin/luci/admin/network/wireguard',
				'openvpn': '/cgi-bin/luci/admin/services/openvpn',
				'passwall': '/cgi-bin/luci/admin/services/passwall',
				'homeproxy': '/cgi-bin/luci/admin/services/homeproxy',
				'adguardhome': '/cgi-bin/luci/admin/services/AdGuardHome',
				'openclash': '/cgi-bin/luci/admin/services/openclash',
				'dockerman': '/cgi-bin/luci/admin/docker',
				'zerotier': '/cgi-bin/luci/admin/services/zerotier',
				'ddns': '/cgi-bin/luci/admin/services/ddns',
				'firewall': '/cgi-bin/luci/admin/network/firewall',
				'samba4': '/cgi-bin/luci/admin/services/samba4',
				'ksmbd': '/cgi-bin/luci/admin/services/ksmbd',
				'upnp': '/cgi-bin/luci/admin/services/upnp',
				'wol': '/cgi-bin/luci/admin/services/wol',
				'transmission': '/cgi-bin/luci/admin/services/transmission',
				'aria2': '/cgi-bin/luci/admin/services/aria2',
				'smartdns': '/cgi-bin/luci/admin/services/smartdns',
				'mosdns': '/cgi-bin/luci/admin/services/mosdns',
				'cpufreq': '/cgi-bin/luci/admin/system/cpufreq',
				'statistics': '/cgi-bin/luci/admin/statistics',
				'filetransfer': '/cgi-bin/luci/admin/system/filetransfer',
				'fan': '/cgi-bin/luci/admin/system/fan',
				'diskman': '/cgi-bin/luci/admin/system/diskman',
				'ttyd': '/cgi-bin/luci/admin/system/ttyd',
				'socat': '/cgi-bin/luci/admin/network/socat'
			};
			if (specialUrls[appName]) {
				return specialUrls[appName];
			}
			// 默认路径：尝试常见的路径模式
			return '/cgi-bin/luci/admin/' + appName;
		}

		// 解析可用的 App 打开地址（带缓存与多段路径探测）
		var appUrlResolveCache = {};
		function resolveAppUrl(pkgName, callback) {
			if (!pkgName || pkgName === 'luci-app-uninstall') {
				callback(null);
				return;
			}
			// 缓存命中
			if (appUrlResolveCache.hasOwnProperty(pkgName)) {
				callback(appUrlResolveCache[pkgName]);
				return;
			}
			// 计算候选路径（含特殊映射）
			var appName = pkgName.replace(/^luci-app-/, '');
			var specialUrls = {
				'wireguard': '/cgi-bin/luci/admin/network/wireguard',
				'openvpn': '/cgi-bin/luci/admin/services/openvpn',
				'passwall': '/cgi-bin/luci/admin/services/passwall',
				'homeproxy': '/cgi-bin/luci/admin/services/homeproxy',
				'adguardhome': '/cgi-bin/luci/admin/services/AdGuardHome',
				'openclash': '/cgi-bin/luci/admin/services/openclash',
				'dockerman': '/cgi-bin/luci/admin/docker',
				'zerotier': '/cgi-bin/luci/admin/services/zerotier',
				'ddns': '/cgi-bin/luci/admin/services/ddns',
				'firewall': '/cgi-bin/luci/admin/network/firewall',
				'samba4': '/cgi-bin/luci/admin/services/samba4',
				'ksmbd': '/cgi-bin/luci/admin/services/ksmbd',
				'upnp': '/cgi-bin/luci/admin/services/upnp',
				'wol': '/cgi-bin/luci/admin/services/wol',
				'transmission': '/cgi-bin/luci/admin/services/transmission',
				'aria2': '/cgi-bin/luci/admin/services/aria2',
				'smartdns': '/cgi-bin/luci/admin/services/smartdns',
				'mosdns': '/cgi-bin/luci/admin/services/mosdns',
				'cpufreq': '/cgi-bin/luci/admin/system/cpufreq',
				'statistics': '/cgi-bin/luci/admin/statistics',
				'filetransfer': '/cgi-bin/luci/admin/system/filetransfer',
				'fan': '/cgi-bin/luci/admin/system/fan',
				'diskman': '/cgi-bin/luci/admin/system/diskman',
				'ttyd': '/cgi-bin/luci/admin/system/ttyd'
			};
			if (specialUrls[appName]) {
				var sp = specialUrls[appName];
				appUrlResolveCache[pkgName] = sp;
				callback(sp);
				return;
			}
			// 常见分区顺序尝试：services → nas → network → system → 根 admin
			var candidates = [
				'/cgi-bin/luci/admin/services/' + appName,
				'/cgi-bin/luci/admin/nas/' + appName,
				'/cgi-bin/luci/admin/network/' + appName,
				'/cgi-bin/luci/admin/system/' + appName,
				'/cgi-bin/luci/admin/' + appName
			];
			// 依次探测
			(function tryNext(idx){
				if (idx >= candidates.length) {
					appUrlResolveCache[pkgName] = null;
					callback(null);
					return;
				}
				var url = candidates[idx];
				checkUrlAvailable(url, function(ok){
					if (ok) {
						appUrlResolveCache[pkgName] = url;
						callback(url);
					} else {
						tryNext(idx + 1);
					}
				});
			})(0);
		}

		// 检查软件是否有可用界面
		function hasAvailableUI(pkgName) {
			// 首先检查黑名单
			if (NO_UI_PACKAGES[pkgName]) {
				return false;
			}
			// 其他软件默认认为有界面（可以通过异步检查进一步验证）
			return true;
		}

		function renderCard(pkg){
			var isNew = false;
			if (pkg && pkg.install_time) {
				// install_time from backend is seconds since epoch
				isNew = ((Date.now() / 1000) - pkg.install_time) < 259200; // 3 days
			}
			// 检查锁状态
			var isLocked = false;
			if (window.lockStateCache && window.lockStateCache[pkg.name] === true) {
				isLocked = true;
			}
			// 批量选择复选框 - 美化版本
			var checkbox = E('input', { 
				type: 'checkbox',
				'class': 'pkg-checkbox',
				'data-pkg-name': pkg.name,
				disabled: isLocked
			});
			checkbox.checked = selectedPackages[pkg.name] || false;
			var checkboxWrapper = E('div', { 'class': 'custom-checkbox-wrapper pkg-checkbox-wrapper' }, [
				checkbox,
				E('span', { 'class': 'custom-checkbox' })
			]);
			// 如果锁定，添加禁用样式
			if (isLocked) {
				checkboxWrapper.style.opacity = '0.5';
				checkboxWrapper.style.cursor = 'not-allowed';
			}
			// 点击包装器也能切换复选框（仅在未锁定时）
			checkboxWrapper.addEventListener('click', function(ev){
				if (checkbox.disabled) {
					ev.preventDefault();
					ev.stopPropagation();
					return;
				}
				ev.preventDefault();
				ev.stopPropagation();
				checkbox.checked = !checkbox.checked;
				checkbox.dispatchEvent(new Event('change'));
			});
			checkbox.addEventListener('change', function(){
				if (this.disabled) {
					this.checked = false;
					return;
				}
				// 读取选项的安全方法，避免元素尚未初始化导致异常
				function safeChecked(el, defVal) {
					return (el && typeof el.checked === 'boolean') ? el.checked : defVal;
				}
				if (this.checked) {
					selectedPackages[pkg.name] = { 
						name: pkg.name, 
						version: pkg.version || '',
						purge: safeChecked(purgeEl, true),
						deps: safeChecked(depsEl, true),
						cache: safeChecked(cacheEl, true)
					};
				} else {
					delete selectedPackages[pkg.name];
				}
				updateBatchUI();
			});
			
		var img = E('img', { src: packageIcon(pkg.name, pkg.category), alt: pkg.name, width: 56, height: 56, 'style': 'border-radius:10px;background:#f3f4f6;object-fit:contain;border:1px solid #e5e7eb;' });
		img.addEventListener('error', function(){ img.src = DEFAULT_ICON; });
			
			var titleCn = E('div', { 'style': 'font-weight:600;color:#111827;word-break:break-all;font-size:14px;' }, (pkg.display_name || displayName(pkg.name, pkg.category)));
			var titleEn = E('div', { 'style': 'font-size:12px;color:#6b7280;word-break:break-all;' }, pkg.name);
			var title = E('div', { 'style': 'display:flex; flex-direction:column; gap:2px;' }, [ titleCn, titleEn ]);
			// small inline icons for options
			var ICON_PURGE = L.resource('app-icons/pz.png');
			var ICON_CACHE = L.resource('app-icons/qk.png');
			var ICON_DEP = 'data:image/svg+xml;base64,' + btoa('<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 1 7.07 0l1.41 1.41a5 5 0 1 1-7.07 7.07l-1.41-1.41"/><path d="M14 11a5 5 0 0 1-7.07 0L5.52 9.59a5 5 0 1 1 7.07-7.07L14 3.93"/></svg>');
			function optionIcon(src){
				return E('span', { 'style': 'display:inline-flex;width:18px;height:18px;align-items:center;justify-content:center;' }, [
					E('img', { src: src, width: 16, height: 16, 'style': 'display:inline-block;object-fit:contain;filter:brightness(0) saturate(100%) invert(0.6);' })
				]);
			}
			
			var verCorner = E('div', { 'style': 'position:absolute; right:12px; bottom:6px; font-size:12px; color:#111827; background:#f3f4f6; padding:2px 8px; border-radius:10px; border:1px solid #e5e7eb;' }, (pkg.version || ''));
			if (pkg && pkg.name === 'luci-app-uninstall') verCorner.id = 'uninstall-card-version';
			var purgeEl = E('input', { type: 'checkbox', checked: true, 'style': 'display:none;' });
			var makeSwitch = function(el, disabled){
				disabled = disabled || false;
				var baseOn = 'display:inline-block;width:36px;height:20px;background:#4f46e5;border-radius:999px;position:relative;transition:all .15s;';
				var baseOff = 'display:inline-block;width:36px;height:20px;background:#e5e7eb;border-radius:999px;position:relative;transition:all .15s;';
				var baseDisabled = 'display:inline-block;width:36px;height:20px;background:#d1d5db;border-radius:999px;position:relative;transition:all .15s;opacity:0.5;';
				var knobOn = 'position:absolute;top:2px;left:18px;width:16px;height:16px;background:#fff;border-radius:999px;box-shadow:0 1px 2px rgba(0,0,0,.15);';
				var knobOff = 'position:absolute;top:2px;left:2px;width:16px;height:16px;background:#fff;border-radius:999px;box-shadow:0 1px 2px rgba(0,0,0,.15);';
				var sw = E('span', { 'style': disabled ? baseDisabled : (el.checked ? baseOn : baseOff) });
				sw.appendChild(E('span', { 'style': el.checked ? knobOn : knobOff }));
				sw._disabled = disabled;
				sw._updateStyle = function(disabledState) {
					sw._disabled = disabledState;
					if (disabledState) {
						sw.setAttribute('style', baseDisabled);
					} else {
						sw.setAttribute('style', el.checked ? baseOn : baseOff);
					}
				};
				sw.addEventListener('click', function(ev){ 
					if (sw._disabled) {
						ev.preventDefault();
						ev.stopPropagation();
						return;
					}
					ev.preventDefault(); 
					el.checked = !el.checked; 
					sw.firstChild.setAttribute('style', el.checked ? knobOn : knobOff); 
					sw.setAttribute('style', el.checked ? baseOn : baseOff); 
				});
				return sw;
			};
			var purgeSwitch = makeSwitch(purgeEl, isLocked);
			var purgeLabel = E('label', { 'style': 'display:grid; grid-template-columns:18px auto auto; align-items:center; column-gap:6px; line-height:20px; opacity:' + (isLocked ? '0.5' : '1') + '; cursor:' + (isLocked ? 'not-allowed' : 'default') + ';' }, [ optionIcon(ICON_PURGE), _('删除配置文件'), purgeSwitch ]);
			var depsEl = E('input', { type: 'checkbox', checked: true, 'style': 'display:none;' });
			var depsSwitch = makeSwitch(depsEl, isLocked);
			var depsLabel = E('label', { 'style': 'display:grid; grid-template-columns:18px auto auto; align-items:center; column-gap:6px; line-height:20px; opacity:' + (isLocked ? '0.5' : '1') + '; cursor:' + (isLocked ? 'not-allowed' : 'default') + ';' }, [ optionIcon(ICON_DEP), _('卸载相关依赖'), depsSwitch ]);
			var cacheEl = E('input', { type: 'checkbox', checked: true, 'style': 'display:none;' });
			var cacheSwitch = makeSwitch(cacheEl, isLocked);
			var cacheLabel = E('label', { 'style': 'display:grid; grid-template-columns:18px auto auto; align-items:center; column-gap:6px; line-height:20px; opacity:' + (isLocked ? '0.5' : '1') + '; cursor:' + (isLocked ? 'not-allowed' : 'default') + ';' }, [ optionIcon(ICON_CACHE), _('清空插件缓存'), cacheSwitch ]);
			var optionsRow = E('div', { 'style': 'display:flex; gap:12px; align-items:center; flex-wrap:wrap;' }, [ purgeLabel, depsLabel, cacheLabel ]);
			// 卸载按钮使用红色渐变
			var uninstallGradient = 'linear-gradient(135deg, #dc2626 0%, #ef4444 50%, #f87171 100%)';
			var uninstallGradientHover = 'linear-gradient(135deg, #b91c1c 0%, #dc2626 50%, #ef4444 100%)';
			var uninstallGradientDisabled = 'linear-gradient(135deg, #9ca3af 0%, #6b7280 50%, #4b5563 100%)';
			var btn = E('button', { 
				type: 'button', 
				'class': 'btn cbi-button cbi-button-remove',
				'style': 'background:' + (isLocked ? uninstallGradientDisabled : uninstallGradient) + '; color:#fff; border:none; box-shadow:0 2px 8px rgba(0,0,0,0.1), inset 0 1px 0 rgba(255,255,255,0.2); transition:all 0.2s; opacity:' + (isLocked ? '0.5' : '1') + '; cursor:' + (isLocked ? 'not-allowed' : 'pointer') + ';'
			}, _('卸载'));
			if (isLocked) {
				btn.disabled = true;
			}
			btn.addEventListener('mouseenter', function() {
				if (!this.disabled) {
					this.style.background = uninstallGradientHover;
					this.style.boxShadow = '0 4px 12px rgba(220,38,38,0.4), inset 0 1px 0 rgba(255,255,255,0.3)';
					this.style.transform = 'translateY(-1px)';
				}
			});
			btn.addEventListener('mouseleave', function() {
				if (!this.disabled) {
					this.style.background = uninstallGradient;
					this.style.boxShadow = '0 2px 8px rgba(220,38,38,0.3), inset 0 1px 0 rgba(255,255,255,0.2)';
					this.style.transform = 'translateY(0)';
				}
			});
			btn.addEventListener('click', function(ev){ 
				if (this.disabled) {
					ev.preventDefault();
					ev.stopPropagation();
					return;
				}
				ev.preventDefault(); 
				ev.stopPropagation(); 
				uninstall(pkg.name, purgeEl.checked, depsEl.checked, pkg.version || '', cacheEl.checked); 
			});
			var metaTop = E('div', { 'style': 'display:flex; align-items:center; gap:8px; flex-wrap:wrap;' }, [ title ]);
		var metaCol = E('div', { 'class': 'pkg-meta', 'style': 'flex:1; display:flex; flex-direction:column; gap:6px;' }, [ metaTop, optionsRow ]);
		var actions = E('div', { 'class': 'pkg-actions', 'style': 'display:flex; align-items:center; margin-left:auto;' }, [ btn ]);
		var children = [ checkboxWrapper, img, metaCol, actions, verCorner ];
		if (pkg.vum_plugin) children.push(E('div', { 'style': 'position:absolute; left:12px; bottom:6px; font-size:11px; color:#fff; background:#4f46e5; padding:2px 6px; border-radius:10px;' }, 'VUM-Plugin'));
		if (isNew) children.push(E('img', { src: L.resource('icons/new.png'), 'style': 'position:absolute; left:12px; top:8px; width:24px; height:24px; object-fit:contain;' }));
		
	// 在卡片左下角添加上报图标按钮(排除 luci-app-uninstall 自身)
	var reportIconBtn = null;
	var reportUninstallBtn = null;
	if (pkg && pkg.name !== 'luci-app-uninstall') {
		reportIconBtn = E('button', {
			type: 'button',
			title: _('上报图标问题'),
			'style': 'position:absolute; left:' + (pkg.vum_plugin ? '100px' : '12px') + '; bottom:6px; width:28px; height:28px; padding:0; background:#f3f4f6; border:1px solid #e5e7eb; border-radius:50%; display:flex; align-items:center; justify-content:center; cursor:' + (isLocked ? 'not-allowed' : 'pointer') + '; box-shadow:0 1px 3px rgba(0,0,0,0.1); transition:all .15s ease; color:#6b7280; overflow:hidden; opacity:' + (isLocked ? '0.5' : '1') + ';'
		}, [
			E('img', { 
				src: L.resource('icons/sbtp.png'), 
				alt: 'report', 
				width: 16, 
				height: 16,
				'style': 'display:block; object-fit:contain;filter:brightness(0) saturate(100%) invert(0.3);'
			})
		]);
		if (isLocked) {
			reportIconBtn.disabled = true;
		}
		reportIconBtn.addEventListener('mouseenter', function(){ 
			if (!this.disabled) {
				this.style.transform = 'translateY(-2px)'; 
				this.style.background = '#ff6b6b';
				this.style.borderColor = '#ff6b6b';
				this.style.boxShadow = '0 3px 8px rgba(255,107,107,0.3)';
				this.style.color = '#ffffff';
			}
		});
		reportIconBtn.addEventListener('mouseleave', function(){ 
			if (!this.disabled) {
				this.style.transform = 'translateY(0)'; 
				this.style.background = '#f3f4f6';
				this.style.borderColor = '#e5e7eb';
				this.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
				this.style.color = '#6b7280';
			}
		});
		reportIconBtn.addEventListener('click', function(ev){
			if (this.disabled) {
				ev.preventDefault();
				ev.stopPropagation();
				return;
			}
			ev.preventDefault();
			ev.stopPropagation();
			reportIcon(pkg.name);
		});
		children.push(reportIconBtn);
		
		// 添加上报卸载问题按钮（在上报图标按钮右边）
		reportUninstallBtn = E('button', {
			type: 'button',
			title: _('上报卸载问题'),
			'style': 'position:absolute; left:' + (pkg.vum_plugin ? '136px' : '48px') + '; bottom:6px; width:28px; height:28px; padding:0; background:#f3f4f6; border:1px solid #e5e7eb; border-radius:50%; display:flex; align-items:center; justify-content:center; cursor:' + (isLocked ? 'not-allowed' : 'pointer') + '; box-shadow:0 1px 3px rgba(0,0,0,0.1); transition:all .15s ease; color:#6b7280; overflow:hidden; opacity:' + (isLocked ? '0.5' : '1') + ';'
		}, [
			E('img', { 
				src: L.resource('icons/xzbc.png'), 
				alt: 'report uninstall', 
				width: 16, 
				height: 16,
				'style': 'display:block; object-fit:contain;filter:brightness(0) saturate(100%) invert(0.3);'
			})
		]);
		if (isLocked) {
			reportUninstallBtn.disabled = true;
		}
		reportUninstallBtn.addEventListener('mouseenter', function(){ 
			if (!this.disabled) {
				this.style.transform = 'translateY(-2px)'; 
				this.style.background = '#f59e0b';
				this.style.borderColor = '#f59e0b';
				this.style.boxShadow = '0 3px 8px rgba(245,158,11,0.3)';
				this.style.color = '#ffffff';
			}
		});
		reportUninstallBtn.addEventListener('mouseleave', function(){ 
			if (!this.disabled) {
				this.style.transform = 'translateY(0)'; 
				this.style.background = '#f3f4f6';
				this.style.borderColor = '#e5e7eb';
				this.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
				this.style.color = '#6b7280';
			}
		});
		reportUninstallBtn.addEventListener('click', function(ev){
			if (this.disabled) {
				ev.preventDefault();
				ev.stopPropagation();
				return;
			}
			ev.preventDefault();
			ev.stopPropagation();
			reportUninstall(pkg.name);
		});
		children.push(reportUninstallBtn);
	}
			// 右上角：小锁图标（锁定复选框）- 排除"高级卸载"卡片
			if (pkg && pkg.name !== 'luci-app-uninstall') {
				// 创建锁图标SVG
				var lockIconSvgUnlocked = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b7280" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>');
				var lockIconSvgLocked = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>');
				
				var lockBtn = E('button', {
					type: 'button',
					title: isLocked ? _('解锁') : _('锁定'),
					'style': 'position:absolute; right:44px; top:12px; width:26px; height:26px; padding:1.5px; background:' + (isLocked ? 'linear-gradient(135deg, #ef4444, #dc2626, #b91c1c)' : 'linear-gradient(135deg, #6b7280, #4b5563, #374151)') + '; border:none; border-radius:50%; display:flex; align-items:center; justify-content:center; cursor:pointer; box-shadow:0 2px 6px rgba(0,0,0,0.2); transition:all .2s ease; z-index:10; overflow:visible;'
				}, [
					E('span', {
						'style': 'width:100%; height:100%; background:linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(248,250,252,0.95) 100%); border-radius:50%; display:flex; align-items:center; justify-content:center;'
					}, [
						E('img', {
							src: isLocked ? lockIconSvgLocked : lockIconSvgUnlocked,
							alt: isLocked ? 'locked' : 'unlocked',
							width: 14,
							height: 14,
							'style': 'display:block; object-fit:contain; pointer-events:none;'
						})
					])
				]);
				
				lockBtn.addEventListener('mouseenter', function(){
					if (isLocked) {
						this.style.transform = 'translateY(-2px) scale(1.1)';
						this.style.background = 'linear-gradient(135deg, #dc2626, #b91c1c, #991b1b)';
						this.style.boxShadow = '0 4px 12px rgba(239,68,68,0.5)';
					} else {
						this.style.transform = 'translateY(-2px) scale(1.1)';
						this.style.background = 'linear-gradient(135deg, #4b5563, #374151, #1f2937)';
						this.style.boxShadow = '0 4px 12px rgba(107,114,128,0.5)';
					}
				});
				lockBtn.addEventListener('mouseleave', function(){
					if (isLocked) {
						this.style.transform = 'translateY(0) scale(1)';
						this.style.background = 'linear-gradient(135deg, #ef4444, #dc2626, #b91c1c)';
						this.style.boxShadow = '0 2px 6px rgba(0,0,0,0.2)';
					} else {
						this.style.transform = 'translateY(0) scale(1)';
						this.style.background = 'linear-gradient(135deg, #6b7280, #4b5563, #374151)';
						this.style.boxShadow = '0 2px 6px rgba(0,0,0,0.2)';
					}
				});
				
				lockBtn.addEventListener('click', function(ev){
					ev.preventDefault();
					ev.stopPropagation();
					
					// 切换锁状态
					isLocked = !isLocked;
					
					// 更新复选框状态
					checkbox.disabled = isLocked;
					if (isLocked) {
						checkbox.checked = false;
						delete selectedPackages[pkg.name];
						checkboxWrapper.style.opacity = '0.5';
						checkboxWrapper.style.cursor = 'not-allowed';
					} else {
						checkboxWrapper.style.opacity = '1';
						checkboxWrapper.style.cursor = 'pointer';
					}
					
					// 更新卸载按钮状态
					if (isLocked) {
						btn.disabled = true;
						btn.style.background = uninstallGradientDisabled;
						btn.style.opacity = '0.5';
						btn.style.cursor = 'not-allowed';
					} else {
						btn.disabled = false;
						btn.style.background = uninstallGradient;
						btn.style.opacity = '1';
						btn.style.cursor = 'pointer';
					}
					
					// 更新上报图标按钮状态
					if (reportIconBtn) {
						if (isLocked) {
							reportIconBtn.disabled = true;
						} else {
							reportIconBtn.disabled = false;
						}
						reportIconBtn.style.opacity = isLocked ? '0.5' : '1';
						reportIconBtn.style.cursor = isLocked ? 'not-allowed' : 'pointer';
					}
					
					if (reportUninstallBtn) {
						if (isLocked) {
							reportUninstallBtn.disabled = true;
						} else {
							reportUninstallBtn.disabled = false;
						}
						reportUninstallBtn.style.opacity = isLocked ? '0.5' : '1';
						reportUninstallBtn.style.cursor = isLocked ? 'not-allowed' : 'pointer';
					}
					
					// 更新开关选项状态
					if (purgeSwitch && purgeSwitch._updateStyle) {
						purgeSwitch._updateStyle(isLocked);
					}
					if (depsSwitch && depsSwitch._updateStyle) {
						depsSwitch._updateStyle(isLocked);
					}
					if (cacheSwitch && cacheSwitch._updateStyle) {
						cacheSwitch._updateStyle(isLocked);
					}
					
					// 更新标签样式
					if (purgeLabel) {
						purgeLabel.style.opacity = isLocked ? '0.5' : '1';
						purgeLabel.style.cursor = isLocked ? 'not-allowed' : 'default';
					}
					if (depsLabel) {
						depsLabel.style.opacity = isLocked ? '0.5' : '1';
						depsLabel.style.cursor = isLocked ? 'not-allowed' : 'default';
					}
					if (cacheLabel) {
						cacheLabel.style.opacity = isLocked ? '0.5' : '1';
						cacheLabel.style.cursor = isLocked ? 'not-allowed' : 'default';
					}
					
					updateBatchUI();
					
					// 更新锁按钮样式
					var lockIcon = lockBtn.querySelector('img');
					if (isLocked) {
						lockBtn.title = _('解锁');
						lockBtn.style.background = 'linear-gradient(135deg, #ef4444, #dc2626, #b91c1c)';
						lockIcon.src = lockIconSvgLocked;
					} else {
						lockBtn.title = _('锁定');
						lockBtn.style.background = 'linear-gradient(135deg, #6b7280, #4b5563, #374151)';
						lockIcon.src = lockIconSvgUnlocked;
					}
					
					// 保存锁状态到服务器
					saveLockStateToServer(pkg.name, isLocked);
				});
				
				children.push(lockBtn);
			}
			
			// 右上角：小眼睛图标（打开软件）- 排除"高级卸载"卡片
			if (pkg && pkg.name !== 'luci-app-uninstall') {
				// 检查黑名单（同步）
				if (!hasAvailableUI(pkg.name)) {
					// 不展示眼睛图标
				} else {
					// 创建唯一的渐变 ID 避免冲突
					var gradientId = 'eyeGrad_' + pkg.name.replace(/[^a-zA-Z0-9]/g, '_') + '_' + Date.now();
					var svgContent = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none"><defs><linearGradient id="' + gradientId + '" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:#6366f1;stop-opacity:1" /><stop offset="50%" style="stop-color:#8b5cf6;stop-opacity:1" /><stop offset="100%" style="stop-color:#a855f7;stop-opacity:1" /></linearGradient></defs><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="url(#' + gradientId + ')" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/><circle cx="12" cy="12" r="3" stroke="url(#' + gradientId + ')" stroke-width="2" fill="none"/></svg>';
					var eyeIconSvg = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgContent);
					// 初始隐藏，待解析到有效 URL 后再显示
					var eyeBtn = E('button', {
						type: 'button',
						title: _('打开软件'),
						'style': 'position:absolute; right:12px; top:12px; width:26px; height:26px; padding:1.5px; background:linear-gradient(135deg, #6366f1, #8b5cf6, #a855f7); border:none; border-radius:50%; display:none; align-items:center; justify-content:center; cursor:pointer; box-shadow:0 2px 6px rgba(99,102,241,0.3); transition:all .2s ease; z-index:10; overflow:visible;'
					}, [
						E('span', {
							'style': 'width:100%; height:100%; background:linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(248,250,252,0.95) 100%); border-radius:50%; display:flex; align-items:center; justify-content:center;'
						}, [
							E('img', {
								src: eyeIconSvg,
								alt: 'open',
								width: 14,
								height: 14,
								'style': 'display:block; object-fit:contain; pointer-events:none;'
							})
						])
					]);
					eyeBtn.addEventListener('mouseenter', function(){
						this.style.transform = 'translateY(-2px) scale(1.1)';
						this.style.background = 'linear-gradient(135deg, #4f46e5, #7c3aed, #9333ea)';
						this.style.boxShadow = '0 4px 12px rgba(99,102,241,0.5)';
					});
					eyeBtn.addEventListener('mouseleave', function(){
						this.style.transform = 'translateY(0) scale(1)';
						this.style.background = 'linear-gradient(135deg, #6366f1, #8b5cf6, #a855f7)';
						this.style.boxShadow = '0 2px 6px rgba(99,102,241,0.3)';
					});
					children.push(eyeBtn);
					// 异步解析有效地址
					resolveAppUrl(pkg.name, function(url){
						if (url) {
							eyeBtn.style.display = 'flex';
							eyeBtn.onclick = function(ev){
								ev.preventDefault();
								ev.stopPropagation();
								window.location.href = url;
							};
						} else {
							// 保持隐藏
						}
					});
				}
			}
			// 顶部右侧：仅在"高级卸载"卡片上展示图标按钮与远端版本
				if (pkg && pkg.name === 'luci-app-uninstall') {
					var actionsTop = E('div', { 'style': 'position:absolute; right:10px; top:8px; display:flex; gap:8px; align-items:center; z-index:50; pointer-events:auto;' }, [
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
				var batchUninstallGradient = 'linear-gradient(135deg, #dc2626 0%, #ef4444 50%, #f87171 100%)';
				if (count > 0) {
					batchBtn.disabled = false;
					batchBtn.style.opacity = '1';
					batchBtn.style.cursor = 'pointer';
					batchBtn.style.background = batchUninstallGradient;
				} else {
					batchBtn.disabled = true;
					batchBtn.style.opacity = '0.5';
					batchBtn.style.cursor = 'not-allowed';
					batchBtn.style.background = batchUninstallGradient;
				}
			}
			
			// 更新全选复选框状态（只统计未锁定的复选框）
			if (selectAllCb) {
				var allCheckboxes = Array.from(document.querySelectorAll('.pkg-checkbox')).filter(function(cb) { return !cb.disabled; });
				var checkedCount = allCheckboxes.filter(function(cb) { return cb.checked; }).length;
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
			var count = items.length;
			
			// 判断是否可以折叠（除了 VUM-Plugin类 都可以折叠）
			var canCollapse = title !== _('VUM-Plugin类');
			
			// 从服务器读取折叠状态（系统级别，跨浏览器）
			var isCollapsed = false;
			if (canCollapse) {
				// 同步获取服务器状态（在渲染时已加载）
				if (window.collapseStateCache && window.collapseStateCache[title] === true) {
					isCollapsed = true;
				}
			}
			
			// 创建折叠/展开按钮
			var collapseBtn = null;
			if (canCollapse) {
				// 展开状态的渐变色（蓝色渐变）
				var gradientBgExpanded = 'linear-gradient(135deg, #3b82f6 0%, #6366f1 50%, #8b5cf6 100%)';
				var gradientBgExpandedHover = 'linear-gradient(135deg, #2563eb 0%, #4f46e5 50%, #7c3aed 100%)';
				// 折叠状态的渐变色（灰色渐变）
				var gradientBgCollapsed = 'linear-gradient(135deg, #6b7280 0%, #4b5563 50%, #374151 100%)';
				var gradientBgCollapsedHover = 'linear-gradient(135deg, #4b5563 0%, #374151 50%, #1f2937 100%)';
				
				// 根据初始状态选择渐变色
				var currentGradient = isCollapsed ? gradientBgCollapsed : gradientBgExpanded;
				var currentGradientHover = isCollapsed ? gradientBgCollapsedHover : gradientBgExpandedHover;
				
				collapseBtn = E('button', {
					type: 'button',
					'style': 'display:flex; align-items:center; justify-content:center; width:32px; height:32px; background:' + currentGradient + '; border:1px solid rgba(255,255,255,0.3); border-radius:8px; cursor:pointer; transition:all 0.2s; padding:0; box-shadow:0 2px 8px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.2);'
				}, [
					E('span', {
						'style': 'display:inline-block; width:0; height:0; border-left:6px solid transparent; border-right:6px solid transparent; border-top:8px solid #ffffff; transition:transform 0.2s; transform:rotate(' + (isCollapsed ? '180' : '0') + 'deg); filter:drop-shadow(0 1px 2px rgba(0,0,0,0.1));'
					})
				]);
				
				// 更新按钮样式的函数
				function updateButtonStyle(collapsed) {
					var gradient = collapsed ? gradientBgCollapsed : gradientBgExpanded;
					var gradientHover = collapsed ? gradientBgCollapsedHover : gradientBgExpandedHover;
					collapseBtn.style.background = gradient;
					// 更新悬停时使用的渐变色和当前状态
					collapseBtn._gradientHover = gradientHover;
					collapseBtn._currentGradient = gradient;
					collapseBtn._isCollapsed = collapsed;
				}
				
				// 初始化按钮样式
				updateButtonStyle(isCollapsed);
				
				// 添加悬停效果
				collapseBtn.addEventListener('mouseenter', function() {
					var hoverGradient = this._gradientHover || (this._isCollapsed ? gradientBgCollapsedHover : gradientBgExpandedHover);
					this.style.background = hoverGradient;
					this.style.borderColor = 'rgba(255,255,255,0.4)';
					this.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.3)';
					this.style.transform = 'scale(1.05)';
				});
				collapseBtn.addEventListener('mouseleave', function() {
					// 使用保存的当前渐变色
					var currentGradient = this._currentGradient || (this._isCollapsed ? gradientBgCollapsed : gradientBgExpanded);
					this.style.background = currentGradient;
					this.style.borderColor = 'rgba(255,255,255,0.3)';
					this.style.boxShadow = '0 2px 8px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.2)';
					this.style.transform = 'scale(1)';
				});
				
				// 保存更新函数供后续使用
				collapseBtn._updateStyle = updateButtonStyle;
			}
			
			var header = E('div', { 'style': 'display:flex; align-items:center; justify-content:space-between;' }, [
				E('div', { 'style': 'display:flex; align-items:center; gap:12px;' }, [
					E('img', { src: L.resource('icons/' + icon), 'style': 'width:36px;height:36px; object-fit:contain;' }),
					(function(){
						// 统一使用 iStoreOS 插件类的渐变色（半透明果冻玻璃效果）
						var grad = 'linear-gradient(90deg, rgba(240,245,255,0.6) 0%, rgba(230,240,255,0.6) 50%, rgba(219,228,255,0.6) 100%)';
						var style = 'margin:0; font-size:20px; color:rgba(17,24,39,0.72); font-weight:800; display:inline-block; padding:8px 16px; border-radius:14px; background: ' + grad + '; backdrop-filter: saturate(160%) blur(10px); -webkit-backdrop-filter: saturate(160%) blur(10px); border:1px solid rgba(255,255,255,0.45); box-shadow: 0 2px 8px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.25)';
						return E('h3', { 'style': style }, title);
					})(),
					(function(){
						// 标题右侧的计数徽标
						var badgeStyle = 'display:inline-flex; align-items:center; justify-content:center; height:26px; padding:0 10px; font-size:12px; font-weight:700; color:#0f172a; background:linear-gradient(135deg, #dbeafe 0%, #e9d5ff 100%); border:1px solid rgba(15,23,42,0.08); border-radius:999px; box-shadow:0 2px 6px rgba(99,102,241,0.18);';
						return E('span', { 'style': badgeStyle }, String(count));
					})()
				]),
				collapseBtn
			].filter(function(item) { return item !== null; }));
			
			var groupGrid = E('div', { 
				'style': 'display:grid; grid-template-columns:repeat(auto-fill,minmax(380px,1fr)); gap:12px; margin-top:8px; transition:max-height 0.3s ease, margin-top 0.3s ease, opacity 0.3s ease; overflow:hidden;'
			});
			items.forEach(function(p){ groupGrid.appendChild(renderCard(p)); });
			
			// 折叠/展开功能
			if (canCollapse && collapseBtn) {
				var arrow = collapseBtn.querySelector('span');
				// 保存展开时的高度
				var expandedHeight = null;
				
				// 初始化折叠状态
				function applyCollapseState(collapsed) {
					if (collapsed) {
						// 折叠状态
						if (expandedHeight === null) {
							// 首次折叠，保存当前高度
							expandedHeight = groupGrid.scrollHeight + 'px';
						}
						groupGrid.style.maxHeight = '0';
						groupGrid.style.marginTop = '0';
						groupGrid.style.opacity = '0';
						arrow.style.transform = 'rotate(180deg)';
					} else {
						// 展开状态
						// 先设置为 auto 以获取实际高度
						groupGrid.style.maxHeight = 'none';
						var height = groupGrid.scrollHeight;
						expandedHeight = height + 'px';
						// 然后设置为具体高度以触发动画
						groupGrid.style.maxHeight = expandedHeight;
						groupGrid.style.marginTop = '8px';
						groupGrid.style.opacity = '1';
						arrow.style.transform = 'rotate(0deg)';
					}
				}
				
				// 如果初始状态是折叠的，应用折叠状态
				if (isCollapsed) {
					// 使用 setTimeout 确保 DOM 已渲染
					setTimeout(function() {
						applyCollapseState(true);
					}, 50);
				} else {
					// 确保展开状态下的高度被保存
					setTimeout(function() {
						expandedHeight = groupGrid.scrollHeight + 'px';
					}, 50);
				}
				
				collapseBtn.addEventListener('click', function() {
					isCollapsed = !isCollapsed;
					applyCollapseState(isCollapsed);
					
					// 更新按钮渐变色
					if (collapseBtn._updateStyle) {
						collapseBtn._updateStyle(isCollapsed);
					}
					
					// 保存状态到服务器（系统级别，跨浏览器）
					saveCollapseStateToServer(title, isCollapsed);
				});
			}
			
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
			var progressBar = E('div', { 'style': 'height:6px;width:0%;background:linear-gradient(90deg, #10b981 0%, #22c55e 50%, #34d399 100%);box-shadow:0 0 8px rgba(34,197,94,.6);transition: width .25s ease;' });
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
			var closeBtn = E('button', { 'class': 'btn', disabled: true, 'style': 'background:linear-gradient(135deg, #6b7280 0%, #4b5563 50%, #374151 100%); color:#fff; border:none; font-weight:600; border-radius:6px; padding:8px 16px; box-shadow:0 2px 8px rgba(107,114,128,0.3), inset 0 1px 0 rgba(255,255,255,0.2); transition:all 0.2s; opacity:0.5; cursor:not-allowed;' }, _('关闭'));
			var closeBtnGradient = 'linear-gradient(135deg, #6b7280 0%, #4b5563 50%, #374151 100%)';
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
					var returnGradient = 'linear-gradient(135deg, #10b981 0%, #059669 50%, #047857 100%)';
					closeBtn.setAttribute('style', 'background:' + returnGradient + '; color:#fff; border:none; font-weight:600; border-radius:6px; padding:8px 16px; box-shadow:0 2px 8px rgba(16,185,129,0.3), inset 0 1px 0 rgba(255,255,255,0.2); transition:all 0.2s;');
					closeBtn.addEventListener('mouseenter', function(){ this.style.background = 'linear-gradient(135deg, #059669 0%, #047857 50%, #065f46 100%)'; this.style.boxShadow = '0 4px 12px rgba(16,185,129,0.4), inset 0 1px 0 rgba(255,255,255,0.2)'; });
					closeBtn.addEventListener('mouseleave', function(){ this.style.background = returnGradient; this.style.boxShadow = '0 2px 8px rgba(16,185,129,0.3), inset 0 1px 0 rgba(255,255,255,0.2)'; });
					closeBtn.addEventListener('click', function(){ ui.hideModal(modal); window.location.reload(); });
				} else {
					setProgress(100);
					progressBar.style.background = 'linear-gradient(90deg, #dc2626 0%, #ef4444 50%, #f87171 100%)';
					progressBar.style.boxShadow = '0 0 8px rgba(239,68,68,.6)';
					statusIconEl.textContent = '✕';
					statusIconEl.setAttribute('style', 'display:inline-flex;width:22px;height:22px;background:#fee2e2;color:#7f1d1d;border-radius:999px;align-items:center;justify-content:center;font-weight:700;');
					statusTextEl.textContent = _('升级失败');
					statusTextEl.setAttribute('style', 'font-weight:600;color:#7f1d1d;');
					closeBtn.disabled = false;
					closeBtn.textContent = _('关闭');
					closeBtn.setAttribute('style', 'background:' + closeBtnGradient + '; color:#fff; border:none; font-weight:600; border-radius:6px; padding:8px 16px; box-shadow:0 2px 8px rgba(107,114,128,0.3), inset 0 1px 0 rgba(255,255,255,0.2); transition:all 0.2s; opacity:1; cursor:pointer;');
					closeBtn.addEventListener('mouseenter', function(){ this.style.background = 'linear-gradient(135deg, #4b5563 0%, #374151 50%, #1f2937 100%)'; this.style.boxShadow = '0 4px 12px rgba(107,114,128,0.4), inset 0 1px 0 rgba(255,255,255,0.2)'; });
					closeBtn.addEventListener('mouseleave', function(){ this.style.background = closeBtnGradient; this.style.boxShadow = '0 2px 8px rgba(107,114,128,0.3), inset 0 1px 0 rgba(255,255,255,0.2)'; });
					closeBtn.addEventListener('click', function(){ ui.hideModal(modal); });
				}
			}).catch(function(err){
				clearInterval(progTimer);
				clearInterval(timer);
				println('! ' + String(err));
				setProgress(100);
				progressBar.style.background = 'linear-gradient(90deg, #dc2626 0%, #ef4444 50%, #f87171 100%)';
				progressBar.style.boxShadow = '0 0 8px rgba(239,68,68,.6)';
				statusIconEl.textContent = '✕';
				statusIconEl.setAttribute('style', 'display:inline-flex;width:22px;height:22px;background:#fee2e2;color:#7f1d1d;border-radius:999px;align-items:center;justify-content:center;font-weight:700;');
				statusTextEl.textContent = _('升级失败');
				statusTextEl.setAttribute('style', 'font-weight:600;color:#7f1d1d;');
				closeBtn.disabled = false;
				closeBtn.textContent = _('关闭');
				closeBtn.setAttribute('style', 'background:' + closeBtnGradient + '; color:#fff; border:none; font-weight:600; border-radius:6px; padding:8px 16px; box-shadow:0 2px 8px rgba(107,114,128,0.3), inset 0 1px 0 rgba(255,255,255,0.2); transition:all 0.2s; opacity:1; cursor:pointer;');
				closeBtn.addEventListener('mouseenter', function(){ this.style.background = 'linear-gradient(135deg, #4b5563 0%, #374151 50%, #1f2937 100%)'; this.style.boxShadow = '0 4px 12px rgba(107,114,128,0.4), inset 0 1px 0 rgba(255,255,255,0.2)'; });
				closeBtn.addEventListener('mouseleave', function(){ this.style.background = closeBtnGradient; this.style.boxShadow = '0 2px 8px rgba(107,114,128,0.3), inset 0 1px 0 rgba(255,255,255,0.2)'; });
				closeBtn.addEventListener('click', function(){ ui.hideModal(modal); });
			});
		}
		function installLocalPackage(){
			var urlInput = E('input', {
				type: 'text',
				placeholder: _('请输入 .ipk 或 .run 的下载地址，例如 "https://example.com/package.ipk"'),
				'style': 'width:100%; padding:8px; border:1px solid #e5e7eb; border-radius:6px; font-size:13px; font-family:inherit;'
			}, '');

			var fileInputId = 'install-file-input-' + Math.floor(Math.random() * 1000000);
			var fileInput = E('input', {
				type: 'file',
				id: fileInputId,
				accept: '.ipk,.run',
				'class': 'file-upload-input'
			});
			var fileLabel = E('label', {
				'class': 'file-upload-label',
				'for': fileInputId
			}, [
				E('span', { 'class': 'file-upload-icon' }, 'UP'),
				E('span', {}, _('选择文件'))
			]);
			var fileNameEl = E('div', {
				'class': 'file-upload-filename',
				'data-has-file': '0'
			}, _('尚未选择文件'));
			fileInput.addEventListener('change', function(){
				var has = this.files && this.files[0];
				fileNameEl.textContent = has ? (this.files[0].name || _('已选择文件')) : _('尚未选择文件');
				fileNameEl.setAttribute('data-has-file', has ? '1' : '0');
			});
			var filePicker = E('div', { 'class': 'file-upload-wrapper' }, [
				E('div', { 'class': 'file-upload-control' }, [
					fileLabel,
					fileNameEl,
					fileInput
				])
			]);

			var desc = E('div', { 'style': 'font-size:13px;color:#4b5563;margin-bottom:8px;' }, [
				E('p', { 'style': 'margin:0 0 4px 0;' }, _('从远程 URL 安装本地插件，支持 .ipk 和 .run 文件。')),
				E('p', { 'style': 'margin:0;' }, _('请确认来源可信，安装过程可能需要一点时间。')),
				E('p', { 'style': 'margin:8px 0 0 0; color:#6b7280;' }, _('也可以选择本地 .ipk / .run 文件进行安装（优先使用本地文件）。'))
			]);

			var content = E('div', { 'style': 'max-width:520px;' }, [
				desc,
				urlInput,
				filePicker
			]);

			function createInstallProgressModal(options) {
				options = options || {};
				var title = options.title || _('正在安装…');
				var subtitleText = options.subtitle || _('安装任务');
				var badgeText = options.badgeText || _('安装');
				var badgeIcon = options.icon || packageIcon('luci-app-uninstall');
				var logTitle = options.logTitle || _('执行日志');

				var statusIconEl = E('span', { 'style': 'display:inline-flex;width:22px;height:22px;background:#dbeafe;color:#1d4ed8;border-radius:999px;align-items:center;justify-content:center;font-weight:700;' }, '…');
				var statusTextEl = E('span', { 'style': 'font-weight:600;color:#1d4ed8;' }, _('正在安装'));
				var elapsedEl = E('span', { 'style': 'font-size:12px;color:#6b7280;' }, '0s');
				var badgeEl = E('span', { 'style': 'font-size:12px; color:#6b7280; background:#f3f4f6; border:1px solid #e5e7eb; border-radius:999px; padding:2px 8px;' }, badgeText);

				var progressTrack = E('div', { 'style': 'height:6px;border-radius:999px;background:#0f1838;overflow:hidden;' });
				var progressBar = E('div', { 'style': 'height:6px;width:0%;background:linear-gradient(90deg, #3b82f6 0%, #6366f1 50%, #8b5cf6 100%);box-shadow:0 0 8px rgba(59,130,246,.6);transition: width .25s ease;' });
				progressTrack.appendChild(progressBar);

				var subtitleEl = E('div', { 'style': 'font-size:15px;font-weight:700;color:#e5e7eb;' }, subtitleText);

				var statusBar = E('div', { 'style': 'display:flex; flex-direction:column; gap:8px; margin-bottom:8px;' }, [
					E('div', { 'style': 'display:flex; align-items:center; justify-content:space-between; gap:8px;' }, [
						E('div', { 'style': 'display:flex; align-items:center; gap:8px;' }, [ statusIconEl, statusTextEl, elapsedEl ]),
						E('div', { 'style': 'display:flex; align-items:center; gap:10px;' }, [
							badgeEl,
							E('img', { src: badgeIcon, 'style': 'width:24px; height:24px; border-radius:6px; background:#f3f4f6; border:1px solid #e5e7eb; object-fit:contain;' })
						])
					]),
					subtitleEl,
					progressTrack
				]);

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
						E('span', { 'style': 'font-size:13px; color:#6b7280; font-weight:600;' }, logTitle),
						toggleLogBtn
					]),
					log
				]);

				var closeBtn = E('button', { 'class': 'btn', disabled: true, 'style': 'background:linear-gradient(135deg, #6b7280 0%, #4b5563 50%, #374151 100%); color:#fff; border:none; font-weight:600; border-radius:6px; padding:8px 16px; box-shadow:0 2px 8px rgba(107,114,128,0.3), inset 0 1px 0 rgba(255,255,255,0.2); transition:all 0.2s; opacity:0.5; cursor:not-allowed;' }, _('关闭'));
				var closeBtnGradient = 'linear-gradient(135deg, #6b7280 0%, #4b5563 50%, #374151 100%)';
				var closeBtnHover = 'linear-gradient(135deg, #4b5563 0%, #374151 50%, #1f2937 100%)';
				var successBtnGradient = 'linear-gradient(135deg, #10b981 0%, #059669 50%, #047857 100%)';
				var successBtnHover = 'linear-gradient(135deg, #059669 0%, #047857 50%, #065f46 100%)';
				var buttonVariant = 'pending';
				var state = 'running';

				var stuckHelpBtn = E('button', {
					type: 'button',
					'class': 'install-stuck-help-btn',
					'style': 'display:none;'
				}, _('安装较慢慢或无法安装？'));
				stuckHelpBtn.style.marginRight = 'auto';

				var actionBar = E('div', {
					'style':'margin-top:10px;display:flex;gap:8px;align-items:center;justify-content:flex-end;'
				}, [
					stuckHelpBtn,
					closeBtn
				]);

				var stuckHelpTimer = null;
				var stuckHelpVisible = false;

				function showStuckHelpHint(){
					if (stuckHelpVisible || (state !== 'running' && state !== 'failure')) return;
					stuckHelpVisible = true;
					stuckHelpBtn.style.display = 'inline-flex';
				}

				function hideStuckHelpHint(){
					stuckHelpVisible = false;
					stuckHelpBtn.style.display = 'none';
				}

				function clearStuckHelpHint(){
					if (stuckHelpTimer) {
						clearTimeout(stuckHelpTimer);
						stuckHelpTimer = null;
					}
				}

				function scheduleStuckHelpHint(){
					clearStuckHelpHint();
					stuckHelpTimer = setTimeout(showStuckHelpHint, 60000);
				}

				scheduleStuckHelpHint();

				stuckHelpBtn.addEventListener('click', function(){
					var knowBtn = E('button', {
						'class': 'btn',
						'style': 'background:linear-gradient(135deg,#3b82f6 0%,#6366f1 50%,#8b5cf6 100%);color:#fff;border:none;border-radius:6px;padding:6px 14px;font-weight:600;'
					}, _('我知道了'));
					var infoModal = ui.showModal(_('安装无法继续？'), [
						E('div', { 'style': 'max-width:420px;line-height:1.7;color:#374151;' }, [
							E('p', { 'style': 'margin:0 0 6px 0;' }, _('安装过程长时间没有新的进展。')),
							E('p', { 'style': 'margin:0 0 6px 0;color:#b45309;' }, _('请返回首页，更换其他源后再重试安装。')),
							E('p', { 'style': 'margin:0;color:#6b7280;font-size:12px;' }, _('更换源后请重新进入 "高级卸载" 再尝试安装。'))
						]),
						E('div', { 'style':'margin-top:14px;display:flex;gap:8px;justify-content:flex-end;' }, [ knowBtn ])
					]);
					knowBtn.addEventListener('click', function(){ ui.hideModal(infoModal); });
				});

				var modal = ui.showModal(title, [
					statusBar,
					logSection,
					actionBar
				]);
				var overlay = modal && modal.parentNode;
				if (overlay) {
					overlay.style.display = 'flex';
					overlay.style.alignItems = 'center';
					overlay.style.justifyContent = 'center';
				}

				var startTs = Date.now();
				var elapsedTimer = setInterval(function(){
					var s = Math.floor((Date.now() - startTs) / 1000);
					elapsedEl.textContent = s + 's';
				}, 1000);

				var currentProgress = 0;
				function setProgress(p){
					currentProgress = Math.max(0, Math.min(100, p));
					progressBar.style.width = currentProgress + '%';
				}

				function getProgress(){
					return currentProgress;
				}

				function stopElapsed(){
					if (elapsedTimer) {
						clearInterval(elapsedTimer);
						elapsedTimer = null;
					}
				}

				var autoHandles = [];
				function startAutoAdvance(max, step, interval){
					max = Math.max(0, Math.min(100, max || 90));
					step = step || 1;
					interval = interval || 400;
					var handle = setInterval(function(){
						if (currentProgress >= max) {
							clearInterval(handle);
							return;
						}
						setProgress(Math.min(max, currentProgress + step));
					}, interval);
					autoHandles.push(handle);
					return handle;
				}

				function stopAutoAdvance(handle){
					if (!handle) return;
					clearInterval(handle);
					autoHandles = autoHandles.filter(function(h){ return h !== handle; });
				}

				function stopAllAuto(){
					autoHandles.forEach(function(h){ clearInterval(h); });
					autoHandles = [];
				}

				function println(text){
					if (text === undefined || text === null) return;
					var str = String(text);
					if (!str.length) return;
					str.split(/\r?\n/).forEach(function(line){
						log.appendChild(document.createTextNode(line));
						log.appendChild(document.createTextNode('\n'));
					});
					log.scrollTop = log.scrollHeight;
				}

				function finalize(success){
					state = success ? 'success' : 'failure';
					buttonVariant = success ? 'success' : 'default';
					closeBtn.disabled = false;
					closeBtn.textContent = success ? _('返回页面') : _('关闭');
					closeBtn.style.opacity = '1';
					closeBtn.style.cursor = 'pointer';
					clearStuckHelpHint();
					if (success) {
						// 成功时隐藏提示按钮
						hideStuckHelpHint();
						closeBtn.style.background = successBtnGradient;
						closeBtn.style.boxShadow = '0 2px 8px rgba(16,185,129,0.3), inset 0 1px 0 rgba(255,255,255,0.2)';
					} else {
						// 失败时显示提示按钮
						stuckHelpVisible = false; // 重置标志，允许显示
						showStuckHelpHint();
						closeBtn.style.background = closeBtnGradient;
						closeBtn.style.boxShadow = '0 2px 8px rgba(107,114,128,0.3), inset 0 1px 0 rgba(255,255,255,0.2)';
					}
				}

				function markSuccess(message){
					stopElapsed();
					stopAllAuto();
					setProgress(100);
					statusIconEl.textContent = '✓';
					statusIconEl.setAttribute('style', 'display:inline-flex;width:22px;height:22px;background:#dcfce7;color:#065f46;border-radius:999px;align-items:center;justify-content:center;font-weight:700;');
					statusTextEl.textContent = message || _('安装完成');
					statusTextEl.setAttribute('style', 'font-weight:600;color:#065f46;');
					finalize(true);
				}

				function markFailure(message){
					stopElapsed();
					stopAllAuto();
					setProgress(Math.max(currentProgress, 100));
					progressBar.style.background = 'linear-gradient(90deg, #dc2626 0%, #ef4444 50%, #f87171 100%)';
					progressBar.style.boxShadow = '0 0 8px rgba(239,68,68,.6)';
					statusIconEl.textContent = '✕';
					statusIconEl.setAttribute('style', 'display:inline-flex;width:22px;height:22px;background:#fee2e2;color:#7f1d1d;border-radius:999px;align-items:center;justify-content:center;font-weight:700;');
					statusTextEl.textContent = message || _('安装失败');
					statusTextEl.setAttribute('style', 'font-weight:600;color:#7f1d1d;');
					finalize(false);
				}

				function setStatus(text, color){
					statusTextEl.textContent = text;
					if (color) statusTextEl.style.color = color;
				}

				closeBtn.addEventListener('mouseenter', function(){
					if (closeBtn.disabled) return;
					if (buttonVariant === 'success') {
						this.style.background = successBtnHover;
						this.style.boxShadow = '0 4px 12px rgba(16,185,129,0.4), inset 0 1px 0 rgba(255,255,255,0.2)';
					} else {
						this.style.background = closeBtnHover;
						this.style.boxShadow = '0 4px 12px rgba(107,114,128,0.4), inset 0 1px 0 rgba(255,255,255,0.2)';
					}
				});
				closeBtn.addEventListener('mouseleave', function(){
					if (closeBtn.disabled) return;
					if (buttonVariant === 'success') {
						this.style.background = successBtnGradient;
						this.style.boxShadow = '0 2px 8px rgba(16,185,129,0.3), inset 0 1px 0 rgba(255,255,255,0.2)';
					} else {
						this.style.background = closeBtnGradient;
						this.style.boxShadow = '0 2px 8px rgba(107,114,128,0.3), inset 0 1px 0 rgba(255,255,255,0.2)';
					}
				});
				closeBtn.addEventListener('click', function(){
					if (state === 'running') return;
					ui.hideModal(modal);
					if (state === 'success') {
						if (typeof refresh === 'function') {
							try { refresh(); }
							catch (err) { window.location.reload(); }
						} else {
							window.location.reload();
						}
					}
				});

				return {
					println: println,
					setProgress: setProgress,
					getProgress: getProgress,
					setStatus: setStatus,
					setSubtitle: function(text){ subtitleEl.textContent = text || _('安装任务'); },
					markSuccess: markSuccess,
					markFailure: markFailure,
					startAutoAdvance: startAutoAdvance,
					stopAutoAdvance: stopAutoAdvance,
					stopAllAuto: stopAllAuto,
					showHelpHint: showStuckHelpHint,
					destroy: function(){ stopElapsed(); stopAllAuto(); clearStuckHelpHint(); hideStuckHelpHint(); ui.hideModal(modal); }
				};
			}

			function appendLogText(progressUI, text){
				if (!text) return;
				String(text).split(/\r?\n/).forEach(function(line){
					if (line.length === 0) return;
					progressUI.println(line);
				});
			}

			function handleInstallResponse(progressUI, res, successMessage){
				if (res && res.log) appendLogText(progressUI, res.log);
				if (res && res.message) progressUI.println(res.message);
				
				// 如果是异步安装，开始轮询检查状态
				if (res && res.async) {
					progressUI.println('> ' + _('安装已在后台启动，正在检查安装状态…'));
					pollInstallStatus(progressUI, res.status_file, res.log_file, 0);
					return;
				}
				
				if (res && res.ok) {
					progressUI.markSuccess(successMessage || _('安装完成'));
				} else {
					var msg = (res && (res.message || res.error || res.reason)) || _('安装失败');
					progressUI.println(msg);
					progressUI.markFailure(msg);
				}
			}
			
			// 轮询检查安装状态
			function pollInstallStatus(progressUI, statusFile, logFile, retryCount) {
				retryCount = retryCount || 0;
				var maxRetries = 300; // 最多检查300次，每次2秒，总共10分钟
				
				if (retryCount >= maxRetries) {
					progressUI.println('! ' + _('安装超时，请手动检查安装状态'));
					progressUI.markFailure(_('安装超时'));
					return;
				}
				
				// 每2秒检查一次
				setTimeout(function() {
					var token = (L.env && (L.env.token || L.env.csrf_token)) || '';
					var checkUrl = L.url('admin/vum/uninstall/check_install_status') +
						(token ? ('?token=' + encodeURIComponent(token)) : '');
					
					self._httpJson(checkUrl, {
						method: 'GET',
						headers: { 'Accept': 'application/json' }
					}).then(function(res) {
						if (res && res.log) {
							// 只显示新的日志内容（避免重复）
							var newLog = res.log;
							if (newLog && newLog.trim()) {
								appendLogText(progressUI, newLog);
							}
						}
						
						// 显示调试信息（如果有）- 只在状态异常时显示
						if (res && res.debug && retryCount > 60) {
							// 只在长时间等待且状态不是 done 时显示调试信息
							if (res.status !== 'done') {
								var debugMsg = '[' + _('调试') + '] ';
								if (res.debug.status_file_exists) debugMsg += '状态文件存在; ';
								if (res.debug.log_file_exists) debugMsg += '日志文件存在; ';
								if (res.debug.log_size) debugMsg += '日志大小: ' + res.debug.log_size + '; ';
								// 每10次检查才显示一次，避免日志过多
								if (retryCount % 10 === 0) {
									progressUI.println(debugMsg);
								}
							}
						}
						
						if (res && res.status === 'done') {
							// 安装完成
							if (res.ok) {
								progressUI.setProgress(100);
								progressUI.markSuccess(_('安装完成'));
								// 刷新页面列表
								if (typeof refresh === 'function') {
									setTimeout(function() { refresh(); }, 500);
								}
							} else {
								progressUI.println('! ' + _('安装失败，退出码: ') + (res.exit_code || 'unknown'));
								progressUI.markFailure(_('安装失败'));
							}
						} else if (res && res.status === 'running') {
							// 仍在运行，继续轮询
							// 确保进度条不会回退，基于当前进度和轮询次数计算新进度
							var currentProgress = progressUI.getProgress();
							var calculatedProgress = Math.min(90, 50 + Math.floor((retryCount / maxRetries) * 40));
							// 使用较大的值，确保进度条只增加不减少
							var progress = Math.max(currentProgress, calculatedProgress);
							progressUI.setProgress(progress);
							var statusMsg = _('正在安装…') + ' (' + retryCount + 's)';
							// 如果等待时间较长，显示提示信息
							if (retryCount > 60) {
								statusMsg += ' - ' + _('安装可能需要较长时间，请耐心等待…');
							}
							progressUI.setStatus(statusMsg);
							pollInstallStatus(progressUI, statusFile, logFile, retryCount + 1);
						} else {
							// 状态未知，继续轮询
							// 如果等待时间较长，尝试通过日志判断
							if (retryCount > 90 && res && res.log) {
								var logText = res.log.toLowerCase();
								if (logText.match('完成') || logText.match('complete') || logText.match('success')) {
									// 日志显示可能已完成，但状态文件未更新
									// 等待更长时间后再次检查
									if (retryCount > 120) {
										progressUI.println('! ' + _('检测到安装可能已完成，但状态文件未更新，请手动检查'));
										progressUI.markFailure(_('状态检查异常'));
										return;
									}
								}
							}
							var statusMsg = _('检查安装状态…') + ' (' + retryCount + 's)';
							if (retryCount > 60) {
								statusMsg += ' - ' + _('安装可能需要较长时间，请耐心等待…');
							}
							progressUI.setStatus(statusMsg);
							pollInstallStatus(progressUI, statusFile, logFile, retryCount + 1);
						}
					}).catch(function(err) {
						// 查询失败，继续轮询
						var statusMsg = _('检查安装状态…') + ' (' + retryCount + 's)';
						if (retryCount > 60) {
							statusMsg += ' - ' + _('网络连接可能不稳定，正在重试…');
						}
						progressUI.setStatus(statusMsg);
						pollInstallStatus(progressUI, statusFile, logFile, retryCount + 1);
					});
				}, 2000); // 每2秒检查一次
			}

			var cancelBtn = E('button', { 'class': 'btn', 'style': 'background:#f3f4f6;color:#1f2937;border-radius:999px;padding:6px 14px;' }, _('取消'));
			var applyGradient = 'linear-gradient(135deg, #10b981 0%, #059669 50%, #047857 100%)';
			var applyGradientHover = 'linear-gradient(135deg, #059669 0%, #047857 50%, #065f46 100%)';
			var okBtn = E('button', {
				'class': 'btn cbi-button-apply',
				'style': 'background:' + applyGradient + '; color:#fff; border:none; border-radius:999px; padding:6px 16px; font-weight:500; box-shadow:0 2px 8px rgba(16,185,129,0.3), inset 0 1px 0 rgba(255,255,255,0.2); transition:all 0.2s;'
			}, _('开始安装'));
			okBtn.addEventListener('mouseenter', function(){
				this.style.background = applyGradientHover;
				this.style.boxShadow = '0 4px 12px rgba(16,185,129,0.4), inset 0 1px 0 rgba(255,255,255,0.3)';
				this.style.transform = 'translateY(-1px)';
			});
			okBtn.addEventListener('mouseleave', function(){
				this.style.background = applyGradient;
				this.style.boxShadow = '0 2px 8px rgba(16,185,129,0.3), inset 0 1px 0 rgba(255,255,255,0.2)';
				this.style.transform = 'translateY(0)';
			});

			var modal = ui.showModal(_('从 URL 安装插件 (.ipk / .run)'), [
				content,
				E('div', { 'style':'margin-top:12px;display:flex;gap:8px;justify-content:flex-end;' }, [ cancelBtn, okBtn ])
			]);
			var overlay = modal && modal.parentNode;
			if (overlay) {
				overlay.style.display = 'flex';
				overlay.style.alignItems = 'center';
				overlay.style.justifyContent = 'center';
			}

			cancelBtn.addEventListener('click', function(){ ui.hideModal(modal); });
			okBtn.addEventListener('click', function(){
				okBtn.disabled = true;
				okBtn.textContent = _('安装中…');
				okBtn.style.opacity = '0.7';

				var token = (L.env && (L.env.token || L.env.csrf_token)) || '';
				var file = fileInput.files && fileInput.files[0];

				if (file) {
					var uploadUrl = L.url('admin/vum/uninstall/install_upload') +
						(token ? ('?token=' + encodeURIComponent(token)) : '');
					var formData = new FormData();
					formData.append('file', file, file.name || 'upload.ipk');

					ui.hideModal(modal);
					modal = null;
					var progressUI = createInstallProgressModal({
						title: _('正在安装本地文件'),
						subtitle: file.name || _('本地安装包'),
						badgeText: _('本地安装'),
						icon: packageIcon('luci-app-uninstall')
					});
					progressUI.println('=== Install from upload ===');
					progressUI.setStatus(_('准备上传…'));
					progressUI.setProgress(5);
					progressUI.println('> POST ' + uploadUrl);

					var xhr = new XMLHttpRequest();
					var waitTimer = null;
					var uploadCompleted = false; // 标记上传是否已完成
					var errorHandled = false; // 标记错误是否已处理

					// 从文件名推断包名
					function extractPackageName(filename) {
						if (!filename) return null;
						// 移除扩展名
						var name = filename.replace(/\.(ipk|run)$/i, '');
						// 移除版本号和架构信息（例如：luci-app-openclash_1.2.3-1_all.ipk）
						name = name.replace(/_[^_]+$/, ''); // 移除最后一个下划线后的内容
						// 如果已经是 luci-app- 开头，直接返回
						if (name.match(/^luci-app-/)) {
							return name;
						}
						// 如果不是，尝试添加 luci-app- 前缀
						if (name && !name.match(/^luci-/)) {
							return 'luci-app-' + name;
						}
						return name;
					}

					// 检查包是否已安装
					function checkPackageInstalled(packageName, retries) {
						retries = retries || 0;
						if (retries > 10) { // 最多检查10次，每次间隔2秒，总共20秒
							progressUI.println('! ' + _('无法确认安装状态，请手动检查'));
							progressUI.markFailure(_('连接中断，无法确认安装状态'));
							return;
						}
						
						progressUI.println('> ' + _('正在检查安装状态…') + ' (尝试 ' + (retries + 1) + '/10)');
						self.pollList().then(function(res) {
							if (res && res.packages) {
								var found = res.packages.some(function(pkg) {
									return pkg.name === packageName;
								});
								if (found) {
									progressUI.println('✓ ' + _('检测到包已安装: ') + packageName);
									progressUI.setProgress(100);
									progressUI.markSuccess(_('安装完成（已通过验证）'));
									// 刷新页面列表
									if (typeof refresh === 'function') {
										setTimeout(function() { refresh(); }, 500);
									}
									return;
								}
							}
							// 如果没找到，等待2秒后重试
							setTimeout(function() {
								checkPackageInstalled(packageName, retries + 1);
							}, 2000);
						}).catch(function(err) {
							// 如果查询失败，也等待后重试
							setTimeout(function() {
								checkPackageInstalled(packageName, retries + 1);
							}, 2000);
						});
					}

					xhr.open('POST', uploadUrl, true);
					xhr.responseType = 'text';
					xhr.setRequestHeader('Accept', 'application/json');
					// 增加超时时间到5分钟（300000毫秒），因为某些包安装时间较长
					xhr.timeout = 300000;

					xhr.upload.addEventListener('progress', function(ev){
						if (!ev.lengthComputable) {
							progressUI.setProgress(Math.max(progressUI.getProgress(), 20));
							return;
						}
						var percent = Math.round((ev.loaded / ev.total) * 45) + 5;
						progressUI.setProgress(Math.min(70, percent));
						progressUI.setStatus(_('正在上传文件… ') + percent + '%');
					});
					xhr.upload.addEventListener('load', function(){
						uploadCompleted = true;
						progressUI.setStatus(_('上传完成，正在安装…'));
						progressUI.println(_('上传完成，等待系统执行安装…'));
						waitTimer = progressUI.startAutoAdvance(90, 1, 450);
					});
					xhr.addEventListener('error', function(){
						if (errorHandled) return;
						errorHandled = true;
						
						if (waitTimer) progressUI.stopAutoAdvance(waitTimer);
						
						// 如果上传已完成，可能是安装过程中的连接中断，尝试检查安装状态
						if (uploadCompleted) {
							progressUI.println('! ' + _('连接中断，但上传已完成，正在验证安装状态…'));
							var packageName = extractPackageName(file.name);
							if (packageName) {
								progressUI.println('> ' + _('尝试检查包: ') + packageName);
								checkPackageInstalled(packageName);
							} else {
								progressUI.println('! ' + _('无法从文件名推断包名，请手动检查安装状态'));
								progressUI.markFailure(_('连接中断，无法确认安装状态'));
							}
						} else {
							// 上传未完成，确实是上传失败
							progressUI.println('! HTTP upload error');
							progressUI.markFailure(_('上传失败或网络中断'));
						}
					});
					xhr.addEventListener('timeout', function(){
						if (errorHandled) return;
						errorHandled = true;
						
						if (waitTimer) progressUI.stopAutoAdvance(waitTimer);
						
						// 超时也可能是安装时间过长，如果上传已完成，尝试检查安装状态
						if (uploadCompleted) {
							progressUI.println('! ' + _('请求超时，但上传已完成，正在验证安装状态…'));
							var packageName = extractPackageName(file.name);
							if (packageName) {
								progressUI.println('> ' + _('尝试检查包: ') + packageName);
								checkPackageInstalled(packageName);
							} else {
								progressUI.println('! ' + _('无法从文件名推断包名，请手动检查安装状态'));
								progressUI.markFailure(_('请求超时，无法确认安装状态'));
							}
						} else {
							progressUI.println('! Request timeout');
							progressUI.markFailure(_('请求超时'));
						}
					});
					xhr.addEventListener('abort', function(){
						if (errorHandled) return;
						errorHandled = true;
						
						if (waitTimer) progressUI.stopAutoAdvance(waitTimer);
						progressUI.println('! Upload aborted');
						progressUI.markFailure(_('上传被取消'));
					});
					xhr.onreadystatechange = function(){
						if (xhr.readyState !== 4) return;
						
						// 如果已经处理过错误，不再处理响应
						if (errorHandled && xhr.status !== 200) return;
						
						if (waitTimer) progressUI.stopAutoAdvance(waitTimer);
						progressUI.setProgress(Math.max(progressUI.getProgress(), 95));
						progressUI.setStatus(_('正在应用返回结果…'));
						var text = xhr.responseText || '';
						if (text) progressUI.println('< HTTP ' + xhr.status + ': ' + (xhr.statusText || ''));
						if (text) progressUI.println(text);
						
						// 即使状态码不是200，也尝试解析响应（某些情况下服务器可能返回错误但包含有用信息）
						var res = null;
						try {
							res = text ? JSON.parse(text) : null;
						} catch (err) {
							progressUI.println('! JSON parse error: ' + err.message);
						}
						
						if (res) {
							errorHandled = true; // 标记已处理，避免 error 事件再次处理
							// 如果是异步安装，handleInstallResponse 会处理轮询
							handleInstallResponse(progressUI, res, _('安装完成'));
							// 如果是异步安装，不需要继续处理
							if (res && res.async) {
								return;
							}
						} else if (xhr.status === 200) {
							// 状态码200但没有有效响应，可能是响应格式问题
							progressUI.markFailure(_('服务器返回无效数据'));
						} else if (uploadCompleted) {
							// 上传已完成但响应异常，尝试检查安装状态
							progressUI.println('! ' + _('服务器响应异常，但上传已完成，正在验证安装状态…'));
							var packageName = extractPackageName(file.name);
							if (packageName) {
								progressUI.println('> ' + _('尝试检查包: ') + packageName);
								checkPackageInstalled(packageName);
							} else {
								progressUI.markFailure(_('服务器返回无效数据'));
							}
						} else {
							progressUI.markFailure(_('服务器返回无效数据'));
						}
					};
					xhr.send(formData);
				} else {
					var url = (urlInput.value || '').trim();
					if (!url) {
						ui.addNotification(null, E('p', {}, _('请填写下载地址，或者选择本地文件')), 'warning');
						okBtn.disabled = false;
						okBtn.textContent = _('开始安装');
						okBtn.style.opacity = '1';
						return;
					}
					if (!url.match(/\.ipk($|\?)/) && !url.match(/\.run($|\?)/)) {
						ui.addNotification(null, E('p', {}, _('目前只支持以 .ipk 或 .run 结尾的文件')), 'warning');
						okBtn.disabled = false;
						okBtn.textContent = _('开始安装');
						okBtn.style.opacity = '1';
						return;
					}

					var reqUrl = L.url('admin/vum/uninstall/install_from_url') +
						'?url=' + encodeURIComponent(url) +
						(token ? ('&token=' + encodeURIComponent(token)) : '');

					ui.hideModal(modal);
					modal = null;
					var progressUI = createInstallProgressModal({
						title: _('正在安装远程文件'),
						subtitle: url,
						badgeText: _('在线安装'),
						icon: packageIcon('luci-app-uninstall')
					});
					progressUI.println('=== Install from URL ===');
					progressUI.println('> GET ' + reqUrl);
					progressUI.setProgress(10);
					progressUI.setStatus(_('正在请求远程安装…'));
					var autoTimer = progressUI.startAutoAdvance(92, 1, 600);

					self._httpJson(reqUrl, {
						method: 'GET',
						headers: { 'Accept': 'application/json' }
					}).then(function(res){
						if (autoTimer) progressUI.stopAutoAdvance(autoTimer);
						progressUI.setProgress(100);
						handleInstallResponse(progressUI, res, _('安装完成'));
					}).catch(function(err){
						if (autoTimer) progressUI.stopAutoAdvance(autoTimer);
						progressUI.println('! ' + String(err));
						progressUI.markFailure(_('安装请求失败: ') + String(err));
					});
				}
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
					var isDark = document.body && document.body.classList.contains('luci-uninstall-dark');
					var textColor = isDark ? '#e5e7eb' : '#111827';
					var msg = E('div', { 'style': 'max-width:520px;' }, [
						E('div', { 'style': 'display:flex; align-items:center; gap:8px; margin:0 0 8px 0;' }, [
							E('img', { src: packageIcon('luci-app-uninstall'), 'style': 'width:28px; height:28px; border-radius:6px; background:#f3f4f6; border:1px solid #e5e7eb; object-fit:contain;' }),
							E('span', { 'style': 'font-weight:600;color:' + textColor + ';' }, _('高级卸载'))
						]),
						E('p', { 'style': 'margin:0 0 8px 0;' }, _('检测到新版本：') + (latest || '')),
						E('p', { 'style': 'margin:0 0 8px 0; color:#6b7280;' }, _('当前版本：') + (cur || '')),
						res && res.changelog ? E('pre', { 'style': 'margin:8px 0 0 0; white-space:pre-wrap; background:#f3f4f6; color:#374151; padding:8px; border-radius:6px;' }, String(res.changelog)) : E('span', {}, '')
					]);
					var modal = ui.showModal(_('确认升级到最新版本？'), [
						msg,
						E('div', { 'style':'margin-top:10px;display:flex;gap:8px;justify-content:flex-end;' }, [
							E('button', { 'class': 'btn', id: 'cancel-upgrade' }, _('取消')),
							(function(){
								var upgradeGradient = 'linear-gradient(135deg, #10b981 0%, #059669 50%, #047857 100%)';
								var upgradeGradientHover = 'linear-gradient(135deg, #059669 0%, #047857 50%, #065f46 100%)';
								var upgradeBtn = E('button', { 
									'class': 'btn cbi-button cbi-button-apply', 
									id: 'confirm-upgrade',
									'style': 'background:' + upgradeGradient + '; color:#fff; border:none; border-radius:999px; padding:6px 14px; box-shadow:0 2px 8px rgba(16,185,129,0.3), inset 0 1px 0 rgba(255,255,255,0.2); transition:all 0.2s; font-weight:500;'
								}, _('立即升级'));
								upgradeBtn.addEventListener('mouseenter', function() {
									this.style.background = upgradeGradientHover;
									this.style.boxShadow = '0 4px 12px rgba(16,185,129,0.4), inset 0 1px 0 rgba(255,255,255,0.3)';
									this.style.transform = 'translateY(-1px)';
								});
								upgradeBtn.addEventListener('mouseleave', function() {
									this.style.background = upgradeGradient;
									this.style.boxShadow = '0 2px 8px rgba(16,185,129,0.3), inset 0 1px 0 rgba(255,255,255,0.2)';
									this.style.transform = 'translateY(0)';
								});
								return upgradeBtn;
							})()
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
							(function(){
								var upgradeGradient = 'linear-gradient(135deg, #10b981 0%, #059669 50%, #047857 100%)';
								var upgradeGradientHover = 'linear-gradient(135deg, #059669 0%, #047857 50%, #065f46 100%)';
								var upgradeBtn = E('button', { 
									'class': 'btn cbi-button cbi-button-apply', 
									id: 'confirm-upgrade',
									'style': 'background:' + upgradeGradient + '; color:#fff; border:none; border-radius:999px; padding:6px 14px; box-shadow:0 2px 8px rgba(16,185,129,0.3), inset 0 1px 0 rgba(255,255,255,0.2); transition:all 0.2s; font-weight:500;'
								}, _('立即升级'));
								upgradeBtn.addEventListener('mouseenter', function() {
									this.style.background = upgradeGradientHover;
									this.style.boxShadow = '0 4px 12px rgba(16,185,129,0.4), inset 0 1px 0 rgba(255,255,255,0.3)';
									this.style.transform = 'translateY(-1px)';
								});
								upgradeBtn.addEventListener('mouseleave', function() {
									this.style.background = upgradeGradient;
									this.style.boxShadow = '0 2px 8px rgba(16,185,129,0.3), inset 0 1px 0 rgba(255,255,255,0.2)';
									this.style.transform = 'translateY(0)';
								});
								return upgradeBtn;
							})()
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
					var isDark = document.body && document.body.classList.contains('luci-uninstall-dark');
					var textColor = isDark ? '#e5e7eb' : '#111827';
					var msg = E('div', { 'style': 'max-width:520px;' }, [
						E('div', { 'style': 'display:flex; align-items:center; gap:8px; margin:0 0 8px 0;' }, [
							E('img', { src: packageIcon('luci-app-uninstall'), 'style': 'width:28px; height:28px; border-radius:6px; background:#f3f4f6; border:1px solid #e5e7eb; object-fit:contain;' }),
							E('span', { 'style': 'font-weight:600;color:' + textColor + ';' }, _('高级卸载'))
						]),
						E('p', { 'style': 'margin:0 0 8px 0;' }, _('检测到新版本：') + (latest || '')),
						E('p', { 'style': 'margin:0 0 8px 0; color:#6b7280;' }, _('当前版本：') + (cur || '')),
						res && res.changelog ? E('pre', { 'style': 'margin:8px 0 0 0; white-space:pre-wrap; background:#f3f4f6; color:#374151; padding:8px; border-radius:6px;' }, String(res.changelog)) : E('span', {}, '')
					]);
					var modal = ui.showModal(_('确认升级到最新版本？'), [
						msg,
						E('div', { 'style':'margin-top:10px;display:flex;gap:8px;justify-content:flex-end;' }, [
							E('button', { 'class': 'btn', id: 'cancel-upgrade' }, _('取消')),
							(function(){
								var upgradeGradient = 'linear-gradient(135deg, #10b981 0%, #059669 50%, #047857 100%)';
								var upgradeGradientHover = 'linear-gradient(135deg, #059669 0%, #047857 50%, #065f46 100%)';
								var upgradeBtn = E('button', { 
									'class': 'btn cbi-button cbi-button-apply', 
									id: 'confirm-upgrade',
									'style': 'background:' + upgradeGradient + '; color:#fff; border:none; border-radius:999px; padding:6px 14px; box-shadow:0 2px 8px rgba(16,185,129,0.3), inset 0 1px 0 rgba(255,255,255,0.2); transition:all 0.2s; font-weight:500;'
								}, _('立即升级'));
								upgradeBtn.addEventListener('mouseenter', function() {
									this.style.background = upgradeGradientHover;
									this.style.boxShadow = '0 4px 12px rgba(16,185,129,0.4), inset 0 1px 0 rgba(255,255,255,0.3)';
									this.style.transform = 'translateY(-1px)';
								});
								upgradeBtn.addEventListener('mouseleave', function() {
									this.style.background = upgradeGradient;
									this.style.boxShadow = '0 2px 8px rgba(16,185,129,0.3), inset 0 1px 0 rgba(255,255,255,0.2)';
									this.style.transform = 'translateY(0)';
								});
								return upgradeBtn;
							})()
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
							(function(){
								var upgradeGradient = 'linear-gradient(135deg, #10b981 0%, #059669 50%, #047857 100%)';
								var upgradeGradientHover = 'linear-gradient(135deg, #059669 0%, #047857 50%, #065f46 100%)';
								var upgradeBtn = E('button', { 
									'class': 'btn cbi-button cbi-button-apply', 
									id: 'confirm-upgrade',
									'style': 'background:' + upgradeGradient + '; color:#fff; border:none; border-radius:999px; padding:6px 14px; box-shadow:0 2px 8px rgba(16,185,129,0.3), inset 0 1px 0 rgba(255,255,255,0.2); transition:all 0.2s; font-weight:500;'
								}, _('立即升级'));
								upgradeBtn.addEventListener('mouseenter', function() {
									this.style.background = upgradeGradientHover;
									this.style.boxShadow = '0 4px 12px rgba(16,185,129,0.4), inset 0 1px 0 rgba(255,255,255,0.3)';
									this.style.transform = 'translateY(-1px)';
								});
								upgradeBtn.addEventListener('mouseleave', function() {
									this.style.background = upgradeGradient;
									this.style.boxShadow = '0 2px 8px rgba(16,185,129,0.3), inset 0 1px 0 rgba(255,255,255,0.2)';
									this.style.transform = 'translateY(0)';
								});
								return upgradeBtn;
							})()
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
		// 将 refresh 函数暴露到全局作用域，以便清空按钮可以直接调用
		window.refreshUninstallList = null;
		// 折叠状态缓存（从服务器加载）
		window.collapseStateCache = {};
		
		// 从服务器加载折叠状态
		function loadCollapseStateFromServer() {
			return self._httpJson(L.url('admin/vum/uninstall/get_collapse_state'), { 
				headers: { 'Accept': 'application/json' } 
			}).then(function(res) {
				if (res && res.ok && res.state) {
					window.collapseStateCache = res.state || {};
				}
				return window.collapseStateCache;
			}).catch(function(err) {
				// 如果加载失败，使用空对象
				window.collapseStateCache = {};
				return window.collapseStateCache;
			});
		}
		
		// 保存折叠状态到服务器
		function saveCollapseStateToServer(section, collapsed) {
			// 更新本地缓存
			if (!window.collapseStateCache) {
				window.collapseStateCache = {};
			}
			window.collapseStateCache[section] = collapsed;
			
			// 保存到服务器（使用 URL 编码的表单方式，更兼容 LuCI）
			var formData = 'section=' + encodeURIComponent(section) + '&collapsed=' + (collapsed ? 'true' : 'false');
			
			// 使用表单方式发送
			self._httpJson(L.url('admin/vum/uninstall/save_collapse_state'), {
				method: 'POST',
				headers: { 
					'Content-Type': 'application/x-www-form-urlencoded',
					'Accept': 'application/json'
				},
				body: formData
			}).then(function(res) {
				// 保存成功，无需操作
				if (res && !res.ok) {
					console.warn('保存折叠状态失败:', res.message || '未知错误', res.debug || '');
				}
			}).catch(function(err) {
				// 保存失败，输出错误信息便于调试
				console.error('保存折叠状态到服务器失败:', err);
			});
		}
		
		// 锁状态缓存（从服务器加载）
		window.lockStateCache = {};
		
		// 从服务器加载锁状态
		function loadLockStateFromServer() {
			return self._httpJson(L.url('admin/vum/uninstall/get_lock_state'), { 
				headers: { 'Accept': 'application/json' } 
			}).then(function(res) {
				if (res && res.ok && res.state) {
					window.lockStateCache = res.state || {};
				}
				return window.lockStateCache;
			}).catch(function(err) {
				// 如果加载失败，使用空对象
				window.lockStateCache = {};
				return window.lockStateCache;
			});
		}
		
		// 保存锁状态到服务器
		function saveLockStateToServer(packageName, locked) {
			// 更新本地缓存
			if (!window.lockStateCache) {
				window.lockStateCache = {};
			}
			window.lockStateCache[packageName] = locked;
			
			// 保存到服务器（使用 URL 编码的表单方式，更兼容 LuCI）
			var formData = 'package=' + encodeURIComponent(packageName) + '&locked=' + (locked ? 'true' : 'false');
			
			// 使用表单方式发送
			self._httpJson(L.url('admin/vum/uninstall/save_lock_state'), {
				method: 'POST',
				headers: { 
					'Content-Type': 'application/x-www-form-urlencoded',
					'Accept': 'application/json'
				},
				body: formData
			}).then(function(res) {
				// 保存成功，无需操作
				if (res && !res.ok) {
					console.warn('保存锁状态失败:', res.message || '未知错误');
				}
			}).catch(function(err) {
				// 保存失败，输出错误信息便于调试
				console.error('保存锁状态到服务器失败:', err);
			});
		}
		
		function refresh() {
			var curSeq = (++searchSeq);
			// 先加载折叠状态和锁状态（从服务器，系统级别，跨浏览器）
			Promise.all([
				loadCollapseStateFromServer(),
				loadLockStateFromServer()
			]).then(function() {
				// 然后加载包列表并渲染
				return self.pollList();
			}).then(function(data){
				if (curSeq !== searchSeq) return; // 已过期
				var pkgs = (data && data.packages) || [];
				var filterInput = document.getElementById('filter');
				var q = (filterInput ? (filterInput.value || '') : '').toLowerCase();
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
					// 渲染完成后重新检查升级状态，避免按钮误显
		try { checkUpdate(); } catch (e) {}
		// 渲染完成后，强制同步一次交互状态，防止出现“需要锁定再解锁”才能选择的问题
		ensureInteractiveCheckboxes();
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
		// 将 refresh 函数暴露到全局作用域，以便清空按钮可以直接调用
		window.refreshUninstallList = refresh;

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
					var isDark = document.body && document.body.classList.contains('luci-uninstall-dark');
					var textColor = isDark ? '#e5e7eb' : '#111827';
					var titleRow = E('div', { 'style': 'display:flex; align-items:center; gap:8px;' }, [
						E('span', { 'style': 'display:inline-flex;width:28px;height:28px;background:#fee2e2;color:#b91c1c;border-radius:999px;align-items:center;justify-content:center;font-weight:700;' }, '!'),
						E('span', { 'style': 'font-weight:600;font-size:16px;color:' + textColor + ';' }, _('批量卸载确认'))
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
					// 批量卸载确定按钮使用红色渐变
					var batchConfirmGradient = 'linear-gradient(135deg, #dc2626 0%, #ef4444 50%, #f87171 100%)';
					var batchConfirmGradientHover = 'linear-gradient(135deg, #b91c1c 0%, #dc2626 50%, #ef4444 100%)';
					var okBtn = E('button', { 
						'class': 'btn', 
						'style': 'background:' + batchConfirmGradient + '; color:#fff; border:none; border-radius:999px; padding:6px 14px; box-shadow:0 2px 8px rgba(220,38,38,0.3), inset 0 1px 0 rgba(255,255,255,0.2); transition:all 0.2s; font-weight:500;' 
					}, _('确定卸载'));
					okBtn.addEventListener('mouseenter', function() {
						this.style.background = batchConfirmGradientHover;
						this.style.boxShadow = '0 4px 12px rgba(220,38,38,0.4), inset 0 1px 0 rgba(255,255,255,0.3)';
						this.style.transform = 'translateY(-1px)';
					});
					okBtn.addEventListener('mouseleave', function() {
						this.style.background = batchConfirmGradient;
						this.style.boxShadow = '0 2px 8px rgba(220,38,38,0.3), inset 0 1px 0 rgba(255,255,255,0.2)';
						this.style.transform = 'translateY(0)';
					});
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
				var isDark = document.body && document.body.classList.contains('luci-uninstall-dark');
				var textColor = isDark ? '#e5e7eb' : '#111827';
				var progressText = E('div', { 'style': 'font-size:15px; font-weight:600; color:' + textColor + '; margin-bottom:8px;' }, _('正在批量卸载...'));
				var progressBar = E('div', { 'style': 'height:8px; background:#e5e7eb; border-radius:999px; overflow:hidden; margin-bottom:12px;' }, [
					E('div', { id: 'batch-progress-bar', 'style': 'height:100%; width:0%; background:linear-gradient(90deg, #10b981 0%, #22c55e 50%, #34d399 100%); transition:width .3s ease; box-shadow:0 0 8px rgba(34,197,94,.4);' })
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
				
				var closeBtn = E('button', { 'class': 'btn', disabled: true, 'style': 'background:linear-gradient(135deg, #6b7280 0%, #4b5563 50%, #374151 100%); color:#fff; border:none; font-weight:600; border-radius:6px; padding:8px 16px; box-shadow:0 2px 8px rgba(107,114,128,0.3), inset 0 1px 0 rgba(255,255,255,0.2); transition:all 0.2s;' }, _('关闭'));
				var closeBtnGradient = 'linear-gradient(135deg, #6b7280 0%, #4b5563 50%, #374151 100%)';
				closeBtn.addEventListener('mouseenter', function(){ if (!this.disabled) { this.style.background = 'linear-gradient(135deg, #4b5563 0%, #374151 50%, #1f2937 100%)'; this.style.boxShadow = '0 4px 12px rgba(107,114,128,0.4), inset 0 1px 0 rgba(255,255,255,0.2)'; } });
				closeBtn.addEventListener('mouseleave', function(){ if (!this.disabled) { this.style.background = closeBtnGradient; this.style.boxShadow = '0 2px 8px rgba(107,114,128,0.3), inset 0 1px 0 rgba(255,255,255,0.2)'; } });
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
						var completeGradient = 'linear-gradient(135deg, #10b981 0%, #059669 50%, #047857 100%)';
						closeBtn.setAttribute('style', 'background:' + completeGradient + '; color:#fff; border:none; font-weight:600; border-radius:6px; padding:8px 16px; box-shadow:0 2px 8px rgba(16,185,129,0.3), inset 0 1px 0 rgba(255,255,255,0.2); transition:all 0.2s;');
						closeBtn.addEventListener('mouseenter', function(){ this.style.background = 'linear-gradient(135deg, #059669 0%, #047857 50%, #065f46 100%)'; this.style.boxShadow = '0 4px 12px rgba(16,185,129,0.4), inset 0 1px 0 rgba(255,255,255,0.2)'; });
						closeBtn.addEventListener('mouseleave', function(){ this.style.background = completeGradient; this.style.boxShadow = '0 2px 8px rgba(16,185,129,0.3), inset 0 1px 0 rgba(255,255,255,0.2)'; });
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
			
			// 为特定应用添加特殊提示（这些应用在iStore商店中安装后会自动显示图标）
			var isDark = document.body && document.body.classList.contains('luci-uninstall-dark');
			var textColor = isDark ? '#e5e7eb' : '#111827';
			var labelColor = isDark ? '#9ca3af' : '#374151';
			var titleText = _('上报图标问题');
			var titleExtra = null;
			var noReportApps = ['luci-app-linkease', 'luci-app-ddnsto', 'luci-app-lucky', 'luci-app-msd_lite', 'luci-app-zerotier', 'luci-app-smartdns'];
			if (noReportApps.indexOf(pkgName) !== -1) {
				titleExtra = E('span', { 'style': 'font-size:13px;color:#ef4444;margin-left:8px;' }, _('（这个图标无需上报，在iStore商店中安装后就会显示）'));
			}
			var titleRow = E('div', { 'style': 'display:flex; align-items:center; gap:8px; margin-bottom:12px; flex-wrap:wrap;' }, [
				E('span', { 'style': 'display:inline-flex;width:28px;height:28px;background:#fff3cd;color:#856404;border-radius:999px;align-items:center;justify-content:center;font-weight:700;' }, '!'),
				E('span', { 'style': 'font-weight:600;font-size:16px;color:' + textColor + ';' }, titleText),
				titleExtra
			].filter(function(item) { return item !== null; }));
			
			var pkgInfo = E('div', { 'style': 'margin-bottom:12px; padding:10px; background:#f8f9fa; border:1px solid #e5e7eb; border-radius:8px;' }, [
				E('div', { 'style': 'display:flex; align-items:center; gap:8px; margin-bottom:6px;' }, [
					E('img', { src: packageIcon(pkgName), 'style': 'width:32px; height:32px; border-radius:6px; background:#f3f4f6; border:1px solid #e5e7eb; object-fit:contain;' }),
					E('div', {}, [
						E('div', { 'style': 'font-weight:600; color:' + textColor + ';' }, fullName),
						E('div', { 'style': 'font-size:12px; color:#6b7280;' }, pkgName)
					])
				]),
				E('div', { 'style': 'font-size:12px; color:#6b7280; margin-top:4px;' }, _('将向开发者上报此应用的图标问题'))
			]);
			
			// 添加软件下载地址输入框
			var inputDownloadUrl = E('input', {
				type: 'text',
				placeholder: _('请提供软件下载地址,例如"https://example.com/package.ipk"'),
				'style': 'width:100%; padding:8px; border:1px solid #e5e7eb; border-radius:6px; font-size:13px; font-family:inherit;'
			}, '');
			
			var inputSection = E('div', { 'style': 'margin-bottom:12px;' }, [
				E('label', { 'style': 'display:block; font-size:13px; color:' + labelColor + '; margin-bottom:6px; font-weight:500;' }, _('问题描述')),
				inputComment,
				E('label', { 'style': 'display:block; font-size:13px; color:' + labelColor + '; margin-top:12px; margin-bottom:6px; font-weight:500;' }, _('软件下载地址') + ' <span style="color: #ef4444;">*</span>'),
				inputDownloadUrl
			]);
			
			var cancelBtn = E('button', { 'class': 'btn', 'style': 'background:#f3f4f6;color:#1f2937;border-radius:999px;padding:6px 14px;' }, _('取消'));
			// 图标上报按钮使用蓝色渐变
			var submitBtnGradient = 'linear-gradient(135deg, #3b82f6 0%, #6366f1 50%, #8b5cf6 100%)';
			var submitBtnGradientHover = 'linear-gradient(135deg, #2563eb 0%, #4f46e5 50%, #7c3aed 100%)';
			var submitBtn = E('button', { 
				'class': 'btn cbi-button-apply', 
				'style': 'background:' + submitBtnGradient + ';color:#fff;border:none;border-radius:999px;padding:6px 14px;box-shadow:0 2px 8px rgba(99,102,241,0.3), inset 0 1px 0 rgba(255,255,255,0.2);transition:all 0.2s;font-weight:500;' 
			}, _('提交上报'));
			// 添加悬停效果
			submitBtn.addEventListener('mouseenter', function() {
				this.style.background = submitBtnGradientHover;
				this.style.boxShadow = '0 4px 12px rgba(99,102,241,0.4), inset 0 1px 0 rgba(255,255,255,0.3)';
				this.style.transform = 'translateY(-1px)';
			});
			submitBtn.addEventListener('mouseleave', function() {
				this.style.background = submitBtnGradient;
				this.style.boxShadow = '0 2px 8px rgba(99,102,241,0.3), inset 0 1px 0 rgba(255,255,255,0.2)';
				this.style.transform = 'translateY(0)';
			});
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
				var downloadUrl = inputDownloadUrl.value.trim();
				
				// 验证必填项
				if (!downloadUrl) {
					// 显示错误提示
					var errorEl = document.getElementById('download-url-error');
					if (errorEl) {
						errorEl.style.display = 'block';
					} else {
						var newErrorEl = E('div', {
							id: 'download-url-error',
							'style': 'color: #ef4444; font-size: 12px; margin-top: 4px; display: block;'
						}, _('请填写软件下载地址'));
						inputDownloadUrl.parentNode.appendChild(newErrorEl);
					}
					// 高亮输入框
					inputDownloadUrl.style.borderColor = '#ef4444';
					inputDownloadUrl.focus();
					return;
				}
				
				// 移除之前的错误提示
				var errorEl = document.getElementById('download-url-error');
				if (errorEl) {
					errorEl.style.display = 'none';
				}
				inputDownloadUrl.style.borderColor = '#e5e7eb';
				
				// 禁用按钮防止重复提交
				submitBtn.disabled = true;
				submitBtn.textContent = _('提交中...');
				submitBtn.style.opacity = '0.6';
				
				// 发送上报请求 - 使用 GET 方法 + URL 参数(更兼容)
				var token = (L.env && (L.env.token || L.env.csrf_token)) || '';
				var reportUrl = L.url('admin/vum/uninstall/report_icon') + 
					'?package=' + encodeURIComponent(pkgName) + 
					'&comment=' + encodeURIComponent(comment) +
					(downloadUrl ? ('&download_url=' + encodeURIComponent(downloadUrl)) : '') +
					(token ? ('&token=' + encodeURIComponent(token)) : '');
				
				self._httpJson(reportUrl, {
					method: 'GET',
					headers: { 
						'Accept': 'application/json'
					}
				}).then(function(res){
					// 关闭原弹窗
					ui.hideModal(modal);
					
					if (res && res.ok) {
						// 成功：创建新弹窗显示成功提示
						var isDark = document.body && document.body.classList.contains('luci-uninstall-dark');
						var textColor = isDark ? '#e5e7eb' : '#111827';
						var content = E('div', { 'style': 'text-align:center; padding:30px 20px;' }, [
							E('div', { 'style': 'width:60px; height:60px; margin:0 auto 16px; background:#10b981; border-radius:50%; display:flex; align-items:center; justify-content:center;' }, [
								E('span', { 'style': 'color:#fff; font-size:32px; font-weight:bold;' }, '✓')
							]),
							E('div', { 'style': 'font-size:18px; font-weight:600; color:' + textColor + '; margin-bottom:8px;' }, _('上报成功')),
							E('div', { 'style': 'font-size:14px; color:#6b7280;' }, _('感谢您的反馈！'))
						]);
						
						var resultModal = ui.showModal(_('上报结果'), [content]);
						
						// 设置弹窗居中样式
						var overlay = resultModal && resultModal.parentNode;
						if (overlay) {
							overlay.style.display = 'flex';
							overlay.style.alignItems = 'center';
							overlay.style.justifyContent = 'center';
						}
						
						// 2秒后自动关闭
						setTimeout(function(){ ui.hideModal(resultModal); }, 2000);
					} else {
						// 失败：创建新弹窗显示错误
						var isDark = document.body && document.body.classList.contains('luci-uninstall-dark');
						var textColor = isDark ? '#e5e7eb' : '#111827';
						var content = E('div', { 'style': 'text-align:center; padding:30px 20px;' }, [
							E('div', { 'style': 'width:60px; height:60px; margin:0 auto 16px; background:#ef4444; border-radius:50%; display:flex; align-items:center; justify-content:center;' }, [
								E('span', { 'style': 'color:#fff; font-size:32px; font-weight:bold;' }, '✕')
							]),
							E('div', { 'style': 'font-size:18px; font-weight:600; color:' + textColor + '; margin-bottom:8px;' }, _('上报失败')),
							E('div', { 'style': 'font-size:14px; color:#6b7280;' }, (res && res.message) || _('未知错误')),
							E('button', { 
								'class': 'btn cbi-button-apply',
								'style': 'margin-top:16px; background:#3b82f6; color:#fff; border-radius:999px; padding:6px 20px;'
							}, _('关闭'))
						]);
						
						var resultModal = ui.showModal(_('上报结果'), [content]);
						
						// 设置弹窗居中样式
						var overlay = resultModal && resultModal.parentNode;
						if (overlay) {
							overlay.style.display = 'flex';
							overlay.style.alignItems = 'center';
							overlay.style.justifyContent = 'center';
						}
						
						// 为关闭按钮添加事件监听
						var closeBtn = content.querySelector('button');
						if (closeBtn) {
							closeBtn.addEventListener('click', function(){ ui.hideModal(resultModal); });
						}
					}
				}).catch(function(err){
					// 关闭原弹窗
					ui.hideModal(modal);
					
					// 网络错误：创建新弹窗显示错误
					var isDark = document.body && document.body.classList.contains('luci-uninstall-dark');
					var textColor = isDark ? '#e5e7eb' : '#111827';
					var content = E('div', { 'style': 'text-align:center; padding:30px 20px;' }, [
						E('div', { 'style': 'width:60px; height:60px; margin:0 auto 16px; background:#ef4444; border-radius:50%; display:flex; align-items:center; justify-content:center;' }, [
							E('span', { 'style': 'color:#fff; font-size:32px; font-weight:bold;' }, '✕')
						]),
						E('div', { 'style': 'font-size:18px; font-weight:600; color:' + textColor + '; margin-bottom:8px;' }, _('上报失败')),
						E('div', { 'style': 'font-size:14px; color:#6b7280;' }, _('请检查网络连接')),
						E('button', { 
							'class': 'btn cbi-button-apply',
							'style': 'margin-top:16px; background:#3b82f6; color:#fff; border-radius:999px; padding:6px 20px;'
						}, _('关闭'))
					]);
					
					var resultModal = ui.showModal(_('上报结果'), [content]);
					
					// 设置弹窗居中样式
					var overlay = resultModal && resultModal.parentNode;
					if (overlay) {
						overlay.style.display = 'flex';
						overlay.style.alignItems = 'center';
						overlay.style.justifyContent = 'center';
					}
					
					// 为关闭按钮添加事件监听
					var closeBtn = content.querySelector('button');
					if (closeBtn) {
						closeBtn.addEventListener('click', function(){ ui.hideModal(resultModal); });
					}
				});
			});
		}
		
		// 上报卸载问题函数
		function reportUninstall(pkgName) {
			var zhName = displayName(pkgName);
			var fullName = zhName && zhName !== pkgName ? (zhName + ' (' + pkgName + ')') : pkgName;
			
			// 创建上报对话框
			var inputComment = E('textarea', {
				placeholder: _('可选:描述卸载时遇到的问题,例如"卸载失败"、"卸载后仍有残留"等'),
				'style': 'width:100%; min-height:80px; padding:8px; border:1px solid #e5e7eb; border-radius:6px; font-size:13px; resize:vertical; font-family:inherit;'
			}, '');
			
			var isDark = document.body && document.body.classList.contains('luci-uninstall-dark');
			var textColor = isDark ? '#e5e7eb' : '#111827';
			var labelColor = isDark ? '#9ca3af' : '#374151';
			var titleRow = E('div', { 'style': 'display:flex; align-items:center; gap:8px; margin-bottom:12px;' }, [
				E('span', { 'style': 'display:inline-flex;width:28px;height:28px;background:#fef3c7;color:#92400e;border-radius:999px;align-items:center;justify-content:center;font-weight:700;' }, '!'),
				E('span', { 'style': 'font-weight:600;font-size:16px;color:' + textColor + ';' }, _('上报卸载问题'))
			]);
			
			var pkgInfo = E('div', { 'style': 'margin-bottom:12px; padding:10px; background:#f8f9fa; border:1px solid #e5e7eb; border-radius:8px;' }, [
				E('div', { 'style': 'display:flex; align-items:center; gap:8px; margin-bottom:6px;' }, [
					E('img', { src: packageIcon(pkgName), 'style': 'width:32px; height:32px; border-radius:6px; background:#f3f4f6; border:1px solid #e5e7eb; object-fit:contain;' }),
					E('div', {}, [
						E('div', { 'style': 'font-weight:600; color:' + textColor + ';' }, fullName),
						E('div', { 'style': 'font-size:12px; color:#6b7280;' }, pkgName)
					])
				]),
				E('div', { 'style': 'font-size:12px; color:#6b7280; margin-top:4px;' }, _('将向开发者上报此应用的卸载问题'))
			]);
			
			// 添加软件下载地址输入框
			var inputDownloadUrl = E('input', {
				type: 'text',
				placeholder: _('请提供软件下载地址,例如"https://example.com/package.ipk"'),
				'style': 'width:100%; padding:8px; border:1px solid #e5e7eb; border-radius:6px; font-size:13px; font-family:inherit;'
			}, '');
			
			var inputSection = E('div', { 'style': 'margin-bottom:12px;' }, [
				E('label', { 'style': 'display:block; font-size:13px; color:' + labelColor + '; margin-bottom:6px; font-weight:500;' }, _('问题描述')),
				inputComment,
				E('label', { 'style': 'display:block; font-size:13px; color:' + labelColor + '; margin-top:12px; margin-bottom:6px; font-weight:500;' }, _('软件下载地址') + ' <span style="color: #ef4444;">*</span>'),
				inputDownloadUrl
			]);
			
			var cancelBtn = E('button', { 'class': 'btn', 'style': 'background:#f3f4f6;color:#1f2937;border-radius:999px;padding:6px 14px;' }, _('取消'));
			// 卸载问题上报按钮使用橙色渐变
			var submitBtnGradient = 'linear-gradient(135deg, #f59e0b 0%, #f97316 50%, #ea580c 100%)';
			var submitBtnGradientHover = 'linear-gradient(135deg, #d97706 0%, #ea580c 50%, #dc2626 100%)';
			var submitBtn = E('button', { 
				'class': 'btn cbi-button-apply', 
				'style': 'background:' + submitBtnGradient + ';color:#fff;border:none;border-radius:999px;padding:6px 14px;box-shadow:0 2px 8px rgba(249,115,22,0.3), inset 0 1px 0 rgba(255,255,255,0.2);transition:all 0.2s;font-weight:500;' 
			}, _('提交上报'));
			// 添加悬停效果
			submitBtn.addEventListener('mouseenter', function() {
				this.style.background = submitBtnGradientHover;
				this.style.boxShadow = '0 4px 12px rgba(249,115,22,0.4), inset 0 1px 0 rgba(255,255,255,0.3)';
				this.style.transform = 'translateY(-1px)';
			});
			submitBtn.addEventListener('mouseleave', function() {
				this.style.background = submitBtnGradient;
				this.style.boxShadow = '0 2px 8px rgba(249,115,22,0.3), inset 0 1px 0 rgba(255,255,255,0.2)';
				this.style.transform = 'translateY(0)';
			});
			var footer = E('div', { 'style':'margin-top:12px;display:flex;gap:8px;justify-content:flex-end;' }, [ cancelBtn, submitBtn ]);
			
			var modal = ui.showModal(_('上报卸载问题'), [ titleRow, pkgInfo, inputSection, footer ]);
			var overlay = modal && modal.parentNode; 
			if (overlay) { 
				overlay.style.display = 'flex'; 
				overlay.style.alignItems = 'center'; 
				overlay.style.justifyContent = 'center'; 
			}
			
			cancelBtn.addEventListener('click', function(){ ui.hideModal(modal); });
			submitBtn.addEventListener('click', function(){
				var comment = inputComment.value.trim();
				var downloadUrl = inputDownloadUrl.value.trim();
				
				// 验证必填项
				if (!downloadUrl) {
					// 显示错误提示
					var errorEl = document.getElementById('download-url-error');
					if (errorEl) {
						errorEl.style.display = 'block';
					} else {
						var newErrorEl = E('div', {
							id: 'download-url-error',
							'style': 'color: #ef4444; font-size: 12px; margin-top: 4px; display: block;'
						}, _('请填写软件下载地址'));
						inputDownloadUrl.parentNode.appendChild(newErrorEl);
					}
					// 高亮输入框
					inputDownloadUrl.style.borderColor = '#ef4444';
					inputDownloadUrl.focus();
					return;
				}
				
				// 移除之前的错误提示
				var errorEl = document.getElementById('download-url-error');
				if (errorEl) {
					errorEl.style.display = 'none';
				}
				inputDownloadUrl.style.borderColor = '#e5e7eb';
				
				// 禁用按钮防止重复提交
				submitBtn.disabled = true;
				submitBtn.textContent = _('提交中...');
				submitBtn.style.opacity = '0.6';
				
				// 发送上报请求 - 使用 GET 方法 + URL 参数(更兼容)
				var token = (L.env && (L.env.token || L.env.csrf_token)) || '';
				var reportUrl = L.url('admin/vum/uninstall/report_uninstall') + 
					'?package=' + encodeURIComponent(pkgName) + 
					'&comment=' + encodeURIComponent(comment) +
					(downloadUrl ? ('&download_url=' + encodeURIComponent(downloadUrl)) : '') +
					(token ? ('&token=' + encodeURIComponent(token)) : '');
				
				self._httpJson(reportUrl, {
					method: 'GET',
					headers: { 
						'Accept': 'application/json'
					}
				}).then(function(res){
					// 关闭原弹窗
					ui.hideModal(modal);
					
					if (res && res.ok) {
						// 成功：创建新弹窗显示成功提示
						var isDark = document.body && document.body.classList.contains('luci-uninstall-dark');
						var textColor = isDark ? '#e5e7eb' : '#111827';
						var content = E('div', { 'style': 'text-align:center; padding:30px 20px;' }, [
							E('div', { 'style': 'width:60px; height:60px; margin:0 auto 16px; background:#10b981; border-radius:50%; display:flex; align-items:center; justify-content:center;' }, [
								E('span', { 'style': 'color:#fff; font-size:32px; font-weight:bold;' }, '✓')
							]),
							E('div', { 'style': 'font-size:18px; font-weight:600; color:' + textColor + '; margin-bottom:8px;' }, _('上报成功')),
							E('div', { 'style': 'font-size:14px; color:#6b7280;' }, _('感谢您的反馈！'))
						]);
						
						var resultModal = ui.showModal(_('上报结果'), [content]);
						
						// 设置弹窗居中样式
						var overlay = resultModal && resultModal.parentNode;
						if (overlay) {
							overlay.style.display = 'flex';
							overlay.style.alignItems = 'center';
							overlay.style.justifyContent = 'center';
						}
						
						// 2秒后自动关闭
						setTimeout(function(){ ui.hideModal(resultModal); }, 2000);
					} else {
						// 失败：创建新弹窗显示错误
						var isDark = document.body && document.body.classList.contains('luci-uninstall-dark');
						var textColor = isDark ? '#e5e7eb' : '#111827';
						var content = E('div', { 'style': 'text-align:center; padding:30px 20px;' }, [
							E('div', { 'style': 'width:60px; height:60px; margin:0 auto 16px; background:#ef4444; border-radius:50%; display:flex; align-items:center; justify-content:center;' }, [
								E('span', { 'style': 'color:#fff; font-size:32px; font-weight:bold;' }, '✕')
							]),
							E('div', { 'style': 'font-size:18px; font-weight:600; color:' + textColor + '; margin-bottom:8px;' }, _('上报失败')),
							E('div', { 'style': 'font-size:14px; color:#6b7280;' }, (res && res.message) || _('未知错误')),
							E('button', { 
								'class': 'btn cbi-button-apply',
								'style': 'margin-top:16px; background:#3b82f6; color:#fff; border-radius:999px; padding:6px 20px;'
							}, _('关闭'))
						]);
						
						var resultModal = ui.showModal(_('上报结果'), [content]);
						
						// 设置弹窗居中样式
						var overlay = resultModal && resultModal.parentNode;
						if (overlay) {
							overlay.style.display = 'flex';
							overlay.style.alignItems = 'center';
							overlay.style.justifyContent = 'center';
						}
						
						// 为关闭按钮添加事件监听
						var closeBtn = content.querySelector('button');
						if (closeBtn) {
							closeBtn.addEventListener('click', function(){ ui.hideModal(resultModal); });
						}
					}
				}).catch(function(err){
					// 关闭原弹窗
					ui.hideModal(modal);
					
					// 网络错误：创建新弹窗显示错误
					var isDark = document.body && document.body.classList.contains('luci-uninstall-dark');
					var textColor = isDark ? '#e5e7eb' : '#111827';
					var content = E('div', { 'style': 'text-align:center; padding:30px 20px;' }, [
						E('div', { 'style': 'width:60px; height:60px; margin:0 auto 16px; background:#ef4444; border-radius:50%; display:flex; align-items:center; justify-content:center;' }, [
							E('span', { 'style': 'color:#fff; font-size:32px; font-weight:bold;' }, '✕')
						]),
						E('div', { 'style': 'font-size:18px; font-weight:600; color:' + textColor + '; margin-bottom:8px;' }, _('上报失败')),
						E('div', { 'style': 'font-size:14px; color:#6b7280;' }, _('请检查网络连接')),
						E('button', { 
							'class': 'btn cbi-button-apply',
							'style': 'margin-top:16px; background:#3b82f6; color:#fff; border-radius:999px; padding:6px 20px;'
						}, _('关闭'))
					]);
					
					var resultModal = ui.showModal(_('上报结果'), [content]);
					
					// 设置弹窗居中样式
					var overlay = resultModal && resultModal.parentNode;
					if (overlay) {
						overlay.style.display = 'flex';
						overlay.style.alignItems = 'center';
						overlay.style.justifyContent = 'center';
					}
					
					// 为关闭按钮添加事件监听
					var closeBtn = content.querySelector('button');
					if (closeBtn) {
						closeBtn.addEventListener('click', function(){ ui.hideModal(resultModal); });
					}
				});
			});
		}
		
		function uninstall(name, purge, removeDeps, version, clearCache) {
			var confirmFn = function(msg, desc){
				return new Promise(function(resolve){
					var isDark = document.body && document.body.classList.contains('luci-uninstall-dark');
					var textColor = isDark ? '#e5e7eb' : '#111827';
					var titleRow = E('div', { 'style': 'display:flex; align-items:center; gap:8px;' }, [
						E('span', { 'style': 'display:inline-flex;width:28px;height:28px;background:#fee2e2;color:#b91c1c;border-radius:999px;align-items:center;justify-content:center;font-weight:700;' }, '!'),
						E('span', { 'style': 'font-weight:600;font-size:16px;color:' + textColor + ';' }, _('卸载确认'))
					]);
					var zhHeader = displayName(name);
					var headerName = zhHeader && zhHeader !== name ? (zhHeader + ' (' + name + ')') : name;
					var headerInfo = E('div', { 'style': 'margin-top:8px; display:flex; align-items:center; justify-content:space-between;' }, [
						E('div', { 'style': 'font-size:18px; font-weight:700; color:' + textColor + ';' }, headerName),
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
					// 单个卸载确定按钮使用蓝色渐变
					var uninstallConfirmGradient = 'linear-gradient(135deg, #3b82f6 0%, #6366f1 50%, #8b5cf6 100%)';
					var uninstallConfirmGradientHover = 'linear-gradient(135deg, #2563eb 0%, #4f46e5 50%, #7c3aed 100%)';
					var okBtn = E('button', { 
						'class': 'btn', 
						'style': 'background:' + uninstallConfirmGradient + '; color:#fff; border:none; border-radius:999px; padding:6px 14px; box-shadow:0 2px 8px rgba(99,102,241,0.3), inset 0 1px 0 rgba(255,255,255,0.2); transition:all 0.2s; font-weight:500;' 
					}, _('确定'));
					okBtn.addEventListener('mouseenter', function() {
						this.style.background = uninstallConfirmGradientHover;
						this.style.boxShadow = '0 4px 12px rgba(99,102,241,0.4), inset 0 1px 0 rgba(255,255,255,0.3)';
						this.style.transform = 'translateY(-1px)';
					});
					okBtn.addEventListener('mouseleave', function() {
						this.style.background = uninstallConfirmGradient;
						this.style.boxShadow = '0 2px 8px rgba(99,102,241,0.3), inset 0 1px 0 rgba(255,255,255,0.2)';
						this.style.transform = 'translateY(0)';
					});
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
				var closeBtn = E('button', { 'class': 'btn', disabled: true, 'style': 'background:linear-gradient(135deg, #6b7280 0%, #4b5563 50%, #374151 100%); color:#fff; border:none; font-weight:600; border-radius:6px; padding:8px 16px; box-shadow:0 2px 8px rgba(107,114,128,0.3), inset 0 1px 0 rgba(255,255,255,0.2); transition:all 0.2s;' }, _('关闭'));
				var closeBtnGradient = 'linear-gradient(135deg, #6b7280 0%, #4b5563 50%, #374151 100%)';
				closeBtn.addEventListener('mouseenter', function(){ if (!this.disabled) { this.style.background = 'linear-gradient(135deg, #4b5563 0%, #374151 50%, #1f2937 100%)'; this.style.boxShadow = '0 4px 12px rgba(107,114,128,0.4), inset 0 1px 0 rgba(255,255,255,0.2)'; } });
				closeBtn.addEventListener('mouseleave', function(){ if (!this.disabled) { this.style.background = closeBtnGradient; this.style.boxShadow = '0 2px 8px rgba(107,114,128,0.3), inset 0 1px 0 rgba(255,255,255,0.2)'; } });
				var zhName2 = displayName(name);
				var fullName2 = zhName2 && zhName2 !== name ? (zhName2 + ' (' + name + ')') : name;
				var startTs = Date.now();
				var elapsedEl = E('span', { 'style': 'font-size:12px;color:#6b7280;' }, '0s');
				var timer = setInterval(function(){ var s = Math.floor((Date.now() - startTs) / 1000); elapsedEl.textContent = s + 's'; }, 1000);
				var progressTrack = E('div', { 'style': 'height:6px;border-radius:999px;background:#0f1838;overflow:hidden;' });
				var progressBar = E('div', { 'style': 'height:6px;width:0%;background:linear-gradient(90deg, #10b981 0%, #22c55e 50%, #34d399 100%);box-shadow:0 0 8px rgba(34,197,94,.6);transition: width .25s ease;' });
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
					if (opSuccess) {
						var returnListGradient = 'linear-gradient(135deg, #10b981 0%, #059669 50%, #047857 100%)';
						closeBtn.setAttribute('style', 'background:' + returnListGradient + '; color:#fff; border:none; font-weight:600; border-radius:6px; padding:8px 16px; box-shadow:0 2px 8px rgba(16,185,129,0.3), inset 0 1px 0 rgba(255,255,255,0.2); transition:all 0.2s;');
						closeBtn.addEventListener('mouseenter', function(){ this.style.background = 'linear-gradient(135deg, #059669 0%, #047857 50%, #065f46 100%)'; this.style.boxShadow = '0 4px 12px rgba(16,185,129,0.4), inset 0 1px 0 rgba(255,255,255,0.2)'; });
						closeBtn.addEventListener('mouseleave', function(){ this.style.background = returnListGradient; this.style.boxShadow = '0 2px 8px rgba(16,185,129,0.3), inset 0 1px 0 rgba(255,255,255,0.2)'; });
					} else {
						closeBtn.setAttribute('style', 'background:' + closeBtnGradient + '; color:#fff; border:none; font-weight:600; border-radius:6px; padding:8px 16px; box-shadow:0 2px 8px rgba(107,114,128,0.3), inset 0 1px 0 rgba(255,255,255,0.2); transition:all 0.2s;');
					}
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
							progressBar.style.background = 'linear-gradient(90deg, #dc2626 0%, #ef4444 50%, #f87171 100%)';
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
					progressBar.style.background = 'linear-gradient(90deg, #dc2626 0%, #ef4444 50%, #f87171 100%)';
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
		// 将 searchTimer 暴露到全局作用域，以便清空按钮可以访问
		window.searchTimer = null;
		root.addEventListener('input', function(ev) {
			if (ev.target && ev.target.id === 'filter') {
				if (searchTimer) clearTimeout(searchTimer);
				searchTimer = setTimeout(refresh, 250);
				window.searchTimer = searchTimer; // 同步到全局变量
			}
		});
		// 全选/取消全选
		root.addEventListener('change', function(ev){
			if (ev.target && ev.target.id === 'select-all') {
				var checked = ev.target.checked;
				// 全选时显示风险提示（只统计未锁定的复选框）
				if (checked) {
					var totalCount = Array.from(document.querySelectorAll('.pkg-checkbox')).filter(function(cb) { return !cb.disabled; }).length;
					if (totalCount > 0) {
						var isDark = document.body && document.body.classList.contains('luci-uninstall-dark');
						var textColor = isDark ? '#e5e7eb' : '#111827';
						var warnModal = ui.showModal(_('风险警告'), [
							E('div', { 'style': 'display:flex; align-items:center; gap:12px; margin-bottom:16px;' }, [
								E('span', { 'style': 'display:inline-flex;width:48px;height:48px;background:#fee2e2;color:#dc2626;border-radius:999px;align-items:center;justify-content:center;font-weight:700;font-size:24px;' }, '!'),
								E('div', { 'style': 'flex:1;' }, [
									E('div', { 'style': 'font-weight:600;font-size:16px;color:' + textColor + ';margin-bottom:4px;' }, _('全部卸载可能导致系统崩溃')),
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
								(function(){
									var riskGradient = 'linear-gradient(135deg, #dc2626 0%, #ef4444 50%, #f87171 100%)';
									var riskGradientHover = 'linear-gradient(135deg, #b91c1c 0%, #dc2626 50%, #ef4444 100%)';
									var riskBtn = E('button', { 
										'class': 'btn', 
										id: 'confirm-select-all', 
										'style': 'background:' + riskGradient + '; color:#fff; border:none; border-radius:999px; padding:6px 14px; font-weight:600; box-shadow:0 2px 8px rgba(220,38,38,0.3), inset 0 1px 0 rgba(255,255,255,0.2); transition:all 0.2s;'
									}, _('我知道风险，继续'));
									riskBtn.addEventListener('mouseenter', function(){ this.style.background = riskGradientHover; this.style.boxShadow = '0 4px 12px rgba(220,38,38,0.4), inset 0 1px 0 rgba(255,255,255,0.2)'; });
									riskBtn.addEventListener('mouseleave', function(){ this.style.background = riskGradient; this.style.boxShadow = '0 2px 8px rgba(220,38,38,0.3), inset 0 1px 0 rgba(255,255,255,0.2)'; });
									return riskBtn;
								})()
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
								checkboxes.forEach(function(cb) { 
									// 跳过锁定的复选框
									if (!cb.disabled) {
										cb.checked = false; 
										cb.dispatchEvent(new Event('change')); 
									}
								});
							});
						}
						
						if (confirmBtn) {
							confirmBtn.addEventListener('click', function() {
								ui.hideModal(warnModal);
								// 继续全选
								var checkboxes = document.querySelectorAll('.pkg-checkbox');
								checkboxes.forEach(function(cb) {
									// 跳过锁定的复选框
									if (!cb.disabled && cb.checked !== checked) {
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
					// 跳过锁定的复选框
					if (!cb.disabled && cb.checked !== checked) {
						cb.checked = checked;
						cb.dispatchEvent(new Event('change'));
					}
				});
			}
		});
		
		// 查看历史更新日志函数
		function showHistoryLog() {
			// 显示加载状态
			var loadingContent = E('div', { 'style': 'text-align:center; padding:40px 20px;' }, [
				E('div', { 'style': 'width:48px; height:48px; margin:0 auto 16px; border:4px solid #e5e7eb; border-top-color:#6366f1; border-radius:50%; animation:spin 1s linear infinite;' }),
				E('div', { 'style': 'font-size:14px; color:#6b7280;' }, _('正在加载历史更新日志...'))
			]);
			var loadingModal = ui.showModal(_('历史更新日志'), [loadingContent]);
			var overlay = loadingModal && loadingModal.parentNode;
			if (overlay) {
				overlay.style.display = 'flex';
				overlay.style.alignItems = 'center';
				overlay.style.justifyContent = 'center';
			}
			
			// 添加旋转动画
			var styleEl = document.createElement('style');
			styleEl.textContent = '@keyframes spin { to { transform: rotate(360deg); } }';
			document.head.appendChild(styleEl);
			
			// 获取历史更新日志
			self._httpJson(L.url('admin/vum/uninstall/history_log'), { 
				headers: { 'Accept': 'application/json' } 
			}).then(function(res){
				ui.hideModal(loadingModal);
				document.head.removeChild(styleEl);
				
				if (res && res.ok && res.logs && res.logs.length > 0) {
					// 显示历史日志
					var logs = res.logs;
					var logContent = E('div', { 'style': 'max-width:800px; max-height:70vh; overflow-y:auto;' }, []);
					
					// 添加标题和说明
					var isDark = document.body && document.body.classList.contains('luci-uninstall-dark');
					var textColor = isDark ? '#e5e7eb' : '#111827';
					var header = E('div', { 'style': 'margin-bottom:16px; padding-bottom:12px; border-bottom:2px solid #e5e7eb;' }, [
						E('div', { 'style': 'display:flex; align-items:center; gap:8px; margin-bottom:8px;' }, [
							E('img', { 
								src: packageIcon('luci-app-uninstall'), 
								'style': 'width:32px; height:32px; border-radius:6px; background:#f3f4f6; border:1px solid #e5e7eb; object-fit:contain;' 
							}),
							E('div', { 'style': 'flex:1;' }, [
								E('div', { 'style': 'font-size:18px; font-weight:700; color:' + textColor + ';' }, _('高级卸载')),
								E('div', { 'style': 'font-size:13px; color:#6b7280;' }, _('历史更新日志'))
							])
						])
					]);
					logContent.appendChild(header);
					
					// 添加日志列表
					var logList = E('div', { 'style': 'display:flex; flex-direction:column; gap:12px;' }, []);
					logs.forEach(function(log, idx){
						var version = log.version || '';
						var date = log.date || '';
						var changelog = log.changelog || log.content || '';
						
						var logItem = E('div', { 
							'style': 'padding:16px; background:#f9fafb; border:1px solid #e5e7eb; border-radius:12px; transition:all 0.2s;'
						}, [
							E('div', { 'style': 'display:flex; align-items:center; justify-content:space-between; margin-bottom:8px;' }, [
								E('div', { 'style': 'display:flex; align-items:center; gap:8px;' }, [
									E('span', { 
										'style': 'font-size:14px; font-weight:700; color:#6366f1; background:#eef2ff; padding:4px 10px; border-radius:6px;'
									}, version || _('未知版本')),
									date ? E('span', { 
										'style': 'font-size:12px; color:#6b7280;'
									}, date) : null
								])
							]),
							changelog ? E('pre', { 
								'style': 'margin:0; padding:12px; background:#ffffff; border:1px solid #e5e7eb; border-radius:8px; font-size:13px; line-height:1.6; color:#374151; white-space:pre-wrap; word-wrap:break-word; font-family:inherit;'
							}, changelog) : E('div', { 'style': 'font-size:13px; color:#9ca3af; font-style:italic;' }, _('暂无更新说明'))
						]);
						
						logItem.addEventListener('mouseenter', function(){
							this.style.background = '#f3f4f6';
							this.style.borderColor = '#d1d5db';
							this.style.transform = 'translateY(-2px)';
							this.style.boxShadow = '0 4px 8px rgba(0,0,0,0.08)';
						});
						logItem.addEventListener('mouseleave', function(){
							this.style.background = '#f9fafb';
							this.style.borderColor = '#e5e7eb';
							this.style.transform = 'translateY(0)';
							this.style.boxShadow = 'none';
						});
						
						logList.appendChild(logItem);
					});
					logContent.appendChild(logList);
					
					var closeBtn = E('button', { 
						'class': 'btn cbi-button-apply',
						'style': 'margin-top:16px; background:#6366f1; color:#fff; border-radius:8px; padding:8px 24px; font-weight:500;'
					}, _('关闭'));
					closeBtn.addEventListener('click', function(){ ui.hideModal(historyModal); });
					
					var historyModal = ui.showModal(_('历史更新日志'), [
						logContent,
						E('div', { 'style': 'margin-top:16px; display:flex; justify-content:flex-end;' }, [closeBtn])
					]);
					
					var historyOverlay = historyModal && historyModal.parentNode;
					if (historyOverlay) {
						historyOverlay.style.display = 'flex';
						historyOverlay.style.alignItems = 'center';
						historyOverlay.style.justifyContent = 'center';
					}
				} else {
					// 没有日志或加载失败
					var isDarkEmpty = document.body && document.body.classList.contains('luci-uninstall-dark');
					var textColorEmpty = isDarkEmpty ? '#e5e7eb' : '#111827';
					var emptyContent = E('div', { 'style': 'text-align:center; padding:40px 20px;' }, [
						E('div', { 'style': 'width:64px; height:64px; margin:0 auto 16px; background:#f3f4f6; border-radius:50%; display:flex; align-items:center; justify-content:center;' }, [
							E('span', { 'style': 'font-size:32px; color:#9ca3af;' }, '📋')
						]),
						E('div', { 'style': 'font-size:16px; font-weight:600; color:' + textColorEmpty + '; margin-bottom:8px;' }, _('暂无历史更新日志')),
						E('div', { 'style': 'font-size:14px; color:#6b7280;' }, res && res.message ? res.message : _('无法获取历史更新日志，请稍后重试'))
					]);
					
					var closeBtn2 = E('button', { 
						'class': 'btn',
						'style': 'margin-top:16px; background:#f3f4f6; color:#374151; border-radius:8px; padding:8px 24px;'
					}, _('关闭'));
					closeBtn2.addEventListener('click', function(){ ui.hideModal(emptyModal); });
					
					var emptyModal = ui.showModal(_('历史更新日志'), [
						emptyContent,
						E('div', { 'style': 'margin-top:16px; display:flex; justify-content:flex-end;' }, [closeBtn2])
					]);
					
					var emptyOverlay = emptyModal && emptyModal.parentNode;
					if (emptyOverlay) {
						emptyOverlay.style.display = 'flex';
						emptyOverlay.style.alignItems = 'center';
						emptyOverlay.style.justifyContent = 'center';
					}
				}
			}).catch(function(err){
				ui.hideModal(loadingModal);
				document.head.removeChild(styleEl);
				
				// 显示错误
				var isDarkError = document.body && document.body.classList.contains('luci-uninstall-dark');
				var textColorError = isDarkError ? '#e5e7eb' : '#111827';
				var errorContent = E('div', { 'style': 'text-align:center; padding:40px 20px;' }, [
					E('div', { 'style': 'width:64px; height:64px; margin:0 auto 16px; background:#fee2e2; border-radius:50%; display:flex; align-items:center; justify-content:center;' }, [
						E('span', { 'style': 'font-size:32px; color:#dc2626;' }, '✕')
					]),
					E('div', { 'style': 'font-size:16px; font-weight:600; color:' + textColorError + '; margin-bottom:8px;' }, _('加载失败')),
					E('div', { 'style': 'font-size:14px; color:#6b7280;' }, _('无法获取历史更新日志，请检查网络连接'))
				]);
				
				var closeBtn3 = E('button', { 
					'class': 'btn',
					'style': 'margin-top:16px; background:#f3f4f6; color:#374151; border-radius:8px; padding:8px 24px;'
				}, _('关闭'));
				closeBtn3.addEventListener('click', function(){ ui.hideModal(errorModal); });
				
				var errorModal = ui.showModal(_('历史更新日志'), [
					errorContent,
					E('div', { 'style': 'margin-top:16px; display:flex; justify-content:flex-end;' }, [closeBtn3])
				]);
				
				var errorOverlay = errorModal && errorModal.parentNode;
				if (errorOverlay) {
					errorOverlay.style.display = 'flex';
					errorOverlay.style.alignItems = 'center';
					errorOverlay.style.justifyContent = 'center';
				}
			});
		}
		
		root.addEventListener('click', function(ev){
			if (!ev.target) return;
			var t = ev.target;
			if (t.id === 'batch-uninstall-btn' || (t.closest && t.closest('#batch-uninstall-btn'))) {
				ev.preventDefault();
				ev.stopPropagation();
				batchUninstall();
				return;
			}
			if (t.id === 'announcement-bell-btn' || (t.closest && t.closest('#announcement-bell-btn'))) {
				// 公告按钮的点击事件已经在按钮上定义了，这里不需要额外处理
				return;
			}
			if (t.id === 'install-local-btn' || (t.closest && t.closest('#install-local-btn'))) {
				ev.preventDefault();
				ev.stopPropagation();
				installLocalPackage();
				return;
			}
			if (t.id === 'history-log-btn' || (t.closest && t.closest('#history-log-btn'))) {
				ev.preventDefault();
				ev.stopPropagation();
				showHistoryLog();
				// 关闭公告面板（如果打开）
				var announcementPanel = document.getElementById('announcement-panel');
				var announcementBellBtn = document.getElementById('announcement-bell-btn');
				if (announcementPanel && announcementPanel.classList.contains('show')) {
					announcementPanel.classList.remove('show');
					// 恢复工具栏圆角
					var toolbar = document.getElementById('batch-toolbar');
					if (toolbar) toolbar.classList.remove('announcement-open');
					if (announcementBellBtn) {
						announcementBellBtn.classList.remove('active');
						// 更新图标渐变色
						if (announcementBellBtn.updateGradient) {
							announcementBellBtn.updateGradient(false);
						}
					}
					window.announcementVisible = false;
				}
				return;
			}
			if (t.id === 'filter-clear') { 
				// 清空按钮的事件处理已经在按钮上定义了
				// 这里不需要额外处理，避免重复刷新
				return; 
			}
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