import { D_PALETTE as P, clamp, type DFrame, type DView, D_VIEWS, type Point } from './model'
import { D_PATHS } from './asset'
import { layout, GROUND, type ArmLayout } from './layout'

const cache = new Map<string, Path2D>()
export function drawDPanda(c: CanvasRenderingContext2D, f: DFrame, view: DView = 'front') {
  const l = layout(f, D_VIEWS.find(v => v.id === view)!.yaw)
  const path = (d: string, fill: string | CanvasGradient | null, width = 2.2, ink = P.ink as string) => {
    let p = cache.get(d); if (!p) { p = new Path2D(d); if (cache.size < 150) cache.set(d, p) }
    if (fill) { c.fillStyle = fill; c.fill(p) }
    if (width) { c.lineWidth = width; c.strokeStyle = ink; c.stroke(p) }
  }
  const ellipse = (x: number, y: number, rx: number, ry: number, fill: string, line = 0, angle = 0) => {
    c.beginPath(); c.ellipse(x, y, Math.max(.01, rx), Math.max(.01, ry), angle, 0, Math.PI * 2)
    c.fillStyle = fill; c.fill(); if (line) { c.lineWidth = line; c.strokeStyle = P.ink; c.stroke() }
  }
  const at = (x: number, y: number, angle: number, draw: () => void) => { c.save(); c.translate(x, y); c.rotate(angle); draw(); c.restore() }
  const gradient = (top: string, bottom: string, y0: number, y1: number) => { const g = c.createLinearGradient(-40, y0, 65, y1); g.addColorStop(0, top); g.addColorStop(1, bottom); return g }
  c.save(); c.lineJoin = 'round'; c.lineCap = 'round'
  ellipse(300 + f.x * .3, GROUND + 1, 113 - f.lift * .18, 9 - f.lift * .025, '#bca98b38')

  const hat = () => at(l.hat.x, l.hat.y, l.hat.angle, () => {
    c.scale(l.hat.scale, l.hat.scale)
    ellipse(0, 11, 140, 27, '#c5a060', 2.3)
    path('M -140 11 Q -105 -12 -43 -25 Q 13 -43 79 -11 Q 121 -1 140 11 Q 75 40 -3 37 Q -92 35 -140 11 Z', gradient('#efcf8e', P.straw, -25, 40), 2.3)
    path(D_PATHS.hatCrown, gradient('#efd194', P.straw, -70, 12), 2.3)
    for (let x = -90; x <= 90; x += 22) path(`M ${x} 11 Q ${x * .72} -3 ${x * .22} -48`, null, .65, '#ad8a4e')
    path('M -117 18 Q 0 -5 118 18 M -111 26 Q 0 9 111 26 M -73 -18 Q -9 -43 66 -18 M -45 -37 Q -7 -53 35 -39', null, .75, '#b38c4d')
    path(D_PATHS.hatBand, P.green, 1.4)
    path('M -112 10 Q 0 -20 107 5', null, 1.1, '#525e3a')
  })
  const bamboo = () => at(l.bamboo.x, l.bamboo.y, l.bamboo.angle, () => {
    c.scale(l.bamboo.scale, l.bamboo.scale)
    path('M -6 -187 Q -10 -100 -5 -18 L -5 128 Q 1 135 9 128 L 8 -10 Q 3 -97 8 -187 Z', gradient('#a3ae62', P.green, -180, 125), 1.9, '#52603c')
    for (const y of [-182, -106, -32, 47, 125]) { path(`M -9 ${y} Q 0 ${y + 6} 11 ${y} L 11 ${y + 5} Q 0 ${y + 10} -9 ${y + 4} Z`, '#d2cd8c', 1.1, '#58603e') }
    path('M -2 -174 Q -4 -139 -1 -118 M 2 -93 L 4 -47 M 0 -20 L 1 29', null, 1, '#cfce8d')
    at(-3, -144, -.5, () => { path(D_PATHS.leaf, P.green, 1.3, '#56613f'); path('M 2 -1 Q 21 -15 35 -23', null, .8, '#56613f') })
    at(-3, -144, -2.3, () => path(D_PATHS.leaf, '#8a9a56', 1.3, '#56613f'))
  })
  if (f.hat < .03 && f.hatCarry < .03) hat()
  if (f.bamboo < .03) bamboo()

  const sole = (x: number, y: number, amount: number, angle: number) => at(x, y, angle, () => {
    const a = clamp(amount)
    if (a < .06) return
    ellipse(0, -8, 24 * a, 30 * a, '#4a4440', 1.5)
    ellipse(0, 1, 11 * a, 15 * a, P.pad, 0, .15)
    for (const [px, py] of [[-14, -23], [-5, -28], [6, -27], [15, -19]]) ellipse(px * a, py * a, 4.3 * a, 5.5 * a, P.pad, 0, px / 40)
  })
  const feet = l.feet
  for (const {side, x, y, sole: amount} of feet) {
    at(x, y, side * -.045 + (amount > .3 ? side * -.13 * amount : 0), () => {
      path(`M -32 -4 Q -43 -11 -32 -31 C -23 ${-56 + f.crouch * 20} 15 ${-57 + f.crouch * 20} 26 -30 Q 35 -12 37 -4 Q 28 4 -1 2 Q -26 3 -32 -4 Z`, gradient(P.blackLight, P.black, -48, 1), 2.2)
      if (amount < .2) path('M -25 -9 Q -26 -3 -20 -1 M -14 -7 Q -14 -1 -9 0', null, 1.25)
    })
  }

  const paw = (a: ArmLayout) => {
    const w = a.wrist
    at(w.x, w.y, a.angle, () => {
      path('M -21 -10 C -28 0 -27 16 -15 23 Q 0 32 17 21 C 29 15 27 -1 18 -11 Q 0 -21 -21 -10 Z', gradient(P.blackLight, P.black, -20, 28), 1.8)
      path('M -17 -3 Q -26 -12 -29 -3 Q -29 8 -18 11', P.blackLight, 1.7)
      path('M -7 14 Q -10 20 -5 22 M 5 16 Q 2 21 8 23 M 16 10 Q 14 15 19 17', null, 1.15, '#29282a')
      if (a.open) {
        ellipse(0, 1, 8.5, 10, P.pad)
        for (const [x, y] of [[-14, -8], [-6, -16], [5, -17], [15, -10]]) ellipse(x, y, 4, 5, P.pad, 0, x / 50)
      }
      if (a.side === 1) {
        path('M -25 -25 Q 0 -34 24 -24 L 25 -13 Q 0 -22 -24 -13 Z', P.green, 1.4)
        ellipse(25, -17, 4.7, 5.5, '#9aaa66', 1.2)
        at(27, -13, .45 + f.headTilt * .15, () => { path('M 0 0 Q 23 7 22 29 Q 3 23 0 0 Z', P.green, 1.2); path('M 0 0 Q -4 22 7 32 Q 12 9 0 0 Z', '#97a468', 1.2) })
      }
    })
  }
  const arm = (a: ArmLayout) => {
    const { root: r, elbow: e, wrist: w } = a
    const normal = (p: Point, q: Point, radius: number) => { const d = Math.hypot(q.x - p.x, q.y - p.y) || 1; return { x: -(q.y - p.y) / d * radius, y: (q.x - p.x) / d * radius } }
    const start = { x: r.x - (a.side * Math.cos(l.yaw)) * 24, y: r.y + 7 }
    const n0 = normal(start, e, 28), n1 = normal(start, w, 35), n2 = normal(e, w, 26)
    path(`M ${start.x + n0.x} ${start.y + n0.y} Q ${e.x + n1.x} ${e.y + n1.y} ${w.x + n2.x} ${w.y + n2.y} Q ${w.x + (w.x - e.x) * .76} ${w.y + (w.y - e.y) * .76} ${w.x - n2.x} ${w.y - n2.y} Q ${e.x - n1.x} ${e.y - n1.y} ${start.x - n0.x} ${start.y - n0.y} Q ${start.x} ${start.y - 13} ${start.x + n0.x} ${start.y + n0.y} Z`, gradient(P.blackLight, P.black, 280, 480), 2.1)
    paw(a)
  }
  const ordered = [l.left, l.right].sort((a, b) => a.depth - b.depth)
  ordered.forEach(a => arm(a))
  if (Math.abs(Math.sin(l.yaw)) > .4 && Math.cos(l.yaw) > -.2) {
    const tail = l.toWorld({ x: -Math.sin(l.yaw) * 110, y: 58 * l.bodyY })
    ellipse(tail.x, tail.y, 13, 15, P.cream, 1.6)
  }
  // The torso and its cream panel deform independently of the head and feet.
  at(l.body.x, l.body.y, f.lean, () => {
    c.scale(l.bodyX * (1 + f.breath), l.bodyY * (1 + f.breath * .4))
    const yaw = Math.cos(l.yaw), side = Math.sin(l.yaw)
    path(`M -68 -103 C -101 -82 -106 -47 -113 -7 C -124 34 -105 67 -73 74 Q -8 97 64 78 C 98 68 115 50 111 7 Q 112 -56 73 -94 Q 15 -119 -68 -103 Z`, gradient(P.blackLight, P.black, -95, 105), 2.4)
    const bellyX = side * 15, bellyW = 98 * (.79 + .21 * Math.abs(yaw)), upper = -58 + f.crouch * 12
    path(`M ${bellyX - bellyW * .55} ${upper + 4} C ${bellyX - bellyW * .05} ${upper - 20} ${bellyX + bellyW * .65} ${upper} ${bellyX + bellyW * .92} ${upper + 42} C ${bellyX + bellyW * 1.07} 15 ${bellyX + bellyW * .89} 51 ${bellyX + bellyW * .38} 71 C ${bellyX - bellyW * .10} 91 ${bellyX - bellyW * .76} 68 ${bellyX - bellyW * .94} 35 C ${bellyX - bellyW * 1.06} 10 ${bellyX - bellyW * .94} ${upper + 24} ${bellyX - bellyW * .55} ${upper + 4} Z`, gradient(P.light, P.cream, -75, 90), 1.7)
    if (yaw > -.2) path(`M ${bellyX - 13} 67 l 5 3`, null, 1.5)
    else ellipse(-side * 20, 55, 17, 15, P.cream, 1.8)
  })
  for (const foot of feet) if (foot.sole > .1) {
    ellipse(foot.x, foot.y - 18, 33, 37, P.blackLight, 2.1, foot.side * -.13)
    sole(foot.x, foot.y - 9, Math.max(.6, foot.sole), foot.side * -.13)
  }
  ordered.forEach(a => paw(a))

  // Props and contact paws are composited in front of the body exactly once.
  if (f.bamboo >= .03) { bamboo(); paw(l.right) }
  if (f.sit > .4) { paw(l.left); paw(l.right) }
  const headYaw = l.headYaw, facing = Math.cos(headYaw), yawSide = Math.sin(headYaw)
  at(l.head.x, l.head.y, f.headTilt + f.lean * .35, () => {
    c.scale(1 + f.face.cheek * .018, 1 - f.face.cheek * .01)
    const headWidth = .82 + Math.abs(facing) * .18
    c.scale(headWidth, 1)
    for (const side of [-1, 1]) {
      const profile = Math.abs(yawSide)
      const x = side * 84 * (1 - profile * .65) - yawSide * profile * 50
      ellipse(x, -75, 27, 29, P.blackLight, 2.3, side * .18)
      ellipse(x + side * 2, -70, 12, 15, '#292728', 0, side * .15)
    }
    const profilePoints = D_PATHS.headProfile.match(/-?\d+(?:\.\d+)?/g)!.map(Number)
    let index = 0
    const silhouette = D_PATHS.head.replace(/-?\d+(?:\.\d+)?/g, n => {
      const i = index++, target = profilePoints[i]
      return String(Number(n) + (target - Number(n)) * Math.abs(yawSide) ** 3)
    })
    c.save(); if (yawSide > 0) c.scale(-1, 1)
    path(silhouette, gradient(P.light, P.cream, -70, 100), 2.4); c.restore()
    path(D_PATHS.tuft, P.light, 1.9)
    if (facing > -.3) {
      c.save(); c.globalAlpha = clamp((facing + .3) / .15)
      const profile = Math.abs(yawSide), faceOffset = yawSide * 55
      const eye = (side: -1 | 1) => {
        const near = side * yawSide > 0, visible = facing > .45 || near
        if (!visible) return
        const x = side * 47 * Math.max(.25, facing) + faceOffset
        const scale = (near ? 1 : 1 - profile * .30)
        at(x, -12 - profile * (near ? 1 : 6), side * -.10, () => {
          c.scale(scale, 1)
          c.save(); if (side === 1) c.scale(-1, 1); path(D_PATHS.eyePatch, gradient('#393636', '#494542', -45, 16), 0); c.restore()
          const openness = clamp(side === 1 ? f.face.eyeL : f.face.eyeR, 0, 1.2)
          if (openness < .18) path('M -14 -3 Q 0 -17 16 -2', null, 3.8, '#19191a')
          else {
            const top = -23 * openness + f.face.focus * 8
            path(`M -14 1 Q -17 ${top} -2 ${top - 5} Q 16 ${top - 5} 17 3 Q 6 13 -14 1 Z`, '#fffef9', 1.3)
            c.save(); const clip = new Path2D(`M -14 1 Q -17 ${top} -2 ${top - 5} Q 16 ${top - 5} 17 3 Q 6 13 -14 1 Z`); c.clip(clip)
            ellipse(6 + f.face.gaze * 7, -3, 7.1, 12.2, '#242222')
            ellipse(8 + f.face.gaze * 7, -7, 1.4, 2.1, '#67625a')
            c.restore()
          }
          const brow = side === 1 ? f.face.browL : f.face.browR
          path(`M -14 ${-57 - brow * 7 - f.face.focus * side * 5} Q 0 ${-63 - brow * 9} 13 ${-57 - brow * 4 + f.face.focus * side * 6}`, null, 3.6)
        })
      }
      eye(-1); eye(1)
      const noseX = faceOffset + yawSide * (19 + profile * 24)
      at(noseX, 18, 0, () => { path(D_PATHS.nose, '#242223', 1.5); path('M -9 -4 Q 0 -7 8 -3', null, 1, '#595047') })
      at(noseX - yawSide * profile * 18, 42, 0, () => {
        const open = f.face.mouth, round = f.face.round, width = 27 - round * 16, height = 5 + open * 40
        if (open > .03) {
          path(`M ${-width} 0 Q 0 ${11 * (1 - round)} ${width} ${-2 * f.face.smile} C ${width * .55} ${height + 12} ${-width * .6} ${height + 11} ${-width} 0 Z`, '#69312b', 2)
          c.save(); c.clip(new Path2D(`M ${-width} 0 Q 0 ${11 * (1 - round)} ${width} 0 C ${width * .55} ${height + 12} ${-width * .6} ${height + 11} ${-width} 0 Z`))
          ellipse(-2, height - 1, width * .77, Math.max(3, open * 14), '#d5826d', 1.2)
          c.restore()
        } else path(`M -26 0 Q 0 ${16 * f.face.smile + 3} 26 ${-2 * f.face.smile}`, null, 2.1)
        if (round < .5) path('M -27 -2 l 3 3 M 25 -4 l 3 3', null, 1.5)
      })
      c.restore()
    }
  })
  if (f.hat >= .03 || f.hatCarry >= .03) hat()
  if (f.grip > .02) paw(l.right)
  // The left wrist knot always belongs to the anatomical left arm, including back views.
  if (Math.cos(l.yaw) < 0 || (l.left.depth > .15 && Math.abs(l.yaw) > .7)) paw(l.left)
  c.restore()
  return { leftWrist: l.left.wrist, rightWrist: l.right.wrist, hat: l.hat, bamboo: l.bamboo, hatGrip: l.hatGrip,
    feet, knotSide: 'left', hatCount: 1, bambooCount: 1, view, phase: f.phase }
}
