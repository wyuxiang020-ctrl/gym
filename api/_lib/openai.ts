import OpenAI, { type ClientOptions } from 'openai'
import { fetch as undiciFetch, ProxyAgent } from 'undici'
import { FOOD_RESULT_LIMITS, WORKOUT_CARDIO_TYPES, WORKOUT_RESULT_LIMITS } from './validate.js'

// Pin the dated snapshot so formal evaluations remain reproducible across releases.
const MODEL = 'gpt-5-mini-2025-08-07'
const OPENAI_SDK_MAX_RETRIES = 0
const OPENAI_TIMEOUT_MS = 110_000

type InputContent =
  | { type: 'input_text'; text: string }
  | { type: 'input_image'; image_url: string; detail: 'auto' | 'low' | 'high' }

type JsonSchema = Record<string, unknown>

export type AIResponseMetadata = {
  model: string
  responseId: string
  requestId?: string
  sdkMaxRetries: number
  timeoutMs: number
  usage?: {
    inputTokens: number
    cachedInputTokens: number
    outputTokens: number
    reasoningTokens: number
    totalTokens: number
  }
}

export type AIJsonResponse = {
  value: unknown
  metadata: AIResponseMetadata
}

export type AIJsonResponseError = Error & {
  rawText?: string
  metadata?: AIResponseMetadata
}

export const FOOD_RESULT_SCHEMA: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    items: {
      type: 'array',
      maxItems: FOOD_RESULT_LIMITS.items,
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          name: { type: 'string', minLength: 1, maxLength: FOOD_RESULT_LIMITS.nameCharacters },
          grams: { type: 'number', minimum: 0, maximum: FOOD_RESULT_LIMITS.grams },
          kcal: { type: 'number', minimum: 0, maximum: FOOD_RESULT_LIMITS.kcal },
          protein: { type: 'number', minimum: 0, maximum: FOOD_RESULT_LIMITS.macroGrams },
          carbs: { type: 'number', minimum: 0, maximum: FOOD_RESULT_LIMITS.macroGrams },
          fat: { type: 'number', minimum: 0, maximum: FOOD_RESULT_LIMITS.macroGrams },
          confidence: { type: 'string', enum: ['high', 'mid', 'low'] },
        },
        required: ['name', 'grams', 'kcal', 'protein', 'carbs', 'fat', 'confidence'],
      },
    },
  },
  required: ['items'],
}

const REP_STRENGTH_SET_SCHEMA: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    weight: { type: 'number', minimum: 0, maximum: WORKOUT_RESULT_LIMITS.weightKg },
    reps: { type: 'integer', minimum: 1, maximum: WORKOUT_RESULT_LIMITS.reps },
    durationSeconds: { type: 'null' },
    done: { type: 'boolean' },
  },
  required: ['weight', 'reps', 'durationSeconds', 'done'],
}

const TIMED_STRENGTH_SET_SCHEMA: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    weight: { type: 'number', minimum: 0, maximum: WORKOUT_RESULT_LIMITS.weightKg },
    reps: { type: 'null' },
    durationSeconds: {
      type: 'integer',
      minimum: 1,
      maximum: WORKOUT_RESULT_LIMITS.durationSeconds,
    },
    done: { type: 'boolean' },
  },
  required: ['weight', 'reps', 'durationSeconds', 'done'],
}

export const WORKOUT_RESULT_SCHEMA: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    strength: {
      type: 'array',
      maxItems: WORKOUT_RESULT_LIMITS.strengthEntries,
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          name: { type: 'string', minLength: 1, maxLength: WORKOUT_RESULT_LIMITS.labelCharacters },
          sets: {
            type: 'array',
            maxItems: WORKOUT_RESULT_LIMITS.setsPerStrength,
            items: {
              anyOf: [REP_STRENGTH_SET_SCHEMA, TIMED_STRENGTH_SET_SCHEMA],
            },
          },
          note: { type: 'string', maxLength: WORKOUT_RESULT_LIMITS.noteCharacters },
          uncertain: {
            type: 'array',
            maxItems: WORKOUT_RESULT_LIMITS.uncertainItems,
            items: { type: 'string', maxLength: WORKOUT_RESULT_LIMITS.uncertainCharacters },
          },
        },
        required: ['name', 'sets', 'note', 'uncertain'],
      },
    },
    cardio: {
      type: 'array',
      maxItems: WORKOUT_RESULT_LIMITS.cardioEntries,
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          type: { type: 'string', enum: WORKOUT_CARDIO_TYPES },
          minutes: {
            type: ['number', 'null'],
            minimum: 1,
            maximum: WORKOUT_RESULT_LIMITS.cardioMinutes,
          },
          distance: {
            type: ['number', 'null'],
            minimum: 0,
            maximum: WORKOUT_RESULT_LIMITS.distanceKm,
          },
          avgHr: { type: ['number', 'null'], minimum: 1, maximum: WORKOUT_RESULT_LIMITS.avgHr },
          intensity: { type: 'string', enum: ['low', 'mid', 'high'] },
          note: { type: 'string', maxLength: WORKOUT_RESULT_LIMITS.noteCharacters },
          uncertain: {
            type: 'array',
            maxItems: WORKOUT_RESULT_LIMITS.uncertainItems,
            items: { type: 'string', maxLength: WORKOUT_RESULT_LIMITS.uncertainCharacters },
          },
        },
        required: ['type', 'minutes', 'distance', 'avgHr', 'intensity', 'note', 'uncertain'],
      },
    },
  },
  required: ['strength', 'cardio'],
}

let client: OpenAI | null = null

function getClient(): OpenAI {
  if (!client) {
    // Vercel CLI can provide the key while an optional local proxy still lives
    // only in .env.local. Load missing local-only values without allowing the
    // file to replace values explicitly supplied by the host environment.
    if (
      !process.env.OPENAI_API_KEY ||
      !(process.env.OPENAI_PROXY_URL || process.env.HTTPS_PROXY || process.env.HTTP_PROXY)
    ) {
      const configuredValue = (value: string | undefined) =>
        value && value.trim() ? value : undefined
      const hostValues = {
        OPENAI_API_KEY: configuredValue(process.env.OPENAI_API_KEY),
        OPENAI_PROXY_URL: configuredValue(process.env.OPENAI_PROXY_URL),
        HTTPS_PROXY: configuredValue(process.env.HTTPS_PROXY),
        HTTP_PROXY: configuredValue(process.env.HTTP_PROXY),
      }
      for (const [name, value] of Object.entries(hostValues)) {
        if (value === undefined) delete process.env[name]
      }
      try {
        process.loadEnvFile('.env.local')
      } catch {
        // Production deployments do not contain .env.local; keep the clear error below.
      }
      for (const [name, value] of Object.entries(hostValues)) {
        if (value !== undefined) process.env[name] = value
      }
    }

    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY is not set in the environment')
    }
    const proxyUrl =
      process.env.OPENAI_PROXY_URL || process.env.HTTPS_PROXY || process.env.HTTP_PROXY
    const baseOptions: ClientOptions = {
      apiKey,
      maxRetries: OPENAI_SDK_MAX_RETRIES,
      timeout: OPENAI_TIMEOUT_MS,
    }

    if (proxyUrl) {
      client = new OpenAI({
        ...baseOptions,
        // The SDK and Undici can resolve through different copies of undici-types.
        // Runtime shapes match the official SDK proxy example; isolate the cast here.
        fetch: undiciFetch as unknown as ClientOptions['fetch'],
        fetchOptions: {
          dispatcher: new ProxyAgent(proxyUrl),
        } as unknown as ClientOptions['fetchOptions'],
      })
    } else {
      client = new OpenAI(baseOptions)
    }
  }
  return client
}

export async function askOpenAIForJson(params: {
  instructions: string
  input: string | InputContent[]
  schemaName: string
  schema: JsonSchema
}): Promise<AIJsonResponse> {
  const openai = getClient()
  const input =
    typeof params.input === 'string'
      ? params.input
      : [{ role: 'user' as const, content: params.input }]

  const response = await openai.responses.create({
    model: MODEL,
    instructions: params.instructions,
    input,
    max_output_tokens: 2048,
    store: false,
    text: {
      format: {
        type: 'json_schema',
        name: params.schemaName,
        schema: params.schema,
        strict: true,
      },
    },
  })

  const requestId = (response as typeof response & { _request_id?: string | null })._request_id
  const metadata: AIResponseMetadata = {
    model: response.model,
    responseId: response.id,
    requestId: requestId ?? undefined,
    sdkMaxRetries: OPENAI_SDK_MAX_RETRIES,
    timeoutMs: OPENAI_TIMEOUT_MS,
    usage: response.usage
      ? {
          inputTokens: response.usage.input_tokens,
          cachedInputTokens: response.usage.input_tokens_details?.cached_tokens ?? 0,
          outputTokens: response.usage.output_tokens,
          reasoningTokens: response.usage.output_tokens_details?.reasoning_tokens ?? 0,
          totalTokens: response.usage.total_tokens,
        }
      : undefined,
  }

  if (!response.output_text) {
    const error = new Error(
      response.error?.message ?? 'OpenAI returned no text output',
    ) as AIJsonResponseError
    error.rawText = response.output_text
    error.metadata = metadata
    throw error
  }

  try {
    return {
      value: JSON.parse(response.output_text),
      metadata,
    }
  } catch {
    const error = new Error('Failed to parse JSON from OpenAI response') as AIJsonResponseError
    error.rawText = response.output_text
    error.metadata = metadata
    throw error
  }
}
