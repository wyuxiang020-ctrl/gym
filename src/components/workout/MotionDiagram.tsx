import type { MotionPattern } from '../../lib/exercisePatterns'

const PATTERN_CONFIG: Record<MotionPattern, { anim: string; vars: Record<string, string>; desc: string }> = {
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

export function MotionDiagram({ pattern }: { pattern: MotionPattern }) {
  const config = PATTERN_CONFIG[pattern]

  return (
    <div className="space-y-1">
      <svg viewBox="0 0 100 80" className="h-24 w-full rounded-md bg-neutral-100">
        <rect x="25" y="58" width="50" height="6" rx="3" className="fill-neutral-300" />
        <g style={config.vars as React.CSSProperties} className={config.anim}>
          <circle cx="50" cy="35" r="12" className="fill-primary" />
        </g>
      </svg>
      <p className="text-center text-[10px] text-neutral-400">动作示意(非真实视频):{config.desc}</p>
    </div>
  )
}
