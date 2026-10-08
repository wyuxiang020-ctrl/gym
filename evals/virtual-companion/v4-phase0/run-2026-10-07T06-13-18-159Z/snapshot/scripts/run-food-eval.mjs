import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, extname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const suiteDir = join(root, 'evals', 'food-ai', 'v1')
const casesPath = join(suiteDir, 'cases.jsonl')
const resultsDir = join(suiteDir, 'results')
const runnerRelativePath = 'scripts/run-food-eval.mjs'
const pricing = {
  checked_at: '2026-09-06',
  source: 'https://developers.openai.com/api/docs/models/gpt-5-mini',
  input_usd_per_million: 0.25,
  cached_input_usd_per_million: 0.025,
  output_usd_per_million: 2,
}
const criticalSourcePaths = [
  'api/parse-meal.ts',
  'api/recalc-meal.ts',
  'api/analyze-photo.ts',
  'api/_lib/openai.ts',
  'api/_lib/request.ts',
  'api/_lib/validate.ts',
  'evals/food-ai/v1/cases.jsonl',
  'evals/food-ai/v1/RUBRIC.md',
  'evals/food-ai/v1/assets/ASSET_MANIFEST.md',
  runnerRelativePath,
]
const foodLimits = {
  items: 30,
  nameCharacters: 120,
  grams: 100_000,
  kcal: 100_000,
  macroGrams: 10_000,
}
const allowedValueArgs = new Set(['base-url', 'run-id', 'output', 'only'])
const allowedFlags = new Set(['live', 'validate-only'])
const args = new Map()
const flags = new Set()

for (let index = 2; index < process.argv.length; index += 1) {
  const token = process.argv[index]
  if (!token?.startsWith('--')) throw new Error(`Invalid argument near ${token ?? '<end>'}`)
  const name = token.slice(2)
  const next = process.argv[index + 1]
  if (!next || next.startsWith('--')) {
    if (!allowedFlags.has(name)) throw new Error(`Unknown flag: --${name}`)
    flags.add(name)
  } else {
    if (!allowedValueArgs.has(name)) throw new Error(`Unknown argument: --${name}`)
    args.set(name, next)
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

function isObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function finiteBetween(value, minimum, maximum) {
  return typeof value === 'number' && Number.isFinite(value) && value >= minimum && value <= maximum
}

function validFoodResult(value) {
  if (!isObject(value) || Object.keys(value).length !== 1 || !Array.isArray(value.items)) return false
  if (value.items.length > foodLimits.items) return false
  const expectedKeys = ['name', 'grams', 'kcal', 'protein', 'carbs', 'fat', 'confidence']
  return value.items.every(
    (item) =>
      isObject(item) &&
      Object.keys(item).length === expectedKeys.length &&
      expectedKeys.every((key) => Object.hasOwn(item, key)) &&
      typeof item.name === 'string' &&
      Boolean(item.name.trim()) &&
      item.name.length <= foodLimits.nameCharacters &&
      finiteBetween(item.grams, 0, foodLimits.grams) &&
      finiteBetween(item.kcal, 0, foodLimits.kcal) &&
      finiteBetween(item.protein, 0, foodLimits.macroGrams) &&
      finiteBetween(item.carbs, 0, foodLimits.macroGrams) &&
      finiteBetween(item.fat, 0, foodLimits.macroGrams) &&
      ['high', 'mid', 'low'].includes(item.confidence),
  )
}

const aliasGroups = [
  ['燕麦', ['燕麦', '燕麦片', '燕麦粥', 'oatmeal']],
  ['牛奶', ['牛奶', '纯牛奶']],
  ['脱脂牛奶', ['脱脂牛奶', '脱脂奶']],
  ['全脂牛奶', ['全脂牛奶', '全脂奶']],
  ['香蕉', ['香蕉']],
  ['鸡胸肉', ['鸡胸肉', '鸡胸', '烤鸡胸']],
  ['米饭', ['米饭', '白米饭', '熟米饭', '白饭']],
  ['糙米饭', ['糙米饭', '糙米', '糙米米饭']],
  ['西兰花', ['西兰花', '花椰菜', '绿花椰菜']],
  ['鸡蛋', ['鸡蛋', '水煮蛋', '煎蛋', '卤蛋', '熟鸡蛋', '蛋']],
  ['全麦面包', ['全麦面包', '全麦吐司', '全麦面包片']],
  ['拿铁', ['拿铁', '拿铁咖啡', '咖啡拿铁', '拿铁牛奶咖啡']],
  ['牛角包', ['牛角包', '可颂', '羊角面包']],
  ['麻婆豆腐', ['麻婆豆腐']],
  ['希腊酸奶', ['希腊酸奶', '希腊式酸奶', '酸奶']],
  ['草莓', ['草莓']],
  ['格兰诺拉', ['格兰诺拉', '格兰诺拉麦片', 'granola']],
  ['乳清蛋白粉', ['乳清蛋白粉', '乳清蛋白', '蛋白粉']],
  ['苹果', ['苹果']],
  ['花生酱', ['花生酱']],
  ['炒饭', ['炒饭', '蛋炒饭']],
  ['牛油果', ['牛油果', '鳄梨']],
  ['牛肉面', ['牛肉面', '牛肉汤面']],
  ['无糖可乐', ['无糖可乐', '零度可乐', '零糖可乐', '无糖汽水']],
  ['豆腐', ['豆腐', '煎豆腐', '香煎豆腐']],
  ['蛋白棒', ['蛋白棒', '蛋白质棒']],
  ['蓝莓', ['蓝莓']],
  ['核桃', ['核桃', '核桃仁']],
  ['面条', ['面条', '小麦面', '汤面', '面']],
  ['青菜', ['青菜', '小白菜', '上海青', '油菜', '菜心', 'bokchoy']],
  ['红甜椒', ['红甜椒', '红彩椒', '红椒', '甜椒']],
]

function cleanName(value) {
  return String(value ?? '').toLowerCase().replace(/[\s·・_\-()（）]/g, '')
}

function canonicalName(value) {
  const cleaned = cleanName(value)
  for (const [canonical, aliases] of aliasGroups) {
    if (aliases.some((alias) => cleaned === cleanName(alias))) return canonical
  }
  const candidates = []
  for (const [canonical, aliases] of aliasGroups) {
    for (const alias of aliases) {
      const normalizedAlias = cleanName(alias)
      if (cleaned.includes(normalizedAlias)) {
        candidates.push({ canonical, length: normalizedAlias.length })
      }
    }
  }
  candidates.sort((left, right) => right.length - left.length)
  return candidates[0]?.canonical ?? cleaned
}

function findItem(items, expectedName) {
  const canonical = canonicalName(expectedName)
  return items.find((item) => canonicalName(item.name) === canonical)
}

function near(actual, target, tolerance = 0) {
  return typeof actual === 'number' && Math.abs(actual - target) <= tolerance + 1e-9
}

function clone(value) {
  return JSON.parse(JSON.stringify(value))
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
  const expectedIds = [
    ...Array.from({ length: 15 }, (_, index) => `FT-${String(index + 1).padStart(2, '0')}`),
    ...Array.from({ length: 10 }, (_, index) => `FR-${String(index + 1).padStart(2, '0')}`),
    ...Array.from({ length: 10 }, (_, index) => `FP-${String(index + 1).padStart(2, '0')}`),
  ]
  if (cases.length !== 35 || new Set(cases.map((item) => item.case_id)).size !== 35) {
    throw new Error('Expected exactly 35 unique food evaluation cases')
  }
  if (cases.some((item, index) => item.case_id !== expectedIds[index])) {
    throw new Error('Cases must be ordered FT-01..15, FR-01..10, FP-01..10')
  }
  const counts = Object.groupBy(cases, (item) => item.modality)
  if (counts.text?.length !== 15 || counts.recalc?.length !== 10 || counts.photo?.length !== 10) {
    throw new Error('Expected 15 text, 10 recalc and 10 photo cases')
  }
  for (const testCase of cases) {
    if (!['/api/parse-meal', '/api/recalc-meal', '/api/analyze-photo'].includes(testCase.endpoint)) {
      throw new Error(`${testCase.case_id} has an invalid endpoint`)
    }
    if (!isObject(testCase.expected) || !Array.isArray(testCase.expected.items)) {
      throw new Error(`${testCase.case_id} has invalid expectations`)
    }
    if (testCase.modality === 'photo') {
      if (typeof testCase.image_path !== 'string' || !existsSync(join(root, testCase.image_path))) {
        throw new Error(`${testCase.case_id} image is missing`)
      }
      const bytes = readFileSync(join(root, testCase.image_path))
      if (bytes.length === 0 || bytes.length > 3 * 1024 * 1024) {
        throw new Error(`${testCase.case_id} image must be between 1 byte and 3 MB`)
      }
    } else if (!isObject(testCase.body)) {
      throw new Error(`${testCase.case_id} has no request body`)
    }
    for (const expectedName of testCase.expected.items) {
      if (typeof expectedName !== 'string' || !expectedName.trim()) {
        throw new Error(`${testCase.case_id} contains an invalid expected item`)
      }
    }
  }
  return { source, cases }
}

function imagePaths(cases) {
  return [...new Set(cases.filter((item) => item.image_path).map((item) => item.image_path))]
}

function sourceHashes(cases) {
  return Object.fromEntries(
    [...criticalSourcePaths, ...imagePaths(cases)].map((path) => [path, fileHash(path)]),
  )
}

function captureSnapshot(cases) {
  const dirtyFiles = git('status', '--porcelain').split(/\r?\n/).filter(Boolean)
  return {
    git_head: git('rev-parse', 'HEAD'),
    dirty: dirtyFiles.length > 0,
    dirty_files: dirtyFiles,
    file_hashes: sourceHashes(cases),
  }
}

function sameCriticalSource(left, right) {
  const paths = Object.keys(left.file_hashes)
  return left.git_head === right.git_head && paths.every((path) => left.file_hashes[path] === right.file_hashes[path])
}

function requestBody(testCase) {
  if (testCase.modality !== 'photo') return clone(testCase.body)
  const bytes = readFileSync(join(root, testCase.image_path))
  const extension = extname(testCase.image_path).toLowerCase()
  const mediaType = extension === '.png' ? 'image/png' : extension === '.webp' ? 'image/webp' : 'image/jpeg'
  return { imageBase64: bytes.toString('base64'), mediaType }
}

function compareExactFood(actual, expected) {
  return (
    canonicalName(actual.name) === canonicalName(expected.name) &&
    near(actual.grams, expected.grams) &&
    near(actual.kcal, expected.kcal) &&
    near(actual.protein, expected.protein) &&
    near(actual.carbs, expected.carbs) &&
    near(actual.fat, expected.fat) &&
    actual.confidence === expected.confidence
  )
}

function scoreCase(testCase, result) {
  if (!validFoodResult(result)) {
    return {
      verdict: 'fail', structure_valid: false, expected_items: testCase.expected.items.length,
      matched_items: 0, actual_items: 0, extra_items: [], hard_checks_passed: 0,
      hard_checks_total: 1, issues: ['接口结果不符合严格 FoodResult 结构'],
    }
  }

  const items = result.items
  const expectedNames = testCase.expected.items
  const matched = expectedNames.filter((name) => Boolean(findItem(items, name)))
  const expectedCanonicals = new Set(expectedNames.map(canonicalName))
  const extraItems = items.filter((item) => !expectedCanonicals.has(canonicalName(item.name))).map((item) => item.name)
  const issues = []
  const hardChecks = []
  const check = (passed, success, failure) => {
    hardChecks.push(Boolean(passed))
    if (!passed) issues.push(failure)
    return passed ? success : failure
  }

  for (const name of expectedNames) {
    check(Boolean(findItem(items, name)), `识别:${name}`, `缺少:${name}`)
  }
  const maxExtras = testCase.expected.max_extra_items ?? 0
  check(extraItems.length <= maxExtras, '多余项目在允许范围', `多余项目:${extraItems.join('、') || '无'}，允许${maxExtras}项`)

  for (const [name, rule] of Object.entries(testCase.expected.grams ?? {})) {
    const item = findItem(items, name)
    check(Boolean(item) && near(item.grams, rule.value, rule.tolerance), `${name}克数命中`, `${name}克数:${item?.grams ?? '缺失'}，期望${rule.value}±${rule.tolerance}`)
  }

  for (const [name, nutrients] of Object.entries(testCase.expected.nutrition ?? {})) {
    const item = findItem(items, name)
    for (const [field, rule] of Object.entries(nutrients)) {
      check(Boolean(item) && near(item[field], rule.value, rule.tolerance), `${name}.${field}命中`, `${name}.${field}:${item?.[field] ?? '缺失'}，期望${rule.value}±${rule.tolerance}`)
    }
  }

  for (const name of testCase.expected.absent_items ?? []) {
    check(!findItem(items, name), `${name}已删除`, `${name}仍存在`)
  }

  for (const name of testCase.expected.unchanged_items ?? []) {
    const original = testCase.body.items.find((item) => canonicalName(item.name) === canonicalName(name))
    const actual = findItem(items, name)
    check(Boolean(original && actual && compareExactFood(actual, original)), `${name}保持不变`, `${name}未逐字段保持原值`)
  }

  for (const name of testCase.expected.high_confidence_items ?? []) {
    const item = findItem(items, name)
    check(item?.confidence === 'high', `${name}置信度提升`, `${name}confidence:${item?.confidence ?? '缺失'}，期望high`)
  }

  for (const name of testCase.expected.low_confidence_items ?? []) {
    const item = findItem(items, name)
    check(['low', 'mid'].includes(item?.confidence), `${name}暴露不确定性`, `${name}confidence:${item?.confidence ?? '缺失'}，模糊输入不应为high`)
  }

  for (const pattern of testCase.expected.forbidden_name_patterns ?? []) {
    const present = items.some((item) => cleanName(item.name).includes(cleanName(pattern)))
    check(!present, `未出现禁止名称:${pattern}`, `食物名称包含禁止内容:${pattern}`)
  }

  const recall = expectedNames.length === 0 ? (items.length === 0 ? 1 : 0) : matched.length / expectedNames.length
  const semanticPrecision = items.length === 0 ? (expectedNames.length === 0 ? 1 : 0) : (items.length - extraItems.length) / items.length
  const allHardPassed = hardChecks.every(Boolean)
  const verdict = allHardPassed ? 'direct' : recall >= 2 / 3 ? 'partial' : 'fail'
  return {
    verdict,
    structure_valid: true,
    expected_items: expectedNames.length,
    matched_items: matched.length,
    actual_items: items.length,
    semantic_recall: recall,
    semantic_precision: semanticPrecision,
    extra_items: extraItems,
    hard_checks_passed: hardChecks.filter(Boolean).length,
    hard_checks_total: hardChecks.length,
    confidence_distribution: Object.fromEntries(['high', 'mid', 'low'].map((level) => [level, items.filter((item) => item.confidence === level).length])),
    issues,
  }
}

function classifyOutcome(httpStatus, requestError, responseId) {
  const hasResponseId = typeof responseId === 'string' && Boolean(responseId.trim())
  const ok = Number.isInteger(httpStatus) && httpStatus >= 200 && httpStatus < 300
  const paidModelFailure = httpStatus === 422 && hasResponseId
  return { fatal: !paidModelFailure && (!ok || Boolean(requestError) || !hasResponseId), paidModelFailure }
}

function estimateCost(usage) {
  if (!usage) return null
  const cached = usage.cachedInputTokens ?? 0
  const uncached = Math.max(0, (usage.inputTokens ?? 0) - cached)
  return (
    (uncached * pricing.input_usd_per_million + cached * pricing.cached_input_usd_per_million + (usage.outputTokens ?? 0) * pricing.output_usd_per_million) /
    1_000_000
  )
}

async function runCase(testCase, baseUrl, runId) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 120_000)
  const startedAt = Date.now()
  let httpStatus = null
  let payload = null
  let requestError = null
  try {
    const response = await fetch(`${baseUrl}${testCase.endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Eval-Run-Id': runId, 'X-Eval-Case-Id': testCase.case_id },
      body: JSON.stringify(requestBody(testCase)),
      signal: controller.signal,
    })
    httpStatus = response.status
    const responseText = await response.text()
    try {
      payload = JSON.parse(responseText)
    } catch {
      payload = { unparsed_response: redact(responseText) }
    }
  } catch (error) {
    requestError = redact(error instanceof Error ? `${error.name}: ${error.message}` : error)
  } finally {
    clearTimeout(timer)
  }

  const latencyMs = Date.now() - startedAt
  const meta = payload?.meta
  const responseId = meta?.responseId ?? null
  const outcome = classifyOutcome(httpStatus, requestError, responseId)
  const structuredResult = payload?.result
  const score = outcome.paidModelFailure || requestError ? {
    verdict: 'fail', structure_valid: false, expected_items: testCase.expected.items.length,
    matched_items: 0, actual_items: 0, extra_items: [], hard_checks_passed: 0,
    hard_checks_total: 1, issues: [payload?.error ?? requestError ?? '模型输出失败'],
  } : scoreCase(testCase, structuredResult)
  const responseEvidence = redact(JSON.stringify(payload))
  return {
    case_id: testCase.case_id,
    modality: testCase.modality,
    category: testCase.category,
    endpoint: testCase.endpoint,
    input_text: testCase.body?.text ?? null,
    input_note: testCase.body?.note ?? null,
    image_path: testCase.image_path ?? null,
    expected: testCase.expected,
    note: testCase.note,
    http_status: httpStatus,
    request_error: requestError,
    fatal: outcome.fatal,
    paid_model_output_failure: outcome.paidModelFailure,
    latency_ms: latencyMs,
    actual_model_id: meta?.model ?? null,
    response_id: responseId,
    request_id: meta?.requestId ?? null,
    provider_sdk_max_retries: meta?.sdkMaxRetries ?? null,
    provider_timeout_ms: meta?.timeoutMs ?? null,
    usage: meta?.usage ?? null,
    estimated_cost_usd: estimateCost(meta?.usage),
    response_sha256: sha256(responseEvidence),
    response: payload,
    ...score,
  }
}

function percentile(values, p) {
  if (!values.length) return null
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * p) - 1)]
}

function summarizeGroup(records) {
  const expected = records.reduce((sum, item) => sum + item.expected_items, 0)
  const matched = records.reduce((sum, item) => sum + item.matched_items, 0)
  const actual = records.reduce((sum, item) => sum + item.actual_items, 0)
  const extras = records.reduce((sum, item) => sum + item.extra_items.length, 0)
  return {
    total: records.length,
    direct: records.filter((item) => item.verdict === 'direct').length,
    partial: records.filter((item) => item.verdict === 'partial').length,
    fail: records.filter((item) => item.verdict === 'fail').length,
    structure_valid: records.filter((item) => item.structure_valid).length,
    semantic_item_recall: expected ? matched / expected : null,
    semantic_item_precision: actual ? (actual - extras) / actual : null,
    hard_check_accuracy: records.reduce((sum, item) => sum + item.hard_checks_total, 0)
      ? records.reduce((sum, item) => sum + item.hard_checks_passed, 0) / records.reduce((sum, item) => sum + item.hard_checks_total, 0)
      : null,
  }
}

function makeSummary(records) {
  const usage = records.map((item) => item.usage).filter(Boolean)
  const total = (field) => usage.reduce((sum, item) => sum + (item[field] ?? 0), 0)
  return {
    overall: summarizeGroup(records),
    by_modality: Object.fromEntries(['text', 'recalc', 'photo'].map((modality) => [modality, summarizeGroup(records.filter((item) => item.modality === modality))])),
    latency_ms: { median: percentile(records.map((item) => item.latency_ms), 0.5), p95: percentile(records.map((item) => item.latency_ms), 0.95) },
    usage: {
      input_tokens: total('inputTokens'), cached_input_tokens: total('cachedInputTokens'),
      output_tokens: total('outputTokens'), reasoning_tokens: total('reasoningTokens'), total_tokens: total('totalTokens'),
    },
    estimated_cost_usd: records.reduce((sum, item) => sum + (item.estimated_cost_usd ?? 0), 0),
    human_metrics: {
      observed_preview_edit_rate: 'NOT_MEASURED', median_correction_time: 'NOT_MEASURED',
      final_saved_record_consistency: 'NOT_MEASURED', user_trust: 'NOT_MEASURED',
    },
  }
}

function percent(value) {
  return value === null || value === undefined ? 'N/A' : `${(value * 100).toFixed(1)}%`
}

function markdown(report) {
  const rows = report.records.map((record) => `| ${record.case_id} | ${record.modality} | ${record.verdict} | ${record.matched_items}/${record.expected_items} | ${record.hard_checks_passed}/${record.hard_checks_total} | ${record.latency_ms} | ${record.issues.join('；') || '—'} |`).join('\n')
  const modalityRows = Object.entries(report.summary.by_modality).map(([name, item]) => `| ${name} | ${item.total} | ${item.direct} | ${item.partial} | ${item.fail} | ${percent(item.semantic_item_recall)} | ${percent(item.semantic_item_precision)} | ${percent(item.hard_check_accuracy)} |`).join('\n')
  return `# Gym 饮食 AI 正式评测：${report.run_id}\n\n> 本次 ${report.summary.overall.total} 条均为合成数据，不代表真实用户、真实摄入量或医学结论。图片 direct 仅表示可进入人工确认。\n\n## 汇总\n\n| 模态 | 数量 | Direct | Partial | Fail | 语义召回 | 语义精确率 | 硬检查准确率 |\n|---|---:|---:|---:|---:|---:|---:|---:|\n${modalityRows}\n| overall | ${report.summary.overall.total} | ${report.summary.overall.direct} | ${report.summary.overall.partial} | ${report.summary.overall.fail} | ${percent(report.summary.overall.semantic_item_recall)} | ${percent(report.summary.overall.semantic_item_precision)} | ${percent(report.summary.overall.hard_check_accuracy)} |\n\n- 结构有效：${report.summary.overall.structure_valid}/${report.summary.overall.total}\n- 延迟：median ${report.summary.latency_ms.median}ms，p95 ${report.summary.latency_ms.p95}ms\n- Token：${report.summary.usage.total_tokens}（input ${report.summary.usage.input_tokens} / output ${report.summary.usage.output_tokens} / reasoning ${report.summary.usage.reasoning_tokens}）\n- 估算成本：$${report.summary.estimated_cost_usd.toFixed(6)}；不是账单\n- 真人指标：NOT_MEASURED\n\n## 逐题\n\n| Case | 模态 | 判定 | 语义命中 | 硬检查 | 延迟 ms | 问题 |\n|---|---|---|---:|---:|---:|---|\n${rows}\n\n## 可复现证据\n\n- 实际模型：${report.actual_model_ids.join(', ') || '缺失'}\n- Git HEAD：${report.product_snapshot.git_head}\n- 运行前工作区：${report.product_snapshot.dirty ? 'dirty（已记录文件清单）' : 'clean'}\n- 数据集 SHA-256：${report.dataset.sha256}\n- SDK 重试：0；执行方式：串行；请求数：${report.run_policy.completed_requests}/${report.run_policy.expected_requests}\n- 运行期间关键源码与图片哈希保持不变：${report.product_snapshot.verified_unchanged_through_completion ? '是' : '否'}\n- 定价核对：${report.pricing.checked_at}，${report.pricing.source}\n`
}

function selfCheck(cases) {
  if (!validFoodResult({ items: [] })) throw new Error('Empty FoodResult must be valid')
  if (!validFoodResult({ items: [{ name: '苹果', grams: 100, kcal: 52, protein: 0.3, carbs: 13.8, fat: 0.2, confidence: 'high' }] })) throw new Error('Valid FoodResult rejected')
  if (validFoodResult({ items: [{ name: '苹果', grams: -1, kcal: 52, protein: 0.3, carbs: 13.8, fat: 0.2, confidence: 'high' }] })) throw new Error('Negative grams accepted')
  if (canonicalName('烤鸡胸肉') !== '鸡胸肉' || canonicalName('红彩椒') !== '红甜椒') throw new Error('Alias self-check failed')
  if (canonicalName('拿铁（牛奶咖啡）') !== '拿铁' || canonicalName('格兰诺拉燕麦（granola）') !== '格兰诺拉' || canonicalName('糙米（熟）') !== '糙米饭') throw new Error('Compound alias self-check failed')
  const direct = scoreCase(cases.find((item) => item.case_id === 'FT-02'), { items: [
    { name: '烤鸡胸肉', grams: 150, kcal: 248, protein: 46, carbs: 0, fat: 5, confidence: 'high' },
    { name: '白米饭', grams: 200, kcal: 232, protein: 5, carbs: 52, fat: 1, confidence: 'high' },
    { name: '西兰花', grams: 100, kcal: 35, protein: 2, carbs: 7, fat: 0.5, confidence: 'high' },
  ] })
  if (direct.verdict !== 'direct') throw new Error('Direct score self-check failed')
  const fail = scoreCase(cases.find((item) => item.case_id === 'FT-07'), { items: [{ name: '苹果', grams: 100, kcal: 52, protein: 0.3, carbs: 14, fat: 0.2, confidence: 'high' }] })
  if (fail.verdict !== 'fail') throw new Error('Empty-result score self-check failed')
  return 9
}

async function main() {
  const { source, cases } = parseCases()
  const selfChecks = selfCheck(cases)
  const mode = flags.has('live') ? 'live' : 'validate-only'
  if (!flags.has('live')) {
    console.log(JSON.stringify({ mode, suite: 'gym-food-ai-v1', cases: cases.length, text: 15, recalc: 10, photo: 10, image_bytes: imagePaths(cases).reduce((sum, path) => sum + readFileSync(join(root, path)).length, 0), self_checks: selfChecks, network_requests: 0 }, null, 2))
    return
  }

  const baseUrl = (args.get('base-url') ?? 'http://127.0.0.1:3100').replace(/\/$/, '')
  const only = args.get('only')
  if (only && !['text', 'recalc', 'photo'].includes(only)) throw new Error('--only must be text, recalc or photo')
  const selectedCases = only ? cases.filter((item) => item.modality === only) : cases
  const runId = args.get('run-id')
  if (!runId || !/^[A-Za-z0-9._-]{6,100}$/.test(runId)) throw new Error('--run-id is required and must contain only letters, digits, dot, underscore or hyphen')
  const outputPath = resolve(args.get('output') ?? join(resultsDir, `${runId}.json`))
  const markdownPath = outputPath.replace(/\.json$/i, '.md')
  const checkpointPath = outputPath.replace(/\.json$/i, '.partial.json')
  for (const path of [outputPath, markdownPath, checkpointPath]) {
    if (existsSync(path)) throw new Error(`Refusing to overwrite existing result: ${path}`)
  }

  const startedAt = new Date()
  const productSnapshot = captureSnapshot(cases)
  const records = []
  mkdirSync(dirname(outputPath), { recursive: true })
  const writeCheckpoint = () => writeFileSync(checkpointPath, `${JSON.stringify({ schema_version: 1, suite_id: 'gym-food-ai-v1', run_id: runId, started_at: startedAt.toISOString(), complete: false, evaluator_retry_count: 0, product_snapshot: productSnapshot, records }, null, 2)}\n`, 'utf8')
  writeCheckpoint()

  let lastStart = 0
  for (const testCase of selectedCases) {
    const remainingPace = 2_100 - (Date.now() - lastStart)
    if (remainingPace > 0) await new Promise((resolveWait) => setTimeout(resolveWait, remainingPace))
    lastStart = Date.now()
    const record = await runCase(testCase, baseUrl, runId)
    records.push(record)
    writeCheckpoint()
    console.error(`${record.case_id}: ${record.verdict} (${record.latency_ms}ms)`)
    if (record.fatal) throw new Error(`${record.case_id} encountered a fatal request/evidence failure; aborted after ${records.length} attempts. See ${checkpointPath}`)
  }

  const completedSnapshot = captureSnapshot(cases)
  if (!sameCriticalSource(productSnapshot, completedSnapshot)) throw new Error(`Critical source or image changed during the run; results remain in ${checkpointPath}`)
  if (records.length !== selectedCases.length || records.some((record) => record.provider_sdk_max_retries !== 0 || record.provider_timeout_ms !== 110_000 || !record.response_id) || new Set(records.map((record) => record.response_id)).size !== selectedCases.length) {
    throw new Error(`Provider evidence is incomplete; results remain in ${checkpointPath}`)
  }

  const report = {
    schema_version: 1,
    suite_id: 'gym-food-ai-v1',
    run_id: runId,
    started_at: startedAt.toISOString(),
    completed_at: new Date().toISOString(),
    run_policy: { authorized_by_live_flag: true, selected_modality: only ?? 'all', expected_requests: selectedCases.length, completed_requests: records.length, evaluator_retries: 0, provider_sdk_max_retries: 0, provider_timeout_ms: 110_000, evaluator_timeout_ms: 120_000, execution: 'sequential', minimum_start_interval_ms: 2_100 },
    product_snapshot: { ...productSnapshot, verified_unchanged_through_completion: true, completed_git_head: completedSnapshot.git_head, completed_file_hashes: completedSnapshot.file_hashes },
    dataset: { path: 'evals/food-ai/v1/cases.jsonl', sha256: sha256(source), total: 35, selected_total: selectedCases.length, text: 15, recalc: 10, photo: 10, synthetic: true, real_users: 0 },
    requested_model_id: 'gpt-5-mini-2025-08-07',
    actual_model_ids: [...new Set(records.map((record) => record.actual_model_id).filter(Boolean))],
    prompt_version: 'food-ai-v1',
    environment: `Node ${process.version}; ${process.platform} ${process.arch}; local Vercel dev; Codex synthetic runner`,
    base_url: baseUrl,
    tester_code: 'codex-local-synthetic-food-v1',
    pricing,
    summary: makeSummary(records),
    records,
  }
  writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
  writeFileSync(markdownPath, markdown(report), 'utf8')
  rmSync(checkpointPath, { force: true })
  console.log(JSON.stringify({ outputPath, markdownPath, summary: report.summary }, null, 2))
}

await main()
