export type SportMotion = 'dumbbell' | 'run' | 'boxing'
export const SPORT_MOTIONS: { id: SportMotion; label: string; description: string; duration: number }[] = [
  { id: 'dumbbell', label: '举哑铃', description: '蓄力、举起、停顿、缓缓放下', duration: 3200 },
  { id: 'run', label: '轻快跑步', description: '左右交替落脚，摆臂跟随重心', duration: 1000 },
  { id: 'boxing', label: '活力拳击', description: '预备、左拳、回收、右拳、回到预备', duration: 2400 },
]
const ease = (n: number) => { const x = Math.max(0, Math.min(1, n)); return x*x*(3-2*x) }
function pulse(t: number, start: number, peak: number, hold: number, end: number) {
  if(t < start || t >= end) return 0
  if(t < peak) return ease((t-start)/(peak-start))
  if(t < hold) return 1
  return 1-ease((t-hold)/(end-hold))
}
export function sportPose(mode: SportMotion, milliseconds: number) {
  const duration = SPORT_MOTIONS.find(item => item.id === mode)!.duration
  const t = (milliseconds % duration) / duration
  const wave = Math.sin(t*Math.PI*2)
  const pose = { bodyX: 0, bodyY: 0, lean: 0, head: 0, leftArm: 0, rightArm: 0, leftElbow: 0, rightElbow: 0, leftLeg: 0, rightLeg: 0, leftLift: 0, rightLift: 0, leftReach: 0, rightReach: 0 }
  if(mode === 'dumbbell') {
    const lift = pulse(t, .08, .36, .47, .92)
    pose.leftArm = 7*lift; pose.rightArm = -5*lift
    pose.leftElbow = 78*lift; pose.rightElbow = -62*lift
    pose.bodyY = 3*pulse(t, 0, .06, .08, .2) - 3*lift
    pose.head = -1.4*lift
  } else if(mode === 'run') {
    pose.leftLeg = 21*wave; pose.rightLeg = -21*wave
    pose.leftLift = -9*Math.max(0,wave); pose.rightLift = -9*Math.max(0,-wave)
    pose.leftArm = -22*wave; pose.rightArm = 22*wave
    pose.leftElbow = 28 + 12*wave; pose.rightElbow = -24 + 12*wave
    pose.bodyY = -5*(1-Math.cos(t*4*Math.PI)); pose.lean = 2; pose.head = -1.5*wave
  } else {
    const left = pulse(t,.08,.19,.23,.40), right = pulse(t,.49,.62,.67,.87)
    pose.leftArm = 28+24*left; pose.rightArm = -22-26*right
    pose.leftElbow = 58-44*left; pose.rightElbow = -48+36*right
    pose.leftReach = -30*left; pose.rightReach = 35*right
    pose.lean = -4*left+4*right; pose.bodyX = -5*left+5*right
    pose.bodyY = 2*(1-Math.cos(t*4*Math.PI)); pose.head = -pose.lean*.45
    pose.leftLeg = -3*left; pose.rightLeg = 3*right
  }
  return pose
}
