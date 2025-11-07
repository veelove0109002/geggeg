#!/bin/bash
# 修复 main.js 中的图标上报功能

cd "/Users/vee/Downloads/kkk 3 7 2 9 3/luci-app-uninstall/htdocs/luci-static/resources/view/uninstall"

# 恢复原始文件 (如果有 git)
git checkout main.js 2>/dev/null || echo "无 git,跳过恢复"

# 使用 Python 正确修复
python3 << 'PYEOF'
file_path = 'main.js'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 查找并替换 - 使用更精确的匹配
import re

# 匹配整个上报请求部分
pattern = r'''(\t\t\t\t// 发送上报请求\n)(\t\t\t\tvar token = \(L\.env && \(L\.env\.token \|\| L\.env\.csrf_token\)\) \|\| '';\n)(\t\t\t\tvar reportUrl = L\.url\('admin/vum/uninstall/report_icon'\) \+ \(token \? \('\?token=' \+ encodeURIComponent\(token\)\) : ''\);\n)(\t\t\t\tvar formBody = 'package=' \+ encodeURIComponent\(pkgName\) \+ '&comment=' \+ encodeURIComponent\(comment\);\n)(\t\t\t\t\n)(\t\t\t\tself\._httpJson\(reportUrl, \{\n)(\t\t\t\t\tmethod: 'POST',\n)(\t\t\t\t\theaders: \{ \n)(\t\t\t\t\t\t'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8', \n)(\t\t\t\t\t\t'Accept': 'application/json',\n)(\t\t\t\t\t\t'X-CSRF-Token': token\n)(\t\t\t\t\t\},\n)(\t\t\t\t\tbody: formBody\n)(\t\t\t\t\}\)\.then\(function\(res\)\{)'''

replacement = r'''\1\2\t\t\t\tvar reportUrl = L.url('admin/vum/uninstall/report_icon') + 
\t\t\t\t\t'?package=' + encodeURIComponent(pkgName) + 
\t\t\t\t\t'&comment=' + encodeURIComponent(comment) +
\t\t\t\t\t(token ? ('&token=' + encodeURIComponent(token)) : '');
\5\t\t\t\tself._httpJson(reportUrl, {
\t\t\t\t\tmethod: 'GET',
\t\t\t\t\theaders: { 
\t\t\t\t\t\t'Accept': 'application/json'
\t\t\t\t\t}
\15'''

new_content = re.sub(pattern, replacement, content, flags=re.MULTILINE)

if new_content != content:
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(new_content)
    print("✅ 修复成功!")
else:
    print("❌ 未找到匹配内容,可能已经修复过了")
PYEOF

echo ""
echo "验证修复结果:"
sed -n '1195,1210p' main.js
