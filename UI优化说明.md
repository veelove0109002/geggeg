# 上报图标按钮 - UI 优化

## 🎨 最新设计

### 按钮样式
- **图标**: 画笔/调色板 SVG 图标
- **尺寸**: 28x28 像素方形按钮
- **位置**: 卡片左下角
- **默认样式**: 白色背景 + 灰色边框 + 灰色图标
- **悬停样式**: 红色背景 + 红色边框 + 白色图标

### 视觉效果

```
默认状态:
┌──────┐
│  🖌️  │  ← 白底灰图标
└──────┘

悬停状态:
┌──────┐
│  🖌️  │  ← 红底白图标 + 上浮阴影
└──────┘
```

## 📐 完整卡片布局

```
┌─────────────────────────────────────┐
│  [📱] 应用名称              版本号    │
│       luci-app-xxx                  │
│  [✓] 配置  [✓] 依赖  [✓] 缓存       │
│                                     │
│  [🖌️]                      [卸载]    │ ← 画笔图标
└─────────────────────────────────────┘
```

## 🎯 交互动画

### 鼠标悬停
1. 按钮上浮 2px (`translateY(-2px)`)
2. 背景变红色 (`#ff6b6b`)
3. 图标变白色
4. 阴影增强 (红色光晕效果)

### 点击操作
- 弹出上报对话框
- 可填写包名和问题描述

## 🔧 技术细节

### SVG 图标
```svg
<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24">
  <!-- 画笔图标 -->
  <path d="M12 19l7-7 3 3-7 7-3-3z"/>
  <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/>
  <path d="M2 2l7.586 7.586"/>
  <circle cx="11" cy="11" r="2"/>
</svg>
```

### 样式代码
```css
/* 默认 */
width: 28px;
height: 28px;
background: #ffffff;
border: 1px solid #e5e7eb;
border-radius: 8px;
color: #6b7280;
box-shadow: 0 1px 3px rgba(0,0,0,0.1);

/* 悬停 */
background: #ff6b6b;
border-color: #ff6b6b;
color: #ffffff;
transform: translateY(-2px);
box-shadow: 0 3px 8px rgba(255,107,107,0.3);
```

### 位置计算
```javascript
// 如果有 VUM-Plugin 标签
left: 100px  // 避免重叠

// 普通应用
left: 12px   // 左边距
```

## ✅ 优化优势

1. **简洁美观**: 小图标不占空间,简约设计
2. **语义清晰**: 画笔图标直观表示"修改图标"
3. **交互友好**: 悬停变色提供清晰反馈
4. **视觉统一**: 圆角方形与整体设计风格一致
5. **性能优化**: SVG 图标体积小,加载快

## 🚀 部署

### 快速更新 (开发测试)
```bash
scp luci-app-uninstall/htdocs/luci-static/resources/view/uninstall/main.js \
    root@192.168.1.1:/www/luci-static/resources/view/uninstall/
```

### 完整编译
```bash
make package/luci-app-uninstall/compile V=s
```

---

**设计版本**: v3.0  
**更新时间**: 2025-11-07  
**状态**: ✅ 已完成
