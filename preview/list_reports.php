<?php
/**
 * 列出所有上报记录 (供前端页面调用)
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');

$dataDir = __DIR__ . '/icon_reports';
$reports = [];

if (is_dir($dataDir)) {
    $files = glob($dataDir . '/*.json');
    
    if ($files) {
        // 按修改时间倒序排列
        usort($files, function($a, $b) {
            return filemtime($b) - filemtime($a);
        });
        
        // 读取前100条记录
        foreach (array_slice($files, 0, 100) as $file) {
            $content = file_get_contents($file);
            $data = json_decode($content, true);
            if ($data) {
                $reports[] = $data;
            }
        }
    }
}

echo json_encode([
    'ok' => true,
    'reports' => $reports,
    'total' => count($reports),
    'timestamp' => time()
], JSON_UNESCAPED_UNICODE);
