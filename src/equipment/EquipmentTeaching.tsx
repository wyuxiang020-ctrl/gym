import { useId, useState } from 'react'
import { CHEST_PRESS } from '../lib/equipment'
import { TeachingVideoPlayer } from '../components/workout/TeachingVideoPlayer'

export default function EquipmentTeaching({ matched, onMatch }: { matched: boolean; onMatch: (value: boolean) => void }) {
  const [watching, setWatching] = useState(false)
  const [step, setStep] = useState(0)
  const id = useId()
  function showStep(index: number) {
    setStep(index)
    document.getElementById(`${id}-${index}`)?.scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
  }
  return <section aria-label="器械教学适用性">
    <h3>先核对型号，再看示范</h3>
    <nav className="teaching-steps" aria-label="教学步骤">{['核对型号', '查看示范'].map((label, index) => <button key={label} aria-pressed={step === index} onClick={() => showStep(index)}>{index + 1}. {label}</button>)}</nav>
    <div id={`${id}-0`} className="teaching-step" data-current={step === 0}>
    <p>本次收录 {CHEST_PRESS.model}，示范发布者为 {CHEST_PRESS.videoPublisher}。器械类别识别并不代表品牌型号已确认。</p>
    <label className="equipment-model-check"><input type="checkbox" checked={matched} onChange={event => { onMatch(event.target.checked); setWatching(false); setStep(event.target.checked ? 1 : 0) }} />我已核对标牌，当前器械是 Life Fitness Insignia SS-CP</label>
    </div><div id={`${id}-1`} className="teaching-step" data-current={step === 1}>
    {matched ? <>
      <p className="equipment-note">示范内容来自厂商，Gym 未做专业审校；外部播放可能受网络限制，不自动开始视频。</p>
      {watching ? <TeachingVideoPlayer title="Life Fitness Insignia Series Chest Press" videoId={CHEST_PRESS.videoId} sourceUrl={CHEST_PRESS.video} onReturn={() => setWatching(false)} returnLabel="返回器械资料" /> : <button onClick={() => setWatching(true)}>查看该型号真人示范</button>}
    </> : <p className="equipment-note">型号不同或不确定时，先查看本机标牌说明或向场馆确认。你仍可记录已确认的推胸动作。</p>}
    </div>
  </section>
}
