export type MotionPattern =
  | 'squat'
  | 'hinge'
  | 'press_horizontal'
  | 'pull_horizontal'
  | 'press_vertical'
  | 'pull_vertical'
  | 'rotate_arm'
  | 'calf'
  | 'core_static'
  | 'core_crunch'

export const EXERCISE_PATTERNS: Record<string, MotionPattern> = {
  杠铃卧推: 'press_horizontal',
  上斜哑铃卧推: 'press_horizontal',
  站姿杠铃推举: 'press_vertical',
  双杠臂屈伸: 'press_horizontal',
  绳索夹胸: 'press_horizontal',
  哑铃俯身飞鸟: 'rotate_arm',
  引体向上: 'pull_vertical',
  杠铃划船: 'pull_horizontal',
  坐姿绳索划船: 'pull_horizontal',
  高位下拉: 'pull_vertical',
  直臂下拉: 'pull_vertical',
  哑铃侧平举: 'rotate_arm',
  绳索面拉: 'rotate_arm',
  哑铃弯举: 'rotate_arm',
  杠铃弯举: 'rotate_arm',
  哑铃锤式弯举: 'rotate_arm',
  绳索三头下压: 'rotate_arm',
  窄距卧推: 'press_horizontal',
  杠铃深蹲: 'squat',
  罗马尼亚硬拉: 'hinge',
  腿举: 'squat',
  箭步蹲: 'squat',
  腿屈伸: 'squat',
  腿弯举: 'squat',
  站姿提踵: 'calf',
  平板支撑: 'core_static',
  卷腹: 'core_crunch',
  固定器械推胸: 'press_horizontal',
  蝴蝶机夹胸: 'rotate_arm',
  史密斯卧推: 'press_horizontal',
  器械划船: 'pull_horizontal',
  反向蝴蝶机: 'rotate_arm',
  器械推肩: 'press_vertical',
  史密斯推举: 'press_vertical',
  器械弯举: 'rotate_arm',
  器械三头屈伸: 'rotate_arm',
  史密斯深蹲: 'squat',
  大腿内收器械: 'rotate_arm',
  大腿外展器械: 'rotate_arm',
  悬垂举腿: 'core_crunch',
}

export function patternFor(exerciseName: string): MotionPattern {
  return EXERCISE_PATTERNS[exerciseName] ?? 'squat'
}
