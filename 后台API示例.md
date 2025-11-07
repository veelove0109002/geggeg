# 图标上报后台 API 实现示例

## Node.js + Express 实现

### 1. 安装依赖

```bash
npm init -y
npm install express body-parser mongoose
```

### 2. 创建服务器 (server.js)

```javascript
const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');

const app = express();
const PORT = 3000;

// 中间件
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// 数据库连接 (可选)
// mongoose.connect('mongodb://localhost/icon_reports', {
//   useNewUrlParser: true,
//   useUnifiedTopology: true
// });

// 数据模型
const IconReport = mongoose.model('IconReport', new mongoose.Schema({
  package: { type: String, required: true, index: true },
  comment: String,
  timestamp: { type: Number, required: true },
  deviceInfo: {
    hostname: String,
    model: String,
    system: String
  },
  reportedAt: { type: Date, default: Date.now },
  status: { type: String, default: 'pending' }, // pending, resolved, ignored
  ipAddress: String,
  userAgent: String
}));

// 上报接收接口
app.post('/api/report/icon', async (req, res) => {
  try {
    const { package: pkgName, comment, timestamp, device_info } = req.body;
    
    // 验证必填字段
    if (!pkgName) {
      return res.status(400).json({
        ok: false,
        message: '缺少包名参数'
      });
    }

    // 记录客户端信息
    const clientIp = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'];

    // 保存到数据库
    const report = new IconReport({
      package: pkgName,
      comment: comment || '',
      timestamp: timestamp || Date.now(),
      deviceInfo: device_info || {},
      ipAddress: clientIp,
      userAgent: userAgent
    });

    await report.save();

    // 记录日志
    console.log(`[${new Date().toISOString()}] Icon report received:`, {
      package: pkgName,
      comment: comment,
      ip: clientIp
    });

    // 可选: 发送通知 (邮件、Webhook 等)
    // await sendNotification(report);

    // 返回成功响应
    res.json({
      ok: true,
      success: true,
      message: 'Report received successfully',
      report_id: report._id
    });

  } catch (error) {
    console.error('Error handling icon report:', error);
    res.status(500).json({
      ok: false,
      message: '服务器内部错误',
      error: error.message
    });
  }
});

// 查询上报记录接口 (管理员使用)
app.get('/api/reports', async (req, res) => {
  try {
    const { package: pkgName, status, limit = 50, skip = 0 } = req.query;
    
    const query = {};
    if (pkgName) query.package = pkgName;
    if (status) query.status = status;

    const reports = await IconReport
      .find(query)
      .sort({ reportedAt: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(skip));

    const total = await IconReport.countDocuments(query);

    res.json({
      ok: true,
      reports: reports,
      total: total,
      limit: parseInt(limit),
      skip: parseInt(skip)
    });

  } catch (error) {
    console.error('Error fetching reports:', error);
    res.status(500).json({
      ok: false,
      message: error.message
    });
  }
});

// 统计接口
app.get('/api/reports/stats', async (req, res) => {
  try {
    // 按包名统计
    const packageStats = await IconReport.aggregate([
      {
        $group: {
          _id: '$package',
          count: { $sum: 1 },
          latestReport: { $max: '$reportedAt' }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 20 }
    ]);

    // 按状态统计
    const statusStats = await IconReport.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    res.json({
      ok: true,
      byPackage: packageStats,
      byStatus: statusStats
    });

  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({
      ok: false,
      message: error.message
    });
  }
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`Icon Report API server running on port ${PORT}`);
  console.log(`POST /api/report/icon - 接收上报`);
  console.log(`GET  /api/reports - 查询上报记录`);
  console.log(`GET  /api/reports/stats - 统计数据`);
});
```

### 3. 启动服务

```bash
node server.js
```

## Python + Flask 实现

### 1. 安装依赖

```bash
pip install flask pymongo
```

### 2. 创建服务器 (app.py)

```python
from flask import Flask, request, jsonify
from datetime import datetime
from pymongo import MongoClient
import os

app = Flask(__name__)

# 数据库连接 (可选)
# client = MongoClient('mongodb://localhost:27017/')
# db = client['icon_reports']
# reports_collection = db['reports']

# 简单文件存储实现
REPORTS_DIR = 'reports'
os.makedirs(REPORTS_DIR, exist_ok=True)

@app.route('/api/report/icon', methods=['POST'])
def report_icon():
    try:
        # 获取请求数据
        data = request.get_json() if request.is_json else request.form.to_dict()
        
        package = data.get('package')
        comment = data.get('comment', '')
        timestamp = data.get('timestamp', int(datetime.now().timestamp()))
        device_info = data.get('device_info', {})
        
        # 验证必填字段
        if not package:
            return jsonify({
                'ok': False,
                'message': '缺少包名参数'
            }), 400
        
        # 构建上报记录
        report = {
            'package': package,
            'comment': comment,
            'timestamp': timestamp,
            'device_info': device_info,
            'reported_at': datetime.now().isoformat(),
            'ip_address': request.remote_addr,
            'user_agent': request.headers.get('User-Agent', '')
        }
        
        # 保存到文件 (或数据库)
        filename = f"{REPORTS_DIR}/{package}_{timestamp}.json"
        import json
        with open(filename, 'w', encoding='utf-8') as f:
            json.dump(report, f, ensure_ascii=False, indent=2)
        
        # 或保存到 MongoDB
        # reports_collection.insert_one(report)
        
        # 记录日志
        app.logger.info(f"Icon report received: {package} from {request.remote_addr}")
        
        return jsonify({
            'ok': True,
            'success': True,
            'message': 'Report received successfully',
            'package': package
        })
    
    except Exception as e:
        app.logger.error(f"Error handling icon report: {str(e)}")
        return jsonify({
            'ok': False,
            'message': '服务器内部错误',
            'error': str(e)
        }), 500

@app.route('/api/reports', methods=['GET'])
def get_reports():
    try:
        import json
        import glob
        
        # 从文件读取
        reports = []
        for filepath in sorted(glob.glob(f"{REPORTS_DIR}/*.json"), reverse=True)[:50]:
            with open(filepath, 'r', encoding='utf-8') as f:
                reports.append(json.load(f))
        
        return jsonify({
            'ok': True,
            'reports': reports,
            'total': len(reports)
        })
    
    except Exception as e:
        return jsonify({
            'ok': False,
            'message': str(e)
        }), 500

@app.route('/api/reports/stats', methods=['GET'])
def get_stats():
    try:
        import json
        import glob
        from collections import Counter
        
        packages = []
        for filepath in glob.glob(f"{REPORTS_DIR}/*.json"):
            with open(filepath, 'r', encoding='utf-8') as f:
                data = json.load(f)
                packages.append(data['package'])
        
        package_counts = Counter(packages)
        
        return jsonify({
            'ok': True,
            'total_reports': len(packages),
            'unique_packages': len(package_counts),
            'top_reported': [
                {'package': pkg, 'count': count}
                for pkg, count in package_counts.most_common(20)
            ]
        })
    
    except Exception as e:
        return jsonify({
            'ok': False,
            'message': str(e)
        }), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=3000, debug=True)
```

### 3. 启动服务

```bash
python app.py
```

## PHP 实现 (简单版)

### report_icon.php

```php
<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, GET');

// 数据目录
$reportsDir = __DIR__ . '/reports';
if (!is_dir($reportsDir)) {
    mkdir($reportsDir, 0755, true);
}

// 接收 POST 请求
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    // 获取 JSON 数据
    $input = file_get_contents('php://input');
    $data = json_decode($input, true);
    
    // 如果不是 JSON,尝试从 POST 获取
    if (!$data) {
        $data = $_POST;
    }
    
    $package = $data['package'] ?? '';
    $comment = $data['comment'] ?? '';
    $timestamp = $data['timestamp'] ?? time();
    $deviceInfo = $data['device_info'] ?? [];
    
    // 验证必填字段
    if (empty($package)) {
        http_response_code(400);
        echo json_encode([
            'ok' => false,
            'message' => '缺少包名参数'
        ]);
        exit;
    }
    
    // 构建上报记录
    $report = [
        'package' => $package,
        'comment' => $comment,
        'timestamp' => $timestamp,
        'device_info' => $deviceInfo,
        'reported_at' => date('Y-m-d H:i:s'),
        'ip_address' => $_SERVER['REMOTE_ADDR'] ?? '',
        'user_agent' => $_SERVER['HTTP_USER_AGENT'] ?? ''
    ];
    
    // 保存到文件
    $filename = sprintf(
        '%s/%s_%d.json',
        $reportsDir,
        preg_replace('/[^a-z0-9\-_]/', '', $package),
        $timestamp
    );
    
    file_put_contents($filename, json_encode($report, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
    
    // 记录到日志
    error_log("Icon report received: {$package} from {$_SERVER['REMOTE_ADDR']}");
    
    // 返回成功响应
    echo json_encode([
        'ok' => true,
        'success' => true,
        'message' => 'Report received successfully',
        'package' => $package
    ]);
    
} else {
    http_response_code(405);
    echo json_encode([
        'ok' => false,
        'message' => 'Method not allowed'
    ]);
}
?>
```

## Nginx 配置示例

```nginx
server {
    listen 80;
    server_name plugin.vumstar.com;

    # 上报接口
    location /api/report/icon {
        # 代理到 Node.js/Python 服务
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        
        # 或使用 PHP
        # fastcgi_pass unix:/var/run/php/php7.4-fpm.sock;
        # include fastcgi_params;
        # fastcgi_param SCRIPT_FILENAME /path/to/report_icon.php;
    }
}
```

## 数据库表结构 (MySQL/PostgreSQL)

```sql
CREATE TABLE icon_reports (
    id SERIAL PRIMARY KEY,
    package VARCHAR(255) NOT NULL,
    comment TEXT,
    timestamp BIGINT NOT NULL,
    hostname VARCHAR(255),
    model VARCHAR(255),
    system VARCHAR(255),
    ip_address VARCHAR(45),
    user_agent TEXT,
    status VARCHAR(20) DEFAULT 'pending',
    reported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_package (package),
    INDEX idx_status (status),
    INDEX idx_reported_at (reported_at)
);
```

## 通知集成示例

### 发送邮件通知

```javascript
const nodemailer = require('nodemailer');

async function sendNotification(report) {
  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    auth: {
      user: 'your-email@gmail.com',
      pass: 'your-password'
    }
  });

  await transporter.sendMail({
    from: 'noreply@vumstar.com',
    to: 'admin@vumstar.com',
    subject: `Icon Report: ${report.package}`,
    text: `
      Package: ${report.package}
      Comment: ${report.comment}
      Device: ${report.deviceInfo.model}
      IP: ${report.ipAddress}
      Time: ${new Date(report.reportedAt).toLocaleString()}
    `
  });
}
```

### 发送 Webhook 通知 (钉钉/企业微信)

```javascript
const axios = require('axios');

async function sendWebhook(report) {
  const webhookUrl = 'https://your-webhook-url';
  
  await axios.post(webhookUrl, {
    msgtype: 'markdown',
    markdown: {
      title: '图标问题上报',
      text: `
### 新的图标问题上报
- **包名**: ${report.package}
- **描述**: ${report.comment || '无'}
- **设备**: ${report.deviceInfo.model}
- **时间**: ${new Date(report.reportedAt).toLocaleString()}
      `
    }
  });
}
```

## 测试后台 API

```bash
# 使用 curl 测试
curl -X POST https://plugin.vumstar.com/api/report/icon \
  -H 'Content-Type: application/json' \
  -d '{
    "package": "luci-app-adguardhome",
    "comment": "图标显示模糊",
    "timestamp": 1704067200,
    "device_info": {
      "hostname": "OpenWrt",
      "model": "aarch64",
      "system": "Linux"
    }
  }'
```
