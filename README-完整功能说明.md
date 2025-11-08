# 上报功能完整说明

## 📚 文档导航

本项目包含以下文档，请按需查阅：

### 核心文档
1. **[类型区分说明.md](类型区分说明.md)** ⭐ 推荐先看
   - 解释为什么需要 `type` 字段
   - 如何区分图标问题和卸载问题
   - 数据结构对比

2. **[上报卸载功能说明.md](上报卸载功能说明.md)**
   - 新增功能的详细说明
   - 前端和后端的修改内容
   - 与上报图标功能的对比

3. **[上报数据格式说明.md](上报数据格式说明.md)**
   - 完整的数据格式定义
   - 接收端处理示例（PHP/SQL）
   - 统计查询示例

### 实现文档
4. **[接收端实现代码.md](接收端实现代码.md)** ⭐ 服务器端必看
   - 完整的 PHP 接收端代码
   - 统计页面代码
   - 目录结构和数据示例

5. **[快速部署指南.md](快速部署指南.md)** ⭐ 部署必看
   - 一步步部署流程
   - 问题排查指南
   - 维护任务设置

## 🎯 功能概述

### 两种上报功能

#### 1. 上报图标问题
- **按钮位置**: 卡片左下角第一个
- **图标**: 📋 copy.png
- **悬停颜色**: 红色 (#ff6b6b)
- **用途**: 上报图标显示不正确、缺少图标等问题
- **数据标识**: `type: "icon"`

#### 2. 上报卸载问题
- **按钮位置**: 卡片左下角第二个（上报图标右侧）
- **图标**: 🗑️ xzbc.png
- **悬停颜色**: 橙色 (#f59e0b)
- **用途**: 上报卸载失败、残留文件等问题
- **数据标识**: `type: "uninstall"`

### 关键特性

✅ **明确的类型区分**
- 每个上报都包含 `type` 字段
- 即使用户不填写描述，也能准确判断问题类型

✅ **统一的交互体验**
- 相同的弹窗风格
- 相同的提交流程
- 相同的结果反馈

✅ **完善的数据管理**
- 按类型分目录存储
- 详细的日志记录
- 实时统计数据

## 📊 数据流程

```
用户点击按钮
    ↓
填写问题描述（可选）
    ↓
点击提交
    ↓
前端发送数据（包含 type 字段）
    ↓
后端接收并验证
    ↓
按 type 分类存储
    ↓
更新统计数据
    ↓
返回成功响应
    ↓
显示结果弹窗
```

## 🔧 技术实现

### 前端 (main.js)
- 添加两个上报按钮
- 实现 `reportIcon()` 函数
- 实现 `reportUninstall()` 函数
- 统一的结果反馈机制

### 后端 (uninstall.lua)
- `action_report_icon()` - 处理图标问题上报
  - 添加 `type = 'icon'`
- `action_report_uninstall()` - 处理卸载问题上报
  - 添加 `type = 'uninstall'`

### 接收端 (report.php)
- 接收 POST 请求
- 验证 `type` 字段
- 按类型分目录存储
- 记录日志和统计

## 📁 文件清单

### 客户端文件（OpenWrt）
```
luci-app-uninstall/
├── htdocs/luci-static/resources/
│   ├── view/uninstall/main.js          # 前端逻辑（已修改）
│   └── icons/
│       ├── copy.png                     # 上报图标按钮图标
│       └── xzbc.png                     # 上报卸载按钮图标
└── luasrc/controller/
    └── uninstall.lua                    # 后端控制器（已修改）
```

### 服务器端文件
```
/var/www/html/
├── report.php                           # 接收端主文件
├── stats.php                            # 统计页面（可选）
└── reports/                             # 数据目录
    ├── icon/                            # 图标问题数据
    │   ├── *.json                       # JSON 数据文件
    │   └── reports.log                  # 日志文件
    ├── uninstall/                       # 卸载问题数据
    │   ├── *.json                       # JSON 数据文件
    │   └── reports.log                  # 日志文件
    ├── all_reports.log                  # 总日志
    └── stats.json                       # 统计数据
```

## 🚀 快速开始

### 1. 部署服务器端
```bash
# 上传 report.php
scp report.php root@tb.vumstar.com:/var/www/html/

# 设置权限
ssh root@tb.vumstar.com
mkdir -p /var/www/html/reports
chmod 777 /var/www/html/reports
```

### 2. 部署客户端
```bash
# 上传文件到 OpenWrt
scp main.js root@192.168.1.1:/usr/lib/lua/luci/view/uninstall/
scp uninstall.lua root@192.168.1.1:/usr/lib/lua/luci/controller/

# 清理缓存
ssh root@192.168.1.1
rm -f /tmp/luci-*
/etc/init.d/uhttpd reload
```

### 3. 测试功能
1. 打开 OpenWrt 管理界面
2. 进入"高级卸载"页面
3. 点击任意插件的上报按钮
4. 提交后查看是否显示成功

### 4. 查看数据
```bash
# 查看服务器端数据
ssh root@tb.vumstar.com
cat /var/www/html/reports/stats.json

# 或访问统计页面
# https://tb.vumstar.com/stats.php
```

## 📈 数据示例

### 图标问题上报
```json
{
  "type": "icon",
  "package": "luci-app-passwall",
  "comment": "图标显示不正确",
  "timestamp": 1705305022,
  "device_info": {...},
  "received_at": "2024-01-15 14:30:22",
  "ip": "192.168.1.100"
}
```

### 卸载问题上报
```json
{
  "type": "uninstall",
  "package": "luci-app-passwall",
  "comment": "卸载后仍有残留",
  "timestamp": 1705305930,
  "device_info": {...},
  "received_at": "2024-01-15 14:45:30",
  "ip": "192.168.1.100"
}
```

### 统计数据
```json
{
  "by_type": {
    "icon": 156,
    "uninstall": 83
  },
  "by_package": {
    "luci-app-passwall": {
      "icon": 45,
      "uninstall": 23,
      "total": 68
    }
  },
  "total": 239
}
```

## 🔍 常见问题

### Q1: 用户不填写描述，如何区分问题类型？
**A**: 通过 `type` 字段区分。每个上报都包含明确的类型标识：
- 图标问题: `type: "icon"`
- 卸载问题: `type: "uninstall"`

### Q2: 数据存储在哪里？
**A**: 服务器端按类型分目录存储：
- 图标问题: `/var/www/html/reports/icon/`
- 卸载问题: `/var/www/html/reports/uninstall/`

### Q3: 如何查看统计数据？
**A**: 三种方式：
1. 访问 `stats.php` 页面（可视化）
2. 查看 `stats.json` 文件
3. 使用命令行统计日志文件

### Q4: 如何防止滥用？
**A**: 可以在 Nginx 中配置：
```nginx
limit_req_zone $binary_remote_addr zone=report_limit:10m rate=10r/m;
location /report.php {
    limit_req zone=report_limit burst=5;
}
```

### Q5: 数据会占用多少空间？
**A**: 每个上报约 500 字节，1000 个上报约 500KB。建议：
- 定期清理 30 天前的数据
- 压缩旧日志文件
- 设置自动备份

## 🛠️ 维护建议

### 定期任务
1. **每天**: 备份数据
2. **每周**: 查看统计，分析问题趋势
3. **每月**: 清理旧数据，优化存储

### 监控指标
- 上报总数
- 各类型占比
- 问题最多的包
- 上报频率趋势

### 优化建议
- 对高频问题包进行重点优化
- 根据用户反馈改进功能
- 定期更新图标资源

## 📞 技术支持

如有问题，请查看：
1. [快速部署指南.md](快速部署指南.md) - 部署问题
2. [类型区分说明.md](类型区分说明.md) - 数据格式问题
3. [接收端实现代码.md](接收端实现代码.md) - 服务器端问题

## 🎉 总结

这套上报系统实现了：
- ✅ 完整的双类型上报功能
- ✅ 明确的类型区分机制
- ✅ 自动化的数据管理
- ✅ 可视化的统计分析
- ✅ 用户友好的交互体验

即使用户不填写任何描述，系统也能准确判断和分类问题，为后续的问题分析和优化提供可靠的数据支持！
