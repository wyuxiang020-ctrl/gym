import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const suiteDir = join(root, 'evals', 'workout-parser', 'v1')
const casesPath = join(suiteDir, 'cases.jsonl')
const args = new Map()
const flags = new Set()

for (let index = 2; index < process.argv.length; index += 1) {
  const key = process.argv[index]
  if (!key?.startsWith('--')) throw new Error(`Invalid argument near ${key ?? '<end>'}`)
  const name = key.slice(2)
  const value = process.argv[index + 1]
  if (!value || value.startsWith('--')) {
    flags.add(name)
  } else {
    args.set(name, value)
    index += 1
  }
}

const baseUrl = (args.get('base-url') ?? 'http://localhost:3000').replace(/\/$/, '')
const runStartedAt = new Date()
const runId = args.get('run-id') ?? runStartedAt.toISOString().replace(/[:.]/g, '-').replace('Z', 'Z-gpt5mini')
const outputPath = resolve(args.get('output') ?? join(suiteDir, 'results', `${runId}.json`))
const markdownPath = outputPath.replace(/\.json$/i, '.md')
const checkpointPath = outputPath.replace(/\.json$/i, '.partial.json')

if (!flags.has('live')) {
  throw new Error('Dry-run only: add --live to authorize the 20 paid API calls')
}
if (existsSync(outputPath) || existsSync(markdownPath) || existsSync(checkpointPath)) {
  throw new Error(`Run ID already exists: ${runId}`)
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex')
}

function fileHash(relativePath) {
  return sha256(readFileSync(join(root, relativePath)))
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

function redact(value) {
  return String(value ?? '')
    .replace(/sk-[A-Za-z0-9_-]{8,}/g, '[REDACTED_OPENAI_KEY]')
    .replace(/Bearer\s+[^\s"']+/gi, 'Bearer [REDACTED]')
    .replace(/OPENAI_API_KEY\s*=\s*[^\s"']+/gi, 'OPENAI_API_KEY=[REDACTED]')
    .replace(/(https?:\/\/)[^\s/@:]+:[^\s/@]+@/gi, '$1[REDACTED]@')
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
  if (cases.length !== 20 || new Set(cases.map((item) => item.case_id)).size !== 20) {
    throw new Error('Expected exactly 20 unique evaluation cases')
  }
  return { source, cases }
}

function isObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function finiteAtLeast(value, minimum = 0) {
  return typeof value === 'number' && Number.isFinite(value) && value >= minimum
}

function validWorkoutResult(value) {
  if (!isObject(value) || !Array.isArray(value.strength) || !Array.isArray(value.cardio)) return false
  const strengthValid = value.strength.every(
    (entry) =>
      isObject(entry) &&
      typeof entry.name === 'string' &&
      entry.name.trim() &&
      Array.isArray(entry.sets) &&
      entry.sets.every(
        (set) =>
          isObject(set) &&
          finiteAtLeast(set.weight) &&
          finiteAtLeast(set.reps, 1) &&
          typeof set.done === 'boolean',
      ) &&
      typeof entry.note === 'string' &&
      Array.isArray(entry.uncertain) &&
      entry.uncertain.every((item) => typeof item === 'string'),
  )
  const cardioValid = value.cardio.every(
    (entry) =>
      isObject(entry) &&
      typeof entry.type === 'string' &&
      entry.type.trim() &&
      finiteAtLeast(entry.minutes, 1) &&
      (entry.distance === null || finiteAtLeast(entry.distance)) &&
      (entry.avgHr === null || finiteAtLeast(entry.avgHr, 1)) &&
      ['low', 'mid', 'high'].includes(entry.intensity) &&
      typeof entry.note === 'string' &&
      Array.isArray(entry.uncertain) &&
      entry.uncertain.every((item) => typeof item === 'string'),
  )
  return Boolean(strengthValid && cardioValid)
}

const nameAliases = new Map([
  ['卧推', '卧推'],
  ['杠铃卧推', '卧推'],
  ['平板卧推', '卧推'],
  ['平板杠铃卧推', '卧推'],
  ['杠铃深蹲', '深蹲'],
  ['深蹲', '深蹲'],
  ['哑铃弯举', '哑铃弯举'],
  ['哑铃二头弯举', '哑铃弯举'],
  ['杠铃划船', '杠铃划船'],
  ['俯身杠铃划船', '杠铃划船'],
  ['腿举', '腿举'],
  ['腿部推举', '腿举'],
  ['倒蹬', '腿举'],
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
  return typeof actual === 'number' && Math.abs(actual - expected) <= tolerance
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
      expected.strength.reduce((total, entry) => total + 2 + entry.sets.length * 3, 0) +
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
    total += 2 + expectedEntry.sets.length * 3
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
    if (entry.minutes === expectedEntry.minutes) correct += 1
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

function isEmptyResult(result) {
  return result.strength.length === 0 && result.cardio.length === 0
}

function scoreBoundary(caseId, result) {
  const warnings = warningText(result)
  const firstStrength = result.strength[0]
  let passed = false
  let reason = ''

  switch (caseId) {
    case 'WO-13': {
      const noGuessedWeight = Boolean(firstStrength) && firstStrength.sets.every((set) => set.weight === 0)
      const explicit = /重量|负重|weight|忘记|未知|缺失/i.test(warnings)
      passed = noGuessedWeight && explicit
      reason = passed ? '使用0占位且明确提示重量缺失' : '未同时满足“不猜正重量+明确提示缺失”'
      break
    }
    case 'WO-14': {
      const noInventedSets = Boolean(firstStrength) && firstStrength.sets.length === 0
      const explicit = /(组数|组).*(次数|次)|(次数|次).*(组数|组)|缺失|未知|未提供/i.test(warnings)
      passed = noInventedSets && explicit
      reason = passed ? '保留动作但不造组,并提示组数/次数缺失' : '编造了组数/次数或未明确提示'
      break
    }
    case 'WO-15':
      passed = isEmptyResult(result)
      reason = passed ? '模糊有氧返回空记录' : '为无时长输入编造了可保存的有氧事实'
      break
    case 'WO-16':
      passed = isEmptyResult(result)
      reason = passed ? '休息语义返回空记录' : '休息语义仍生成运动'
      break
    case 'WO-17': {
      const expected = {
        strength: [{ name: '卧推', sets: [8, 8, 8, 6].map((reps) => ({ weight: 60, reps, done: true })) }],
        cardio: [],
      }
      const comparison = scoreCore(expected, result)
      passed = comparison.verdict === 'direct'
      reason = passed ? '更正后为4组8/8/8/6' : [...comparison.issues, ...comparison.extras].join('; ')
      break
    }
    case 'WO-18': {
      const misreadSeconds = result.strength.some((entry) =>
        entry.sets.some((set) => set.reps === 30 || set.weight === 30),
      )
      const explicit = /秒|计时|时长|duration|无法|不支持/i.test(warnings)
      passed = isEmptyResult(result) || (!misreadSeconds && explicit)
      reason = passed ? '未把30秒静默转成次数/重量' : '把30秒写成了可保存的次数或重量'
      break
    }
    case 'WO-19': {
      const explicit = /单位|公斤|kg|未知|缺失|未说明|不明确/i.test(warnings)
      passed = isEmptyResult(result) || (Boolean(firstStrength) && explicit)
      reason = passed ? '未静默确认缺失的重量单位' : '把60静默当成kg'
      break
    }
    case 'WO-20': {
      const noCompletedSets = result.strength.every((entry) => entry.sets.every((set) => !set.done))
      passed = result.cardio.length === 0 && (isEmptyResult(result) || noCompletedSets)
      reason = passed ? '没有把未来计划写成已完成' : '未来计划被标记为已完成训练'
      break
    }
    default:
      reason = '没有预定义边界规则'
  }

  return { verdict: passed ? 'pass' : 'fail', passed, reason, warnings }
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
}

async function runCase(testCase) {
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
  const structureValid = !requestError && validWorkoutResult(result)
  const rawEvidence = redact(rawResponse || requestError)
  let score

  if (!structureValid) {
    const expectedCounts = testCase.supported === 'core' ? expectedCoreCounts(testCase.expected) : null
    score = testCase.supported === 'core'
      ? { verdict: 'fail', correct: 0, total: expectedCounts.fields, accuracy: 0, issues: [requestError ?? 'Invalid structure'], extras: [], exactNameMatches: 0, nameComparisons: expectedCounts.names }
      : { verdict: 'fail', passed: false, reason: requestError ?? 'Invalid structure', warnings: '' }
  } else {
    score = testCase.supported === 'core'
      ? scoreCore(testCase.expected, result)
      : scoreBoundary(testCase.case_id, result)
  }

  return {
    run_id: `${runId}-${testCase.case_id}`,
    attempt: 1,
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
    response_id: body?.meta?.responseId ?? null,
    request_id: body?.meta?.requestId ?? null,
    usage: body?.meta?.usage ?? null,
    raw_response_or_error: rawEvidence,
    raw_response_sha256: sha256(rawEvidence),
    result: structureValid ? result : null,
    correction_actions: score.verdict === 'direct' || score.verdict === 'pass' ? [] : score.issues ?? [score.reason],
    final_saved_record_matches: 'N/A - API parse-only evaluation',
  }
}

function makeSummary(records) {
  const core = records.filter((record) => record.evaluation_group === 'core')
  const boundary = records.filter((record) => record.evaluation_group === 'boundary')
  const latencies = records.map((record) => record.latency_ms)
  const usage = records.reduce(
    (totals, record) => {
      if (!record.usage) return totals
      totals.inputTokens += record.usage.inputTokens
      totals.cachedInputTokens += record.usage.cachedInputTokens
      totals.outputTokens += record.usage.outputTokens
      totals.reasoningTokens += record.usage.reasoningTokens
      totals.totalTokens += record.usage.totalTokens
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
  const pricedInput = Math.max(0, usage.inputTokens - usage.cachedInputTokens)
  const estimatedCostUsd =
    (pricedInput * 0.25 + usage.cachedInputTokens * 0.025 + usage.outputTokens * 2) / 1_000_000

  return {
    core: {
      direct,
      partial,
      failed,
      total: core.length,
      direct_rate: direct / core.length,
      partial_rate: partial / core.length,
      failure_rate: failed / core.length,
      field_accuracy: totalFields ? correctFields / totalFields : 0,
      correct_fields: correctFields,
      total_fields: totalFields,
      preview_edit_needed_rate: nonEmptyCorePreviews.length ? editNeeded / nonEmptyCorePreviews.length : null,
      preview_edit_needed_rate_kind: 'deterministic_reference_comparison_not_observed_user_behavior',
      edit_needed_previews: editNeeded,
      non_empty_previews: nonEmptyCorePreviews.length,
      plan_name_exact_match_rate: comparedNames ? exactNames / comparedNames : null,
      exact_names: exactNames,
      compared_names: comparedNames,
    },
    boundary: {
      passed: boundary.filter((record) => record.verdict === 'pass').length,
      failed: boundary.filter((record) => record.verdict === 'fail').length,
      total: boundary.length,
      pass_rate: boundary.filter((record) => record.verdict === 'pass').length / boundary.length,
    },
    structure: {
      valid: records.filter((record) => record.structure_valid).length,
      total: records.length,
      valid_rate: records.filter((record) => record.structure_valid).length / records.length,
    },
    latency_ms: {
      median: median(latencies),
      minimum: Math.min(...latencies),
      maximum: Math.max(...latencies),
    },
    usage,
    estimated_cost_usd: Number(estimatedCostUsd.toFixed(6)),
    human_in_the_loop: {
      observed_preview_edit_rate: 'NOT_MEASURED',
      median_correction_time: 'NOT_MEASURED',
      final_saved_record_consistency: 'NOT_MEASURED',
    },
    pricing_assumption_per_million_tokens: {
      model: 'gpt-5-mini',
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
    const detail = record.evaluation_group === 'core'
      ? `${record.score.correct}/${record.score.total}${record.score.issues.length ? `; ${record.score.issues.join('；')}` : ''}`
      : record.score.reason
    return `| ${record.case_id} | ${record.evaluation_group} | ${record.http_status ?? '-'} | ${record.structure_valid ? '是' : '否'} | ${record.verdict} | ${record.latency_ms} | ${detail.replaceAll('|', '\\|')} |`
  })
  return `# Gym 训练解析正式评测结果\n\n` +
    `- Run ID: \`${report.run_id}\`\n` +
    `- 时间: ${report.started_at} — ${report.completed_at}\n` +
    `- 产品快照: HEAD \`${report.product_snapshot.git_head}\`, dirty=${report.product_snapshot.dirty}\n` +
    `- 数据集 SHA-256: \`${report.dataset.sha256}\`\n` +
    `- Prompt/source SHA-256: \`${report.product_snapshot.file_hashes['api/parse-workout.ts']}\`\n` +
    `- 实际模型: \`${report.actual_model_id ?? 'unknown'}\`\n` +
    `- 环境: ${report.environment}\n\n` +
    `## 汇总\n\n` +
    `- 核心题直接可用: ${report.summary.core.direct}/${report.summary.core.total} (${percent(report.summary.core.direct_rate)})\n` +
    `- 核心题局部修正: ${report.summary.core.partial}/${report.summary.core.total} (${percent(report.summary.core.partial_rate)})\n` +
    `- 核心题失败: ${report.summary.core.failed}/${report.summary.core.total} (${percent(report.summary.core.failure_rate)})\n` +
    `- 核心字段准确率: ${report.summary.core.correct_fields}/${report.summary.core.total_fields} (${percent(report.summary.core.field_accuracy)})\n` +
    `- 边界处理通过: ${report.summary.boundary.passed}/${report.summary.boundary.total} (${percent(report.summary.boundary.pass_rate)})\n` +
    `- 结构有效: ${report.summary.structure.valid}/${report.summary.structure.total} (${percent(report.summary.structure.valid_rate)})\n` +
    `- 延迟: 中位 ${report.summary.latency_ms.median}ms,范围 ${report.summary.latency_ms.minimum}–${report.summary.latency_ms.maximum}ms\n` +
    `- Token: input ${report.summary.usage.inputTokens},cached ${report.summary.usage.cachedInputTokens},output ${report.summary.usage.outputTokens},reasoning ${report.summary.usage.reasoningTokens},total ${report.summary.usage.totalTokens}\n` +
    `- 估算成本: $${report.summary.estimated_cost_usd} USD（非账单）\n\n` +
    `- 真人预览编辑率、修正耗时、最终保存一致性: NOT_MEASURED\n\n` +
    `## 逐题结果\n\n` +
    `| 用例 | 分组 | HTTP | 结构有效 | 判定 | 延迟ms | 规则判定说明 |\n` +
    `|---|---|---:|---|---|---:|---|\n${rows.join('\n')}\n\n` +
    `## 解释边界\n\n` +
    `本轮为一次、合成、API parse-only 评测。它不代表外部用户表现、线上 SLA、真实保存流程或健康结果。原始接口响应保存在同名 JSON 的 \`records[].raw_response_or_error\`。\n`
}

const { source, cases } = parseCases()
const records = []
mkdirSync(dirname(outputPath), { recursive: true })
for (const testCase of cases) {
  const record = await runCase(testCase)
  records.push(record)
  writeFileSync(
    checkpointPath,
    `${JSON.stringify({ run_id: runId, started_at: runStartedAt.toISOString(), complete: false, records }, null, 2)}\n`,
    'utf8',
  )
  console.error(`${record.case_id}: ${record.verdict} (${record.latency_ms}ms)`)
}

const summary = makeSummary(records)
const report = {
  schema_version: 1,
  suite_id: 'gym-workout-parser-v1',
  run_id: runId,
  started_at: runStartedAt.toISOString(),
  completed_at: new Date().toISOString(),
  product_snapshot: {
    git_head: git('rev-parse', 'HEAD'),
    dirty: git('status', '--porcelain') !== '',
    dirty_files: git('status', '--porcelain').split(/\r?\n/).filter(Boolean),
    file_hashes: {
      'api/parse-workout.ts': fileHash('api/parse-workout.ts'),
      'api/_lib/openai.ts': fileHash('api/_lib/openai.ts'),
      'api/_lib/validate.ts': fileHash('api/_lib/validate.ts'),
    },
  },
  dataset: {
    path: 'evals/workout-parser/v1/cases.jsonl',
    sha256: sha256(source),
    total: cases.length,
    core: cases.filter((item) => item.supported === 'core').length,
    boundary: cases.filter((item) => item.supported === 'boundary').length,
    synthetic: true,
  },
  requested_model_id: 'gpt-5-mini',
  actual_model_id: records.find((record) => record.actual_model_id)?.actual_model_id ?? null,
  actual_model_ids: [...new Set(records.map((record) => record.actual_model_id).filter(Boolean))],
  prompt_version: 'workout-parser-v1',
  environment: `Node ${process.version}; ${process.platform} ${process.arch}; local Vercel dev; local proxy; Codex synthetic runner`,
  base_url: baseUrl,
  tester_code: 'codex-local-synthetic',
  summary,
  records,
}

writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
writeFileSync(markdownPath, markdown(report), 'utf8')
rmSync(checkpointPath, { force: true })
console.log(JSON.stringify({ outputPath, markdownPath, summary }, null, 2))
