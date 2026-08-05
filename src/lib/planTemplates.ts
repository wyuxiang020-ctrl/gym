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

export const PLAN_TEMPLATES: PlanTemplate[] = [PUSH_PULL_LEGS, BRO_SPLIT]
