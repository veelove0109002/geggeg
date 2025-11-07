#!/bin/bash
#
# 图标上报功能诊断脚本
# 用于快速检查上报功能是否正常工作
#

echo "=========================================="
echo "  图标上报功能诊断工具"
echo "=========================================="
echo ""

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 配置
OPENWRT_IP="${1:-192.168.1.1}"
SERVER_URL="https://tb.vumstar.com/api/report/icon"
TEST_PACKAGE="luci-app-test-diagnostic"

echo "配置信息:"
echo "  OpenWrt IP: $OPENWRT_IP"
echo "  服务器地址: $SERVER_URL"
echo ""

# 1. 测试服务器接收端
echo "=========================================="
echo "1. 测试服务器接收端"
echo "=========================================="

echo -n "测试服务器连通性... "
if curl -s -o /dev/null -w "%{http_code}" --max-time 5 "$SERVER_URL" > /tmp/http_code.txt 2>&1; then
    HTTP_CODE=$(cat /tmp/http_code.txt)
    if [ "$HTTP_CODE" = "405" ] || [ "$HTTP_CODE" = "200" ]; then
        echo -e "${GREEN}✓ 服务器可访问 (HTTP $HTTP_CODE)${NC}"
    else
        echo -e "${YELLOW}⚠ 服务器返回 HTTP $HTTP_CODE${NC}"
    fi
else
    echo -e "${RED}✗ 服务器无法访问${NC}"
fi

echo -n "测试 POST 请求... "
RESPONSE=$(curl -s -X POST \
    -H 'Content-Type: application/json' \
    -d "{\"package\":\"$TEST_PACKAGE\",\"comment\":\"诊断测试 $(date '+%Y-%m-%d %H:%M:%S')\"}" \
    "$SERVER_URL" 2>&1)

if echo "$RESPONSE" | grep -q '"ok":true'; then
    echo -e "${GREEN}✓ POST 请求成功${NC}"
    echo "  响应: $RESPONSE" | head -c 100
    echo ""
else
    echo -e "${RED}✗ POST 请求失败${NC}"
    echo "  响应: $RESPONSE"
fi

echo ""

# 2. 测试 OpenWrt 设备
echo "=========================================="
echo "2. 测试 OpenWrt 设备"
echo "=========================================="

echo -n "测试 SSH 连接... "
if ssh -o ConnectTimeout=5 -o StrictHostKeyChecking=no root@$OPENWRT_IP "echo ok" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ SSH 连接成功${NC}"
else
    echo -e "${RED}✗ SSH 连接失败${NC}"
    echo "  请确保:"
    echo "  1. OpenWrt IP 地址正确: $OPENWRT_IP"
    echo "  2. SSH 服务已启动"
    echo "  3. 已配置 SSH 密钥或密码"
    exit 1
fi

echo -n "检查 curl 命令... "
if ssh root@$OPENWRT_IP "which curl" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ curl 已安装${NC}"
else
    echo -e "${YELLOW}⚠ curl 未安装，将尝试 wget${NC}"
fi

echo -n "检查网络连通性... "
if ssh root@$OPENWRT_IP "ping -c 1 -W 3 tb.vumstar.com" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ 可以访问服务器${NC}"
else
    echo -e "${RED}✗ 无法访问服务器${NC}"
    echo "  请检查 OpenWrt 的网络连接和 DNS 配置"
fi

echo ""

# 3. 测试上报接口
echo "=========================================="
echo "3. 测试 OpenWrt 上报接口"
echo "=========================================="

echo "发送测试上报请求..."
ssh root@$OPENWRT_IP "curl -X POST \
    'http://127.0.0.1/cgi-bin/luci/admin/vum/uninstall/report_icon' \
    -H 'Content-Type: application/x-www-form-urlencoded' \
    -d 'package=$TEST_PACKAGE&comment=诊断测试-$(date +%s)' \
    2>&1" > /tmp/openwrt_response.txt

echo "OpenWrt 响应:"
cat /tmp/openwrt_response.txt
echo ""

if grep -q '"ok":true' /tmp/openwrt_response.txt; then
    echo -e "${GREEN}✓ OpenWrt 接口返回成功${NC}"
else
    echo -e "${RED}✗ OpenWrt 接口返回失败${NC}"
fi

echo ""

# 4. 检查日志
echo "=========================================="
echo "4. 检查 OpenWrt 日志"
echo "=========================================="

echo "最近的 REPORT_ICON 日志:"
ssh root@$OPENWRT_IP "logread | grep REPORT_ICON | tail -10" 2>&1 || echo "  (无日志)"

echo ""

# 5. 检查临时文件
echo "=========================================="
echo "5. 检查临时文件"
echo "=========================================="

echo "临时文件列表:"
ssh root@$OPENWRT_IP "ls -lh /tmp/*icon_report* 2>/dev/null" || echo "  (无临时文件)"

echo ""
echo "请求数据 (/tmp/icon_report_data.json):"
ssh root@$OPENWRT_IP "cat /tmp/icon_report_data.json 2>/dev/null" || echo "  (文件不存在)"

echo ""
echo "响应数据 (/tmp/icon_report_response.txt):"
ssh root@$OPENWRT_IP "cat /tmp/icon_report_response.txt 2>/dev/null" || echo "  (文件不存在)"

echo ""

# 6. 检查服务器数据
echo "=========================================="
echo "6. 检查服务器接收到的数据"
echo "=========================================="

echo "查询最近的上报记录 (包含测试数据):"
REPORTS=$(curl -s "https://tb.vumstar.com/api/report/list_reports.php" 2>&1)

if echo "$REPORTS" | grep -q "$TEST_PACKAGE"; then
    echo -e "${GREEN}✓ 服务器已接收到测试数据${NC}"
    echo "$REPORTS" | grep "$TEST_PACKAGE" | head -3
else
    echo -e "${YELLOW}⚠ 服务器未找到测试数据${NC}"
    echo "  最近的上报记录:"
    echo "$REPORTS" | head -5
fi

echo ""

# 7. 总结
echo "=========================================="
echo "诊断总结"
echo "=========================================="

# 检查关键指标
SERVER_OK=false
OPENWRT_OK=false
DATA_RECEIVED=false

if echo "$RESPONSE" | grep -q '"ok":true'; then
    SERVER_OK=true
fi

if grep -q '"ok":true' /tmp/openwrt_response.txt 2>/dev/null; then
    OPENWRT_OK=true
fi

if echo "$REPORTS" | grep -q "$TEST_PACKAGE"; then
    DATA_RECEIVED=true
fi

echo "检查项目:"
echo -n "  [1] 服务器接收端: "
if [ "$SERVER_OK" = true ]; then
    echo -e "${GREEN}✓ 正常${NC}"
else
    echo -e "${RED}✗ 异常${NC}"
fi

echo -n "  [2] OpenWrt 上报接口: "
if [ "$OPENWRT_OK" = true ]; then
    echo -e "${GREEN}✓ 正常${NC}"
else
    echo -e "${RED}✗ 异常${NC}"
fi

echo -n "  [3] 数据传输: "
if [ "$DATA_RECEIVED" = true ]; then
    echo -e "${GREEN}✓ 正常${NC}"
else
    echo -e "${RED}✗ 异常${NC}"
fi

echo ""

if [ "$SERVER_OK" = true ] && [ "$OPENWRT_OK" = true ] && [ "$DATA_RECEIVED" = true ]; then
    echo -e "${GREEN}=========================================="
    echo "  ✓ 所有测试通过，功能正常！"
    echo "==========================================${NC}"
else
    echo -e "${RED}=========================================="
    echo "  ✗ 发现问题，请查看上述详细信息"
    echo "==========================================${NC}"
    echo ""
    echo "建议操作:"
    
    if [ "$SERVER_OK" = false ]; then
        echo "  1. 检查服务器配置和 PHP 文件部署"
        echo "     - 确认 report.php 已上传到正确位置"
        echo "     - 检查 Nginx 配置中的 URL 重写规则"
        echo "     - 查看 PHP 错误日志"
    fi
    
    if [ "$OPENWRT_OK" = false ]; then
        echo "  2. 检查 OpenWrt 配置"
        echo "     - 确认 uninstall.lua 已更新"
        echo "     - 清除 LuCI 缓存: rm -f /tmp/luci-*"
        echo "     - 重启 uhttpd: /etc/init.d/uhttpd reload"
    fi
    
    if [ "$DATA_RECEIVED" = false ]; then
        echo "  3. 检查网络连接"
        echo "     - 确认 OpenWrt 可以访问外网"
        echo "     - 检查防火墙规则"
        echo "     - 查看 OpenWrt 日志: logread | grep REPORT_ICON"
    fi
fi

echo ""
echo "详细文档: 图标上报问题修复说明.md"
echo ""

# 清理临时文件
rm -f /tmp/http_code.txt /tmp/openwrt_response.txt
