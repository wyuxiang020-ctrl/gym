import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const suiteDir = join(root, 'evals', 'workout-parser', 'v2')
const casesPath = join(suiteDir, 'cases.jsonl')
const runnerRelativePath = 'scripts/run-workout-eval-v2.mjs'
const criticalSourcePaths = [
  'api/parse-workout.ts',
  'api/_lib/openai.ts',
  'api/_lib/validate.ts',
  'evals/workout-parser/v2/cases.jsonl',
  'evals/workout-parser/v2/RUBRIC.md',
  runnerRelativePath,
]
const allowedValueArgs = new Set(['base-url', 'run-id', 'output'])
const allowedFlags = new Set(['live', 'validate-only'])
const limits = {
  strengthEntries: 30,
  cardioEntries: 10,
  setsPerStrength: 50,
  labelCharacters: 100,
  weightKg: 1_000,
  reps: 1_000,
  durationSeconds: 86_400,
  cardioMinutes: 1_440,
  distanceKm: 1_000,
  avgHr: 250,
  noteCharacters: 2_000,
  uncertainItems: 20,
  uncertainCharacters: 300,
}
const cardioTypes = new Set(['快走', '跑步', '单车', '椭圆机', '游泳', '跳绳', '划船机'])
const args = new Map()
const flags = new Set()

for (let index = 2; index < process.argv.length; index += 1) {
  const key = process.argv[index]
  if (!key?.startsWith('--')) throw new Error(`Invalid argument near ${key ?? '<end>'}`)
  const name = key.slice(2)
  const value = process.argv[index + 1]
  if (!value || value.startsWith('--')) {
    if (!allowedFlags.has(name)) throw new Error(`Unknown flag: --${name}`)
    flags.add(name)
  } else {
    if (!allowedValueArgs.has(name)) throw new Error(`Unknown argument: --${name}`)
    args.set(name, value)
    index += 1
  }
}

if (flags.has('live') && flags.has('validate-only')) {
  throw new Error('--live and --validate-only cannot be used together')
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex')
}

function fileHash(relativePath) {
  return sha256(readFileSync(join(root, relativePath)))
}

function sourceHashes() {
  return Object.fromEntries(criticalSourcePaths.map((path) => [path, fileHash(path)]))
}

function git(...gitArgs) {
  try {
    return execFileSync('git', gitArgs, {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
  } catch {
    return 'unavailable'
  }
}

function captureProductSnapshot() {
  const dirtyFiles = git('status', '--porcelain').split(/\r?\n/).filter(Boolean)
  return {
    git_head: git('rev-parse', 'HEAD'),
    dirty: dirtyFiles.length > 0,
    dirty_files: dirtyFiles,
    file_hashes: sourceHashes(),
  }
}

function sameCriticalSource(left, right) {
  return (
    left.git_head === right.git_head &&
    criticalSourcePaths.every((path) => left.file_hashes[path] === right.file_hashes[path])
  )
}

function redact(value) {
  return String(value ?? '')
    .replace(/sk-[A-Za-z0-9_-]{8,}/g, '[REDACTED_OPENAI_KEY]')
    .replace(/Bearer\s+[^\s"']+/gi, 'Bearer [REDACTED]')
    .replace(/OPENAI_API_KEY\s*=\s*[^\s"']+/gi, 'OPENAI_API_KEY=[REDACTED]')
    .replace(/(https?:\/\/)[^\s/@:]+:[^\s/@]+@/gi, '$1[REDACTED]@')
}

function isObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function finiteAtLeast(value, minimum = 0) {
  return typeof value === 'number' && Number.isFinite(value) && value >= minimum
}

function finiteBetween(value, minimum, maximum) {
  return finiteAtLeast(value, minimum) && value <= maximum
}

function positiveInteger(value, maximum) {
  return Number.isInteger(value) && finiteBetween(value, 1, maximum)
}

function validSetContract(set) {
  if (
    !isObject(set) ||
    !finiteBetween(set.weight, 0, limits.weightKg) ||
    typeof set.done !== 'boolean'
  ) {
    return false
  }
  const repsSet = positiveInteger(set.reps, limits.reps) && set.durationSeconds === null
  const durationSet =
    set.reps === null && positiveInteger(set.durationSeconds, limits.durationSeconds)
  return repsSet || durationSet
}

function validExpectedResult(value) {
  if (!isObject(value) || !Array.isArray(value.strength) || !Array.isArray(value.cardio)) return false
  return (
    value.strength.length <= limits.strengthEntries &&
    value.cardio.length <= limits.cardioEntries &&
    value.strength.every(
      (entry) =>
        isObject(entry) &&
        typeof entry.name === 'string' &&
        Boolean(entry.name.trim()) &&
        entry.name.length <= limits.labelCharacters &&
        Array.isArray(entry.sets) &&
        entry.sets.length <= limits.setsPerStrength &&
        entry.sets.every(validSetContract),
    ) &&
    value.cardio.every(
      (entry) =>
        isObject(entry) &&
        typeof entry.type === 'string' &&
        Boolean(entry.type.trim()) &&
        entry.type.length <= limits.labelCharacters &&
        cardioTypes.has(entry.type.trim()) &&
        (entry.minutes === null || finiteBetween(entry.minutes, 1, limits.cardioMinutes)) &&
        (entry.distance === null || finiteBetween(entry.distance, 0, limits.distanceKm)) &&
        (entry.avgHr === null || finiteBetween(entry.avgHr, 1, limits.avgHr)) &&
        ['low', 'mid', 'high'].includes(entry.intensity),
    )
  )
}

function validWorkoutResult(value) {
  if (!validExpectedResult(value)) return false
  const entries = [...value.strength, ...value.cardio]
  return entries.every(
    (entry) =>
      typeof entry.note === 'string' &&
      entry.note.length <= limits.noteCharacters &&
      Array.isArray(entry.uncertain) &&
      entry.uncertain.length <= limits.uncertainItems &&
      entry.uncertain.every(
        (item) => typeof item === 'string' && item.length <= limits.uncertainCharacters,
      ),
  )
}

function classifyRequestOutcome({ httpStatus, requestError, responseId }) {
  const hasResponseId = typeof responseId === 'string' && Boolean(responseId.trim())
  const successfulHttp =
    Number.isInteger(httpStatus) && httpStatus >= 200 && httpStatus < 300
  const paidModelOutputFailure = httpStatus === 422 && hasResponseId

  return {
    fatal:
      !paidModelOutputFailure &&
      (!successfulHttp || Boolean(requestError) || !hasResponseId),
    paidModelOutputFailure,
  }
}

function parseCases() {
  const source = readFileSync(casesPath, 'utf8')
  const cases = source
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line, index) => {
      try {
        return JSON.parse(line)
      } catch (error) {
        throw new Error(`Invalid JSONL on line ${index + 1}: ${error.message}`)
      }
    })

  const expectedIds = Array.from({ length: 20 }, (_, index) => `WO-${String(index + 1).padStart(2, '0')}`)
  const actualIds = cases.map((item) => item.case_id)
  if (cases.length !== 20 || new Set(actualIds).size !== 20) {
    throw new Error('Expected exactly 20 unique evaluation cases')
  }
  if (expectedIds.some((caseId, index) => actualIds[index] !== caseId)) {
    throw new Error('Cases must be ordered WO-01 through WO-20')
  }
  if (cases.filter((item) => item.supported === 'core').length !== 12) {
    throw new Error('Expected exactly 12 core cases')
  }
  if (cases.filter((item) => item.supported === 'boundary').length !== 8) {
    throw new Error('Expected exactly 8 boundary cases')
  }
  for (const testCase of cases) {
    if (typeof testCase.input !== 'string' || !testCase.input.trim()) {
      throw new Error(`${testCase.case_id} has no input`)
    }
    if (!Array.isArray(testCase.checks) || !testCase.checks.length) {
      throw new Error(`${testCase.case_id} has no checks`)
    }
    if (testCase.supported === 'core' && !validExpectedResult(testCase.expected)) {
      throw new Error(`${testCase.case_id} has an invalid V2 expected result`)
    }
  }

  for (const caseId of ['WO-15', 'WO-16', 'WO-17', 'WO-18']) {
    const testCase = cases.find((item) => item.case_id === caseId)
    if (!validExpectedResult(testCase?.expected)) {
      throw new Error(`${caseId} must contain an explicit valid V2 expected result`)
    }
  }
  return { source, cases }
}

const nameAliases = new Map([
  ['卧推', '卧推'],
  ['杠铃卧推', '卧推'],
  ['平板卧推', '卧推'],
  ['平板杠铃卧推', '卧推'],
  ['杠铃平板卧推', '卧推'],
  ['杠铃深蹲', '深蹲'],
  ['深蹲', '深蹲'],
  ['哑铃弯举', '哑铃弯举'],
  ['哑铃二头弯举', '哑铃弯举'],
  ['杠铃划船', '杠铃划船'],
  ['俯身杠铃划船', '杠铃划船'],
  ['腿举', '腿举'],
  ['腿部推举', '腿举'],
  ['倒蹬', '腿举'],
  ['平板支撑', '平板支撑'],
  ['平板撑', '平板支撑'],
  ['肘撑平板', '平板支撑'],
  ['跑步', '跑步'],
  ['单车', '单车'],
  ['动感单车', '单车'],
  ['自行车', '单车'],
  ['快走', '快走'],
  ['跳绳', '跳绳'],
])

function normalizedName(value) {
  const cleaned = String(value ?? '').replace(/[\s·・_-]/g, '').trim()
  return nameAliases.get(cleaned) ?? cleaned
}

function near(actual, expected, tolerance = 0) {
  return typeof actual === 'number' && Math.abs(actual - expected) <= tolerance + 1e-9
}

function sameNullableNumber(actual, expected) {
  return expected === null ? actual === null : near(actual, expected)
}

function findSemantic(items, expectedName, key) {
  return items.find((item) => normalizedName(item[key]) === normalizedName(expectedName))
}

function expectedCoreCounts(expected) {
  return {
    fields:
      2 +
      expected.strength.reduce((total, entry) => total + 2 + entry.sets.length * 4, 0) +
      expected.cardio.length * 5,
    names: expected.strength.length + expected.cardio.length,
  }
}

function scoreCore(expected, actual) {
  let correct = 0
  let total = 2
  const issues = []
  const extras = []
  let exactNameMatches = 0
  let nameComparisons = 0
  let matchedExpectedEntries = 0

  if (actual.strength.length === expected.strength.length) correct += 1
  else issues.push(`strength数量:${actual.strength.length},期望${expected.strength.length}`)
  if (actual.cardio.length === expected.cardio.length) correct += 1
  else issues.push(`cardio数量:${actual.cardio.length},期望${expected.cardio.length}`)

  for (const expectedEntry of expected.strength) {
    total += 2 + expectedEntry.sets.length * 4
    nameComparisons += 1
    const entry = findSemantic(actual.strength, expectedEntry.name, 'name')
    if (!entry) {
      issues.push(`缺少力量动作:${expectedEntry.name}`)
      continue
    }
    matchedExpectedEntries += 1
    correct += 1
    if (entry.name.trim() === expectedEntry.name.trim()) exactNameMatches += 1
    if (entry.sets.length === expectedEntry.sets.length) correct += 1
    else issues.push(`${expectedEntry.name}组数:${entry.sets.length},期望${expectedEntry.sets.length}`)

    expectedEntry.sets.forEach((expectedSet, index) => {
      const actualSet = entry.sets[index]
      if (!actualSet) return
      if (near(actualSet.weight, expectedSet.weight, 0.1)) correct += 1
      else issues.push(`${expectedEntry.name}第${index + 1}组weight:${actualSet.weight}`)
      if (actualSet.reps === expectedSet.reps) correct += 1
      else issues.push(`${expectedEntry.name}第${index + 1}组reps:${actualSet.reps}`)
      if (actualSet.durationSeconds === expectedSet.durationSeconds) correct += 1
      else issues.push(`${expectedEntry.name}第${index + 1}组durationSeconds:${actualSet.durationSeconds}`)
      if (actualSet.done === expectedSet.done) correct += 1
      else issues.push(`${expectedEntry.name}第${index + 1}组done:${actualSet.done}`)
    })
    if (entry.sets.length > expectedEntry.sets.length) {
      extras.push(`${expectedEntry.name}多${entry.sets.length - expectedEntry.sets.length}组`)
    }
  }

  for (const expectedEntry of expected.cardio) {
    total += 5
    nameComparisons += 1
    const entry = findSemantic(actual.cardio, expectedEntry.type, 'type')
    if (!entry) {
      issues.push(`缺少有氧:${expectedEntry.type}`)
      continue
    }
    matchedExpectedEntries += 1
    correct += 1
    if (entry.type.trim() === expectedEntry.type.trim()) exactNameMatches += 1
    if (sameNullableNumber(entry.minutes, expectedEntry.minutes)) correct += 1
    else issues.push(`${expectedEntry.type}minutes:${entry.minutes}`)
    if (entry.intensity === expectedEntry.intensity) correct += 1
    else issues.push(`${expectedEntry.type}intensity:${entry.intensity}`)
    if (sameNullableNumber(entry.distance, expectedEntry.distance)) correct += 1
    else issues.push(`${expectedEntry.type}distance:${entry.distance}`)
    if (sameNullableNumber(entry.avgHr, expectedEntry.avgHr)) correct += 1
    else issues.push(`${expectedEntry.type}avgHr:${entry.avgHr}`)
  }

  for (const entry of actual.strength) {
    if (!findSemantic(expected.strength, entry.name, 'name')) extras.push(`多余力量动作:${entry.name}`)
  }
  for (const entry of actual.cardio) {
    if (!findSemantic(expected.cardio, entry.type, 'type')) extras.push(`多余有氧:${entry.type}`)
  }

  const accuracy = total ? correct / total : 0
  const expectedEntryCount = expected.strength.length + expected.cardio.length
  const hasUnexpectedEntry = extras.some((item) => /多余力量动作|多余有氧/.test(item))
  const mainStructureUsable = matchedExpectedEntries === expectedEntryCount && !hasUnexpectedEntry
  const verdict =
    correct === total && extras.length === 0
      ? 'direct'
      : accuracy >= 0.75 && mainStructureUsable
        ? 'partial'
        : 'fail'
  return { verdict, correct, total, accuracy, issues, extras, exactNameMatches, nameComparisons }
}

function warningText(result) {
  return [...result.strength, ...result.cardio]
    .flatMap((entry) => [entry.note, ...entry.uncertain])
    .join(' ')
}

function entryWarningClauses(entry) {
  return entry
    ? [entry.note, ...entry.uncertain]
        .flatMap((text) => text.split(/[。！？；;，,\n]+/))
        .map((text) => text.trim())
        .filter(Boolean)
    : []
}

function explicitlyMarksMissing(entry, fieldPattern) {
  const missingCue = /忘记|未知|缺失|未提供|未记录|没(?:有)?(?:写|说|记|提|记录)|不明确|不清楚|不确定|未说明|请补充|待补充|需要补充|待确认|需(?:要)?确认|可能/i
  const resolvedCue = /已确认|已经确认|无需补充|不用补充|不需要补充|并未缺失|没有缺失|并不缺失/i
  return entryWarningClauses(entry).some(
    (clause) => fieldPattern.test(clause) && missingCue.test(clause) && !resolvedCue.test(clause),
  )
}

function isEmptyResult(result) {
  return result.strength.length === 0 && result.cardio.length === 0
}

function scoreBoundary(testCase, result) {
  const warnings = warningText(result)
  let passed = false
  let reason = ''

  switch (testCase.case_id) {
    case 'WO-13': {
      const matchingEntry = findSemantic(result.strength, '卧推', 'name')
      const onlyExpectedEntry = result.strength.length === 1 && Boolean(matchingEntry)
      const preservesKnownFields =
        Boolean(matchingEntry) &&
        matchingEntry.sets.length === 4 &&
        matchingEntry.sets.every(
          (set) =>
            set.weight === 0 &&
            set.reps === 8 &&
            set.durationSeconds === null &&
            set.done === true,
        )
      const explicit = explicitlyMarksMissing(
        matchingEntry,
        /重量|负重|weight|公斤数|千克数|重量值/i,
      )
      passed = result.cardio.length === 0 && onlyExpectedEntry && preservesKnownFields && explicit
      reason = passed
        ? '只保留4组8次卧推，使用0占位且在该条目明确提示重量缺失'
        : '存在多余项目、已知组次/完成状态被改写、猜测正重量、丢失卧推或缺失提示未绑定卧推条目'
      break
    }
    case 'WO-14': {
      const matchingEntry = findSemantic(result.strength, '卧推', 'name')
      const noInventedSets = Boolean(matchingEntry) && matchingEntry.sets.length === 0
      const explicit =
        explicitlyMarksMissing(matchingEntry, /组数|几组|多少组|几轮|多少轮/i) &&
        explicitlyMarksMissing(matchingEntry, /次数|几次|多少次|多少下|下数|重复次数/i)
      passed =
        result.cardio.length === 0 &&
        result.strength.length === 1 &&
        noInventedSets &&
        explicit
      reason = passed
        ? '只保留卧推动作但不造组，并在该条目提示组数/次数缺失'
        : '存在多余项目、编造组数/次数、丢弃动作或提示未绑定卧推条目'
      break
    }
    case 'WO-15': {
      const comparison = scoreCore(testCase.expected, result)
      const cardioEntry = findSemantic(result.cardio, '跑步', 'type')
      const explicit = explicitlyMarksMissing(
        cardioEntry,
        /时长|时间|分钟|多久|持续(?:时间|秒数|分钟数)?|秒数/i,
      )
      passed = comparison.verdict === 'direct' && explicit
      reason = passed
        ? '保留跑步，minutes为null且明确提示补充时长'
        : [
            ...comparison.issues,
            ...comparison.extras,
            ...(explicit ? [] : ['缺少补充时长的明确提示']),
          ].join('; ')
      break
    }
    case 'WO-16':
      passed = isEmptyResult(result)
      reason = passed ? '休息语义返回空记录' : '休息语义仍生成运动'
      break
    case 'WO-17': {
      const comparison = scoreCore(testCase.expected, result)
      passed = comparison.verdict === 'direct'
      reason = passed ? '更正后为4个次数组8/8/8/6' : [...comparison.issues, ...comparison.extras].join('; ')
      break
    }
    case 'WO-18': {
      const comparison = scoreCore(testCase.expected, result)
      const matchingEntry = findSemantic(result.strength, '平板支撑', 'name')
      const exactZeroWeight = Boolean(matchingEntry) && matchingEntry.sets.every((set) => set.weight === 0)
      passed = comparison.verdict === 'direct' && exactZeroWeight
      reason = passed
        ? '平板支撑正确保留为3个30秒计时组'
        : [
            ...comparison.issues,
            ...comparison.extras,
            ...(comparison.verdict === 'direct' && !exactZeroWeight
              ? ['平板支撑重量必须精确为0']
              : []),
          ].join('; ')
      break
    }
    case 'WO-19': {
      const matchingEntry = findSemantic(result.strength, '卧推', 'name')
      const explicit = explicitlyMarksMissing(
        matchingEntry,
        /单位|公斤|kg|计量制式|重量制式|公斤还是磅|磅|斤/i,
      )
      const onlyExpectedEntry =
        result.cardio.length === 0 && result.strength.length === 1 && Boolean(matchingEntry)
      const preservesKnownFields =
        Boolean(matchingEntry) &&
        matchingEntry.sets.length === 4 &&
        matchingEntry.sets.every(
          (set) =>
            (set.weight === 0 || set.weight === 60) &&
            set.reps === 8 &&
            set.durationSeconds === null &&
            set.done === true,
        ) &&
        new Set(matchingEntry.sets.map((set) => set.weight)).size === 1
      passed = isEmptyResult(result) || (onlyExpectedEntry && preservesKnownFields && explicit)
      reason = passed
        ? '返回空结果，或只保留4组8次卧推并在该条目明确提示重量单位缺失'
        : '存在多余项目、已知组次/完成状态被改写、重量不是一致的0或60，或把60静默当成kg'
      break
    }
    case 'WO-20': {
      const matchingEntry = findSemantic(result.strength, '卧推', 'name')
      const retainedPlanIsExact =
        result.cardio.length === 0 &&
        result.strength.length === 1 &&
        Boolean(matchingEntry) &&
        matchingEntry.sets.length === 4 &&
        matchingEntry.sets.every(
          (set) =>
            set.weight === 60 &&
            set.reps === 8 &&
            set.durationSeconds === null &&
            set.done === false,
        )
      passed = isEmptyResult(result) || retainedPlanIsExact
      reason = passed
        ? '返回空结果，或只保留4组未完成的卧推计划'
        : '未来计划被标记为完成、字段错误或包含多余项目'
      break
    }
    default:
      reason = '没有预定义边界规则'
  }

  return { verdict: passed ? 'pass' : 'fail', passed, reason, warnings }
}

function runOfflineSelfCheck(cases) {
  const case15 = cases.find((item) => item.case_id === 'WO-15')
  const case16 = cases.find((item) => item.case_id === 'WO-16')
  const case17 = cases.find((item) => item.case_id === 'WO-17')
  const case18 = cases.find((item) => item.case_id === 'WO-18')
  const valid15 = {
    strength: [],
    cardio: [
      {
        type: '跑步',
        minutes: null,
        distance: null,
        avgHr: null,
        intensity: 'mid',
        note: '',
        uncertain: ['未提供具体时长，请补充分钟数'],
      },
    ],
  }
  const legacy15 = {
    strength: [],
    cardio: [
      {
        type: '跑步',
        minutes: 1,
        distance: null,
        avgHr: null,
        intensity: 'mid',
        note: '',
        uncertain: ['时长不明确'],
      },
    ],
  }
  const valid18 = {
    strength: [
      {
        name: '平板支撑',
        sets: Array.from({ length: 3 }, () => ({
          weight: 0,
          reps: null,
          durationSeconds: 30,
          done: true,
        })),
        note: '',
        uncertain: [],
      },
    ],
    cardio: [],
  }
  const legacy18 = {
    strength: [
      {
        name: '平板支撑',
        sets: Array.from({ length: 3 }, () => ({
          weight: 0,
          reps: 30,
          durationSeconds: null,
          done: true,
        })),
        note: '',
        uncertain: ['原文是每组30秒'],
      },
    ],
    cardio: [],
  }
  const invalidBoth = {
    strength: [
      {
        name: '平板支撑',
        sets: [{ weight: 0, reps: 30, durationSeconds: 30, done: true }],
        note: '',
        uncertain: [],
      },
    ],
    cardio: [],
  }
  const valid13 = {
    strength: [
      {
        name: '卧推',
        sets: Array.from({ length: 4 }, () => ({
          weight: 0,
          reps: 8,
          durationSeconds: null,
          done: true,
        })),
        note: '重量忘记了，请补充',
        uncertain: ['重量缺失'],
      },
    ],
    cardio: [],
  }
  const deceptive13 = {
    strength: [
      {
        name: '深蹲',
        sets: [{ weight: 0, reps: 8, durationSeconds: null, done: true }],
        note: '重量缺失',
        uncertain: [],
      },
      {
        name: '卧推',
        sets: [{ weight: 60, reps: 8, durationSeconds: null, done: true }],
        note: '',
        uncertain: [],
      },
    ],
    cardio: [],
  }
  const valid14 = {
    strength: [
      {
        name: '卧推',
        sets: [],
        note: '组数和次数缺失，请补充',
        uncertain: ['未提供组数与次数'],
      },
    ],
    cardio: [],
  }
  const deceptive14 = {
    strength: [
      { name: '卧推', sets: [], note: '', uncertain: [] },
      {
        name: '深蹲',
        sets: [{ weight: 60, reps: 8, durationSeconds: null, done: true }],
        note: '组数和次数缺失',
        uncertain: [],
      },
    ],
    cardio: [],
  }
  const deceptive19 = {
    strength: [
      {
        name: '深蹲',
        sets: [{ weight: 60, reps: 8, durationSeconds: null, done: true }],
        note: '单位不明确',
        uncertain: [],
      },
    ],
    cardio: [],
  }
  const valid20 = {
    strength: [
      {
        name: '卧推',
        sets: Array.from({ length: 4 }, () => ({
          weight: 60,
          reps: 8,
          durationSeconds: null,
          done: false,
        })),
        note: '明天的计划，尚未完成',
        uncertain: [],
      },
    ],
    cardio: [],
  }
  const deceptive20 = {
    strength: [
      {
        name: '深蹲',
        sets: [{ weight: 60, reps: 8, durationSeconds: null, done: false }],
        note: '未完成',
        uncertain: [],
      },
    ],
    cardio: [],
  }
  const resolved13 = {
    ...valid13,
    strength: [{ ...valid13.strength[0], note: '重量已确认', uncertain: [] }],
  }
  const resolved14 = {
    ...valid14,
    strength: [{ ...valid14.strength[0], note: '组数和次数已确认', uncertain: [] }],
  }
  const resolved15 = {
    ...valid15,
    cardio: [{ ...valid15.cardio[0], note: '时间已确认，无需补充', uncertain: [] }],
  }
  const valid19 = {
    strength: [
      {
        name: '卧推',
        sets: Array.from({ length: 4 }, () => ({
          weight: 60,
          reps: 8,
          durationSeconds: null,
          done: true,
        })),
        note: '重量单位未说明，请补充是公斤还是磅',
        uncertain: ['单位不明确'],
      },
    ],
    cardio: [],
  }
  const resolved19 = {
    ...valid19,
    strength: [{ ...valid19.strength[0], note: '单位已确认为kg', uncertain: [] }],
  }
  const crossField13 = {
    ...valid13,
    strength: [{ ...valid13.strength[0], note: '重量为0，次数未知', uncertain: [] }],
  }
  const synonym13 = {
    ...valid13,
    strength: [{ ...valid13.strength[0], note: '公斤数没记，请补充', uncertain: [] }],
  }
  const crossField14 = {
    ...valid14,
    strength: [{ ...valid14.strength[0], note: '组数4，重量未知，次数8', uncertain: [] }],
  }
  const synonym14 = {
    ...valid14,
    strength: [{ ...valid14.strength[0], note: '多少组没记，多少下未记录', uncertain: [] }],
  }
  const crossField15 = {
    ...valid15,
    cardio: [{ ...valid15.cardio[0], note: '时长30分钟，距离未知', uncertain: [] }],
  }
  const synonym15 = {
    ...valid15,
    cardio: [{ ...valid15.cardio[0], note: '持续秒数未记录，请补充', uncertain: [] }],
  }
  const crossField19 = {
    ...valid19,
    strength: [{ ...valid19.strength[0], note: '单位是kg，次数未知', uncertain: [] }],
  }
  const synonym19 = {
    ...valid19,
    strength: [{ ...valid19.strength[0], note: '计量制式未记录，请补充', uncertain: [] }],
  }
  const alternativeUnitWarning19 = {
    ...valid19,
    strength: [
      {
        ...valid19.strength[0],
        note: '60可能是磅或斤，需要确认',
        uncertain: [],
      },
    ],
  }
  const almostZero18 = {
    ...valid18,
    strength: [
      {
        ...valid18.strength[0],
        sets: valid18.strength[0].sets.map((set) => ({ ...set, weight: 0.1 })),
      },
    ],
  }
  const wrongKnown13 = {
    ...valid13,
    strength: [
      {
        ...valid13.strength[0],
        sets: [{ weight: 0, reps: 1, durationSeconds: null, done: false }],
      },
    ],
  }
  const nonEmpty16 = {
    strength: [
      {
        name: '卧推',
        sets: [{ weight: 60, reps: 8, durationSeconds: null, done: true }],
        note: '',
        uncertain: [],
      },
    ],
    cardio: [],
  }
  const valid17 = {
    strength: [
      {
        name: '杠铃平板卧推',
        sets: [8, 8, 8, 6].map((reps) => ({
          weight: 60,
          reps,
          durationSeconds: null,
          done: true,
        })),
        note: '',
        uncertain: [],
      },
    ],
    cardio: [],
  }
  const wrong17 = {
    ...valid17,
    strength: [
      {
        ...valid17.strength[0],
        sets: [8, 8, 8, 8].map((reps) => ({
          weight: 60,
          reps,
          durationSeconds: null,
          done: true,
        })),
      },
    ],
  }
  const toleranceBoundary17 = {
    ...valid17,
    strength: [
      {
        ...valid17.strength[0],
        sets: valid17.strength[0].sets.map((set, index) => ({
          ...set,
          weight: index % 2 === 0 ? 59.9 : 60.1,
        })),
      },
    ],
  }
  const extraSet17 = {
    ...valid17,
    strength: [
      {
        ...valid17.strength[0],
        sets: [...valid17.strength[0].sets, { weight: 60, reps: 6, durationSeconds: null, done: true }],
      },
    ],
  }
  const alias18 = {
    ...valid18,
    strength: [{ ...valid18.strength[0], name: '肘撑平板' }],
  }
  const wrongKnown19 = {
    ...valid19,
    strength: [
      {
        ...valid19.strength[0],
        sets: [{ weight: 42, reps: 1, durationSeconds: null, done: false }],
      },
    ],
  }
  const completed20 = {
    ...valid20,
    strength: [
      {
        ...valid20.strength[0],
        sets: valid20.strength[0].sets.map((set, index) =>
          index === 0 ? { ...set, done: true } : set,
        ),
      },
    ],
  }
  const extraCardio20 = {
    ...valid20,
    cardio: [
      {
        type: '跑步',
        minutes: 10,
        distance: null,
        avgHr: null,
        intensity: 'mid',
        note: '',
        uncertain: [],
      },
    ],
  }
  const paidValidationFailure = classifyRequestOutcome({
    httpStatus: 422,
    requestError: 'AI returned JSON with an invalid data structure',
    responseId: 'resp_paid_validation_failure',
  })
  const validationFailureWithoutEvidence = classifyRequestOutcome({
    httpStatus: 422,
    requestError: 'AI returned JSON with an invalid data structure',
    responseId: null,
  })
  const upstreamFailure = classifyRequestOutcome({
    httpStatus: 500,
    requestError: 'Upstream request failed',
    responseId: 'resp_upstream_failure',
  })
  const networkFailure = classifyRequestOutcome({
    httpStatus: null,
    requestError: 'fetch failed',
    responseId: null,
  })
  const successfulResponse = classifyRequestOutcome({
    httpStatus: 200,
    requestError: null,
    responseId: 'resp_success',
  })
  const successfulResponseWithoutEvidence = classifyRequestOutcome({
    httpStatus: 200,
    requestError: null,
    responseId: null,
  })

  const checks = [
    ['WO-15 V2 structure is valid', validWorkoutResult(valid15)],
    ['WO-15 V2 answer passes', scoreBoundary(case15, valid15).passed],
    ['WO-15 legacy minutes:1 fails', !scoreBoundary(case15, legacy15).passed],
    ['WO-18 V2 structure is valid', validWorkoutResult(valid18)],
    ['WO-18 V2 answer passes', scoreBoundary(case18, valid18).passed],
    ['WO-18 legacy reps:30 fails', !scoreBoundary(case18, legacy18).passed],
    ['WO-18 weight must be exactly zero', !scoreBoundary(case18, almostZero18).passed],
    ['WO-18 supported semantic alias passes', scoreBoundary(case18, alias18).passed],
    ['reps and durationSeconds together are rejected', !validWorkoutResult(invalidBoth)],
    ['WO-13 safe zero-weight placeholder passes', scoreBoundary(cases.find((item) => item.case_id === 'WO-13'), valid13).passed],
    ['WO-13 extra guessed entry cannot pass', !scoreBoundary(cases.find((item) => item.case_id === 'WO-13'), deceptive13).passed],
    ['WO-13 resolved wording cannot mimic a missing warning', !scoreBoundary(cases.find((item) => item.case_id === 'WO-13'), resolved13).passed],
    ['WO-13 cannot borrow a missing cue from another clause', !scoreBoundary(cases.find((item) => item.case_id === 'WO-13'), crossField13).passed],
    ['WO-13 accepts an equivalent missing-weight phrase', scoreBoundary(cases.find((item) => item.case_id === 'WO-13'), synonym13).passed],
    ['WO-13 must preserve known sets, reps, and done', !scoreBoundary(cases.find((item) => item.case_id === 'WO-13'), wrongKnown13).passed],
    ['WO-14 empty-set placeholder passes', scoreBoundary(cases.find((item) => item.case_id === 'WO-14'), valid14).passed],
    ['WO-14 warning on another entry cannot pass', !scoreBoundary(cases.find((item) => item.case_id === 'WO-14'), deceptive14).passed],
    ['WO-14 resolved wording cannot mimic missing fields', !scoreBoundary(cases.find((item) => item.case_id === 'WO-14'), resolved14).passed],
    ['WO-14 cannot borrow a missing cue from weight', !scoreBoundary(cases.find((item) => item.case_id === 'WO-14'), crossField14).passed],
    ['WO-14 accepts equivalent missing group and rep phrases', scoreBoundary(cases.find((item) => item.case_id === 'WO-14'), synonym14).passed],
    ['WO-15 resolved wording cannot mimic a missing-duration warning', !scoreBoundary(case15, resolved15).passed],
    ['WO-15 cannot borrow a missing cue from distance', !scoreBoundary(case15, crossField15).passed],
    ['WO-15 accepts an equivalent missing-duration phrase', scoreBoundary(case15, synonym15).passed],
    ['WO-16 empty result passes', scoreBoundary(case16, { strength: [], cardio: [] }).passed],
    ['WO-16 any generated exercise fails', !scoreBoundary(case16, nonEmpty16).passed],
    ['WO-17 corrected 8/8/8/6 with a semantic alias passes', scoreBoundary(case17, valid17).passed],
    ['WO-17 accepts both documented weight tolerance boundaries', scoreBoundary(case17, toleranceBoundary17).passed],
    ['WO-17 uncorrected last set fails', !scoreBoundary(case17, wrong17).passed],
    ['WO-17 an extra fifth set fails', !scoreBoundary(case17, extraSet17).passed],
    ['WO-19 empty result passes', scoreBoundary(cases.find((item) => item.case_id === 'WO-19'), { strength: [], cardio: [] }).passed],
    ['WO-19 warned retained value passes', scoreBoundary(cases.find((item) => item.case_id === 'WO-19'), valid19).passed],
    ['WO-19 unrelated warned entry cannot pass', !scoreBoundary(cases.find((item) => item.case_id === 'WO-19'), deceptive19).passed],
    ['WO-19 resolved wording cannot mimic a missing-unit warning', !scoreBoundary(cases.find((item) => item.case_id === 'WO-19'), resolved19).passed],
    ['WO-19 cannot borrow a missing cue from reps', !scoreBoundary(cases.find((item) => item.case_id === 'WO-19'), crossField19).passed],
    ['WO-19 accepts an equivalent missing-unit phrase', scoreBoundary(cases.find((item) => item.case_id === 'WO-19'), synonym19).passed],
    ['WO-19 accepts an explicit lb-or-jin ambiguity', scoreBoundary(cases.find((item) => item.case_id === 'WO-19'), alternativeUnitWarning19).passed],
    ['WO-19 must preserve known sets, reps, and done', !scoreBoundary(cases.find((item) => item.case_id === 'WO-19'), wrongKnown19).passed],
    ['WO-20 exact unfinished plan passes', scoreBoundary(cases.find((item) => item.case_id === 'WO-20'), valid20).passed],
    ['WO-20 unrelated unfinished entry cannot pass', !scoreBoundary(cases.find((item) => item.case_id === 'WO-20'), deceptive20).passed],
    ['WO-20 any completed set fails', !scoreBoundary(cases.find((item) => item.case_id === 'WO-20'), completed20).passed],
    ['WO-20 extra cardio fails', !scoreBoundary(cases.find((item) => item.case_id === 'WO-20'), extraCardio20).passed],
    ['HTTP 422 with Response ID is a paid scorable failure', paidValidationFailure.paidModelOutputFailure && !paidValidationFailure.fatal],
    ['HTTP 422 without Response ID is fatal', validationFailureWithoutEvidence.fatal],
    ['upstream HTTP failure remains fatal even with a Response ID', upstreamFailure.fatal],
    ['network failure is fatal', networkFailure.fatal],
    ['successful response with Response ID is not fatal', !successfulResponse.fatal],
    ['successful response without Response ID is fatal', successfulResponseWithoutEvidence.fatal],
  ]
  const failed = checks.filter(([, passed]) => !passed)
  if (failed.length) {
    throw new Error(`Offline scorer self-check failed: ${failed.map(([name]) => name).join('; ')}`)
  }
  return checks.map(([name]) => name)
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
}

async function runCase(testCase, baseUrl, runId) {
  const startedAt = new Date()
  const started = performance.now()
  let response
  let rawResponse = ''
  let body = null
  let requestError = null

  try {
    response = await fetch(`${baseUrl}/api/parse-workout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ text: testCase.input }),
      signal: AbortSignal.timeout(120_000),
    })
    rawResponse = await response.text()
    try {
      body = JSON.parse(rawResponse)
    } catch {
      requestError = 'Response body was not valid JSON'
    }
    if (!response.ok) requestError = body?.error ?? `HTTP ${response.status}`
  } catch (error) {
    requestError = error instanceof Error ? error.message : String(error)
  }

  const latencyMs = Math.round(performance.now() - started)
  const result = body?.result
  const responseId = body?.meta?.responseId ?? null
  const requestOutcome = classifyRequestOutcome({
    httpStatus: response?.status ?? null,
    requestError,
    responseId,
  })
  const structureValid = !requestError && validWorkoutResult(result)
  const rawEvidence = redact(rawResponse || requestError)
  let score

  if (!structureValid) {
    const expectedCounts = testCase.supported === 'core' ? expectedCoreCounts(testCase.expected) : null
    score =
      testCase.supported === 'core'
        ? {
            verdict: 'fail',
            correct: 0,
            total: expectedCounts.fields,
            accuracy: 0,
            issues: [requestError ?? 'Invalid V2 structure'],
            extras: [],
            exactNameMatches: 0,
            nameComparisons: expectedCounts.names,
          }
        : {
            verdict: 'fail',
            passed: false,
            reason: requestError ?? 'Invalid V2 structure',
            warnings: '',
          }
  } else {
    score =
      testCase.supported === 'core'
        ? scoreCore(testCase.expected, result)
        : scoreBoundary(testCase, result)
  }

  return {
    run_id: `${runId}-${testCase.case_id}`,
    attempt: 1,
    evaluator_retry_count: 0,
    started_at: startedAt.toISOString(),
    completed_at: new Date().toISOString(),
    case_id: testCase.case_id,
    category: testCase.category,
    evaluation_group: testCase.supported,
    input: testCase.input,
    expected: testCase.expected,
    checks: testCase.checks,
    http_status: response?.status ?? null,
    latency_ms: latencyMs,
    structure_valid: structureValid,
    verdict: score.verdict,
    score,
    actual_model_id: body?.meta?.model ?? null,
    response_id: responseId,
    request_id: body?.meta?.requestId ?? null,
    provider_sdk_max_retries: body?.meta?.sdkMaxRetries ?? null,
    provider_timeout_ms: body?.meta?.timeoutMs ?? null,
    request_error: requestError,
    fatal: requestOutcome.fatal,
    paid_model_output_failure: requestOutcome.paidModelOutputFailure,
    usage: body?.meta?.usage ?? null,
    raw_response_or_error: rawEvidence,
    raw_response_sha256: sha256(rawEvidence),
    result: structureValid ? result : null,
    correction_actions:
      score.verdict === 'direct' || score.verdict === 'pass'
        ? []
        : score.issues ?? [score.reason],
    final_saved_record_matches: 'NOT_MEASURED - API parse-only evaluation',
  }
}

function makeSummary(records) {
  const core = records.filter((record) => record.evaluation_group === 'core')
  const boundary = records.filter((record) => record.evaluation_group === 'boundary')
  const latencies = records.map((record) => record.latency_ms)
  const usage = records.reduce(
    (totals, record) => {
      if (!record.usage) return totals
      totals.inputTokens += record.usage.inputTokens ?? 0
      totals.cachedInputTokens += record.usage.cachedInputTokens ?? 0
      totals.outputTokens += record.usage.outputTokens ?? 0
      totals.reasoningTokens += record.usage.reasoningTokens ?? 0
      totals.totalTokens += record.usage.totalTokens ?? 0
      return totals
    },
    { inputTokens: 0, cachedInputTokens: 0, outputTokens: 0, reasoningTokens: 0, totalTokens: 0 },
  )
  const correctFields = core.reduce((total, record) => total + record.score.correct, 0)
  const totalFields = core.reduce((total, record) => total + record.score.total, 0)
  const direct = core.filter((record) => record.verdict === 'direct').length
  const partial = core.filter((record) => record.verdict === 'partial').length
  const failed = core.filter((record) => record.verdict === 'fail').length
  const nonEmptyCorePreviews = core.filter(
    (record) => record.result && (record.result.strength.length || record.result.cardio.length),
  )
  const editNeeded = nonEmptyCorePreviews.filter((record) => record.verdict !== 'direct').length
  const exactNames = core.reduce((total, record) => total + record.score.exactNameMatches, 0)
  const comparedNames = core.reduce((total, record) => total + record.score.nameComparisons, 0)
  const boundaryPassed = boundary.filter((record) => record.verdict === 'pass').length
  const pricedInput = Math.max(0, usage.inputTokens - usage.cachedInputTokens)
  const estimatedCostUsd =
    (pricedInput * 0.25 + usage.cachedInputTokens * 0.025 + usage.outputTokens * 2) / 1_000_000
  const responseIds = records.map((record) => record.response_id).filter(Boolean)
  const responseHashes = records.map((record) => record.raw_response_sha256)

  return {
    core: {
      direct,
      partial,
      failed,
      total: core.length,
      direct_rate: core.length ? direct / core.length : null,
      partial_rate: core.length ? partial / core.length : null,
      failure_rate: core.length ? failed / core.length : null,
      field_accuracy: totalFields ? correctFields / totalFields : null,
      correct_fields: correctFields,
      total_fields: totalFields,
      preview_edit_needed_rate: nonEmptyCorePreviews.length
        ? editNeeded / nonEmptyCorePreviews.length
        : null,
      preview_edit_needed_rate_kind: 'deterministic_reference_comparison_not_observed_user_behavior',
      edit_needed_previews: editNeeded,
      non_empty_previews: nonEmptyCorePreviews.length,
      plan_name_exact_match_rate: comparedNames ? exactNames / comparedNames : null,
      exact_names: exactNames,
      compared_names: comparedNames,
    },
    boundary: {
      passed: boundaryPassed,
      failed: boundary.length - boundaryPassed,
      total: boundary.length,
      pass_rate: boundary.length ? boundaryPassed / boundary.length : null,
    },
    structure: {
      valid: records.filter((record) => record.structure_valid).length,
      total: records.length,
      valid_rate: records.length
        ? records.filter((record) => record.structure_valid).length / records.length
        : null,
    },
    latency_ms: {
      median: median(latencies),
      minimum: Math.min(...latencies),
      maximum: Math.max(...latencies),
    },
    usage,
    estimated_cost_usd: Number(estimatedCostUsd.toFixed(6)),
    evidence: {
      responses_with_id: responseIds.length,
      unique_response_ids: new Set(responseIds).size,
      unique_raw_response_hashes: new Set(responseHashes).size,
    },
    human_in_the_loop: {
      observed_preview_edit_rate: 'NOT_MEASURED',
      median_correction_time: 'NOT_MEASURED',
      final_saved_record_consistency: 'NOT_MEASURED',
    },
    pricing_assumption_per_million_tokens: {
      model: 'gpt-5-mini-2025-08-07',
      input_usd: 0.25,
      cached_input_usd: 0.025,
      output_usd: 2,
      checked_on: '2026-09-05',
      source: 'https://developers.openai.com/api/docs/models/gpt-5-mini',
    },
  }
}

function percent(value) {
  return value === null ? 'N/A' : `${(value * 100).toFixed(1)}%`
}

function markdown(report) {
  const rows = report.records.map((record) => {
    const detail =
      record.evaluation_group === 'core'
        ? `${record.score.correct}/${record.score.total}${record.score.issues.length ? `; ${record.score.issues.join('；')}` : ''}`
        : record.score.reason
    return `| ${record.case_id} | ${record.evaluation_group} | ${record.http_status ?? '-'} | ${record.structure_valid ? '是' : '否'} | ${record.verdict} | ${record.latency_ms} | ${detail.replaceAll('|', '\\|')} |`
  })
  return (
    `# Gym 训练解析正式回归结果 v2\n\n` +
    `- Run ID: \`${report.run_id}\`\n` +
    `- 时间: ${report.started_at} — ${report.completed_at}\n` +
    `- 产品快照: HEAD \`${report.product_snapshot.git_head}\`, dirty=${report.product_snapshot.dirty}\n` +
    `- 数据集 SHA-256: \`${report.dataset.sha256}\`\n` +
    `- Prompt/source SHA-256: \`${report.product_snapshot.file_hashes['api/parse-workout.ts']}\`\n` +
    `- 实际模型: \`${report.actual_model_id ?? 'unknown'}\`\n` +
    `- SDK 自动重试上限: ${report.run_policy.provider_sdk_max_retries}；SDK 超时: ${report.run_policy.provider_timeout_ms}ms\n` +
    `- 环境: ${report.environment}\n\n` +
    `## 汇总\n\n` +
    `- 核心题直接可用: ${report.summary.core.direct}/${report.summary.core.total} (${percent(report.summary.core.direct_rate)})\n` +
    `- 核心题局部修正: ${report.summary.core.partial}/${report.summary.core.total} (${percent(report.summary.core.partial_rate)})\n` +
    `- 核心题失败: ${report.summary.core.failed}/${report.summary.core.total} (${percent(report.summary.core.failure_rate)})\n` +
    `- 核心字段准确率: ${report.summary.core.correct_fields}/${report.summary.core.total_fields} (${percent(report.summary.core.field_accuracy)})\n` +
    `- 边界处理通过: ${report.summary.boundary.passed}/${report.summary.boundary.total} (${percent(report.summary.boundary.pass_rate)})\n` +
    `- 结构有效: ${report.summary.structure.valid}/${report.summary.structure.total} (${percent(report.summary.structure.valid_rate)})\n` +
    `- 延迟: 中位 ${report.summary.latency_ms.median}ms，范围 ${report.summary.latency_ms.minimum}–${report.summary.latency_ms.maximum}ms\n` +
    `- Token: input ${report.summary.usage.inputTokens}，cached ${report.summary.usage.cachedInputTokens}，output ${report.summary.usage.outputTokens}，reasoning ${report.summary.usage.reasoningTokens}，total ${report.summary.usage.totalTokens}\n` +
    `- 估算成本: $${report.summary.estimated_cost_usd} USD（按运行时记录单价估算，非账单）\n` +
    `- Response ID: ${report.summary.evidence.responses_with_id} 条，唯一 ${report.summary.evidence.unique_response_ids} 条；唯一响应哈希 ${report.summary.evidence.unique_raw_response_hashes} 条\n` +
    `- 真人预览编辑率、修正耗时、最终保存一致性: NOT_MEASURED\n\n` +
    `## 逐题结果\n\n` +
    `| 用例 | 分组 | HTTP | 结构有效 | 判定 | 延迟ms | 规则判定说明 |\n` +
    `|---|---|---:|---|---|---:|---|\n${rows.join('\n')}\n\n` +
    `## 解释边界\n\n` +
    `本轮为一次、合成、API parse-only 回归。评测器每题只发一个请求且不重试。它不代表外部用户表现、线上 SLA、真实保存流程或健康结果。原始接口响应保存在同名 JSON 的 \`records[].raw_response_or_error\`。\n`
  )
}

async function main() {
  const { source, cases } = parseCases()
  const selfChecks = runOfflineSelfCheck(cases)

  if (flags.has('validate-only')) {
    console.log(
      JSON.stringify(
        {
          suite_id: 'gym-workout-parser-v2',
          status: 'NOT_RUN',
          network_requests: 0,
          cases: cases.length,
          dataset_sha256: sha256(source),
          scorer_self_checks: selfChecks,
        },
        null,
        2,
      ),
    )
    return
  }

  if (!flags.has('live')) {
    throw new Error(
      'Dry-run protection: no requests were sent. Use --validate-only for offline checks, or add --live to authorize exactly 20 paid API calls.',
    )
  }

  const baseUrl = (args.get('base-url') ?? 'http://localhost:3000').replace(/\/$/, '')
  const runStartedAt = new Date()
  const runId =
    args.get('run-id') ??
    runStartedAt.toISOString().replace(/[:.]/g, '-').replace('Z', 'Z-gpt5mini-v2')
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(runId)) {
    throw new Error('--run-id must use 1-128 letters, numbers, dots, underscores, or hyphens')
  }
  const resultsDir = resolve(suiteDir, 'results')
  const outputPath = resolve(args.get('output') ?? join(resultsDir, `${runId}.json`))
  const outputWithinResults = relative(resultsDir, outputPath)
  if (
    outputWithinResults === '..' ||
    outputWithinResults.startsWith(`..${sep}`) ||
    isAbsolute(outputWithinResults)
  ) {
    throw new Error('--output must stay inside evals/workout-parser/v2/results')
  }
  if (!outputPath.toLowerCase().endsWith('.json')) {
    throw new Error('--output must end in .json')
  }
  const markdownPath = outputPath.replace(/\.json$/i, '.md')
  const checkpointPath = outputPath.replace(/\.json$/i, '.partial.json')

  if (existsSync(outputPath) || existsSync(markdownPath) || existsSync(checkpointPath)) {
    throw new Error(`Run ID or output already exists: ${runId}`)
  }

  const productSnapshot = captureProductSnapshot()
  const records = []
  mkdirSync(dirname(outputPath), { recursive: true })
  const writeCheckpoint = () =>
    writeFileSync(
      checkpointPath,
      `${JSON.stringify(
        {
          schema_version: 2,
          suite_id: 'gym-workout-parser-v2',
          run_id: runId,
          started_at: runStartedAt.toISOString(),
          complete: false,
          evaluator_retry_count: 0,
          product_snapshot: productSnapshot,
          records,
        },
        null,
        2,
      )}\n`,
      'utf8',
    )

  writeCheckpoint()
  for (const testCase of cases) {
    const record = await runCase(testCase, baseUrl, runId)
    records.push(record)
    writeCheckpoint()
    console.error(`${record.case_id}: ${record.verdict} (${record.latency_ms}ms)`)
    if (record.fatal) {
      throw new Error(
        `${record.case_id} encountered a fatal request or evidence failure; aborted after ${records.length} attempts to preserve sequential cost evidence. See ${checkpointPath}`,
      )
    }
  }

  const completedSnapshot = captureProductSnapshot()
  if (!sameCriticalSource(productSnapshot, completedSnapshot)) {
    throw new Error(
      `Critical source changed during the run; results are invalid and remain in ${checkpointPath}`,
    )
  }
  if (
    records.length !== 20 ||
    records.some(
      (record) =>
        record.provider_sdk_max_retries !== 0 ||
        record.provider_timeout_ms !== 110_000 ||
        !record.response_id,
    ) ||
    new Set(records.map((record) => record.response_id)).size !== 20
  ) {
    throw new Error(
      `Provider retry/timeout or Response ID evidence is incomplete; results remain in ${checkpointPath}`,
    )
  }

  const summary = makeSummary(records)
  const report = {
    schema_version: 2,
    suite_id: 'gym-workout-parser-v2',
    run_id: runId,
    started_at: runStartedAt.toISOString(),
    completed_at: new Date().toISOString(),
    run_policy: {
      authorized_by_live_flag: true,
      expected_requests: 20,
      completed_requests: records.length,
      evaluator_retries: 0,
      provider_sdk_max_retries: 0,
      provider_timeout_ms: 110_000,
      execution: 'sequential',
    },
    product_snapshot: {
      ...productSnapshot,
      verified_unchanged_through_completion: true,
      completed_git_head: completedSnapshot.git_head,
      completed_file_hashes: completedSnapshot.file_hashes,
    },
    dataset: {
      path: 'evals/workout-parser/v2/cases.jsonl',
      sha256: sha256(source),
      total: cases.length,
      core: cases.filter((item) => item.supported === 'core').length,
      boundary: cases.filter((item) => item.supported === 'boundary').length,
      synthetic: true,
    },
    requested_model_id: 'gpt-5-mini-2025-08-07',
    actual_model_id: records.find((record) => record.actual_model_id)?.actual_model_id ?? null,
    actual_model_ids: [...new Set(records.map((record) => record.actual_model_id).filter(Boolean))],
    prompt_version: 'workout-parser-v2',
    environment: `Node ${process.version}; ${process.platform} ${process.arch}; local Vercel dev; Codex synthetic runner v2`,
    base_url: baseUrl,
    tester_code: 'codex-local-synthetic-v2',
    summary,
    records,
  }

  writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
  writeFileSync(markdownPath, markdown(report), 'utf8')
  rmSync(checkpointPath, { force: true })
  console.log(JSON.stringify({ outputPath, markdownPath, summary }, null, 2))
}

await main()
