<?php
/**
 * 上报接收端 - 支持图标问题和卸载问题
 * 通过 type 字段区分不同类型的上报
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST');
header('Access-Control-Allow-Headers: Content-Type');

// 数据存储根目录
$baseDir = __DIR__ . '/reports';
if (!is_dir($baseDir)) {
    mkdir($baseDir, 0755, true);
}

// 只处理 POST 请求
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    die(json_encode(['ok' => false, 'message' => 'Method not allowed']));
}

// 获取数据
$input = file_get_contents('php://input');
$data = json_decode($input, true) ?: $_POST;

// 提取字段
$package = $data['package'] ?? '';
$comment = $data['comment'] ?? '';
$downloadUrl = $data['download_url'] ?? '';
$type = $data['type'] ?? 'unknown';  // 关键字段：区分类型
$timestamp = $data['timestamp'] ?? time();
$deviceInfo = $data['device_info'] ?? [];

// 验证包名
if (empty($package)) {
    http_response_code(400);
    die(json_encode(['ok' => false, 'message' => '缺少包名参数']));
}

// 验证类型
if (!in_array($type, ['icon', 'uninstall'])) {
    http_response_code(400);
    die(json_encode(['ok' => false, 'message' => '无效的上报类型: ' . $type]));
}

// 根据类型创建不同的存储目录
$typeDir = $baseDir . '/' . $type;
if (!is_dir($typeDir)) {
    mkdir($typeDir, 0755, true);
}

// 构建完整的上报数据
$report = [
    'type' => $type,
    'package' => $package,
    'comment' => $comment,
    'download_url' => $downloadUrl,
    'timestamp' => $timestamp,
    'device_info' => $deviceInfo,
    'received_at' => date('Y-m-d H:i:s'),
    'ip' => $_SERVER['REMOTE_ADDR'] ?? 'unknown',
    'user_agent' => $_SERVER['HTTP_USER_AGENT'] ?? 'unknown'
];

// 保存为 JSON 文件（按类型分目录）
$filename = sprintf(
    '%s/%s_%s.json',
    $typeDir,
    date('Ymd_His'),
    preg_replace('/[^a-z0-9\-_]/i', '', $package)
);

file_put_contents($filename, json_encode($report, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));

// 记录到对应类型的日志文件
$logFile = $typeDir . '/reports.log';
$logLine = sprintf(
    "[%s] [%s] %s - %s - %s%s\n",
    date('Y-m-d H:i:s'),
    strtoupper($type),
    $_SERVER['REMOTE_ADDR'] ?? 'unknown',
    $package,
    $comment ?: '(无描述)',
    $downloadUrl ? ' | URL: ' . $downloadUrl : ''
);
file_put_contents($logFile, $logLine, FILE_APPEND);

// 记录到总日志（可选）
$masterLog = $baseDir . '/all_reports.log';
file_put_contents($masterLog, $logLine, FILE_APPEND);

// 统计数据（可选）
updateStats($baseDir, $type, $package);

// 返回成功
echo json_encode([
    'ok' => true,
    'success' => true,
    'message' => '上报成功',
    'type' => $type,
    'package' => $package
], JSON_UNESCAPED_UNICODE);

/**
 * 更新统计数据
 */
function updateStats($baseDir, $type, $package) {
    $statsFile = $baseDir . '/stats.json';
    
    // 读取现有统计
    $stats = [];
    if (file_exists($statsFile)) {
        $stats = json_decode(file_get_contents($statsFile), true) ?: [];
    }
    
    // 初始化结构
    if (!isset($stats['by_type'])) {
        $stats['by_type'] = ['icon' => 0, 'uninstall' => 0];
    }
    if (!isset($stats['by_package'])) {
        $stats['by_package'] = [];
    }
    if (!isset($stats['by_package'][$package])) {
        $stats['by_package'][$package] = ['icon' => 0, 'uninstall' => 0, 'total' => 0];
    }
    
    // 更新计数
    $stats['by_type'][$type]++;
    $stats['by_package'][$package][$type]++;
    $stats['by_package'][$package]['total']++;
    $stats['total'] = ($stats['total'] ?? 0) + 1;
    $stats['last_updated'] = date('Y-m-d H:i:s');
    
    // 保存统计
    file_put_contents($statsFile, json_encode($stats, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
}
?>