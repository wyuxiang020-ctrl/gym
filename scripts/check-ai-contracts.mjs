import { validateFoodResult, validateWorkoutResult } from '../api/_lib/validate.ts'

function accepted(validator, value) {
  try {
    validator(value)
    return true
  } catch {
    return false
  }
}

const repSet = { weight: 60, reps: 8, durationSeconds: null, done: true }
const timedSet = { weight: 0, reps: null, durationSeconds: 30, done: true }
const strength = { name: '卧推', sets: [repSet], note: '', uncertain: [] }
const cardio = {
  type: '跑步',
  minutes: null,
  distance: null,
  avgHr: null,
  intensity: 'mid',
  note: '',
  uncertain: ['请补充具体时长'],
}
const food = {
  name: '鸡胸肉',
  grams: 100,
  kcal: 165,
  protein: 31,
  carbs: 0,
  fat: 3.6,
  confidence: 'high',
}

const checks = [
  ['次数型力量组通过', accepted(validateWorkoutResult, { strength: [strength], cardio: [] })],
  [
    '计时型力量组通过',
    accepted(validateWorkoutResult, {
      strength: [{ ...strength, name: '平板支撑', sets: [timedSet] }],
      cardio: [],
    }),
  ],
  [
    '待补充动作允许空组数组',
    accepted(validateWorkoutResult, {
      strength: [{ ...strength, sets: [], note: '组数和次数未记录' }],
      cardio: [],
    }),
  ],
  [
    '仅重量缺失时允许保留已知组次并用0占位',
    accepted(validateWorkoutResult, {
      strength: [
        {
          ...strength,
          sets: Array.from({ length: 4 }, () => ({ ...repSet, weight: 0 })),
          uncertain: ['重量缺失，请补充'],
        },
      ],
      cardio: [],
    }),
  ],
  ['待补充有氧允许 minutes 为 null', accepted(validateWorkoutResult, { strength: [], cardio: [cardio] })],
  [
    'reps 与 durationSeconds 同为 null 被拒绝',
    !accepted(validateWorkoutResult, {
      strength: [{ ...strength, sets: [{ ...repSet, reps: null }] }],
      cardio: [],
    }),
  ],
  [
    '缺失 durationSeconds 键被拒绝',
    !accepted(validateWorkoutResult, {
      strength: [
        {
          ...strength,
          sets: [{ weight: 60, reps: 8, done: true }],
        },
      ],
      cardio: [],
    }),
  ],
  [
    '力量组额外键被拒绝',
    !accepted(validateWorkoutResult, {
      strength: [{ ...strength, sets: [{ ...repSet, guessed: true }] }],
      cardio: [],
    }),
  ],
  [
    '力量条目缺失 note 被拒绝',
    !accepted(validateWorkoutResult, {
      strength: [{ name: '卧推', sets: [repSet], uncertain: [] }],
      cardio: [],
    }),
  ],
  [
    '有氧条目缺失 distance 被拒绝',
    !accepted(validateWorkoutResult, {
      strength: [],
      cardio: [
        {
          type: '跑步',
          minutes: 20,
          avgHr: null,
          intensity: 'mid',
          note: '',
          uncertain: [],
        },
      ],
    }),
  ],
  [
    '训练结果根级额外键被拒绝',
    !accepted(validateWorkoutResult, { strength: [], cardio: [], debug: true }),
  ],
  ['合法饮食结果通过', accepted(validateFoodResult, { items: [food] })],
  [
    '饮食条目额外键被拒绝',
    !accepted(validateFoodResult, { items: [{ ...food, source: 'model' }] }),
  ],
  [
    '饮食结果根级额外键被拒绝',
    !accepted(validateFoodResult, { items: [food], debug: true }),
  ],
]

const failures = checks.filter(([, passed]) => !passed)
for (const [name, passed] of checks) {
  console.log(`${passed ? 'PASS' : 'FAIL'} ${name}`)
}

if (failures.length) {
  console.error(`FAIL ${failures.length}/${checks.length} AI contract checks failed`)
  process.exit(1)
}

console.log(`PASS ${checks.length}/${checks.length}; AI runtime contract fixtures are enforced`)
