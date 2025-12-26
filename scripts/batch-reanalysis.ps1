# 批量重新分析合同脚本 (PowerShell版本)
#
# 功能：
# 1. 加载环境变量
# 2. 执行批量重新分析
# 3. 显示实时进度
#
# 使用方法：
# .\scripts\batch-reanalysis.ps1 [position]
#
# 参数：
# position - 可选，分析立场：party_a（甲方）| party_b（乙方）| neutral（中立，默认）
#
# 示例：
# .\scripts\batch-reanalysis.ps1 neutral
# .\scripts\batch-reanalysis.ps1 party_a
# .\scripts\batch-reanalysis.ps1 party_b

param(
    [Parameter(Position=0)]
    [ValidateSet('party_a', 'party_b', 'neutral')]
    [string]$Position = 'neutral'
)

# 加载环境变量
$envFile = '.env.production'
if (Test-Path $envFile) {
    Get-Content $envFile | ForEach-Object {
        if ($_ -match '^([^=]+)=(.*)$') {
            $name = $matches[1]
            $value = $matches[2]
            Set-Item -Path "env:$name" -Value $value
        }
    }
}

# 检查环境变量
if (-not $env:NEXT_PUBLIC_SUPABASE_URL -or -not $env:NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    Write-Host "❌ 错误：缺少环境变量" -ForegroundColor Red
    Write-Host "   请确保 .env.production 文件包含：" -ForegroundColor Yellow
    Write-Host "   - NEXT_PUBLIC_SUPABASE_URL" -ForegroundColor Yellow
    Write-Host "   - NEXT_PUBLIC_SUPABASE_ANON_KEY" -ForegroundColor Yellow
    exit 1
}

# 立场标签
$positionLabels = @{
    'party_a' = '甲方'
    'party_b' = '乙方'
    'neutral' = '中立'
}

Write-Host "`n🚀 开始批量重新分析合同（立场：$($positionLabels[$Position])）`n" -ForegroundColor Cyan

# 执行Node.js脚本
node scripts/batch-reanalysis.js $Position

# 检查执行结果
if ($LASTEXITCODE -eq 0) {
    Write-Host "`n✅ 批量分析脚本执行完成" -ForegroundColor Green
    Write-Host "`n💡 下一步：" -ForegroundColor Yellow
    Write-Host "   1. 访问 https://still-legal-ai.gocdn.dpdns.org/risks 查看分析结果" -ForegroundColor White
    Write-Host "   2. 如需查看详细日志，访问 Supabase Dashboard → Edge Functions → Logs" -ForegroundColor White
} else {
    Write-Host "`n❌ 批量分析脚本执行失败（错误代码：$LASTEXITCODE）" -ForegroundColor Red
    exit $LASTEXITCODE
}
