import type { PlanDay } from './types'

export interface PlanTemplate {
  id: string
  name: string
  description: string
  days: PlanDay[]
}

// 经典三分化:推 / 拉 / 腿
const PUSH_PULL_LEGS: PlanTemplate = {
  id: 'ppl-3day',
  name: '三分化 · 推/拉/腿',
  description: '经典 PPL,一周练 3-6 天均可循环',
  days: [
    {
      label: 'Day 1 · 推(胸肩三头)',
      exercises: [
        { name: '杠铃卧推', sets: 4, repRange: '8-10' },
        { name: '上斜哑铃卧推', sets: 3, repRange: '10-12' },
        { name: '站姿杠铃推举', sets: 3, repRange: '8-10' },
        { name: '哑铃侧平举', sets: 3, repRange: '12-15' },
        { name: '绳索三头下压', sets: 3, repRange: '12-15' },
      ],
    },
    {
      label: 'Day 2 · 拉(背二头)',
      exercises: [
        { name: '引体向上', sets: 4, repRange: '6-10' },
        { name: '杠铃划船', sets: 4, repRange: '8-10' },
        { name: '坐姿绳索划船', sets: 3, repRange: '10-12' },
        { name: '哑铃弯举', sets: 3, repRange: '10-12' },
        { name: '绳索面拉', sets: 3, repRange: '15' },
      ],
    },
    {
      label: 'Day 3 · 腿',
      exercises: [
        { name: '杠铃深蹲', sets: 4, repRange: '8-10' },
        { name: '罗马尼亚硬拉', sets: 3, repRange: '10-12' },
        { name: '腿举', sets: 3, repRange: '12-15' },
        { name: '腿弯举', sets: 3, repRange: '12-15' },
        { name: '站姿提踵', sets: 4, repRange: '15-20' },
      ],
      cardio: { type: '有氧(可自选)', minutes: 20, note: '低强度' },
    },
  ],
}

// 经典五分化(Bro Split):胸 / 背 / 肩 / 手臂 / 腿
const BRO_SPLIT: PlanTemplate = {
  id: 'bro-split-5day',
  name: '五分化 · 胸/背/肩/臂/腿',
  description: '每次只练一个部位,适合有一定训练经验、一周能练 5 天以上的人',
  days: [
    {
      label: 'Day 1 · 胸',
      exercises: [
        { name: '杠铃卧推', sets: 4, repRange: '8-10' },
        { name: '上斜哑铃卧推', sets: 3, repRange: '10-12' },
        { name: '双杠臂屈伸', sets: 3, repRange: '10-12' },
        { name: '绳索夹胸', sets: 3, repRange: '12-15' },
      ],
    },
    {
      label: 'Day 2 · 背',
      exercises: [
        { name: '引体向上', sets: 4, repRange: '8-10' },
        { name: '杠铃划船', sets: 4, repRange: '8-10' },
        { name: '坐姿绳索划船', sets: 3, repRange: '10-12' },
        { name: '直臂下拉', sets: 3, repRange: '12-15' },
      ],
    },
    {
      label: 'Day 3 · 肩',
      exercises: [
        { name: '站姿杠铃推举', sets: 4, repRange: '8-10' },
        { name: '哑铃侧平举', sets: 4, repRange: '12-15' },
        { name: '绳索面拉', sets: 3, repRange: '15' },
        { name: '哑铃俯身飞鸟', sets: 3, repRange: '12-15' },
      ],
    },
    {
      label: 'Day 4 · 手臂',
      exercises: [
        { name: '杠铃弯举', sets: 4, repRange: '8-10' },
        { name: '绳索三头下压', sets: 4, repRange: '10-12' },
        { name: '哑铃锤式弯举', sets: 3, repRange: '12' },
        { name: '窄距卧推', sets: 3, repRange: '10-12' },
      ],
    },
    {
      label: 'Day 5 · 腿',
      exercises: [
        { name: '杠铃深蹲', sets: 4, repRange: '8-10' },
        { name: '罗马尼亚硬拉', sets: 3, repRange: '10-12' },
        { name: '腿举', sets: 3, repRange: '12-15' },
        { name: '腿弯举', sets: 3, repRange: '12-15' },
        { name: '站姿提踵', sets: 4, repRange: '15-20' },
      ],
    },
  ],
}

// 新手全身训练:三天循环,每天都练全身主要复合动作
const FULL_BODY_BEGINNER: PlanTemplate = {
  id: 'full-body-3day',
  name: '全身训练 · 新手三日',
  description: '每次都练全身,动作少而精,适合刚开始训练的人打基础',
  days: [
    {
      label: 'Day 1 · 全身 A',
      exercises: [
        { name: '杠铃深蹲', sets: 3, repRange: '8-10' },
        { name: '杠铃卧推', sets: 3, repRange: '8-10' },
        { name: '杠铃划船', sets: 3, repRange: '8-10' },
        { name: '平板支撑', sets: 3, repRange: '30-45秒' },
      ],
    },
    {
      label: 'Day 2 · 全身 B',
      exercises: [
        { name: '罗马尼亚硬拉', sets: 3, repRange: '8-10' },
        { name: '站姿杠铃推举', sets: 3, repRange: '8-10' },
        { name: '高位下拉', sets: 3, repRange: '10-12' },
        { name: '卷腹', sets: 3, repRange: '12-15' },
      ],
    },
    {
      label: 'Day 3 · 全身 C',
      exercises: [
        { name: '杠铃深蹲', sets: 3, repRange: '8-10' },
        { name: '双杠臂屈伸', sets: 3, repRange: '8-10' },
        { name: '引体向上', sets: 3, repRange: '6-10' },
        { name: '平板支撑', sets: 3, repRange: '30-45秒' },
      ],
    },
  ],
}

// 四分化:上肢 / 下肢 交替,力量日 + 泵感日各一次
const UPPER_LOWER: PlanTemplate = {
  id: 'upper-lower-4day',
  name: '四分化 · 上肢/下肢',
  description: '一周 4 天,上下肢交替,兼顾力量和维度,适合中等训练经验',
  days: [
    {
      label: 'Day 1 · 上肢(力量)',
      exercises: [
        { name: '杠铃卧推', sets: 4, repRange: '6-8' },
        { name: '杠铃划船', sets: 4, repRange: '6-8' },
        { name: '站姿杠铃推举', sets: 3, repRange: '8-10' },
        { name: '哑铃弯举', sets: 3, repRange: '10-12' },
      ],
    },
    {
      label: 'Day 2 · 下肢(力量)',
      exercises: [
        { name: '杠铃深蹲', sets: 4, repRange: '6-8' },
        { name: '罗马尼亚硬拉', sets: 3, repRange: '8-10' },
        { name: '腿举', sets: 3, repRange: '10-12' },
        { name: '站姿提踵', sets: 4, repRange: '12-15' },
      ],
    },
    {
      label: 'Day 3 · 上肢(泵感)',
      exercises: [
        { name: '上斜哑铃卧推', sets: 3, repRange: '10-12' },
        { name: '高位下拉', sets: 3, repRange: '10-12' },
        { name: '哑铃侧平举', sets: 3, repRange: '12-15' },
        { name: '绳索三头下压', sets: 3, repRange: '12-15' },
      ],
    },
    {
      label: 'Day 4 · 下肢(泵感)',
      exercises: [
        { name: '箭步蹲', sets: 3, repRange: '10-12' },
        { name: '腿屈伸', sets: 3, repRange: '12-15' },
        { name: '腿弯举', sets: 3, repRange: '12-15' },
        { name: '卷腹', sets: 3, repRange: '15' },
      ],
    },
  ],
}

// 六分化(Arnold Split):胸背 / 肩臂 / 腿,一周循环两次
const ARNOLD_SPLIT: PlanTemplate = {
  id: 'arnold-split-6day',
  name: '六分化 · Arnold Split',
  description: '胸背、肩臂、腿各练两次,训练量大,适合有经验、一周能练 6 天的人',
  days: [
    {
      label: 'Day 1 · 胸背',
      exercises: [
        { name: '杠铃卧推', sets: 4, repRange: '8-10' },
        { name: '引体向上', sets: 4, repRange: '6-10' },
        { name: '上斜哑铃卧推', sets: 3, repRange: '10-12' },
        { name: '杠铃划船', sets: 3, repRange: '8-10' },
        { name: '绳索夹胸', sets: 3, repRange: '12-15' },
      ],
    },
    {
      label: 'Day 2 · 肩臂',
      exercises: [
        { name: '站姿杠铃推举', sets: 4, repRange: '8-10' },
        { name: '哑铃侧平举', sets: 3, repRange: '12-15' },
        { name: '哑铃弯举', sets: 3, repRange: '10-12' },
        { name: '绳索三头下压', sets: 3, repRange: '12-15' },
        { name: '杠铃弯举', sets: 3, repRange: '10-12' },
      ],
    },
    {
      label: 'Day 3 · 腿',
      exercises: [
        { name: '杠铃深蹲', sets: 4, repRange: '8-10' },
        { name: '罗马尼亚硬拉', sets: 3, repRange: '10-12' },
        { name: '腿举', sets: 3, repRange: '12-15' },
        { name: '站姿提踵', sets: 4, repRange: '15-20' },
      ],
    },
    {
      label: 'Day 4 · 胸背',
      exercises: [
        { name: '双杠臂屈伸', sets: 3, repRange: '10-12' },
        { name: '高位下拉', sets: 4, repRange: '10-12' },
        { name: '固定器械推胸', sets: 3, repRange: '10-12' },
        { name: '器械划船', sets: 3, repRange: '10-12' },
        { name: '反向蝴蝶机', sets: 3, repRange: '15' },
      ],
    },
    {
      label: 'Day 5 · 肩臂',
      exercises: [
        { name: '器械推肩', sets: 3, repRange: '10-12' },
        { name: '哑铃俯身飞鸟', sets: 3, repRange: '12-15' },
        { name: '哑铃锤式弯举', sets: 3, repRange: '12' },
        { name: '器械三头屈伸', sets: 3, repRange: '12-15' },
      ],
    },
    {
      label: 'Day 6 · 腿',
      exercises: [
        { name: '史密斯深蹲', sets: 4, repRange: '8-10' },
        { name: '箭步蹲', sets: 3, repRange: '10-12' },
        { name: '腿弯举', sets: 3, repRange: '12-15' },
        { name: '悬垂举腿', sets: 3, repRange: '12-15' },
      ],
    },
  ],
}

export const PLAN_TEMPLATES: PlanTemplate[] = [
  FULL_BODY_BEGINNER,
  UPPER_LOWER,
  PUSH_PULL_LEGS,
  ARNOLD_SPLIT,
  BRO_SPLIT,
]
