import type { CameraView, CompanionPose } from './types'

// An articulated ink drawing: curved limbs, drawn facial planes and deliberate
// overlap replace the old sphere model. The action clock owns every transform.
type Point = { x: number; y: number }
const INK = '#3c403a', FUR = '#454943', LIGHT = '#f5f3df', SHADE = '#e3e3cf'
const paths = new Map<string, Path2D>()
const clamp = (v: number | undefined, min: number, max: number, fallback = 0) => Number.isFinite(v) ? Math.max(min, Math.min(max, v!)) : fallback
const mix = (a: number, b: number, t: number) => a + (b - a) * t

export interface IllustrationOptions { view: CameraView; hat: boolean }

export function drawIllustratedPanda(c: CanvasRenderingContext2D, pose: CompanionPose, options: IllustrationOptions) {
  const m = pose.motion ?? {}
  const lean = clamp(m.lean, -.5, .5), lift = clamp(m.lift, 0, 1)
  const stretch = clamp(m.stretch, .7, 1.3, 1), fold = clamp(m.fold, 0, 1)
  const kick = clamp(m.kick, 0, 1), crouch = clamp(m.crouch, 0, 1)
  const quarter = options.view !== 'front', reverse = options.view === 'side'
  const path = (d: string, fill: string | null, width = 2.4, stroke = INK) => {
    let p = paths.get(d)
    if (!p) { p = new Path2D(d); if (paths.size < 160) paths.set(d, p) }
    if (fill) { c.fillStyle = fill; c.fill(p) }
    if (width) { c.strokeStyle = stroke; c.lineWidth = width; c.stroke(p) }
  }
  const ellipse = (x: number, y: number, rx: number, ry: number, fill: string, width = 0, rotation = 0) => {
    c.beginPath(); c.ellipse(x, y, rx, ry, rotation, 0, Math.PI * 2)
    c.fillStyle = fill; c.fill()
    if (width) { c.lineWidth = width; c.strokeStyle = INK; c.stroke() }
  }
  const scoped = (x: number, y: number, rotation: number, draw: () => void) => {
    c.save(); c.translate(x, y); c.rotate(rotation); draw(); c.restore()
  }
  c.save()
  c.lineCap = 'round'; c.lineJoin = 'round'
  ellipse(305, 506, 101 - lift * 24, 10 - lift * 3, '#d5cbbb66')
  c.translate(300 + clamp(m.shift, -.7, .7) * 120, 488 - lift * 140)
  if (reverse) c.scale(-1, 1)
  c.rotate(lean)
  c.scale(1 / Math.sqrt(stretch), stretch)
  c.translate(0, -118 + crouch * 15)

  // The near hind paw changes silhouette when kicking; it is not a rigid leg.
  const farStep = clamp(m.rightFoot, 0, 1), nearStep = clamp(m.leftFoot, 0, 1)
  scoped(47, 80 - farStep * 30, -.22 - farStep * .5, () => {
    path('M -25 -17 C -9 -28 16 -18 21 5 L 35 28 Q 45 43 24 45 C 7 44 -14 35 -18 20 Z', FUR)
    path('M 21 33 Q 27 38 33 35', null, 1.4)
  })
  const nearFoot = () => scoped(-42 - kick * 42, 89 - nearStep * 36 - kick * 64, .16 - kick * .65, () => {
    path('M -17 -28 C 3 -39 33 -25 30 -5 Q 24 16 11 27 C -1 38 -29 33 -34 23 Q -43 7 -25 -1 Z', FUR)
    if (kick > .1 || nearStep > .35) {
      ellipse(-12, 9, 19 + kick * 12, 23 + kick * 10, LIGHT, 2, -.2)
      ellipse(-12, 9, 11 + kick * 7, 16 + kick * 6, '#e1e3d0', 0, -.2)
    } else path('M -28 18 Q -28 27 -20 28 M -17 21 Q -17 29 -10 30', null, 1.4)
  })
  if (kick <= .1 && nearStep <= .35) nearFoot()

  const arm = (side: -1 | 1, front: boolean) => {
    const a = side < 0 ? pose.right : pose.left
    const shoulder = clamp(a.shoulder, 0, 2.6, .1), elbow = clamp(a.elbow, 0, 1.25)
    const root: Point = { x: side * 39, y: -51 }
    let mid: Point = { x: root.x + side * Math.sin(shoulder) * 53, y: root.y + Math.cos(shoulder) * 53 }
    let tip: Point = { x: mid.x + side * Math.sin(shoulder + elbow) * 50, y: mid.y + Math.cos(shoulder + elbow) * 50 }
    if (fold) {
      mid = { x: mix(mid.x, side * 69, fold), y: mix(mid.y, -2, fold) }
      tip = { x: mix(tip.x, side < 0 ? 1 : -18, fold), y: mix(tip.y, side < 0 ? -37 : -32, fold) }
    }
    const n = (a: Point, b: Point, radius: number) => {
      const len = Math.hypot(b.x - a.x, b.y - a.y) || 1
      return { x: -(b.y - a.y) / len * radius, y: (b.x - a.x) / len * radius }
    }
    const n0 = n(root, mid, 24), n1 = n(root, tip, 22), n2 = n(mid, tip, 20)
    const d = `M ${root.x + n0.x} ${root.y + n0.y} Q ${mid.x + n1.x} ${mid.y + n1.y} ${tip.x + n2.x} ${tip.y + n2.y} Q ${tip.x + (tip.x - mid.x) * .95} ${tip.y + (tip.y - mid.y) * .95} ${tip.x - n2.x} ${tip.y - n2.y} Q ${mid.x - n1.x} ${mid.y - n1.y} ${root.x - n0.x} ${root.y - n0.y} Q ${root.x - side * 23} ${root.y - 13} ${root.x + n0.x} ${root.y + n0.y} Z`
    path(d, front ? FUR : '#41453f')
    const rotation = Math.atan2(tip.y - mid.y, tip.x - mid.x) - Math.PI / 2
    scoped(tip.x, tip.y, rotation, () => {
      // An offset thumb and small knuckle creases give the paw a readable gesture.
      path('M -19 -10 Q -30 -19 -31 -7 Q -32 5 -18 10 L -13 1 Z', FUR, 1.9)
      path('M 9 15 Q 15 11 15 6 M -2 19 Q 5 16 6 11', null, 1.35, '#303a33')
      if (shoulder > 1.3 && fold < .4) {
        ellipse(0, 3, 10, 11, '#697162')
        ellipse(-12, -9, 3.5, 4.5, '#78816f'); ellipse(0, -13, 3.8, 4.5, '#78816f'); ellipse(11, -8, 3.4, 4.3, '#78816f')
      }
    })
  }
  arm(1, false); arm(-1, false)
  ellipse(86, 30, 18, 20, LIGHT, 2.1, -.3)
  path('M -48 -83 C -84 -54 -91 -7 -83 28 C -75 66 -42 88 7 93 C 60 100 86 69 84 22 C 81 -24 71 -61 43 -78 C 18 -98 -21 -101 -48 -83 Z', FUR, 2.6)
  // Cream chest is a single drawn shape, with a little side-plane shading.
  path(quarter
    ? 'M -49 -56 C -82 -37 -87 0 -74 34 C -62 66 -25 84 7 81 C 38 79 54 48 49 11 C 45 -27 19 -60 -12 -64 Q -34 -66 -49 -56 Z'
    : 'M -42 -53 C -74 -30 -76 20 -54 54 C -31 88 35 91 60 56 C 84 22 63 -42 29 -58 Q -11 -76 -42 -53 Z', LIGHT, 2.1)
  path(quarter
    ? 'M 28 -39 C 59 10 51 53 24 72 Q 7 84 -20 77 C 20 97 57 76 56 31 Q 53 -12 28 -39 Z'
    : 'M 55 -12 C 76 41 38 82 -9 80 C 44 99 85 52 55 -12 Z', SHADE, 0)
  path('M -20 64 Q -17 62 -15 65', null, 1.6, '#737866')
  if (kick > .1 || nearStep > .35) nearFoot()
  if (fold > .01) { arm(1, true); arm(-1, true) }

  const tilt = clamp(m.headTilt, -.5, .5), nod = clamp(m.nod, -.4, .4)
  const headX = quarter ? -22 : 0
  scoped(headX + clamp(m.headTurn, -.5, .5) * 20, -124 + nod * 21, tilt, () => {
    const hatTilt = clamp(m.hatTip, -.4, .4) + clamp(m.earWiggle, -.3, .3) * .65
    const hatBack = () => scoped(0, -49, hatTilt, () => {
      path('M -111 -6 Q -105 -32 -17 -73 C -2 -82 5 -87 13 -84 Q 71 -51 106 -8 C 133 13 94 37 37 28 L -81 19 Q -119 12 -111 -6 Z', '#dc8732', 2.5, '#73543b')
      path('M -102 -2 Q -35 -13 43 14 Q 81 29 103 11 C 82 50 -79 43 -102 -2 Z', '#b96828', 0)
    })
    if (options.hat) hatBack()
    ellipse(-53, -57, 18, 23, FUR, 2.3, -.35)
    ellipse(-54, -57, 11, 14, '#303930', 0, -.35)
    path(quarter
      ? 'M -55 -53 C -49 -79 -5 -86 31 -70 C 58 -59 65 -42 64 -17 C 88 6 75 37 52 53 C 24 72 -17 72 -45 54 C -68 40 -85 18 -84 -1 Q -86 -18 -66 -20 Q -72 -39 -55 -53 Z'
      : 'M -60 -47 C -47 -80 6 -83 46 -60 C 64 -48 64 -29 71 -8 C 92 30 54 66 11 68 C -43 71 -78 43 -78 10 Q -78 -20 -60 -47 Z', LIGHT, 2.5)
    path('M 59 -31 Q 68 -12 64 5 C 74 45 23 72 -17 61 C 19 83 80 53 78 14 Q 80 -12 59 -31 Z', SHADE, 0)
    ellipse(61, -50, 17, 24, FUR, 2.4, .3)
    ellipse(63, -50, 10, 16, '#323a33', 1.3, .3)
    path('M -27 -69 L -31 -86 L -18 -77 L -19 -91 L -4 -77 L 1 -88 L 10 -72', LIGHT, 1.8)
    const openness = 1 - clamp(m.blink, 0, .98)
    const gaze = clamp(m.look, -1, 1)
    const eye = (x: number, y: number, scale: number, rotation: number, far: boolean) => scoped(x, y, rotation, () => {
      c.scale(scale, scale)
      path('M -18 -23 C -7 -33 12 -29 21 -15 C 30 -1 31 19 15 27 C 1 34 -26 27 -26 12 Q -27 -6 -18 -23 Z', FUR, 1.7)
      if (openness < .12) { path('M -15 2 Q -3 10 16 3', null, 3.1, LIGHT); return }
      c.save(); c.scale(1, openness)
      path(far ? 'M -15 -9 Q -7 -25 5 -18 Q 20 -13 17 11 Q 9 21 -11 15 Z' : 'M -17 -9 Q -8 -19 8 -18 Q 24 -8 19 11 Q 9 24 -12 18 Z', '#fffff2', 1.8)
      ellipse(-5 + gaze * 5, 2, 6.7, 10.5, '#2e3830')
      ellipse(-7 + gaze * 5, -2, 2.2, 3.3, '#ffffff')
      c.restore()
    })
    if (quarter) {
      eye(-51, -35, .66, -.18, true)
      eye(8, -25, 1.03, .37, false)
      path('M -61 -57 Q -52 -68 -42 -59 M -9 -57 Q 9 -66 26 -58', null, 3.4)
      // A protruding muzzle breaks the round-head / sticker-face appearance.
      path('M -65 -15 Q -82 -21 -90 -8 C -99 8 -81 23 -63 28 Q -47 32 -30 23', LIGHT, 1.7)
      path('M -80 -7 C -76 -15 -60 -16 -56 -9 Q -53 -1 -67 4 Q -78 3 -80 -7 Z', '#a34232', 1.9)
      ellipse(-72, -10, 5, 2, '#cb6c54')
      if (clamp(m.smile, 0, 1) > .35) {
        path('M -68 23 Q -44 35 -21 14 C -19 50 -47 59 -59 42 Z', '#763d33', 2.1)
        path('M -64 26 Q -43 35 -25 21 L -28 32 Q -45 42 -60 32 Z', '#fffdf0', 1.1)
        path('M -51 47 Q -39 34 -29 42 Q -38 52 -51 47 Z', '#d77765', 0)
      } else {
        path('M -68 25 Q -47 38 -24 19 M -27 18 Q -19 15 -17 21', null, 2.2)
      }
      path('M -68 4 Q -69 12 -74 13', null, 1.5)
      ellipse(36, 22, 10, 6, '#deb8a566', 0, -.3)
    } else {
      eye(-32, -24, .9, -.31, false); eye(29, -25, .97, .34, false)
      path('M -47 -57 Q -34 -65 -20 -52 M 15 -59 Q 32 -70 44 -53', null, 3.4)
      path('M -39 20 Q -19 3 0 13 Q 19 1 36 20', LIGHT, 0)
      path('M -11 5 Q 0 -3 12 5 Q 11 15 0 18 Q -11 15 -11 5 Z', '#a34232', 1.8)
      if (clamp(m.smile, 0, 1) > .35) {
        path('M -24 30 Q -3 42 25 25 Q 24 61 3 59 Q -14 56 -24 30 Z', '#763d33', 2)
        path('M -21 32 Q 2 43 23 28 L 20 37 Q 1 48 -17 38 Z', LIGHT, 1)
        ellipse(5, 53, 12, 4, '#d77765')
      } else path('M -24 33 Q 3 47 26 26 M 22 26 Q 28 21 32 27', null, 2.2)
      path('M 0 17 L -1 28', null, 1.6)
      ellipse(-51, 25, 9, 5, '#deb8a555'); ellipse(48, 23, 10, 5, '#deb8a555')
    }
    // The upper crown sits behind the face; its curved lip stays above the eyes.
    if (options.hat) scoped(0, -49, hatTilt, () => {
      path('M -111 -6 Q -106 -29 -17 -73 Q 5 -85 13 -84 C 51 -62 81 -35 104 -7 Q 64 -27 13 -37 Q -53 -50 -111 -6 Z', '#f2a543', 2.3, '#73543b')
      path('M -106 -7 Q -66 -29 -13 -27 Q 49 -22 95 -2', null, 3.3, '#d6872f')
      path('M -91 -27 Q -29 -57 53 -35 M -70 -40 Q -20 -65 28 -52 M -45 -54 Q -16 -67 13 -66', null, 1.05, '#d68a32')
      path('M 13 -83 Q 9 -60 13 -37 M 13 -83 Q -7 -57 -21 -35 M 13 -83 Q 33 -51 43 -30', null, 1, '#d78d36')
    })
  })
  const impact = clamp(m.impact, 0, 1)
  if (impact > .03) {
    c.globalAlpha = impact * .7
    path('M -102 113 Q -120 104 -135 111 M 80 113 Q 98 104 119 112', null, 2, '#aeb198')
  }
  c.restore()
}
