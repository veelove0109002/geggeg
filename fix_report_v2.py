#!/usr/bin/env python3
# -*- coding: utf-8 -*-

file_path = "luci-app-uninstall/htdocs/luci-static/resources/view/uninstall/main.js"

with open(file_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

# 找到需要修改的行
# 行1208: // 在弹窗内显示结果，而不是使用顶部通知条
# 替换为: // 关闭原弹窗并显示结果

# 行1209-1225: 成功部分
# 行1227-1246: 失败部分  
# 行1248-1267: catch部分

# 新的成功代码
success_code = '''\t\t\t\t\t// 关闭原弹窗
\t\t\t\t\tui.hideModal(modal);
\t\t\t\t\t
\t\t\t\t\tif (res && res.ok) {
\t\t\t\t\t\t// 成功：显示成功提示
\t\t\t\t\t\tvar successContent = E('div', { 'style': 'text-align:center; padding:30px 20px;' }, [
\t\t\t\t\t\t\tE('div', { 'style': 'width:60px; height:60px; margin:0 auto 16px; background:#10b981; border-radius:50%; display:flex; align-items:center; justify-content:center;' }, [
\t\t\t\t\t\t\t\tE('span', { 'style': 'color:#fff; font-size:32px; font-weight:bold;' }, '✓')
\t\t\t\t\t\t\t]),
\t\t\t\t\t\t\tE('div', { 'style': 'font-size:18px; font-weight:600; color:#111827; margin-bottom:8px;' }, _('上报成功')),
\t\t\t\t\t\t\tE('div', { 'style': 'font-size:14px; color:#6b7280;' }, _('感谢您的反馈！'))
\t\t\t\t\t\t]);
\t\t\t\t\t\tvar successModal = ui.showModal(_('上报结果'), [ successContent ]);
\t\t\t\t\t\tvar successOverlay = successModal && successModal.parentNode;
\t\t\t\t\t\tif (successOverlay) {
\t\t\t\t\t\t\tsuccessOverlay.style.display = 'flex';
\t\t\t\t\t\t\tsuccessOverlay.style.alignItems = 'center';
\t\t\t\t\t\t\tsuccessOverlay.style.justifyContent = 'center';
\t\t\t\t\t\t}
\t\t\t\t\t\t// 2秒后自动关闭
\t\t\t\t\t\tsetTimeout(function(){ ui.hideModal(successModal); }, 2000);
\t\t\t\t\t} else {
\t\t\t\t\t\t// 失败：显示错误提示
\t\t\t\t\t\tvar closeBtn = E('button', { 
\t\t\t\t\t\t\t'class': 'btn cbi-button-apply',
\t\t\t\t\t\t\t'style': 'margin-top:16px; background:#3b82f6; color:#fff; border-radius:999px; padding:6px 20px;'
\t\t\t\t\t\t}, _('关闭'));
\t\t\t\t\t\tvar errorContent = E('div', { 'style': 'text-align:center; padding:30px 20px;' }, [
\t\t\t\t\t\t\tE('div', { 'style': 'width:60px; height:60px; margin:0 auto 16px; background:#ef4444; border-radius:50%; display:flex; align-items:center; justify-content:center;' }, [
\t\t\t\t\t\t\t\tE('span', { 'style': 'color:#fff; font-size:32px; font-weight:bold;' }, '✕')
\t\t\t\t\t\t\t]),
\t\t\t\t\t\t\tE('div', { 'style': 'font-size:18px; font-weight:600; color:#111827; margin-bottom:8px;' }, _('上报失败')),
\t\t\t\t\t\t\tE('div', { 'style': 'font-size:14px; color:#6b7280; margin-bottom:16px;' }, (res && res.message) || _('未知错误')),
\t\t\t\t\t\t\tcloseBtn
\t\t\t\t\t\t]);
\t\t\t\t\t\tvar errorModal = ui.showModal(_('上报结果'), [ errorContent ]);
\t\t\t\t\t\tvar errorOverlay = errorModal && errorModal.parentNode;
\t\t\t\t\t\tif (errorOverlay) {
\t\t\t\t\t\t\terrorOverlay.style.display = 'flex';
\t\t\t\t\t\t\terrorOverlay.style.alignItems = 'center';
\t\t\t\t\t\t\terrorOverlay.style.justifyContent = 'center';
\t\t\t\t\t\t}
\t\t\t\t\t\tcloseBtn.addEventListener('click', function(){ ui.hideModal(errorModal); });
\t\t\t\t\t}
'''

catch_code = '''\t\t\t\t}).catch(function(err){
\t\t\t\t\t// 关闭原弹窗
\t\t\t\t\tui.hideModal(modal);
\t\t\t\t\t
\t\t\t\t\t// 网络错误：显示错误提示
\t\t\t\t\tvar closeBtn = E('button', { 
\t\t\t\t\t\t'class': 'btn cbi-button-apply',
\t\t\t\t\t\t'style': 'margin-top:16px; background:#3b82f6; color:#fff; border-radius:999px; padding:6px 20px;'
\t\t\t\t\t}, _('关闭'));
\t\t\t\t\tvar errorContent = E('div', { 'style': 'text-align:center; padding:30px 20px;' }, [
\t\t\t\t\t\tE('div', { 'style': 'width:60px; height:60px; margin:0 auto 16px; background:#ef4444; border-radius:50%; display:flex; align-items:center; justify-content:center;' }, [
\t\t\t\t\t\t\tE('span', { 'style': 'color:#fff; font-size:32px; font-weight:bold;' }, '✕')
\t\t\t\t\t\t]),
\t\t\t\t\t\tE('div', { 'style': 'font-size:18px; font-weight:600; color:#111827; margin-bottom:8px;' }, _('上报失败')),
\t\t\t\t\t\tE('div', { 'style': 'font-size:14px; color:#6b7280; margin-bottom:16px;' }, _('请检查网络连接')),
\t\t\t\t\t\tcloseBtn
\t\t\t\t\t]);
\t\t\t\t\tvar errorModal = ui.showModal(_('上报结果'), [ errorContent ]);
\t\t\t\t\tvar errorOverlay = errorModal && errorModal.parentNode;
\t\t\t\t\tif (errorOverlay) {
\t\t\t\t\t\terrorOverlay.style.display = 'flex';
\t\t\t\t\t\terrorOverlay.style.alignItems = 'center';
\t\t\t\t\t\terrorOverlay.style.justifyContent = 'center';
\t\t\t\t\t}
\t\t\t\t\tcloseBtn.addEventListener('click', function(){ ui.hideModal(errorModal); });
\t\t\t\t});
'''

new_lines = []
i = 0
while i < len(lines):
    # 找到 }).then(function(res){
    if i == 1207 and '}).then(function(res){' in lines[i]:
        new_lines.append(lines[i])  # 保留 }).then(function(res){
        new_lines.append(success_code)
        # 跳过旧代码到 }).catch(function(err){
        i += 1
        while i < len(lines) and '}).catch(function(err){' not in lines[i]:
            i += 1
        # 现在 i 指向 }).catch(function(err){
        new_lines.append(catch_code)
        # 跳过旧的 catch 代码到 });
        i += 1
        while i < len(lines) and not (lines[i].strip() == '});' and i > 1260):
            i += 1
        new_lines.append(lines[i])  # 保留 });
        i += 1
        continue
    new_lines.append(lines[i])
    i += 1

with open(file_path, 'w', encoding='utf-8') as f:
    f.writelines(new_lines)

print("修复完成！")
print(f"总行数: {len(new_lines)}")
