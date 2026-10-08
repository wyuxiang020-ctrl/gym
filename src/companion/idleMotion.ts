export const IDLE_DURATION = 6000

function smooth(value: number) {
  const x = Math.max(0, Math.min(1, value))
  return x * x * x * (x * (x * 6 - 15) + 10)
}

function pulse(t: number, start: number, peak: number, release: number, end: number) {
  if (t <= start || t >= end) return 0
  if (t < peak) return smooth((t - start) / (peak - start))
  if (t <= release) return 1
  return 1 - smooth((t - release) / (end - release))
}

export function idlePose(milliseconds: number) {
  const t = Math.max(0, Math.min(IDLE_DURATION, milliseconds)) / 1000
  const breath = (delay: number) => pulse(t - delay, 0.25, 1.70, 2.00, 5.10)
  return {
    chest: breath(0), head: breath(0.13), leftPaw: breath(0.23), rightPaw: breath(0.18), ribbon: breath(0.36),
    nod: pulse(t, 2.12, 2.43, 2.66, 3.50),
    blink: pulse(t, 2.24, 2.34, 2.40, 2.56),
  }
}

export type IdlePose = ReturnType<typeof idlePose>

function region(x: number, y: number, cx: number, cy: number, rx: number, ry: number) {
  return Math.exp(-2 * (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2))
}

export function deformOriginal(x: number, y: number, pose: IdlePose): [number, number] {
  // Foot contact is an exact constraint. A connected texture avoids inventing hidden pixels at joints.
  if (y >= 422) return [x, y]
  const anchored = 1 - smooth((y - 365) / 57)
  const headWeight = 1 - smooth((y - 207) / 43)
  let bodyX = x + (x - 195) * 0.016 * pose.chest * anchored
  let bodyY = y - 4.4 * pose.chest * (1 - smooth((y - 285) / 137))
  const left = region(x, y, 51, 297, 49, 81) * (1 - headWeight) * anchored
  const right = region(x, y, 307, 302, 53, 83) * (1 - headWeight) * anchored
  bodyX += left * (-2.3 * pose.leftPaw) + right * (2.0 * pose.rightPaw)
  bodyY += left * (2.6 * pose.leftPaw) + right * (2.3 * pose.rightPaw)
  const ribbon = region(x, y, 337, 339, 25, 36) * anchored
  const ribbonAngle = (pose.ribbon - pose.chest * 0.6) * 0.055
  bodyX += -(y - 324) * ribbonAngle * ribbon
  bodyY += (x - 332) * ribbonAngle * ribbon
  const angle = (0.45 * pose.head - 0.80 * pose.nod) * Math.PI / 180
  const dx = x - 198, dy = y - 190
  const headX = 198 + dx * Math.cos(angle) - dy * Math.sin(angle) + 0.7 * pose.head
  const headY = 190 + dx * Math.sin(angle) + dy * Math.cos(angle) - 5.2 * pose.head + 1.1 * pose.nod
  return [bodyX * (1 - headWeight) + headX * headWeight, bodyY * (1 - headWeight) + headY * headWeight]
}
