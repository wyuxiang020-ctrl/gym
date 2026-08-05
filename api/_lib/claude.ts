import Anthropic from '@anthropic-ai/sdk'

const MODEL = 'claude-sonnet-4-6'

let client: Anthropic | null = null

function getClient(): Anthropic {
  if (!client) {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY is not set in the environment')
    }
    client = new Anthropic({ apiKey })
  }
  return client
}

export function stripJsonFences(text: string): string {
  return text.replace(/```json|```/g, '').trim()
}

export async function askClaudeForJson(params: {
  system: string
  content: Anthropic.MessageParam['content']
}): Promise<unknown> {
  const anthropic = getClient()
  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system: params.system,
    messages: [{ role: 'user', content: params.content }],
  })

  const block = response.content[0]
  if (block.type !== 'text') {
    throw new Error('Unexpected response type from Claude')
  }

  const cleaned = stripJsonFences(block.text)
  try {
    return JSON.parse(cleaned)
  } catch {
    const err = new Error('Failed to parse JSON from Claude response') as Error & {
      rawText?: string
    }
    err.rawText = block.text
    throw err
  }
}
