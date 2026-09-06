import type { VercelRequest, VercelResponse } from '@vercel/node'
import sharp from 'sharp'
import { FOOD_RESULT_LIMITS } from './validate.js'

export const REQUEST_LIMITS = {
  textCharacters: 2_000,
  noteCharacters: 1_000,
  foodItems: 30,
  foodNameCharacters: 120,
  recalcItemsBytes: 32 * 1024,
  imageBytes: 3 * 1024 * 1024,
  imageDimension: 4_096,
  imagePixels: 16_000_000,
  textRequestBytes: 16 * 1024,
  recalcRequestBytes: 64 * 1024,
  imageRequestBytes: Math.ceil(3 * 1024 * 1024 * (4 / 3)) + 4 * 1024,
  requestsPerMinute: 30,
} as const

type JsonObject = Record<string, unknown>

type FoodItemInput = {
  name: string
  grams: number
  kcal: number
  protein: number
  carbs: number
  fat: number
  confidence: 'high' | 'mid' | 'low'
}

export type AllowedImageMediaType = 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif'

type RateWindow = {
  count: number
  resetAt: number
}

const RATE_WINDOW_MS = 60_000
const MAX_TRACKED_IPS = 10_000
const rateWindows = new Map<string, RateWindow>()
const allowedImageMediaTypes = new Set<AllowedImageMediaType>([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
])

function sendError(res: VercelResponse, status: number, error: string): null {
  res.status(status).json({ error })
  return null
}

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function headerValue(req: VercelRequest, name: string): string | undefined {
  const value = req.headers[name]
  return Array.isArray(value) ? value[0] : value
}

function clientIp(req: VercelRequest): string {
  const forwarded = headerValue(req, 'x-forwarded-for')?.split(',')[0]?.trim()
  return (forwarded || headerValue(req, 'x-real-ip') || req.socket.remoteAddress || 'unknown').slice(
    0,
    128,
  )
}

function cleanupRateWindows(now: number) {
  if (rateWindows.size < 1_000) return

  for (const [ip, window] of rateWindows) {
    if (window.resetAt <= now) rateWindows.delete(ip)
  }

  while (rateWindows.size >= MAX_TRACKED_IPS) {
    const oldestIp = rateWindows.keys().next().value
    if (typeof oldestIp !== 'string') break
    rateWindows.delete(oldestIp)
  }
}

function allowWithinRateLimit(req: VercelRequest, res: VercelResponse): boolean {
  const now = Date.now()
  cleanupRateWindows(now)

  const ip = clientIp(req)
  const current = rateWindows.get(ip)
  const window = !current || current.resetAt <= now
    ? { count: 0, resetAt: now + RATE_WINDOW_MS }
    : current

  res.setHeader('X-RateLimit-Limit', String(REQUEST_LIMITS.requestsPerMinute))
  res.setHeader('X-RateLimit-Reset', String(Math.ceil(window.resetAt / 1_000)))

  if (window.count >= REQUEST_LIMITS.requestsPerMinute) {
    res.setHeader('X-RateLimit-Remaining', '0')
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil((window.resetAt - now) / 1_000))))
    sendError(res, 429, '请求过于频繁,请稍后再试。')
    return false
  }

  window.count += 1
  rateWindows.set(ip, window)
  res.setHeader('X-RateLimit-Remaining', String(REQUEST_LIMITS.requestsPerMinute - window.count))
  return true
}

function bodyByteLength(body: unknown): number | null {
  try {
    if (typeof body === 'string') return Buffer.byteLength(body, 'utf8')
    if (Buffer.isBuffer(body)) return body.byteLength
    const serialized = JSON.stringify(body)
    return serialized === undefined ? 0 : Buffer.byteLength(serialized, 'utf8')
  } catch {
    return null
  }
}

export function guardAiRequest(
  req: VercelRequest,
  res: VercelResponse,
  maxBodyBytes: number,
): boolean {
  res.setHeader('Cache-Control', 'no-store')

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    sendError(res, 405, '仅支持 POST 请求。')
    return false
  }

  const contentType = headerValue(req, 'content-type')?.split(';', 1)[0]?.trim().toLowerCase()
  if (contentType !== 'application/json') {
    sendError(res, 415, '请求必须使用 application/json。')
    return false
  }

  const contentLength = Number(headerValue(req, 'content-length'))
  if (Number.isFinite(contentLength) && contentLength > maxBodyBytes) {
    sendError(res, 413, '请求内容过大。')
    return false
  }

  if (!Number.isFinite(contentLength)) {
    const measuredLength = bodyByteLength(req.body)
    if (measuredLength === null) {
      sendError(res, 400, '请求内容不是有效的 JSON。')
      return false
    }
    if (measuredLength > maxBodyBytes) {
      sendError(res, 413, '请求内容过大。')
      return false
    }
  }

  return allowWithinRateLimit(req, res)
}

export function requireJsonBody(req: VercelRequest, res: VercelResponse): JsonObject | null {
  if (!isObject(req.body)) {
    return sendError(res, 400, '请求内容必须是 JSON 对象。')
  }
  return req.body
}

export function requireTextField(
  body: JsonObject,
  field: string,
  maxCharacters: number,
  res: VercelResponse,
): string | null {
  const value = body[field]
  if (typeof value !== 'string' || !value.trim()) {
    return sendError(res, 400, `缺少有效的 "${field}" 字段。`)
  }
  if (value.length > maxCharacters) {
    return sendError(res, 413, `"${field}" 最多允许 ${maxCharacters} 个字符。`)
  }
  return value
}

function detectedImageMediaType(bytes: Buffer): AllowedImageMediaType | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg'
  }
  if (
    bytes.length >= 8 &&
    bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    return 'image/png'
  }
  if (
    bytes.length >= 12 &&
    bytes.subarray(0, 4).toString('ascii') === 'RIFF' &&
    bytes.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return 'image/webp'
  }
  if (bytes.length >= 6 && ['GIF87a', 'GIF89a'].includes(bytes.subarray(0, 6).toString('ascii'))) {
    return 'image/gif'
  }
  return null
}

export async function requireImageInput(
  body: JsonObject,
  res: VercelResponse,
): Promise<{ imageBase64: string; mediaType: 'image/jpeg' } | null> {
  const imageBase64 = body.imageBase64
  if (typeof imageBase64 !== 'string' || !imageBase64.trim()) {
    return sendError(res, 400, '缺少有效的 "imageBase64" 字段。')
  }
  if (imageBase64.startsWith('data:')) {
    return sendError(res, 400, '"imageBase64" 只能包含不带 data: 前缀的 Base64 数据。')
  }

  const mediaType = body.mediaType === undefined ? 'image/jpeg' : body.mediaType
  if (typeof mediaType !== 'string' || !allowedImageMediaTypes.has(mediaType as AllowedImageMediaType)) {
    return sendError(res, 400, '不支持该图片类型,仅支持 JPEG、PNG、WebP 和 GIF。')
  }

  const maxBase64Characters = Math.ceil(REQUEST_LIMITS.imageBytes / 3) * 4
  if (imageBase64.length > maxBase64Characters) {
    return sendError(res, 413, '图片过大,压缩后请不要超过 3 MB。')
  }
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(imageBase64) || imageBase64.length % 4 === 1) {
    return sendError(res, 400, '"imageBase64" 不是有效的 Base64 图片数据。')
  }

  const bytes = Buffer.from(imageBase64, 'base64')
  const canonicalInput = imageBase64.replace(/=+$/, '')
  const canonicalDecoded = bytes.toString('base64').replace(/=+$/, '')
  if (bytes.length === 0 || canonicalInput !== canonicalDecoded) {
    return sendError(res, 400, '"imageBase64" 不是有效的 Base64 图片数据。')
  }
  if (bytes.length > REQUEST_LIMITS.imageBytes) {
    return sendError(res, 413, '图片过大,压缩后请不要超过 3 MB。')
  }

  const resolvedMediaType = mediaType as AllowedImageMediaType
  if (detectedImageMediaType(bytes) !== resolvedMediaType) {
    return sendError(res, 400, '图片内容与 mediaType 不匹配,请重新选择图片。')
  }

  try {
    const decoderOptions = {
      failOn: 'warning' as const,
      limitInputPixels: REQUEST_LIMITS.imagePixels,
      sequentialRead: true,
      pages: 1,
    }
    const metadata = await sharp(bytes, decoderOptions).metadata()
    const actualMediaType = metadata.format === 'jpeg'
      ? 'image/jpeg'
      : metadata.format === 'png'
        ? 'image/png'
        : metadata.format === 'webp'
          ? 'image/webp'
          : metadata.format === 'gif'
            ? 'image/gif'
            : null

    if (actualMediaType !== resolvedMediaType) {
      return sendError(res, 400, '图片内容与 mediaType 不匹配,请重新选择图片。')
    }
    if (!metadata.width || !metadata.height || metadata.width < 1 || metadata.height < 1) {
      return sendError(res, 400, '无法读取图片尺寸,请重新选择图片。')
    }
    if (
      metadata.width > REQUEST_LIMITS.imageDimension ||
      metadata.height > REQUEST_LIMITS.imageDimension ||
      metadata.width * metadata.height > REQUEST_LIMITS.imagePixels
    ) {
      return sendError(
        res,
        413,
        `图片分辨率过高,单边请勿超过 ${REQUEST_LIMITS.imageDimension} 像素。`,
      )
    }
    if ((metadata.pages ?? 1) > 1) {
      return sendError(res, 400, '暂不支持动态或多帧图片,请上传静态图片。')
    }

    // A pixel operation forces a full decode. Re-encoding removes metadata and gives
    // the model one bounded, predictable image format instead of the untrusted input.
    const normalizedBytes = await sharp(bytes, decoderOptions)
      .rotate()
      .resize({
        width: 1_024,
        height: 1_024,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .flatten({ background: '#ffffff' })
      .toColourspace('srgb')
      .jpeg({ quality: 80 })
      .toBuffer()

    return { imageBase64: normalizedBytes.toString('base64'), mediaType: 'image/jpeg' }
  } catch (error) {
    const message = error instanceof Error ? error.message.toLowerCase() : ''
    if (message.includes('pixel limit') || message.includes('exceeds')) {
      return sendError(res, 413, '图片分辨率过高,请压缩后重试。')
    }
    return sendError(res, 400, '图片无法完整解码,请重新选择有效图片。')
  }
}

function validFiniteNumber(value: unknown, maximum: number): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= maximum
}

export function requireFoodItems(
  body: JsonObject,
  res: VercelResponse,
): FoodItemInput[] | null {
  const items = body.items
  if (!Array.isArray(items) || items.length === 0) {
    return sendError(res, 400, '"items" 必须是非空食物数组。')
  }
  if (items.length > REQUEST_LIMITS.foodItems) {
    return sendError(res, 413, `一次最多重算 ${REQUEST_LIMITS.foodItems} 项食物。`)
  }

  const normalized: FoodItemInput[] = []
  for (const item of items) {
    if (
      !isObject(item) ||
      typeof item.name !== 'string' ||
      !item.name.trim() ||
      item.name.length > REQUEST_LIMITS.foodNameCharacters ||
      !validFiniteNumber(item.grams, FOOD_RESULT_LIMITS.grams) ||
      !validFiniteNumber(item.kcal, FOOD_RESULT_LIMITS.kcal) ||
      !validFiniteNumber(item.protein, FOOD_RESULT_LIMITS.macroGrams) ||
      !validFiniteNumber(item.carbs, FOOD_RESULT_LIMITS.macroGrams) ||
      !validFiniteNumber(item.fat, FOOD_RESULT_LIMITS.macroGrams) ||
      typeof item.confidence !== 'string' ||
      !['high', 'mid', 'low'].includes(item.confidence)
    ) {
      return sendError(res, 400, '"items" 中包含无效的食物数据。')
    }

    normalized.push({
      name: item.name,
      grams: item.grams,
      kcal: item.kcal,
      protein: item.protein,
      carbs: item.carbs,
      fat: item.fat,
      confidence: item.confidence as FoodItemInput['confidence'],
    })
  }

  if (Buffer.byteLength(JSON.stringify(normalized), 'utf8') > REQUEST_LIMITS.recalcItemsBytes) {
    return sendError(res, 413, '食物列表内容过大,请减少项目后重试。')
  }
  return normalized
}
