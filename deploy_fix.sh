#!/bin/bash
#
# 图标上报功能修复 - 快速部署脚本
#

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 配置
OPENWRT_IP="${1:-192.168.1.1}"

echo -e "${BLUE}=========================================="
echo "  图标上报功能修复 - 部署脚本"
echo "==========================================${NC}"
echo ""
echo "OpenWrt IP: $OPENWRT_IP"
echo ""

# 检查文件是否存在
if [ ! -f "luci-app-uninstall/luasrc/controller/uninstall.lua" ]; then
    echo -e "${RED}✗ 错误: 找不到 uninstall.lua 文件${NC}"
    echo "  请确保在项目根目录运行此脚本"
    exit 1
fi

if [ ! -f "luci-app-uninstall/htdocs/luci-static/resources/view/uninstall/main.js" ]; then
    echo -e "${RED}✗ 错误: 找不到 main.js 文件${NC}"
    echo "  请确保在项目根目录运行此脚本"
    exit 1
fi

# 步骤 1: 备份原文件
echo -e "${YELLOW}[1/5] 备份原文件...${NC}"
ssh root@$OPENWRT_IP "cp /usr/lib/lua/luci/controller/uninstall.lua /usr/lib/lua/luci/controller/uninstall.lua.backup.$(date +%Y%m%d_%H%M%S) 2>/dev/null" && \
    echo -e "${GREEN}✓ 备份 Lua 文件完成${NC}" || \
    echo -e "${YELLOW}⚠ 备份失败或文件不存在（首次部署可忽略）${NC}"

ssh root@$OPENWRT_IP "cp /www/luci-static/resources/view/uninstall/main.js /www/luci-static/resources/view/uninstall/main.js.backup.$(date +%Y%m%d_%H%M%S) 2>/dev/null" && \
    echo -e "${GREEN}✓ 备份 JS 文件完成${NC}" || \
    echo -e "${YELLOW}⚠ 备份失败或文件不存在（首次部署可忽略）${NC}"

# 步骤 2: 上传 Lua 控制器文件
echo -e "${YELLOW}[2/5] 上传 Lua 控制器文件...${NC}"
if scp luci-app-uninstall/luasrc/controller/uninstall.lua root@$OPENWRT_IP:/usr/lib/lua/luci/controller/; then
    echo -e "${GREEN}✓ Lua 文件上传成功${NC}"
else
    echo -e "${RED}✗ Lua 文件上传失败${NC}"
    exit 1
fi

# 步骤 3: 上传前端 JS 文件
echo -e "${YELLOW}[3/5] 上传前端 JS 文件...${NC}"
if scp luci-app-uninstall/htdocs/luci-static/resources/view/uninstall/main.js root@$OPENWRT_IP:/www/luci-static/resources/view/uninstall/; then
    echo -e "${GREEN}✓ JS 文件上传成功${NC}"
else
    echo -e "${RED}✗ JS 文件上传失败${NC}"
    exit 1
fi

# 步骤 4: 清除 LuCI 缓存
echo -e "${YELLOW}[4/5] 清除 LuCI 缓存...${NC}"
if ssh root@$OPENWRT_IP "rm -f /tmp/luci-* && /etc/init.d/uhttpd reload"; then
    echo -e "${GREEN}✓ 缓存清除成功${NC}"
else
    echo -e "${RED}✗ 缓存清除失败${NC}"
    exit 1
fi

# 步骤 5: 测试上报功能
echo -e "${YELLOW}[5/5] 测试上报功能...${NC}"
echo ""

# 发送测试请求
echo "发送测试请求..."
RESPONSE=$(ssh root@$OPENWRT_IP "curl -s -X POST \
    'http://127.0.0.1/cgi-bin/luci/admin/vum/uninstall/report_icon' \
    -H 'Content-Type: application/x-www-form-urlencoded' \
    -d 'package=luci-app-deploy-test&comment=部署测试-$(date +%s)' \
    2>&1")

echo "响应: $RESPONSE"
echo ""

# 检查响应
if echo "$RESPONSE" | grep -q '"ok":true'; then
    echo -e "${GREEN}✓ 测试成功！上报功能正常工作${NC}"
else
    echo -e "${RED}✗ 测试失败${NC}"
    echo "请查看详细日志:"
    echo "  ssh root@$OPENWRT_IP 'logread | grep REPORT_ICON'"
fi

echo ""

# 查看最近的日志
echo -e "${BLUE}最近的上报日志:${NC}"
ssh root@$OPENWRT_IP "logread | grep REPORT_ICON | tail -5" 2>&1 || echo "  (无日志)"

echo ""
echo -e "${BLUE}=========================================="
echo "  部署完成！"
echo "==========================================${NC}"
echo ""
echo "下一步操作:"
echo "  1. 在浏览器访问: http://$OPENWRT_IP/cgi-bin/luci/admin/vum/uninstall"
echo "  2. 点击任意应用的上报按钮测试"
echo "  3. 查看服务器数据: ssh root@tb.vumstar.com 'ls -lt /var/www/html/api/report/icon/icon_reports/*.json | head -5'"
echo ""
echo "查看详细日志:"
echo "  ssh root@$OPENWRT_IP 'logread -f | grep REPORT_ICON'"
echo ""
