# 图标上报UI修复说明

## 问题描述

提交图标上报后，弹窗卡住，没有给用户反馈提交成功与否的内容。

## 原因分析

代码中使用了 `modal.querySelector('.modal-body')` 来查找弹窗主体元素，但 LuCI 的 `ui.showModal()` 创建的弹窗结构可能没有 `.modal-body` 类，导致 `modalBody` 为 `null`，所以 `if (modalBody)` 条件不成立，无法显示结果。

## 解决方案

改用更可靠的方法：
1. 关闭原弹窗
2. 创建新的结果弹窗显示成功/失败信息

## 手动修复步骤

请手动修改文件：`luci-app-uninstall/htdocs/luci-static/resources/view/uninstall/main.js`

### 修改位置1：成功处理（约第1208-1225行）

**查找：**
```javascript
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
```

**替换为：**
```javascript
			// 关闭原弹窗并显示结果
			ui.hideModal(modal);
			
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
```

### 修改位置2：失败处理（约第1227-1246行）

**查找：**
```javascript
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
```

**替换为：**
```javascript
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
```

### 修改位置3：网络错误处理（约第1248-1267行）

**查找：**
```javascript
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
```

**替换为：**
```javascript
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
```

## 修改后的效果

1. **提交成功**：关闭输入弹窗 → 显示成功弹窗（绿色✓） → 2秒后自动关闭
2. **提交失败**：关闭输入弹窗 → 显示失败弹窗（红色✕ + 错误信息） → 点击"关闭"按钮关闭
3. **网络错误**：关闭输入弹窗 → 显示错误弹窗（红色✕ + "请检查网络连接"） → 点击"关闭"按钮关闭

## 备份文件

修改前已自动创建备份：
- `luci-app-uninstall/htdocs/luci-static/resources/view/uninstall/main.js.bak`
- `luci-app-uninstall/htdocs/luci-static/resources/view/uninstall/main.js.bak2`

如需恢复，可使用：
```bash
cp luci-app-uninstall/htdocs/luci-static/resources/view/uninstall/main.js.bak luci-app-uninstall/htdocs/luci-static/resources/view/uninstall/main.js
```
