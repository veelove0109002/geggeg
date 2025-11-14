<?php
/**
 * 上报记录查看页面 - 支持图标和卸载问题切换、状态管理
 */

$baseDir = __DIR__ . '/reports';

// 处理状态更新请求
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['action'])) {
    header('Content-Type: application/json');
    
    if ($_POST['action'] === 'update_status') {
        $reportId = $_POST['report_id'] ?? '';
        $status = $_POST['status'] ?? 'pending';
        $note = $_POST['note'] ?? '';
        
        if ($reportId && updateReportStatus($baseDir, $reportId, $status, $note)) {
            echo json_encode(['success' => true, 'message' => '状态更新成功']);
        } else {
            echo json_encode(['success' => false, 'message' => '状态更新失败']);
        }
        exit;
    }
}

// 获取查看类型（默认显示所有）
$viewType = $_GET['type'] ?? 'all';
$statusFilter = $_GET['status'] ?? 'all';
$validTypes = ['all', 'icon', 'uninstall'];
$validStatuses = ['all', 'pending', 'fixed', 'ignored'];

if (!in_array($viewType, $validTypes)) {
    $viewType = 'all';
}
if (!in_array($statusFilter, $validStatuses)) {
    $statusFilter = 'all';
}

// 读取数据
$reports = [];

if ($viewType === 'all') {
    // 读取所有类型
    foreach (['icon', 'uninstall'] as $type) {
        $typeDir = $baseDir . '/' . $type;
        if (is_dir($typeDir)) {
            $files = glob($typeDir . '/*.json');
            foreach ($files as $file) {
                $data = json_decode(file_get_contents($file), true);
                $data['_file'] = basename($file);
                $data['_filepath'] = $file;
                // 确保有状态字段
                if (!isset($data['status'])) {
                    $data['status'] = 'pending';
                }
                $reports[] = $data;
            }
        }
    }
} else {
    // 只读取指定类型
    $typeDir = $baseDir . '/' . $viewType;
    if (is_dir($typeDir)) {
        $files = glob($typeDir . '/*.json');
        foreach ($files as $file) {
            $data = json_decode(file_get_contents($file), true);
            $data['_file'] = basename($file);
            $data['_filepath'] = $file;
            if (!isset($data['status'])) {
                $data['status'] = 'pending';
            }
            $reports[] = $data;
        }
    }
}

// 按状态筛选
if ($statusFilter !== 'all') {
    $reports = array_filter($reports, fn($r) => ($r['status'] ?? 'pending') === $statusFilter);
}

// 按时间排序（最新的在前）
usort($reports, function($a, $b) {
    return strtotime($b['received_at']) - strtotime($a['received_at']);
});

// 限制显示数量
$reports = array_slice($reports, 0, 100);

// 统计数据
$totalCount = count($reports);
$iconCount = count(array_filter($reports, fn($r) => $r['type'] === 'icon'));
$uninstallCount = count(array_filter($reports, fn($r) => $r['type'] === 'uninstall'));
$pendingCount = count(array_filter($reports, fn($r) => ($r['status'] ?? 'pending') === 'pending'));
$fixedCount = count(array_filter($reports, fn($r) => ($r['status'] ?? 'pending') === 'fixed'));
$ignoredCount = count(array_filter($reports, fn($r) => ($r['status'] ?? 'pending') === 'ignored'));
$uniquePackages = count(array_unique(array_column($reports, 'package')));
$latestTime = $reports[0]['received_at'] ?? '-';

/**
 * 更新报告状态
 */
function updateReportStatus($baseDir, $reportId, $status, $note = '') {
    // 在所有类型目录中查找文件
    foreach (['icon', 'uninstall'] as $type) {
        $file = $baseDir . '/' . $type . '/' . $reportId;
        if (file_exists($file)) {
            $data = json_decode(file_get_contents($file), true);
            $data['status'] = $status;
            $data['status_updated_at'] = date('Y-m-d H:i:s');
            if ($note) {
                $data['status_note'] = $note;
            }
            return file_put_contents($file, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE)) !== false;
        }
    }
    return false;
}
?>
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>上报记录查看</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; background: #f5f5f5; padding: 20px; }
        .container { max-width: 1600px; margin: 0 auto; }
        
        /* 头部 */
        .header { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 20px; }
        h1 { color: #333; margin-bottom: 15px; font-size: 28px; }
        
        /* 类型切换标签 */
        .tabs { display: flex; gap: 10px; margin-bottom: 15px; flex-wrap: wrap; }
        .tab { 
            padding: 10px 20px; 
            background: #e5e7eb; 
            border: none; 
            border-radius: 6px; 
            cursor: pointer; 
            font-size: 14px; 
            font-weight: 600;
            text-decoration: none;
            color: #4b5563;
            transition: all 0.2s;
        }
        .tab:hover { background: #d1d5db; }
        .tab.active { background: #3b82f6; color: white; }
        .tab.icon.active { background: #ec4899; }
        .tab.uninstall.active { background: #f59e0b; }
        
        /* 状态筛选标签 */
        .status-tabs { display: flex; gap: 8px; margin-top: 10px; flex-wrap: wrap; }
        .status-tab { 
            padding: 6px 14px; 
            background: #f3f4f6; 
            border: 2px solid transparent;
            border-radius: 6px; 
            cursor: pointer; 
            font-size: 13px; 
            font-weight: 600;
            text-decoration: none;
            color: #6b7280;
            transition: all 0.2s;
        }
        .status-tab:hover { background: #e5e7eb; }
        .status-tab.active { border-color: #3b82f6; background: #eff6ff; color: #3b82f6; }
        .status-tab.pending.active { border-color: #f59e0b; background: #fffbeb; color: #f59e0b; }
        .status-tab.fixed.active { border-color: #10b981; background: #ecfdf5; color: #10b981; }
        .status-tab.ignored.active { border-color: #6b7280; background: #f9fafb; color: #6b7280; }
        
        /* 统计卡片 */
        .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 15px; margin-bottom: 20px; }
        .stat-card { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .stat-card h3 { font-size: 14px; color: #6b7280; margin-bottom: 8px; font-weight: 500; }
        .stat-card .value { font-size: 32px; font-weight: bold; color: #3b82f6; }
        .stat-card.icon .value { color: #ec4899; }
        .stat-card.uninstall .value { color: #f59e0b; }
        .stat-card.pending .value { color: #f59e0b; }
        .stat-card.fixed .value { color: #10b981; }
        .stat-card.ignored .value { color: #9ca3af; }
        
        /* 表格 */
        .table-container { background: white; border-radius: 8px; overflow-x: auto; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        table { width: 100%; border-collapse: collapse; min-width: 1200px; }
        th { 
            background: #f9fafb; 
            color: #374151; 
            padding: 14px 12px; 
            text-align: left; 
            font-weight: 600; 
            font-size: 13px;
            border-bottom: 2px solid #e5e7eb;
        }
        td { 
            padding: 14px 12px; 
            border-bottom: 1px solid #f3f4f6; 
            font-size: 14px;
        }
        tr:hover { background: #f9fafb; }
        tr:last-child td { border-bottom: none; }
        
        /* 类型标签 */
        .type-badge { 
            display: inline-block; 
            padding: 4px 10px; 
            border-radius: 12px; 
            font-size: 12px; 
            font-weight: 600;
        }
        .type-badge.icon { background: #fce7f3; color: #be185d; }
        .type-badge.uninstall { background: #fef3c7; color: #92400e; }
        
        /* 状态标签 */
        .status-badge { 
            display: inline-flex;
            align-items: center;
            gap: 4px;
            padding: 4px 10px; 
            border-radius: 12px; 
            font-size: 12px; 
            font-weight: 600;
        }
        .status-badge.pending { background: #fef3c7; color: #92400e; }
        .status-badge.fixed { background: #d1fae5; color: #065f46; }
        .status-badge.ignored { background: #f3f4f6; color: #6b7280; }
        
        /* 状态操作按钮 */
        .status-actions { display: flex; gap: 4px; }
        .status-btn { 
            padding: 4px 8px; 
            border: 1px solid #e5e7eb;
            background: white;
            border-radius: 4px; 
            cursor: pointer; 
            font-size: 11px;
            color: #6b7280;
            transition: all 0.2s;
        }
        .status-btn:hover { background: #f9fafb; border-color: #3b82f6; color: #3b82f6; }
        .status-btn.fixed:hover { border-color: #10b981; color: #10b981; }
        .status-btn.ignored:hover { border-color: #6b7280; color: #374151; }
        
        /* 其他样式 */
        .package { font-weight: 600; color: #1f2937; font-family: 'Courier New', monospace; }
        .comment { color: #6b7280; font-size: 13px; max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .comment.empty { color: #d1d5db; font-style: italic; }
        .time { color: #9ca3af; font-size: 12px; font-family: monospace; }
        .ip { font-family: 'Courier New', monospace; color: #6b7280; font-size: 12px; }
        .device-info { font-size: 12px; color: #6b7280; line-height: 1.5; }
        .download-link { 
            display: inline-flex; 
            align-items: center; 
            gap: 6px; 
            font-size: 13px; 
            color: #2563eb; 
            text-decoration: none;
            word-break: break-all;
        }
        .download-link svg {
            width: 16px;
            height: 16px;
        }
        .download-link:hover { text-decoration: underline; }
        .download-empty { color: #d1d5db; font-style: italic; font-size: 13px; }
        
        /* 空状态 */
        .empty-state { 
            text-align: center; 
            padding: 60px 20px; 
            color: #9ca3af; 
            background: white; 
            border-radius: 8px;
        }
        .empty-state svg { width: 64px; height: 64px; margin-bottom: 16px; opacity: 0.5; }
        
        /* 加载提示 */
        .toast { 
            position: fixed; 
            top: 20px; 
            right: 20px; 
            padding: 12px 20px; 
            background: #1f2937; 
            color: white; 
            border-radius: 6px; 
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            display: none;
            z-index: 1000;
        }
        .toast.show { display: block; animation: slideIn 0.3s; }
        @keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📋 上报记录查看</h1>
            
            <!-- 类型切换标签 -->
            <div class="tabs">
                <a href="?type=all&status=<?= $statusFilter ?>" class="tab <?= $viewType === 'all' ? 'active' : '' ?>">
                    全部 (<?= $iconCount + $uninstallCount ?>)
                </a>
                <a href="?type=icon&status=<?= $statusFilter ?>" class="tab icon <?= $viewType === 'icon' ? 'active' : '' ?>">
                    图标问题 (<?= $iconCount ?>)
                </a>
                <a href="?type=uninstall&status=<?= $statusFilter ?>" class="tab uninstall <?= $viewType === 'uninstall' ? 'active' : '' ?>">
                    卸载问题 (<?= $uninstallCount ?>)
                </a>
            </div>
            
            <!-- 状态筛选标签 -->
            <div class="status-tabs">
                <a href="?type=<?= $viewType ?>&status=all" class="status-tab <?= $statusFilter === 'all' ? 'active' : '' ?>">
                    全部状态
                </a>
                <a href="?type=<?= $viewType ?>&status=pending" class="status-tab pending <?= $statusFilter === 'pending' ? 'active' : '' ?>">
                    待处理 (<?= $pendingCount ?>)
                </a>
                <a href="?type=<?= $viewType ?>&status=fixed" class="status-tab fixed <?= $statusFilter === 'fixed' ? 'active' : '' ?>">
                    已修复 (<?= $fixedCount ?>)
                </a>
                <a href="?type=<?= $viewType ?>&status=ignored" class="status-tab ignored <?= $statusFilter === 'ignored' ? 'active' : '' ?>">
                    已忽略 (<?= $ignoredCount ?>)
                </a>
            </div>
        </div>
        
        <!-- 统计卡片 -->
        <div class="stats">
            <div class="stat-card">
                <h3>当前显示</h3>
                <div class="value"><?= $totalCount ?></div>
            </div>
            <?php if ($viewType === 'all'): ?>
            <div class="stat-card icon">
                <h3>图标问题</h3>
                <div class="value"><?= $iconCount ?></div>
            </div>
            <div class="stat-card uninstall">
                <h3>卸载问题</h3>
                <div class="value"><?= $uninstallCount ?></div>
            </div>
            <?php endif; ?>
            <div class="stat-card pending">
                <h3>待处理</h3>
                <div class="value"><?= $pendingCount ?></div>
            </div>
            <div class="stat-card fixed">
                <h3>已修复</h3>
                <div class="value"><?= $fixedCount ?></div>
            </div>
            <div class="stat-card ignored">
                <h3>已忽略</h3>
                <div class="value"><?= $ignoredCount ?></div>
            </div>
            <div class="stat-card">
                <h3>独立应用</h3>
                <div class="value"><?= $uniquePackages ?></div>
            </div>
        </div>
        
        <!-- 数据表格 -->
        <?php if (empty($reports)): ?>
        <div class="empty-state">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"></path>
            </svg>
            <p style="font-size: 16px; margin-bottom: 8px;">暂无数据</p>
            <p style="font-size: 14px;">还没有收到任何上报记录</p>
        </div>
        <?php else: ?>
        <div class="table-container">
            <table>
                <thead>
                    <tr>
                        <th style="width: 70px;">类型</th>
                        <th style="width: 90px;">状态</th>
                        <th style="width: 130px;">时间</th>
                        <th style="width: 180px;">包名</th>
                        <th>问题描述</th>
                        <th style="width: 220px;">软件下载地址</th>
                        <th style="width: 150px;">设备信息</th>
                        <th style="width: 110px;">IP</th>
                        <th style="width: 180px;">操作</th>
                    </tr>
                </thead>
                <tbody>
                    <?php foreach ($reports as $r): ?>
                    <tr data-report-id="<?= htmlspecialchars($r['_file']) ?>">
                        <td>
                            <span class="type-badge <?= $r['type'] ?>">
                                <?= $r['type'] === 'icon' ? '图标' : '卸载' ?>
                            </span>
                        </td>
                        <td>
                            <span class="status-badge <?= $r['status'] ?? 'pending' ?>">
                                <?php 
                                $statusText = [
                                    'pending' => '⏳ 待处理',
                                    'fixed' => '✅ 已修复',
                                    'ignored' => '🚫 已忽略'
                                ];
                                echo $statusText[$r['status'] ?? 'pending'];
                                ?>
                            </span>
                        </td>
                        <td class="time"><?= $r['received_at'] ?></td>
                        <td class="package"><?= htmlspecialchars($r['package']) ?></td>
                        <td>
                            <div class="comment <?= empty($r['comment']) ? 'empty' : '' ?>" title="<?= htmlspecialchars($r['comment']) ?>">
                                <?= htmlspecialchars($r['comment'] ?: '(无描述)') ?>
                            </div>
                            <?php if (!empty($r['status_note'])): ?>
                            <div style="font-size: 11px; color: #9ca3af; margin-top: 4px;">
                                备注: <?= htmlspecialchars($r['status_note']) ?>
                            </div>
                            <?php endif; ?>
                        </td>
                        <td>
                            <?php if (!empty($r['download_url'])): ?>
                                <a class="download-link" href="<?= htmlspecialchars($r['download_url']) ?>" target="_blank" rel="noopener">
                                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5m0 0l5-5m-5 5V4"/></svg>
                                    <?= htmlspecialchars($r['download_url']) ?>
                                </a>
                            <?php else: ?>
                                <span class="download-empty">(未提供)</span>
                            <?php endif; ?>
                        </td>
                        <td class="device-info">
                            <?= htmlspecialchars($r['device_info']['model'] ?? '-') ?><br>
                            <?= htmlspecialchars($r['device_info']['hostname'] ?? '-') ?>
                        </td>
                        <td class="ip"><?= htmlspecialchars($r['ip']) ?></td>
                        <td>
                            <div class="status-actions">
                                <?php if (($r['status'] ?? 'pending') !== 'fixed'): ?>
                                <button class="status-btn fixed" onclick="updateStatus('<?= htmlspecialchars($r['_file']) ?>', 'fixed')">
                                    ✓ 已修复
                                </button>
                                <?php endif; ?>
                                <?php if (($r['status'] ?? 'pending') !== 'pending'): ?>
                                <button class="status-btn" onclick="updateStatus('<?= htmlspecialchars($r['_file']) ?>', 'pending')">
                                    ↺ 待处理
                                </button>
                                <?php endif; ?>
                                <?php if (($r['status'] ?? 'pending') !== 'ignored'): ?>
                                <button class="status-btn ignored" onclick="updateStatus('<?= htmlspecialchars($r['_file']) ?>', 'ignored')">
                                    ✕ 忽略
                                </button>
                                <?php endif; ?>
                            </div>
                        </td>
                    </tr>
                    <?php endforeach; ?>
                </tbody>
            </table>
        </div>
        <?php endif; ?>
        
        <p style="text-align: center; color: #9ca3af; font-size: 13px; margin-top: 20px;">
            显示最近 100 条记录 | 
            <a href="stats.php" style="color: #3b82f6; text-decoration: none;">查看统计数据</a>
        </p>
    </div>
    
    <!-- Toast 提示 -->
    <div id="toast" class="toast"></div>
    
    <script>
    function updateStatus(reportId, status) {
        const note = status === 'fixed' ? prompt('请输入修复说明（可选）:') : 
                     status === 'ignored' ? prompt('请输入忽略原因（可选）:') : '';
        
        if (status === 'fixed' && note === null) return; // 用户取消
        if (status === 'ignored' && note === null) return;
        
        const formData = new FormData();
        formData.append('action', 'update_status');
        formData.append('report_id', reportId);
        formData.append('status', status);
        formData.append('note', note || '');
        
        fetch(window.location.href, {
            method: 'POST',
            body: formData
        })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                showToast('状态更新成功', 'success');
                setTimeout(() => location.reload(), 800);
            } else {
                showToast('状态更新失败: ' + data.message, 'error');
            }
        })
        .catch(err => {
            showToast('网络错误: ' + err.message, 'error');
        });
    }
    
    function showToast(message, type = 'info') {
        const toast = document.getElementById('toast');
        toast.textContent = message;
        toast.className = 'toast show';
        setTimeout(() => {
            toast.className = 'toast';
        }, 3000);
    }
    </script>
</body>