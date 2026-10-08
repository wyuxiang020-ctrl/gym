// 奥林匹克杠铃片配色:红25 / 蓝20 / 黄15 / 绿10 / 灰5
export function plateColorClass(weightKg: number): string | null {
  if (weightKg >= 25) return 'bg-plate-red'
  if (weightKg >= 20) return 'bg-plate-blue'
  if (weightKg >= 15) return 'bg-plate-yellow'
  if (weightKg >= 10) return 'bg-plate-green'
  if (weightKg > 0) return 'bg-plate-gray'
  return null
}
