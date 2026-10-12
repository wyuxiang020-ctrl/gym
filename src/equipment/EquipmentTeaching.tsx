import { useState } from 'react'
import { type EquipmentExercise } from '../lib/equipment'
import { TeachingVideoPlayer } from '../components/workout/TeachingVideoPlayer'

export default function EquipmentTeaching({ exercise }: { exercise: EquipmentExercise }) {
  const [watching, setWatching] = useState(false)
  return <section className="equipment-teaching" aria-label="动作短示范">
    <div className="equipment-video-heading"><h3>{exercise.name}</h3><span>{exercise.seconds} 秒 · 官方示范</span></div>
    <p>{exercise.description}</p>
    <p className="equipment-note">{exercise.condition}视频供动作参考，具体调节以现场器械说明为准。</p>
    {watching ? <TeachingVideoPlayer title={`${exercise.name} · Cybex 官方示范`} videoId={exercise.videoId} sourceUrl={`https://www.youtube.com/watch?v=${exercise.videoId}`} onReturn={() => setWatching(false)} returnLabel="收起示范" loadOnMount /> : <button className="equipment-watch" onClick={() => setWatching(true)}><span aria-hidden="true">▶</span> 查看示范 · {exercise.seconds} 秒</button>}
    <p className="equipment-note">来源：Cybex。点击后加载 YouTube 播放器。</p>
  </section>
}
