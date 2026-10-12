import { useState } from 'react'
import { exerciseArea, type EquipmentExercise, type EquipmentExerciseId } from '../lib/equipment'

type Props = { exercises: readonly EquipmentExercise[]; selected: EquipmentExerciseId | null; onSelect: (id: EquipmentExerciseId) => void }

export default function EquipmentExercisePicker({ exercises, selected, onSelect }: Props) {
  const [area, setArea] = useState('全部')
  const [query, setQuery] = useState('')
  const searchable = exercises.length > 3
  const areas = ['全部', ...new Set(exercises.map(exerciseArea))]
  const filtered = exercises.filter(item => (area === '全部' || exerciseArea(item) === area) && `${item.name} ${item.description}`.includes(query.trim()))
  return <>
    {searchable && <div className="equipment-exercise-tools">
      <label>查找动作<input type="search" placeholder="例如：卧推、划船、弯举" value={query} onChange={event => setQuery(event.target.value)} /></label>
      <div className="equipment-area-filters" aria-label="按训练部位筛选">{areas.map(value => <button key={value} aria-pressed={area === value} onClick={() => setArea(value)}>{value}</button>)}</div>
      <p className="equipment-note" role="status">显示 {filtered.length} / {exercises.length} 个动作 · 滚动列表查看更多</p>
    </div>}
    <div className="equipment-exercises" data-many={searchable} aria-label="可练动作">{filtered.map(item => <button key={item.id} className="equipment-exercise" aria-pressed={selected === item.id} onClick={() => onSelect(item.id)}>
      <span className="equipment-exercise-top"><strong>{item.name}</strong><span>{item.seconds} 秒示范</span></span>
      <span>{item.description}</span>
      <small>{item.condition}</small>
      <span className="equipment-exercise-selection">{selected === item.id ? '✓ 已选择' : `${exerciseArea(item)} · 选择动作`}</span>
    </button>)}</div>
    {filtered.length === 0 && <p className="equipment-note">没有匹配动作。<button onClick={() => { setQuery(''); setArea('全部') }}>清除筛选</button></p>}
    {searchable && <p className="equipment-selection-summary" role="status">{selected ? `当前选择：${exercises.find(item => item.id === selected)?.name}` : '先选择一个动作，再继续查看示范。'}</p>}
  </>
}
