#!/usr/bin/env python3
# 修复图标上报功能 - 将 POST 改为 GET 请求

import re

file_path = 'luci-app-uninstall/htdocs/luci-static/resources/view/uninstall/main.js'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 查找并替换上报请求部分
old_pattern = r'''(\t\t\t\t// 发送上报请求\n\t\t\t\tvar token = \(L\.env && \(L\.env\.token \|\| L\.env\.csrf_token\)\) \|\| '';\n\t\t\t\tvar reportUrl = L\.url\('admin/vum/uninstall/report_icon'\) \+ \(token \? \('\?token=' \+ encodeURIComponent\(token\)\) : ''\);\n\t\t\t\tvar formBody = 'package=' \+ encodeURIComponent\(pkgName\) \+ '&comment=' \+ encodeURIComponent\(comment\);\n\t\t\t\t\n\t\t\t\tself\._httpJson\(reportUrl, \{\n\t\t\t\t\tmethod: 'POST',\n\t\t\t\t\theaders: \{ \n\t\t\t\t\t\t'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8', \n\t\t\t\t\t\t'Accept': 'application/json',\n\t\t\t\t\t\t'X-CSRF-Token': token\n\t\t\t\t\t\},\n\t\t\t\t\tbody: formBody\n\t\t\t\t\}\)\.then\(function\(res\)\{)'''

new_code = '''\t\t\t\t// 发送上报请求 - 使用 GET 方法 + URL 参数(更兼容)
\t\t\t\tvar token = (L.env && (L.env.token || L.env.csrf_token)) || '';
\t\t\t\tvar reportUrl = L.url('admin/vum/uninstall/report_icon') + 
\t\t\t\t\t'?package=' + encodeURIComponent(pkgName) + 
\t\t\t\t\t'&comment=' + encodeURIComponent(comment) +
\t\t\t\t\t(token ? ('&token=' + encodeURIComponent(token)) : '');
\t\t\t\t
\t\t\t\tself._httpJson(reportUrl, {
\t\t\t\t\tmethod: 'GET',
\t\t\t\t\theaders: { 
\t\t\t\t\t\t'Accept': 'application/json'
\t\t\t\t\t}
\t\t\t\t}).then(function(res){'''

content = re.sub(old_pattern, new_code, content)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("✅ 修复完成!")
