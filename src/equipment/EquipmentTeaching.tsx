import { useState } from 'react'
import { EQUIPMENT_GUIDES, type EquipmentExercise } from '../lib/equipment'
import { TeachingVideoPlayer } from '../components/workout/TeachingVideoPlayer'

export default function EquipmentTeaching({ exercise }: { exercise: EquipmentExercise }) {
  const [watching, setWatching] = useState(false)
  return <section className="equipment-teaching" aria-label="动作短示范">
    <div className="equipment-video-heading"><h3>{exercise.name}</h3><span>约 {exercise.seconds} 秒 · 动作讲解</span></div>
    <p>{exercise.description}</p>
    <p className="equipment-note">{exercise.condition}视频供动作参考，具体调节以现场器械说明为准。</p>
    {watching ? <TeachingVideoPlayer title={`${exercise.name} · ${exercise.publisher} 教学`} videoId={exercise.videoId} sourceUrl={`https://www.youtube.com/watch?v=${exercise.videoId}`} startSeconds={exercise.startSeconds} endSeconds={exercise.endSeconds} onReturn={() => setWatching(false)} returnLabel="收起示范" loadOnMount /> : <button className="equipment-watch" onClick={() => setWatching(true)}><span aria-hidden="true">▶</span> 查看示范 · {exercise.seconds} 秒</button>}
    <p className="equipment-note">{exercise.videoNote}。来源：{exercise.publisher}。</p>
    <section className="equipment-quick-guide" aria-label="使用要点与易错提醒">
      <h4>怎么用 · 记住这 4 点</h4>
      <ol>{EQUIPMENT_GUIDES[exercise.id].map((item, index) => <li key={index}><span>{item.instruction}</span>{item.mistake && <strong className="equipment-mistake">易错：{item.mistake}</strong>}</li>)}</ol>
      <a className="equipment-guide-source" href={exercise.guideSource} target="_blank" rel="noopener noreferrer">文字参考：{new URL(exercise.guideSource).hostname.includes('puregym') ? 'PureGym' : 'StrengthLog'} 动作指南 ↗</a>
    </section>
  </section>
}
