#!/bin/bash
# 最终部署脚本 - 修复图标上报功能

ROUTER_IP="192.168.1.1"
ROUTER_USER="root"

echo "=========================================="
echo "部署图标上报修复 (GET 方法)"
echo "=========================================="

# 1. 上传修复后的文件
echo ""
echo "[1/6] 上传 Lua 控制器..."
scp luci-app-uninstall/luasrc/controller/uninstall.lua \
    ${ROUTER_USER}@${ROUTER_IP}:/usr/lib/lua/luci/controller/
echo "✅ Lua 控制器已上传"

echo ""
echo "[2/6] 上传 JavaScript 文件..."
scp luci-app-uninstall/htdocs/luci-static/resources/view/uninstall/main.js \
    ${ROUTER_USER}@${ROUTER_IP}:/www/luci-static/resources/view/uninstall/
echo "✅ JavaScript 文件已上传"

# 3. 设置权限
echo ""
echo "[3/6] 设置文件权限..."
ssh ${ROUTER_USER}@${ROUTER_IP} "chmod 644 /usr/lib/lua/luci/controller/uninstall.lua /www/luci-static/resources/view/uninstall/main.js"
echo "✅ 权限设置完成"

# 4. 清除缓存
echo ""
echo "[4/6] 清除所有缓存..."
ssh ${ROUTER_USER}@${ROUTER_IP} "rm -rf /tmp/luci-* /tmp/luci-indexcache* /tmp/luci-modulecache/*"
echo "✅ 缓存已清除"

# 5. 重启服务
echo ""
echo "[5/6] 重启 uhttpd 服务..."
ssh ${ROUTER_USER}@${ROUTER_IP} "/etc/init.d/uhttpd restart"
sleep 2
echo "✅ 服务已重启"

# 6. 测试
echo ""
echo "[6/6] 测试上报功能..."
ssh ${ROUTER_USER}@${ROUTER_IP} "curl -s 'http://localhost/cgi-bin/luci/admin/vum/uninstall/report_icon?package=luci-app-test&comment=测试' 2>&1"

echo ""
echo "=========================================="
echo "✅ 部署完成!"
echo "=========================================="
echo ""
echo "接下来请:"
echo "1. 清除浏览器缓存 (Ctrl+Shift+Delete)"
echo "2. 强制刷新页面 (Ctrl+F5)"
echo "3. 测试图标上报功能"
echo ""
echo "查看实时日志:"
echo "  ssh ${ROUTER_USER}@${ROUTER_IP} 'logread -f | grep REPORT_ICON'"
echo ""
