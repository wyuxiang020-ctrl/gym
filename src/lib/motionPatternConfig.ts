import type { MotionPattern } from './exercisePatterns'

export const MOTION_PATTERN_CONFIG: Record<MotionPattern, { anim: string; vars: Record<string, string>; desc: string }> = {
  squat: { anim: 'animate-motion-y', vars: { '--motion-dy': '18px' }, desc: '身体整体下蹲再站起' },
  hinge: { anim: 'animate-motion-rotate', vars: { '--motion-deg': '25deg' }, desc: '髋部前后铰链弯曲' },
  press_horizontal: { anim: 'animate-motion-x', vars: { '--motion-dx': '16px' }, desc: '手臂向前推出再收回' },
  pull_horizontal: { anim: 'animate-motion-x', vars: { '--motion-dx': '-16px' }, desc: '手臂向身体方向拉近' },
  press_vertical: { anim: 'animate-motion-y', vars: { '--motion-dy': '-18px' }, desc: '重物向上方推起' },
  pull_vertical: { anim: 'animate-motion-y', vars: { '--motion-dy': '14px' }, desc: '身体或重物向下拉动' },
  rotate_arm: { anim: 'animate-motion-rotate', vars: { '--motion-deg': '-30deg' }, desc: '手臂绕关节摆动' },
  calf: { anim: 'animate-motion-y', vars: { '--motion-dy': '-8px' }, desc: '脚跟小幅提起放下' },
  core_static: { anim: 'animate-motion-pulse', vars: {}, desc: '保持姿势静态发力' },
  core_crunch: { anim: 'animate-motion-y', vars: { '--motion-dy': '-10px' }, desc: '上腹部卷起放下' },
}
