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
				// 关闭原弹窗
				ui.hideModal(modal);
				
				// 显示结果弹窗
				if (res && res.ok) {
					// 成功：显示成功提示
					var successContent = E('div', { 'style': 'text-align:center; padding:30px 20px;' }, [
						E('div', { 'style': 'width:60px; height:60px; margin:0 auto 16px; background:#10b981; border-radius:50%; display:flex; align-items:center; justify-content:center;' }, [
							E('span', { 'style': 'color:#fff; font-size:32px; font-weight:bold;' }, '✓')
						]),
						E('div', { 'style': 'font-size:18px; font-weight:600; color:#111827; margin-bottom:8px;' }, _('上报成功')),
						E('div', { 'style': 'font-size:14px; color:#6b7280;' }, _('感谢您的反馈！'))
					]);
					var successModal = ui.showModal(_('上报结果'), [ successContent ]);
					var successOverlay = successModal && successModal.parentNode;
					if (successOverlay) {
						successOverlay.style.display = 'flex';
						successOverlay.style.alignItems = 'center';
						successOverlay.style.justifyContent = 'center';
					}
					// 2秒后自动关闭
					setTimeout(function(){ ui.hideModal(successModal); }, 2000);
				} else {
					// 失败：显示错误提示
					var closeBtn = E('button', { 
						'class': 'btn cbi-button-apply',
						'style': 'margin-top:16px; background:#3b82f6; color:#fff; border-radius:999px; padding:6px 20px;'
					}, _('关闭'));
					var errorContent = E('div', { 'style': 'text-align:center; padding:30px 20px;' }, [
						E('div', { 'style': 'width:60px; height:60px; margin:0 auto 16px; background:#ef4444; border-radius:50%; display:flex; align-items:center; justify-content:center;' }, [
							E('span', { 'style': 'color:#fff; font-size:32px; font-weight:bold;' }, '✕')
						]),
						E('div', { 'style': 'font-size:18px; font-weight:600; color:#111827; margin-bottom:8px;' }, _('上报失败')),
						E('div', { 'style': 'font-size:14px; color:#6b7280; margin-bottom:16px;' }, (res && res.message) || _('未知错误')),
						closeBtn
					]);
					var errorModal = ui.showModal(_('上报结果'), [ errorContent ]);
					var errorOverlay = errorModal && errorModal.parentNode;
					if (errorOverlay) {
						errorOverlay.style.display = 'flex';
						errorOverlay.style.alignItems = 'center';
						errorOverlay.style.justifyContent = 'center';
					}
					closeBtn.addEventListener('click', function(){ ui.hideModal(errorModal); });
				}
			}).catch(function(err){
				// 关闭原弹窗
				ui.hideModal(modal);
				
				// 网络错误：显示错误提示
				var closeBtn = E('button', { 
					'class': 'btn cbi-button-apply',
					'style': 'margin-top:16px; background:#3b82f6; color:#fff; border-radius:999px; padding:6px 20px;'
				}, _('关闭'));
				var errorContent = E('div', { 'style': 'text-align:center; padding:30px 20px;' }, [
					E('div', { 'style': 'width:60px; height:60px; margin:0 auto 16px; background:#ef4444; border-radius:50%; display:flex; align-items:center; justify-content:center;' }, [
						E('span', { 'style': 'color:#fff; font-size:32px; font-weight:bold;' }, '✕')
					]),
					E('div', { 'style': 'font-size:18px; font-weight:600; color:#111827; margin-bottom:8px;' }, _('上报失败')),
					E('div', { 'style': 'font-size:14px; color:#6b7280; margin-bottom:16px;' }, _('请检查网络连接')),
					closeBtn
				]);
				var errorModal = ui.showModal(_('上报结果'), [ errorContent ]);
				var errorOverlay = errorModal && errorModal.parentNode;
				if (errorOverlay) {
					errorOverlay.style.display = 'flex';
					errorOverlay.style.alignItems = 'center';
					errorOverlay.style.justifyContent = 'center';
				}
				closeBtn.addEventListener('click', function(){ ui.hideModal(errorModal); });
			});
		});
	}
