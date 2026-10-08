export type ActionId = 'encourage' | 'hat' | 'stretch'
type Key = readonly [number, number]
type Point = [number, number]

export const ACTIONS = [
  { id: 'encourage', title: '点头鼓励', duration: 3000, description: '先注意你，再轻重点头；胸口和前爪稍晚回应。', source: 'D2-character-accessories.png', crop: [50, 140, 390, 475], scale: 1, offset: [45, 42], footY: 422, texture: 'gentle/stand-original.svg', shadow: 'gentle/ground-original.svg', checkpoints: [['准备', 480], ['点头', 960], ['收稳', 2250]] },
  { id: 'hat', title: '扶帽致意', duration: 3600, description: '扶住帽檐，微微前倾致意，再抬头收稳。', source: 'D2-character-accessories.png', crop: [530, 135, 420, 480], scale: 1, offset: [30, 37], footY: 431, texture: 'actions/hat-original.svg', shadow: 'actions/hat-ground.svg', checkpoints: [['准备', 480], ['致意', 1380], ['收稳', 2840]] },
  { id: 'stretch', title: '轻轻伸展', duration: 5000, description: '双爪与胸腹慢慢舒展，稍停一会，再呼气放松。', source: 'D2-key-poses.png', crop: [405, 540, 355, 345], scale: 1.22, offset: [23.45, 96.6], footY: 306, texture: 'actions/stretch-original.svg', shadow: 'actions/stretch-ground.svg', checkpoints: [['准备', 650], ['舒展', 2260], ['放松', 3960]] },
] as const

export function actionDefinition(id: ActionId) { return ACTIONS.find(action => action.id === id)! }

function smooth(value: number) { const x = Math.max(0, Math.min(1, value)); return x * x * x * (x * (x * 6 - 15) + 10) }
function track(t: number, keys: readonly Key[]) {
  if (t <= keys[0][0]) return keys[0][1]
  for (let i = 1; i < keys.length; i++) {
    if (t <= keys[i][0]) { const [a, b] = keys[i - 1], [c, d] = keys[i]; return b + (d - b) * smooth((t - a) / (c - a)) }
  }
  return keys[keys.length - 1][1]
}
function weight(value: number, start: number, end: number) { return 1 - smooth((value - start) / (end - start)) }
function region(x: number, y: number, cx: number, cy: number, rx: number, ry: number) { return Math.exp(-2 * (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2)) }
function rotate(x: number, y: number, cx: number, cy: number, degrees: number): Point {
  const a = degrees * Math.PI / 180, dx = x - cx, dy = y - cy
  return [cx + dx * Math.cos(a) - dy * Math.sin(a), cy + dx * Math.sin(a) + dy * Math.cos(a)]
}
function mix(a: Point, b: Point, weight: number): Point { return [a[0] * (1 - weight) + b[0] * weight, a[1] * (1 - weight) + b[1] * weight] }

export function actionPose(id: ActionId, milliseconds: number) {
  const t = Math.max(0, Math.min(actionDefinition(id).duration, milliseconds)) / 1000
  if (id === 'encourage') {
    const gesture = (delay: number) => track(t - delay, [[0, 0], [.25, 0], [.48, -.28], [.93, 1], [1.13, .91], [1.52, -.12], [1.85, .25], [2.55, 0], [3, 0]])
    return { main: gesture(0), body: gesture(.10), paw: gesture(.17), follow: gesture(.24), blink: track(t, [[0, 0], [.78, 0], [.89, 1], [.96, 1], [1.12, 0], [3, 0]]) }
  }
  if (id === 'hat') {
    const gesture = (delay: number) => track(t - delay, [[0, 0], [.20, 0], [.49, -.16], [1.16, 1], [1.54, 1], [2.20, -.10], [2.64, .05], [3.12, 0], [3.60, 0]])
    return { main: gesture(.05), body: gesture(0), paw: gesture(.13), follow: gesture(.24), blink: 0 }
  }
  const gesture = (delay: number) => track(t - delay, [[0, 0], [.22, 0], [.66, -.24], [1.80, 1], [2.65, 1], [3.96, -.09], [4.63, 0], [5, 0]])
  return { main: gesture(.10), body: gesture(0), paw: gesture(.15), follow: gesture(.26), blink: 0 }
}

export type ActionPose = ReturnType<typeof actionPose>

export function deformAction(id: ActionId, x: number, y: number, pose: ActionPose): Point {
  const def = actionDefinition(id)
  if (y >= def.footY) return [x, y]
  if (id === 'encourage') {
    const pin = weight(y, 352, 422), face = weight(y, 232, 285)
    const body: Point = [x + (x - 195) * .012 * pose.body * pin, y + 6 * pose.body * weight(y, 290, 422)]
    const left = region(x, y, 51, 297, 49, 81) * (1 - face) * pin
    const right = region(x, y, 307, 302, 53, 83) * (1 - face) * pin
    body[0] += -3 * pose.paw * left + 3.5 * pose.paw * right
    body[1] -= 5 * pose.paw * (left + right)
    const head = rotate(x, y, 198, 190, 2.7 * pose.main)
    head[0] += 1.8 * pose.main; head[1] += 15 * pose.main
    const result = mix(body, head, face)
    const ribbon = region(x, y, 337, 339, 25, 36) * pin
    result[0] -= (y - 324) * .07 * (pose.follow - pose.body * .5) * ribbon
    return result
  }
  if (id === 'hat') {
    const pin = weight(y, 365, 431)
    // Head, hat and contacting paw share one rigid region, preserving the source contact.
    const upper = weight(y, 252, 316)
    const body: Point = [x + 6 * pose.body * pin + (x - 215) * .016 * pose.body * pin, y + 12 * pose.body * weight(y, 300, 431)]
    const head = rotate(x, y, 216, 240, 3.5 * pose.main)
    head[0] += 7 * pose.main; head[1] += 15 * pose.main
    const result = mix(body, head, upper)
    const paw = region(x, y, 305, 347, 51, 53) * (1 - upper) * pin
    result[0] -= 3 * pose.paw * paw; result[1] -= 4 * pose.paw * paw
    const ribbon = region(x, y, 370, 365, 23, 36) * pin
    result[0] -= (y - 344) * .09 * (pose.follow - pose.body * .6) * ribbon
    return result
  }
  const pin = weight(y, 268, 306)
  // A broad upper-body region keeps the complete head and both ears rigid.
  const face = weight(y, 178, 239)
  const body: Point = [x - (x - 176) * .022 * pose.body * pin - 6 * pose.body * pin, y - 12 * pose.body * weight(y, 218, 306)]
  const head = rotate(x, y, 175, 168, -3 * pose.main)
  head[0] -= 7 * pose.main; head[1] -= 14 * pose.main
  const result = mix(body, head, face)
  // Keep the extra paw motion outside the face; interpolate across the forearm, not the cheek.
  const left = region(x, y, 42, 98, 65, 90) * weight(x, 47, 89)
  const right = region(x, y, 316, 115, 61, 72) * (1 - weight(x, 276, 317))
  const l = rotate(x, y, 100, 189, 5 * pose.paw)
  const r = rotate(x, y, 248, 186, -6 * pose.paw)
  result[0] += (l[0] - x) * left + (r[0] - x) * right
  result[1] += (l[1] - y) * left + (r[1] - y) * right
  const ribbon = region(x, y, 292, 145, 23, 32) * (1 - weight(x, 280, 301))
  result[0] -= (y - 126) * .075 * (pose.follow - pose.paw * .5) * ribbon
  return result
}

export function actionPhase(id: ActionId, milliseconds: number) {
  const fraction = milliseconds / actionDefinition(id).duration
  if (fraction < .06 || fraction > .96) return '原画姿势'
  if (fraction < .24) return id === 'stretch' ? '站稳 · 轻轻蓄势' : '注意到你 · 准备'
  if (fraction < .56) return id === 'encourage' ? '轻重点头 · 前爪回应' : id === 'hat' ? '扶住帽檐 · 前倾致意' : '胸腹打开 · 双爪舒展'
  return id === 'stretch' ? '呼气 · 慢慢放松' : '头爪跟随 · 轻轻收稳'
}
