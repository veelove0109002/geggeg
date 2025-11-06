# UI优化说明

## 修复内容

本次修复了3个UI问题：

### 1. 全选复选框垂直对齐问题 ✓

**问题描述**：全选复选框下移，没有和"全选"文字在同一水平线上

**修复方案**：
- 为复选框添加 `margin:0` 和 `flex-shrink:0` 样式
- 为"全选"文字添加 `line-height:18px` 样式，确保与复选框高度一致
- 保持父容器的 `align-items:center` 属性

**修改位置**：`main.js` 第97-103行

```javascript
var selectAllCheckbox = E('input', { 
    type: 'checkbox', 
    id: 'select-all', 
    'style': 'width:18px; height:18px; cursor:pointer; margin:0; flex-shrink:0;' 
});
var selectAllLabel = E('label', { 
    'for': 'select-all',
    'style': 'display:flex; align-items:center; gap:6px; cursor:pointer; font-weight:600; color:#0369a1; user-select:none;'
}, [
    selectAllCheckbox,
    E('span', { 'style': 'line-height:18px;' }, _('全选'))
]);
```

---

### 2. 全选风险提示 ✓

**问题描述**：当用户点击全选时，需要给出风险警告，提示"全部卸载会导致系统崩溃"

**修复方案**：
- 在全选事件处理中添加风险提示弹窗
- 弹窗包含醒目的警告图标和文字说明
- 列出3条严重警告：
  1. 卸载系统核心插件可能导致路由器无法正常工作
  2. 可能需要重新刷机才能恢复系统
  3. 建议仅卸载您确认不需要的插件
- 提供"取消全选"和"我知道风险，继续"两个按钮
- 只有用户确认后才会执行全选操作

**修改位置**：`main.js` 第1224-1280行

**弹窗样式**：
- 红色警告图标（48x48px圆形）
- 红色背景的警告区域
- 醒目的红色"我知道风险，继续"按钮
- 灰色的"取消全选"按钮

---

### 3. 返回列表按钮颜色优化 ✓

**问题描述**：卸载完成后弹窗中的"返回列表"按钮不够醒目

**修复方案**：
- 为成功卸载后的"返回列表"按钮添加绿色背景
- 样式：`background:#22c55e; color:#fff; border:none; font-weight:600;`
- 使用鲜艳的绿色（#22c55e）突出显示
- 白色文字，加粗字体，无边框

**修改位置**：`main.js` 第1124行

```javascript
function enableClose(){
    closeBtn.disabled = false;
    closeBtn.textContent = opSuccess ? _('返回列表') : _('查看详情');
    if (opSuccess) closeBtn.setAttribute('style', 'background:#22c55e; color:#fff; border:none; font-weight:600;');
    closeBtn.addEventListener('click', function(){
        if (opSuccess) { ui.hideModal(modal); window.location.reload(); }
        else { log.style.maxHeight = '420px'; log.scrollTop = log.scrollHeight; }
    });
}
```

---

## 测试建议

1. **全选对齐测试**：
   - 打开高级卸载页面
   - 检查全选复选框和"全选"文字是否在同一水平线上

2. **风险提示测试**：
   - 点击全选复选框
   - 应该弹出风险警告弹窗
   - 点击"取消全选"应该关闭弹窗并取消全选
   - 点击"我知道风险，继续"应该关闭弹窗并执行全选

3. **返回按钮测试**：
   - 卸载任意一个软件包
   - 卸载成功后，检查"返回列表"按钮是否显示为绿色
   - 点击按钮应该刷新页面

---

## 技术细节

- 使用 LuCI 的 `ui.showModal()` 创建弹窗
- 使用 `E()` 函数创建 DOM 元素
- 使用内联样式确保样式优先级
- 使用事件监听器处理用户交互
- 使用 `_()` 函数支持国际化

---

## 修改文件

- `luci-app-uninstall/htdocs/luci-static/resources/view/uninstall/main.js`

---

---

## 后续修复（第二轮）

### 4. 批量卸载完成按钮颜色优化 ✓

**问题描述**：批量卸载完成后弹窗中的"完成"按钮不够醒目

**修复方案**：
- 为"完成"按钮添加醒目的绿色背景
- 样式：`background:#22c55e; color:#fff; border:none; font-weight:600; border-radius:6px; padding:8px 16px;`
- 使用与"返回列表"按钮相同的绿色主题
- 增加圆角和内边距，提升视觉效果

**修改位置**：`main.js` 第925行

```javascript
closeBtn.disabled = false;
closeBtn.textContent = _('完成');
closeBtn.setAttribute('style', 'background:#22c55e; color:#fff; border:none; font-weight:600; border-radius:6px; padding:8px 16px;');
```

---

### 5. 全选复选框垂直对齐优化（增强版）✓

**问题描述**：全选复选框仍然下移，没有和"全选"文字在同一水平线上

**修复方案**：
- 为复选框添加更多对齐样式：
  - `padding:0` - 移除内边距
  - `vertical-align:middle` - 垂直居中对齐
  - `display:inline-block` - 设置为行内块元素
- 将 label 的 `display:flex` 改为 `display:inline-flex`
- 为 label 添加 `line-height:1` 确保行高一致
- 为"全选"文字添加 `vertical-align:middle` 和 `display:inline-block`

**修改位置**：`main.js` 第97-104行

```javascript
var selectAllCheckbox = E('input', { 
    type: 'checkbox', 
    id: 'select-all', 
    'style': 'width:18px; height:18px; cursor:pointer; margin:0; padding:0; flex-shrink:0; vertical-align:middle; display:inline-block;' 
});
var selectAllLabel = E('label', { 
    'for': 'select-all',
    'style': 'display:inline-flex; align-items:center; gap:6px; cursor:pointer; font-weight:600; color:#0369a1; user-select:none; line-height:1;'
}, [
    selectAllCheckbox,
    E('span', { 'style': 'line-height:1; display:inline-block; vertical-align:middle;' }, _('全选'))
]);
```

**关键改进**：
- 使用 `inline-flex` 替代 `flex`，避免块级元素的默认行为
- 同时设置复选框和文字的 `vertical-align:middle`
- 统一 `line-height:1` 确保行高一致

---

**修复完成时间**：2025-11-06
**最后更新时间**：2025-11-06（第二轮修复）
