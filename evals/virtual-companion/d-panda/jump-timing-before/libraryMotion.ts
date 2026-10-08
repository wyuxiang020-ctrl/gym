import { actionPose, deformAction } from './actionMotion'
import { deformOriginal, idlePose } from './idleMotion'
import type { Clip } from './companionCatalog'

type Point = [number, number]
type Key = readonly [number, number]
const smooth = (n: number) => { const x = Math.max(0, Math.min(1, n)); return x * x * x * (x * (x * 6 - 15) + 10) }
const above = (n: number, a: number, b: number) => 1 - smooth((n - a) / (b - a))
function track(t: number, keys: readonly Key[]) {
  if (t <= keys[0][0]) return keys[0][1]
  for (let i = 1; i < keys.length; i++) if (t <= keys[i][0]) {
    const [a, v] = keys[i - 1], [b, w] = keys[i]
    return v + (w - v) * smooth((t - a) / (b - a))
  }
  return keys[keys.length - 1][1]
}
const rotate = (x: number, y: number, cx: number, cy: number, degrees: number): Point => {
  const a = degrees * Math.PI / 180
  return [cx + (x - cx) * Math.cos(a) - (y - cy) * Math.sin(a), cy + (x - cx) * Math.sin(a) + (y - cy) * Math.cos(a)]
}
const blend = (a: Point, b: Point, w: number): Point => [a[0] * (1 - w) + b[0] * w, a[1] * (1 - w) + b[1] * w]
const region = (x: number, y: number, cx: number, cy: number, rx: number, ry: number) => Math.exp(-2 * (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2))

export function librarySample(clip: Clip, milliseconds: number, reduced = false) {
  const amount = reduced ? .28 : 1
  const t = Math.max(0, Math.min(milliseconds, clip.duration)) / 1000
  if (clip.motion === 'idle') {
    const pose = idlePose(milliseconds)
    return { blink: reduced ? 0 : pose.blink, lift: 0, deform: (x: number, y: number): Point => blend([x, y], deformOriginal(x, y, pose), amount) }
  }
  if (clip.motion === 'encourage' || clip.motion === 'hat' || clip.motion === 'stretch') {
    const id = clip.motion, pose = actionPose(id, milliseconds)
    return { blink: pose.blink, lift: 0, deform: (x: number, y: number): Point => blend([x, y], deformAction(id, x, y, pose), amount) }
  }
  const d = clip.duration / 1000
  const gesture = (delay = 0) => track(t - delay, [[0, 0], [.15 * d, -.10], [.36 * d, 1], [.46 * d, 1], [.82 * d, 0], [d, 0]]) * amount
  const main = gesture(), follow = gesture(.12), tail = gesture(.23)
  const wave = track(t, [[0, 0], [.40, -.12], [1.08, 1], [1.55, -.45], [2.12, .85], [2.60, -.22], [3.35, 0], [4.30, 0]]) * amount
  const jumpCompress = track(t, [[0, 0], [.25, 0], [.81, 1], [1.08, -.8], [1.50, -.6], [1.90, -.25], [2.14, 1.25], [2.95, 0], [3.3, 0]]) * amount
  const flightProgress = (t - 1.08) / .82
  // A single ballistic arc has no plateau at its apex. Reduced motion stays in contact with the ground.
  const lift = clip.motion === 'jump' && !reduced && flightProgress > 0 && flightProgress < 1 ? 76 * 4 * flightProgress * (1 - flightProgress) : 0
  function deform(x: number, y: number): Point {
    const { footY, headEnd } = clip
    if (clip.motion === 'rest' && ((x < 144 && y > 192) || (x > 336 && y > 194))) return [x, y]
    if (y >= footY) return [x, y - lift]
    const pin = above(y, footY - 52, footY)
    const headWeight = above(y, headEnd, headEnd + 48)
    const cx = clip.crop[2] / 2, cy = headEnd - 20
    let body: Point = [x, y], head: Point = [x, y]

    if (clip.motion === 'bow') {
      body = [x + 3 * main * pin, y + 8 * main * pin]
      head = rotate(x, y, 183, 194, 3.8 * follow)
      head[0] += 3 * follow; head[1] += 9 * follow
      const result = blend(body, head, headWeight)
      // Hat and grasping paw stay together, including the full exposed brim.
      const held = above(x, 91, 156) * (1 - above(y, 175, 221)) * pin
      result[0] -= 3 * tail * held; result[1] += 2 * tail * held
      return result
    }
    if (clip.motion === 'wave') {
      body = [x + 4 * main * pin, y - 3 * main * pin]
      head = rotate(x, y, 220, 189, 1.8 * follow)
      head[0] += 3 * follow; head[1] -= 3 * follow
      const result = blend(body, head, headWeight)
      const paw = above(x, 109, 157) * above(y, 112, 205)
      const moved = rotate(x, y, 138, 183, -7 * wave)
      result[0] += (moved[0] - x) * paw; result[1] += (moved[1] - y) * paw
      const freeFoot = region(x, y, 245, 277, 55, 40) * (1 - headWeight) * pin
      result[1] -= 4 * tail * freeFoot
      return result
    }
    if (clip.motion === 'walk') {
      body = [x + 6 * main * pin, y - 4 * main * pin]
      head = [x + 6 * follow, y - 4 * follow]
      let result = blend(body, head, headWeight)
      // Bamboo, leaves and the holding paw use one rigid translation, rather than a bending rod.
      const prop = above(x, 132, 194)
      result = blend(result, [x + 6 * follow, y - 4 * follow], prop)
      const paw = region(x, y, 383, 220, 53, 59) * (1 - headWeight)
      result[0] -= 5 * tail * paw; result[1] += 4 * tail * paw
      const heel = region(x, y, 160, 314, 42, 28) * pin
      result[0] -= 3 * tail * heel; result[1] -= 6 * tail * heel
      return result
    }
    if (clip.motion === 'lookback') {
      body = [x - 3 * main * pin, y - 2 * main * pin]
      head = rotate(x, y, 197, 156, -2.5 * follow)
      head[0] -= 3 * follow; head[1] -= 2 * follow
      return blend(body, head, headWeight)
    }
    if (clip.motion === 'celebrate') {
      body = [x + (x - 157) * .012 * main * pin, y - 7 * main * pin]
      head = rotate(x, y, 164, 163, -1.8 * follow)
      head[1] -= 7 * follow
      const result = blend(body, head, headWeight)
      const paw = above(x, 66, 101) * above(y, 106, 180)
      const moved = rotate(x, y, 76, 163, -5 * wave)
      result[0] += (moved[0] - x) * paw; result[1] += (moved[1] - y) * paw
      const foot = region(x, y, 216, 268, 49, 37) * pin
      result[1] -= 3 * tail * foot
      return result
    }
    if (clip.motion === 'rest') {
      body = [x + (x - 241) * .009 * main * pin, y - 2.5 * main * pin]
      head = [x, y - 3.4 * follow]
      const result = blend(body, head, headWeight)
      const paw = region(x, y, 174, 191, 38, 36) + region(x, y, 313, 192, 35, 33)
      result[1] += 1.3 * tail * paw * pin
      return result
    }
    if (clip.motion === 'jump') {
      body = [x + (x - cx) * .026 * jumpCompress * pin, y + 10 * jumpCompress * pin]
      // Keep the complete face rigid; compress the belly and knees underneath it.
      head = [x, y + 10 * jumpCompress]
      const result = blend(body, head, headWeight)
      const outer = above(x, 111, 171) + (1 - above(x, 362, 424))
      result[1] += 5 * jumpCompress * outer * pin
      result[1] -= lift
      return result
    }
    // Each portrait retains its complete original face. Only head/upper-body response varies by expression.
    const expression = clip.expression ?? 0
    const angle = [0, -2.3, 0, 1.4, -1.3, .6, -1.8, 0, .5, 2.0, -1.4, 1.4][expression] * follow
    const dy = [2.0, -3.2, 2.6, -3.5, -2.0, 3.4, -4.5, -5, 3.5, -2.5, -2.5, 4.5][expression]
    body = [x + (x - cx) * .009 * main * pin, y + dy * main * pin]
    head = rotate(x, y, cx, cy, angle)
    head[1] += dy * follow
    return blend(body, head, headWeight)
  }
  return { blink: 0, lift, deform }
}

export function libraryPhase(clip: Clip, milliseconds: number) {
  if (milliseconds === 0 || milliseconds >= clip.duration) return '原画姿势'
  if (clip.motion === 'jump') return milliseconds < 1080 ? '蓄力' : milliseconds < 1900 ? '离地 · 欢呼' : milliseconds < 2600 ? '落地 · 缓冲' : '收稳'
  const t = milliseconds / clip.duration
  return t < .2 ? '准备' : t < .52 ? clip.category === 'expressions' ? '表情回应' : '动作展开' : t < .9 ? '慢慢收回' : '收稳'
}
