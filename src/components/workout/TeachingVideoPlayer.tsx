import { useEffect, useRef, useState } from 'react'

type YouTubePlayer = { destroy: () => void }
type PlayerEvent = { data: number }
type YouTubeApi = {
  Player: new (element: HTMLIFrameElement, options: {
    events: {
      onReady: () => void
      onStateChange: (event: PlayerEvent) => void
      onError: (event: PlayerEvent) => void
      onAutoplayBlocked: () => void
    }
  }) => YouTubePlayer
}
type YouTubeWindow = Window & {
  YT?: YouTubeApi
  onYouTubeIframeAPIReady?: () => void
}
type ApiSubscriber = { ready: (api: YouTubeApi) => void; error: () => void }
type PendingApi = { subscribers: Set<ApiSubscriber>; cleanup: () => void }

let pendingApi: PendingApi | null = null

// Called only after explicit consent. No thumbnails, embeds or scripts are prefetched.
function subscribeToApi(subscriber: ApiSubscriber): () => void {
  const youtubeWindow = window as YouTubeWindow
  if (youtubeWindow.YT?.Player) {
    subscriber.ready(youtubeWindow.YT)
    return () => {}
  }
  if (!pendingApi) {
    const script = document.createElement('script')
    const previousReady = youtubeWindow.onYouTubeIframeAPIReady
    const request: PendingApi = { subscribers: new Set(), cleanup: () => {} }
    function finish(success: boolean) {
      const subscribers = [...request.subscribers]
      request.cleanup()
      for (const listener of subscribers) {
        if (success && youtubeWindow.YT?.Player) listener.ready(youtubeWindow.YT)
        else listener.error()
      }
    }
    function apiReady() {
      try { previousReady?.() } finally { finish(true) }
    }
    function apiError() { finish(false) }
    request.cleanup = () => {
      script.removeEventListener('error', apiError)
      script.remove()
      if (youtubeWindow.onYouTubeIframeAPIReady === apiReady) {
        youtubeWindow.onYouTubeIframeAPIReady = previousReady
      }
      request.subscribers.clear()
      if (pendingApi === request) pendingApi = null
    }
    pendingApi = request
    youtubeWindow.onYouTubeIframeAPIReady = apiReady
    script.src = 'https://www.youtube.com/iframe_api'
    script.async = true
    script.addEventListener('error', apiError)
    document.head.appendChild(script)
  }
  const request = pendingApi
  request.subscribers.add(subscriber)
  return () => {
    request.subscribers.delete(subscriber)
    if (request.subscribers.size === 0) request.cleanup()
  }
}

type PlaybackState = 'idle' | 'loading' | 'ready' | 'playing' | 'paused' | 'ended' | 'buffering' | 'cancelled' | 'error'

const WAIT_LIMIT_MS = 15_000
const ERROR_MESSAGES: Record<number, string> = {
  2: '视频参数无效，暂时无法在这里播放。',
  5: '当前浏览器无法播放这个视频，可以重试或打开来源。',
  100: '来源视频已删除、设为私密或不存在。',
  101: '视频发布者不允许在其他网站内播放，请打开来源。',
  150: '视频发布者不允许在其他网站内播放，请打开来源。',
  153: '视频平台无法确认当前页面来源，可能被浏览器隐私设置或网络限制阻止。',
}

export type TeachingVideoPlayerProps = {
  title: string
  videoId: string
  sourceUrl: string
  onReturn: () => void
  returnLabel?: string
}

export function TeachingVideoPlayer({ title, videoId, sourceUrl, onReturn, returnLabel = '返回当前记录' }: TeachingVideoPlayerProps) {
  const [attempt, setAttempt] = useState(0)
  const [state, setState] = useState<PlaybackState>('idle')
  const [error, setError] = useState('')
  const holder = useRef<HTMLDivElement>(null)
  const stop = useRef<() => void>(() => {})
  const validId = /^[a-zA-Z0-9_-]{11}$/.test(videoId)
  let safeSource = validId ? `https://www.youtube.com/watch?v=${videoId}` : undefined
  try {
    const url = new URL(sourceUrl)
    if (url.protocol === 'https:' && !url.username && !url.password) safeSource = url.href
  } catch { /* Keep the canonical source, never activate a malformed URL. */ }

  useEffect(() => {
    if (!attempt) return
    const container = holder.current
    if (!container || !validId) {
      setState('error')
      setError(ERROR_MESSAGES[2])
      return
    }
    let active = true
    let player: YouTubePlayer | undefined
    let timer: ReturnType<typeof setTimeout> | undefined
    let unsubscribe = () => {}
    function clearDeadline() {
      if (timer !== undefined) clearTimeout(timer)
      timer = undefined
    }
    function teardown() {
      active = false
      clearDeadline()
      unsubscribe()
      try { player?.destroy() } catch { /* The iframe may already have been removed. */ }
      container?.replaceChildren()
    }
    function fail(message: string) {
      if (!active) return
      teardown()
      setError(message)
      setState('error')
    }
    function startDeadline(message: string) {
      // Repeated buffering events cannot reset the current wait indefinitely.
      if (timer === undefined) timer = setTimeout(() => fail(message), WAIT_LIMIT_MS)
    }
    stop.current = teardown
    setError('')
    setState('loading')
    startDeadline('视频加载超过 15 秒，已停止等待。你的训练记录没有改变，可以重试或打开来源。')
    unsubscribe = subscribeToApi({
      error: () => fail('视频服务连接失败，可能是网络或浏览器限制。可以重试或打开来源。'),
      ready: api => {
        if (!active) return
        const iframe = document.createElement('iframe')
        const url = new URL(`https://www.youtube-nocookie.com/embed/${videoId}`)
        url.search = new URLSearchParams({
          enablejsapi: '1', origin: window.location.origin,
          playsinline: '1', controls: '1', autoplay: '0', hl: 'zh-CN',
        }).toString()
        iframe.src = url.href
        iframe.title = title
        iframe.width = '100%'
        iframe.height = '100%'
        iframe.allowFullscreen = true
        iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share'
        iframe.referrerPolicy = 'strict-origin-when-cross-origin'
        iframe.className = 'h-full min-h-[200px] w-full rounded-md'
        container.replaceChildren(iframe)
        try {
          player = new api.Player(iframe, {
            events: {
              onReady: () => {
                if (!active) return
                clearDeadline()
                setState('ready')
              },
              onStateChange: event => {
                if (!active) return
                if (event.data === 3) {
                  setState('buffering')
                  startDeadline('视频缓冲超过 15 秒，已停止等待。可以重试、打开来源，或返回继续记录。')
                } else if ([0, 1, 2, 5].includes(event.data)) {
                  clearDeadline()
                  setState(event.data === 1 ? 'playing' : event.data === 2 ? 'paused' : event.data === 0 ? 'ended' : 'ready')
                }
              },
              onError: event => fail(ERROR_MESSAGES[event.data] ?? `视频平台返回错误（${event.data}），可以重试或打开来源。`),
              onAutoplayBlocked: () => {
                if (!active) return
                clearDeadline()
                setState('ready')
              },
            },
          })
          if (!active) player.destroy()
        } catch {
          fail('播放器初始化失败，可以重试或打开来源。')
        }
      },
    })
    return teardown
  }, [attempt, title, validId, videoId])

  const active = ['loading', 'ready', 'playing', 'paused', 'ended', 'buffering'].includes(state)
  const statusText: Record<PlaybackState, string> = {
    idle: '点击后才会连接 YouTube 并加载原站播放器，不会自动播放。',
    loading: '正在加载播放器，最多等待 15 秒；随时可以取消。',
    ready: '播放器已就绪，尚未确认开始播放。请点击视频里的播放按钮。',
    playing: '正在播放。可使用原站控件暂停、重播或全屏查看。',
    paused: '播放已暂停。可以继续观看或返回记录。',
    ended: '视频播放结束。可使用原站控件重播，或返回记录。',
    buffering: '视频正在缓冲，连续等待最多 15 秒；随时可以取消。',
    cancelled: '视频已关闭，不会继续播放；训练记录没有改变。',
    error,
  }

  return (
    <section className="space-y-2" aria-label={`${title}视频`} data-video-state={state}>
      <div ref={holder} className={active ? 'aspect-video min-h-[200px] w-full rounded-md bg-neutral-900' : 'hidden'} />
      <p role={state === 'error' ? 'alert' : 'status'} className={`text-xs ${state === 'error' ? 'text-amber-700' : 'text-neutral-500'}`}>
        {statusText[state]}
      </p>
      {!active ? (
        <button
          className="min-h-11 rounded-md bg-primary px-3 text-sm font-medium text-white hover:bg-primary-dark"
          onClick={() => setAttempt(value => value + 1)}
        >
          {state === 'error' ? '重试加载视频' : '加载真人示范'}
        </button>
      ) : (
        <button
          className="min-h-11 text-sm text-neutral-600 underline"
          onClick={() => { stop.current(); setAttempt(0); setState('cancelled') }}
        >
          {state === 'loading' || state === 'buffering' ? '取消加载视频' : '关闭视频'}
        </button>
      )}
      <div className="flex flex-wrap gap-x-4">
        {safeSource && <a href={safeSource} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center text-sm text-primary underline">打开视频来源 ↗</a>}
        <button className="min-h-11 text-sm text-primary underline" onClick={() => { stop.current(); onReturn() }}>{returnLabel}</button>
      </div>
      <p className="text-xs text-neutral-500">第三方播放器可能受地区、网络、登录或发布者权限影响；Gym 不下载、缓存或修改视频。示范不能判断你本人的动作是否正确。</p>
    </section>
  )
}
