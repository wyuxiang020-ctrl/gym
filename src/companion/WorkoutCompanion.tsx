import { useEffect, useRef, useState } from 'react'
import type { StrengthEntry } from '../lib/types'
import { companionSummary, extendRest, pauseRest, remainingRest, resumeRest, startRest, type RestClock } from '../lib/companionSession'
import PandaFeedback from './PandaFeedback'
import './workoutCompanion.css'

export type CompletionEvent = { sequence: number; entryId: string }
type Props = { entries: StrengthEntry[]; date: string; initialEntryId?: string; focusOnOpen?: boolean; completion: CompletionEvent | null; onClose: () => void }

export default function WorkoutCompanion({ entries, date, initialEntryId, focusOnOpen = false, completion, onClose }: Props) {
  const [selected, setSelected] = useState(initialEntryId ?? entries[0]?.id ?? '')
  const panel = useRef<HTMLElement>(null)
  const [reduced, setReduced] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches)
  const entry = entries.find(item => item.id === selected) ?? entries[0]
  useEffect(() => {
    if (!focusOnOpen) return
    panel.current?.focus({ preventScroll: true })
    panel.current?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' })
  }, [focusOnOpen])
  return <section ref={panel} tabIndex={-1} className="workout-companion" aria-label="熊猫训练陪伴">
    <header><div><p>D 熊猫 · 训练陪伴</p><h3>按你的节奏，一组一组来。</h3></div><button onClick={onClose}>关闭陪练</button></header>
    {entry ? <><label className="workout-companion-select">当前动作<select aria-label="陪练当前动作" value={entry.id} onChange={event => setSelected(event.target.value)}>{entries.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><Session key={`${date}:${entry.id}`} entry={entry} date={date} completion={completion} reduced={reduced} /></> : <><PandaFeedback key="empty" clipId="idle" reduced={reduced} /><p>先在下方添加动作，或通过器械扫描带入，再开始陪练。</p><a href="/?equipment-scan=1">去扫描器械 ↗</a></>}
    <label className="workout-companion-note"><input type="checkbox" checked={reduced} onChange={event => setReduced(event.target.checked)} />静态形象</label>
    <p className="workout-companion-note">根据你确认保存的记录给出提示。休息时长由你选择；关闭、换动作或离开页面会结束本次计时，已保存记录保留。</p>
  </section>
}

type Phase = 'ready' | 'training' | 'rest' | 'next' | 'finished'
function Session({ entry, date, completion, reduced }: { entry: StrengthEntry; date: string; completion: CompletionEvent | null; reduced: boolean }) {
  const [phase, setPhase] = useState<Phase>('ready')
  const [seconds, setSeconds] = useState(60)
  const [clock, setClock] = useState<RestClock>({ deadline: null, remainingMs: 0 })
  const [now, setNow] = useState(Date.now)
  const [notice, setNotice] = useState('')
  const [reaction, setReaction] = useState(0)
  const seen = useRef(completion?.sequence ?? 0)
  const summary = companionSummary(entry)
  const previousCompleted = useRef(summary.completed)
  useEffect(() => {
    if (!completion || seen.current === completion.sequence) return
    seen.current = completion.sequence
    if (completion.entryId !== entry.id || phase === 'finished') return
    const at = Date.now(); setClock(startRest(seconds, at)); setNow(at); setPhase('rest'); setNotice('这一组已保存。歇一会，准备好再继续。'); setReaction(value => value + 1)
  }, [completion, entry.id, phase, seconds])
  useEffect(() => {
    if (summary.completed < previousCompleted.current) { setPhase('ready'); setClock({ deadline: null, remainingMs: 0 }); setNotice('完成记录已调整，请核对后继续。') }
    previousCompleted.current = summary.completed
  }, [summary.completed])
  useEffect(() => {
    if (phase !== 'rest') return
    if (clock.deadline === null) {
      if (clock.remainingMs <= 0) { setPhase('next'); setNotice('计时结束。准备好后，再开始下一组。') }
      return
    }
    let timer: ReturnType<typeof setInterval> | undefined
    const tick = () => { const at = Date.now(); setNow(at); if (remainingRest(clock, at) <= 0) { setPhase('next'); setNotice('计时结束。准备好后，再开始下一组。') } }
    const visibility = () => { clearInterval(timer); if (!document.hidden) { tick(); timer = setInterval(tick, 250) } }
    visibility(); document.addEventListener('visibilitychange', visibility)
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', visibility) }
  }, [phase, clock])
  const remaining = Math.ceil(remainingRest(clock, now) / 1000)
  const clipId = phase === 'rest' ? 'rest' : phase === 'finished' && summary.completed ? 'celebrate' : phase === 'training' ? 'encourage' : 'idle'
  const title = phase === 'ready' ? '先核对动作与记录' : phase === 'training' ? '专注当前这一组' : phase === 'rest' ? '组间歇一会' : phase === 'next' ? '准备好了再继续' : '本次陪练已结束'
  function begin() { setPhase('training'); setNotice('按实际完成情况在下方填写，保存并勾选完成后，我再提醒你休息。'); setReaction(value => value + 1) }
  return <div data-session-phase={phase}>
    <div className="workout-companion-body"><PandaFeedback key={`${clipId}:${reaction}:${reduced}`} clipId={clipId} reduced={reduced} /><div><h4>{title}</h4><p role="status">{notice || '先查看适用的动作资料，确认器械和记录内容，再开始。'}</p><p className="workout-companion-note">{date} · {entry.name}<br />已确认 {summary.completed} 组 · 待完成 {summary.pending} 组</p></div></div>
    {phase === 'rest' && <div className="workout-rest"><output aria-label="休息剩余时间">{String(Math.floor(remaining / 60)).padStart(2, '0')}:{String(remaining % 60).padStart(2, '0')}</output><span>{clock.deadline === null ? '计时已暂停' : '休息计时中'}</span><div>
      <button onClick={() => { const at = Date.now(); setNow(at); setClock(clock.deadline === null ? resumeRest(clock, at) : pauseRest(clock, at)) }}>{clock.deadline === null ? '继续计时' : '暂停计时'}</button>
      <button onClick={() => { const at = Date.now(); setNow(at); setClock(extendRest(clock, at)) }}>延长 30 秒</button>
      <button onClick={() => { setPhase('next'); setClock({ deadline: null, remainingMs: 0 }); setNotice('已结束休息计时，准备好后再继续。') }}>结束休息</button>
    </div></div>}
    {phase !== 'finished' && <label className="workout-companion-select">{phase === 'rest' ? '下次休息时长' : '休息计时'}<select aria-label="休息时长" value={seconds} onChange={event => setSeconds(Number(event.target.value))}>{[30, 60, 90, 120].map(value => <option key={value} value={value}>{value} 秒</option>)}</select></label>}
    <div className="workout-companion-buttons">{(phase === 'ready' || phase === 'next') && <button className="workout-companion-primary" onClick={begin}>{phase === 'next' ? '准备下一组' : '开始当前动作'}</button>}
      {phase !== 'finished' && <><button onClick={() => document.getElementById(`strength-entry-${entry.id}`)?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' })}>查看当前动作记录</button><button onClick={() => { setPhase('finished'); setClock({ deadline: null, remainingMs: 0 }); setNotice('记录已按你的确认保留。未完成的组仍然是待完成。') }}>结束本次陪练</button></>}
      {phase === 'finished' && <button onClick={() => { setPhase('ready'); setNotice('继续按实际情况记录。'); setReaction(value => value + 1) }}>继续陪练</button>}
    </div>
    {phase === 'finished' && <div className="workout-companion-summary"><h4>当前动作的已保存记录</h4><p>已确认 {summary.completed} 组；待完成 {summary.pending} 组。</p>{summary.volume > 0 && <p>已知重量的次数型容量：{summary.volume.toLocaleString()} kg·次</p>}{summary.seconds > 0 && <p>已确认计时组：{summary.seconds} 秒</p>}{summary.missingWeight > 0 && <p>{summary.missingWeight} 组已确认重量缺失，容量不包含这些组。</p>}<p className="workout-companion-note">这是该日期当前动作的全部记录，不代表仅在本次陪练中新增的训练，也不换算增肌或减脂量。</p></div>}
  </div>
}
