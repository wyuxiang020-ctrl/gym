import { useEffect, useState } from 'react'
import * as store from '../../lib/store'
import type { DayLog, Profile } from '../../lib/types'
import { calcStreak, checkInEligible, hasCompletedWorkout, type CheckInMode } from '../../lib/checkIn'
import { validCompletedSet } from '../../lib/strength'
import { toDateStr } from '../../lib/date'
import { totalLifetimeVolume } from '../../lib/pet'
import { CheckInButton } from './CheckInButton'
import { MonthHeatmap } from './MonthHeatmap'
import { StreakCard } from './StreakCard'
import { PetCard } from './PetCard'

function emptyDayLog(date: string): DayLog {
  return { date, checkedIn: false, strength: [], cardio: [], meals: [], water: 0 }
}

export function TodayTab({ date, profile, onTrain, onRecords }: { date: string; profile: Profile; onTrain: () => void; onRecords: (date: string) => void }) {
  const mode: CheckInMode = profile.checkInMode ?? 'open'
  const [dayLogs, setDayLogs] = useState<Record<string, DayLog>>(() => store.getDayLogsMap())
  const todayLog = dayLogs[date] ?? emptyDayLog(date)

  useEffect(() => {
    if (mode === 'open' && !todayLog.checkedIn) {
      store.setCheckedIn(date, true)
      setDayLogs(store.getDayLogsMap())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, mode])

  function checkIn() {
    store.setCheckedIn(date, true)
    setDayLogs(store.getDayLogsMap())
  }

  const eligible = checkInEligible(todayLog, mode)
  const streak = calcStreak(dayLogs, date)
  const totalVolume = totalLifetimeVolume(dayLogs)
  const sets = todayLog.strength.flatMap(entry => entry.sets)
  const completed = sets.filter(validCompletedSet).length
  const hasTraining = todayLog.strength.length + todayLog.cardio.length > 0
  const activePlan = store.getPlans().find(plan => plan.isActive)
  const [y, m, d] = date.split('-').map(Number)
  const monday = new Date(y, m - 1, d)
  monday.setDate(monday.getDate() - (monday.getDay() + 6) % 7)
  const week = Array.from({ length: 7 }, (_, i) => {
    const day = new Date(monday); day.setDate(day.getDate() + i)
    const key = toDateStr(day)
    return { key, day: day.getDate(), done: Boolean(dayLogs[key] && hasCompletedWorkout(dayLogs[key])) }
  })
  const recent = Object.keys(dayLogs).filter(key => key <= date && (dayLogs[key].strength.length || dayLogs[key].cardio.length)).sort().reverse().slice(0, 3)

  return (
    <div className="today-layout">
      <section className="training-hero" aria-label="今日训练">
        <div className="hero-content"><p className="eyebrow">今日训练 · 从这一组开始</p>
          <h2>{hasTraining ? '把今天，练扎实。' : '准备好，动起来。'}</h2>
          <p className="hero-description">{hasTraining ? todayLog.strength.map(entry => entry.name).concat(todayLog.cardio.map(entry => entry.type)).join(' / ') : activePlan ? `已有计划「${activePlan.name}」，选择今天要练的训练日。` : '拍下器械，了解怎么练。\n从一次真实的训练开始。'}</p>
          {hasTraining && <div className="hero-stats"><span><strong>{todayLog.strength.length + todayLog.cardio.length}</strong> 个动作</span><span><strong>{completed}<small> / {sets.length}</small></strong> 力量组已完成</span></div>}
          {hasTraining || activePlan ? <button className="gym-primary hero-cta" onClick={onTrain}>{hasTraining ? '继续训练' : '选择今天的训练'} <span aria-hidden="true">↗</span></button> : <a className="gym-primary hero-cta" href="/?equipment-scan=1">扫描器械，开始训练 <span aria-hidden="true">↗</span></a>}
        </div><span className="hero-caption">训练氛围示意</span>
      </section>
      <a className="scan-entry" href="/?equipment-scan=1"><svg viewBox="0 0 72 72" aria-hidden="true"><path d="M7 23V7h16m26 0h16v16M7 49v16h16m26 0h16V49M18 28v16m8-22v28m20-28v28m8-22v16M26 36h20" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/></svg><div><span className="eyebrow">认识器械 → 学习 → 训练</span><h3>拍下器械，了解怎么练</h3><p>目前支持坐姿推胸机 · 由你确认结果</p></div><span aria-hidden="true">↗</span></a>
      <section className="week-panel"><div className="section-heading"><h2>本周节奏</h2><p><strong>{week.filter(day => day.done).length}</strong> 天有完成训练</p></div><div className="week-days">{week.map((day, i) => <button key={day.key} onClick={() => onRecords(day.key)} aria-label={`${day.key}${day.done ? ' 已完成训练' : ' 查看记录'}`} aria-current={day.key === date ? 'date' : undefined} className={day.done ? 'is-complete' : ''}><span>{['一', '二', '三', '四', '五', '六', '日'][i]}</span><strong>{day.day}</strong><span className="day-mark">{day.done ? '✓' : '—'}</span></button>)}</div><p className="muted-note">点击日期查看记录 · 以实际完成的组或有氧为准</p></section>
      <section className="recent-panel"><div className="section-heading"><h2>最近记录</h2><button onClick={() => onRecords(date)}>全部记录 ↗</button></div>{recent.length ? recent.map(key => <button className="recent-record" key={key} onClick={() => onRecords(key)}><div><span>{key}</span><strong>{dayLogs[key].strength.map(entry => entry.name).concat(dayLogs[key].cardio.map(entry => entry.type)).join(' · ')}</strong><small>{dayLogs[key].strength.flatMap(entry => entry.sets).filter(validCompletedSet).length} 组力量已完成 · {dayLogs[key].cardio.length} 项有氧记录</small></div><span aria-hidden="true">↗</span></button>) : <div className="empty-training"><p>第一份记录，从今天开始。</p><button onClick={onTrain}>手动添加训练 ↗</button></div>}</section>
      <aside className="panda-welcome"><img src="/companion-assets/d-panda/gentle/stand-original.svg" alt="D 熊猫原始形象" width="80" height="96"/><div><h3>按你的节奏，一组一组来。</h3><p>开始训练后，可开启熊猫陪练和组间休息计时。</p><a href="/?training-companion=1">前往熊猫陪练 ↗</a></div></aside>
      <details className="growth-details"><summary>打卡与成长记录 <span>查看月历、连续打卡和喂养</span></summary><div className="growth-grid">
      <CheckInButton date={date} checkedIn={todayLog.checkedIn} eligible={eligible} mode={mode} onCheckIn={checkIn} />

      <PetCard date={date} totalVolume={totalVolume} />

      <StreakCard streak={streak} />

      <div className="rounded-xl bg-card p-3 shadow-sm">
        <MonthHeatmap dayLogs={dayLogs} today={date} />
      </div>
      </div></details>
    </div>
  )
}
