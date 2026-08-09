export interface ExerciseCategory {
  category: string
  exercises: string[]
}

export const PUSH_COMPOUND = ['杠铃卧推', '上斜哑铃卧推', '站姿杠铃推举', '双杠臂屈伸']
export const PUSH_ISOLATION = ['哑铃侧平举', '绳索夹胸', '绳索三头下压', '哑铃俯身飞鸟']
export const PULL_COMPOUND = ['引体向上', '杠铃划船', '坐姿绳索划船', '高位下拉']
export const PULL_ISOLATION = ['哑铃弯举', '绳索面拉', '直臂下拉', '杠铃弯举']
export const LEGS_COMPOUND = ['杠铃深蹲', '罗马尼亚硬拉', '腿举', '箭步蹲']
export const LEGS_ISOLATION = ['腿屈伸', '腿弯举', '站姿提踵']
export const CORE = ['平板支撑', '卷腹']
export const ARMS_EXTRA = ['哑铃锤式弯举', '窄距卧推']

// 按肌群分类的动作库,给「添加动作」时的选择列表用
export const EXERCISE_LIBRARY: ExerciseCategory[] = [
  {
    category: '胸',
    exercises: [
      ...PUSH_COMPOUND,
      '哑铃卧推',
      '绳索夹胸',
      '哑铃俯身飞鸟',
      '固定器械推胸',
      '蝴蝶机夹胸',
      '史密斯卧推',
    ],
  },
  {
    category: '背',
    exercises: [...PULL_COMPOUND, '杠铃硬拉', '单臂哑铃划船', '直臂下拉', '器械划船', '反向蝴蝶机'],
  },
  {
    category: '肩',
    exercises: [
      '站姿杠铃推举',
      '坐姿哑铃推肩',
      '阿诺德推举',
      '哑铃侧平举',
      '哑铃前平举',
      '绳索面拉',
      '器械推肩',
      '史密斯推举',
    ],
  },
  {
    category: '手臂',
    exercises: [
      '哑铃弯举',
      '杠铃弯举',
      '哑铃锤式弯举',
      '牧师凳弯举',
      '绳索三头下压',
      '过头绳索三头伸展',
      '窄距卧推',
      '器械弯举',
      '器械三头屈伸',
    ],
  },
  {
    category: '腿',
    exercises: [
      ...LEGS_COMPOUND,
      ...LEGS_ISOLATION,
      '保加利亚分腿蹲',
      '史密斯深蹲',
      '坐姿提踵',
      '大腿内收器械',
      '大腿外展器械',
    ],
  },
  {
    category: '核心',
    exercises: [...CORE, '悬垂举腿', '俄罗斯转体', '侧平板'],
  },
]

export const ALL_EXERCISE_NAMES: string[] = EXERCISE_LIBRARY.flatMap((c) => c.exercises)
