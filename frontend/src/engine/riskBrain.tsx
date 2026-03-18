export interface RiskSnapshot {
  balance: number
  equity: number
  pnl: number
  drawdown: number
  positions: number
}

export interface RiskDecision {
  score: number
  level: "SAFE" | "WARNING" | "DANGER" | "LOCKED"
  reason: string
  killSwitch: boolean
}

export function evaluateRisk(data: RiskSnapshot): RiskDecision {
  let score = 100

  score -= Math.abs(data.drawdown) * 5
  score -= data.positions * 3
  score -= Math.abs(data.pnl) * 2

  if (score > 70) return { score, level: "SAFE", reason: "Stable", killSwitch: false }
  if (score > 40) return { score, level: "WARNING", reason: "Elevated risk", killSwitch: false }
  if (score > 20) return { score, level: "DANGER", reason: "Critical risk", killSwitch: false }

  return {
    score,
    level: "LOCKED",
    reason: "Max risk exceeded",
    killSwitch: true
  }
}

