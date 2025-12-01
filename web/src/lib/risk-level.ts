export type RiskLevel = 'high' | 'medium' | 'low';

export const RISK_LEVEL_LABELS: Record<RiskLevel, string> = {
  high: '高风险',
  medium: '中风险',
  low: '低风险',
};

export const RISK_LEVEL_ALIASES: Record<RiskLevel, string[]> = {
  high: ['high', 'High', 'HIGH', 'critical', 'Critical', 'CRITICAL', 'very high', 'Very High', 'very-high', '高', '高风险', '高危', '特高', '高等'],
  medium: ['medium', 'Medium', 'MEDIUM', 'moderate', 'Moderate', '适中', '中', '中风险', '中等', '一般', '普通'],
  low: ['low', 'Low', 'LOW', 'minor', 'Minor', '轻微', '低', '低风险', '较低', '轻度'],
};

export function getRiskLevelAliases(level: RiskLevel): string[] {
  return Array.from(new Set([level, ...RISK_LEVEL_ALIASES[level]]));
}

export function normalizeRiskLevel(value?: string | null): RiskLevel | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const lowered = trimmed.toLowerCase();

  for (const level of Object.keys(RISK_LEVEL_ALIASES) as RiskLevel[]) {
    if (getRiskLevelAliases(level).some((alias) => alias.toLowerCase() === lowered)) {
      return level;
    }
  }

  if (trimmed.includes('高')) return 'high';
  if (trimmed.includes('中')) return 'medium';
  if (trimmed.includes('低') || trimmed.includes('轻')) return 'low';
  return null;
}
