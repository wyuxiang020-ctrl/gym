import sharp from 'sharp'

const baseUrl = (process.argv[2] ?? 'http://127.0.0.1:3000').replace(/\/$/, '')

const validJpeg = await sharp({
  create: { width: 16, height: 16, channels: 3, background: '#ffffff' },
})
  .jpeg()
  .toBuffer()
const truncatedJpeg = validJpeg.subarray(0, Math.floor(validJpeg.length / 2)).toString('base64')
const oversizedJpeg = await sharp({
  create: { width: 4_097, height: 1, channels: 3, background: '#ffffff' },
})
  .jpeg()
  .toBuffer()

const validFoodItem = {
  name: '测试食物',
  grams: 100,
  kcal: 100,
  protein: 10,
  carbs: 10,
  fat: 2,
  confidence: 'mid',
}

const cases = [
  {
    name: '拒绝非 POST 请求',
    path: '/api/parse-workout',
    init: { method: 'GET' },
    status: 405,
    expectRateHeaders: false,
  },
  {
    name: '拒绝非 JSON 请求',
    path: '/api/parse-workout',
    init: {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'text=%E5%8D%A7%E6%8E%A810%E6%AC%A1',
    },
    status: 415,
    expectRateHeaders: false,
  },
  {
    name: '拒绝空训练文字',
    path: '/api/parse-workout',
    payload: {},
    status: 400,
  },
  {
    name: '拒绝超过 2000 字的训练文字',
    path: '/api/parse-workout',
    payload: { text: 'a'.repeat(2001) },
    status: 413,
    expectRateHeaders: false,
  },
  {
    name: '拒绝伪造图片内容',
    path: '/api/analyze-photo',
    payload: { imageBase64: 'aGVsbG8=', mediaType: 'image/jpeg' },
    status: 400,
  },
  {
    name: '拒绝只有 JPEG 文件头的伪图',
    path: '/api/analyze-photo',
    payload: { imageBase64: '/9j/', mediaType: 'image/jpeg' },
    status: 400,
  },
  {
    name: '拒绝被截断的 JPEG',
    path: '/api/analyze-photo',
    payload: { imageBase64: truncatedJpeg, mediaType: 'image/jpeg' },
    status: 400,
  },
  {
    name: '拒绝超过单边像素上限的图片',
    path: '/api/analyze-photo',
    payload: { imageBase64: oversizedJpeg.toString('base64'), mediaType: 'image/jpeg' },
    status: 413,
  },
  {
    name: '拒绝空食物重算清单',
    path: '/api/recalc-meal',
    payload: { items: [], note: '减半' },
    status: 400,
  },
  {
    name: '拒绝超过 1000 字的重算备注',
    path: '/api/recalc-meal',
    payload: { items: [validFoodItem], note: 'a'.repeat(1001) },
    status: 413,
  },
]

let failed = 0
for (const testCase of cases) {
  const init = testCase.init ?? {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(testCase.payload),
  }
  const response = await fetch(`${baseUrl}${testCase.path}`, init)
  const body = await response.json().catch(() => null)
  const protectedHeaders =
    response.headers.get('cache-control') === 'no-store' &&
    (testCase.expectRateHeaders === false ||
      (response.headers.has('x-ratelimit-limit') && response.headers.has('x-ratelimit-remaining')))
  const passed = response.status === testCase.status && typeof body?.error === 'string' && protectedHeaders
  if (!passed) failed += 1
  console.log(
    `${passed ? 'PASS' : 'FAIL'} ${testCase.name}: HTTP ${response.status}; no-store/rate headers=${protectedHeaders}`,
  )
}

if (failed) {
  throw new Error(`${failed}/${cases.length} API guard checks failed`)
}

console.log(`PASS ${cases.length}/${cases.length}; all requests were rejected before any model call`)
