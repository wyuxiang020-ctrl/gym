export type ExerciseResource = {
  url: string
  hostname: string
  kind: 'video' | 'webpage'
}

export type ExerciseResourceResult =
  | { ok: true; resource: ExerciseResource }
  | { ok: false; error: string }

// Classify locally only: ordinary pages are never fetched or embedded by Gym.
export function parseExerciseResource(value: string): ExerciseResourceResult {
  const trimmed = value.trim()
  if (!trimmed) return { ok: false, error: '请先粘贴教学网页或视频直链。' }
  if (trimmed.length > 2_048) return { ok: false, error: '链接过长，请使用不超过 2048 个字符的链接。' }
  const hasControlCharacter = Array.from(trimmed).some(character => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)
  if (!/^https?:\/\//i.test(trimmed) || /\s/.test(trimmed) || hasControlCharacter) {
    return { ok: false, error: '请填写完整的 http:// 或 https:// 链接，不要包含空格或换行。' }
  }
  try {
    const url = new URL(trimmed)
    if (!['https:', 'http:'].includes(url.protocol) || !url.hostname || url.username || url.password) {
      return { ok: false, error: '链接必须是普通网页地址，不能包含用户名或密码。' }
    }
    if (url.href.length > 2_048) return { ok: false, error: '链接编码后过长，请使用更短的链接。' }
    return {
      ok: true,
      resource: {
        url: url.href,
        hostname: url.hostname,
        kind: /\.(mp4|webm|ogg|ogv|m4v)$/i.test(url.pathname) ? 'video' : 'webpage',
      },
    }
  } catch {
    return { ok: false, error: '链接格式不正确，请复制完整的网页地址后重试。' }
  }
}
