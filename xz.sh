#!/bin/sh
# OpenClash 完全卸载与清理脚本（无备份版，执行后自动删除自身）
# 用法：chmod +x ./uninstall-openclash.sh && sh ./uninstall-openclash.sh

set -e

echo "=== OpenClash 卸载脚本启动（无备份） ==="

# 函数：打印并容错执行
_do() {
  echo "+ $*"
  sh -c "$*" 2>/dev/null || true
}

echo "[1/6] 停止并禁用 OpenClash 服务"
if [ -x /etc/init.d/openclash ]; then
  _do "/etc/init.d/openclash stop"
  _do "/etc/init.d/openclash disable"
fi

echo "[2/6] 卸载 OpenClash 包（若已安装）"
_do "opkg update"
_do "opkg remove luci-i18n-openclash-zh-cn"
_do "opkg remove luci-app-openclash"
_do "opkg autoremove"

echo "[3/6] 删除配置、核心与所有残留文件（不可逆）"
# 配置与核心
_do "rm -rf /etc/openclash"
_do "rm -f /etc/config/openclash"
# LuCI 控制器/模型/视图
_do "rm -f /usr/lib/lua/luci/controller/openclash.lua"
_do "rm -rf /usr/lib/lua/luci/controller/openclash"
_do "rm -rf /usr/lib/lua/luci/model/cbi/openclash"
_do "rm -rf /usr/lib/lua/luci/view/openclash"
# 共享资源与可执行
_do "rm -rf /usr/share/openclash"
_do "rm -f /usr/bin/clash"
# 启动脚本与链接
_do "rm -f /etc/init.d/openclash"
_do "find /etc/rc.d -maxdepth 1 -type l -name '*openclash*' -exec rm -f {} +"
# UCI 默认脚本、热插拔钩子
_do "rm -f /etc/uci-defaults/*openclash*"
_do "find /etc/hotplug.d -type f -name '*openclash*' -exec rm -f {} +"
# 运行时与日志
_do "rm -rf /tmp/openclash* /var/run/openclash*"

echo "[4/6] 移除可能的计划任务"
if [ -f /etc/crontabs/root ]; then
  _do "sed -i '/openclash/d' /etc/crontabs/root"
  _do "/etc/init.d/cron reload"
fi

echo "[5/6] 刷新 LuCI 缓存并重载 Web/防火墙"
_do "rm -f /tmp/luci-indexcache"
_do "rm -rf /tmp/luci-modulecache/*"
if command -v luci-reload >/dev/null 2>&1; then
  _do "luci-reload"
fi
[ -x /etc/init.d/uhttpd ] && _do "/etc/init.d/uhttpd reload"
[ -x /etc/init.d/nginx ] && _do "/etc/init.d/nginx reload"
[ -x /etc/init.d/firewall ] && _do "/etc/init.d/firewall reload"

sync
echo "✓ OpenClash 已卸载并完成清理。若 LuCI 菜单仍缓存，请清空浏览器缓存或重新登录。"

# [6/6] 删除自身脚本
SCRIPT_PATH="$0"
case "$SCRIPT_PATH" in
  */* ) ;;
  *   ) # 若为相对/仅文件名，尝试从当前目录解析
        SCRIPT_PATH="./$SCRIPT_PATH"
        ;;
esac
_do "rm -f -- \"$SCRIPT_PATH\""

exit 0