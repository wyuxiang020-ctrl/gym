// 身体档案(只有一份,会随时间更新)
export interface Profile {
  gender: 'male' | 'female'
  birthYear: number
  height: number // cm
  experience: 'beginner' | 'intermediate' | 'advanced'
  goal: 'cut' | 'bulk' | 'maintain' // 减脂 / 增肌 / 维持
  targetWeight?: number // kg
  targetBodyFat?: number // %
  targetNote?: string // 用文字描述想要的身材
  trainingDaysPerWeek: number // 2-6
  activityLevel: 1 | 2 | 3 | 4 | 5 // 日常活动量(不含训练)
  waterTargetMl?: number // 不填则用 体重kg × 30ml
  checkInMode?: 'open' | 'workout' | 'workout_and_meal' // 打卡定义,默认 open
}

// 身体测量记录(每次测量一条,不是每天一条)
export interface Measurement {
  date: string // YYYY-MM-DD
  weight?: number // kg
  bodyFat?: number // %
  waist?: number // cm 腰围
  chest?: number
  hip?: number
  arm?: number
  thigh?: number // 可选
  note?: string
}

// 训练计划(AI 生成初稿,之后完全可编辑)
export interface Plan {
  id: string
  createdAt: string
  name: string // 如「增肌 · 推拉腿 4 天」
  isActive: boolean
  days: PlanDay[]
}
export interface PlanDay {
  label: string // 「Day A · 胸肩三头」
  exercises: { name: string; sets: number; repRange: string; note?: string }[]
  cardio?: { type: string; minutes: number; note?: string }
}

// 每日记录
export interface DayLog {
  date: string
  checkedIn: boolean // 打卡
  strength: StrengthEntry[]
  cardio: CardioEntry[]
  meals: Meal[]
  water: number // ml
  bodyNote?: string
  mood?: 0 | 1 | 2 | 3
}

export interface StrengthEntry {
  id: string
  name: string
  sets: { weight: number; reps: number; done: boolean }[]
  intensity?: 'low' | 'mid' | 'high' // 用于 MET 热量估算,默认 mid
  estKcal: number // 自动算(MET 公式)
  source: 'manual' | 'nl' // 手动还是自然语言生成的
  note?: string // 自然语言解析时识别不出的部分,原文保留
  uncertain?: string[] // 自然语言解析时没把握的地方
}

export interface CardioEntry {
  id: string
  type: string // 跑步 / 单车 / 椭圆机 / 游泳 / 跳绳 / 划船机 / 快走
  minutes: number
  distance?: number // km
  avgHr?: number // 平均心率,可选
  intensity: 'low' | 'mid' | 'high'
  estKcal: number // 自动算(MET 公式)
  source: 'manual' | 'nl'
  note?: string
  uncertain?: string[]
}

export interface Meal {
  id: string
  slot: 'breakfast' | 'lunch' | 'dinner' | 'snack'
  rawText?: string // 我原话说的
  photoThumb?: string // base64 缩略图(压缩到 200px 以内再存)
  items: FoodItem[]
  note?: string // 备注,可用来触发重算
  confirmed: boolean // 我是否确认过 AI 的估算
}
export interface FoodItem {
  name: string
  grams: number
  kcal: number
  protein: number
  carbs: number
  fat: number // 克
  confidence: 'high' | 'mid' | 'low' // AI 对这一项的把握
}

export interface GymData {
  profile: Profile | null
  measurements: Measurement[]
  plans: Plan[]
  dayLogs: Record<string, DayLog> // 以 date 为 key
  exerciseVideos: Record<string, string> // 动作名 -> 我自己填的直链视频地址
}
