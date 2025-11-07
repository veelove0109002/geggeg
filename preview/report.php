<?php
/**
 * 图标上报接收端 - 超简单版本
 * 部署说明: 上传到服务器 /api/report/ 目录即可
 * 访问地址: https://你的域名/api/report/report.php
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// 处理预检请求
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// 数据存储目录
$dataDir = __DIR__ . '/icon_reports';
if (!is_dir($dataDir)) {
    mkdir($dataDir, 0755, true);
}

// 只处理 POST 请求
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    die(json_encode([
        'ok' => false,
        'message' => 'Method not allowed. Please use POST.'
    ]));
}

// 获取请求数据
$input = file_get_contents('php://input');
$data = json_decode($input, true);

// 如果不是 JSON,尝试从 POST 表单获取
if (!$data) {
    $data = $_POST;
}

// 提取字段
$package = $data['package'] ?? '';
$comment = $data['comment'] ?? '';
$timestamp = $data['timestamp'] ?? time();
$deviceInfo = $data['device_info'] ?? [];

// 验证必填字段
if (empty($package)) {
    http_response_code(400);
    die(json_encode([
        'ok' => false,
        'message' => '缺少包名参数 (package is required)'
    ]));
}

// 构建上报记录
$report = [
    'package' => $package,
    'comment' => $comment,
    'timestamp' => $timestamp,
    'device_info' => $deviceInfo,
    'received_at' => date('Y-m-d H:i:s'),
    'received_timestamp' => time(),
    'ip' => $_SERVER['REMOTE_ADDR'] ?? 'unknown',
    'user_agent' => $_SERVER['HTTP_USER_AGENT'] ?? ''
];

// 生成文件名
$safePackageName = preg_replace('/[^a-z0-9\-_]/i', '', $package);
$filename = sprintf(
    '%s/%s_%s_%d.json',
    $dataDir,
    date('Ymd_His'),
    $safePackageName,
    rand(1000, 9999)
);

// 保存 JSON 文件
$saved = file_put_contents(
    $filename,
    json_encode($report, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE)
);

if (!$saved) {
    http_response_code(500);
    die(json_encode([
        'ok' => false,
        'message' => 'Failed to save report'
    ]));
}

// 记录到汇总日志
$logFile = $dataDir . '/reports.log';
$logLine = sprintf(
    "[%s] IP:%s | Package:%s | Comment:%s\n",
    date('Y-m-d H:i:s'),
    $_SERVER['REMOTE_ADDR'] ?? 'unknown',
    $package,
    $comment ?: '(无描述)'
);
file_put_contents($logFile, $logLine, FILE_APPEND);

// 返回成功响应
echo json_encode([
    'ok' => true,
    'success' => true,
    'message' => '图标问题已成功上报,感谢您的反馈!',
    'package' => $package,
    'report_id' => basename($filename, '.json')
], JSON_UNESCAPED_UNICODE);
