import { useState } from 'react'
import { EQUIPMENT_CATALOG, exercisesForEquipment, type EquipmentId } from '../lib/equipment'

const GROUPS = [
  { name: '自由器械', description: '可自由移动的重量，按训练部位选择动作。' },
  { name: '固定器械', description: '座椅与运动轨迹相对固定，找到对应器械即可。' },
  { name: '绳索与综合', description: '龙门架、史密斯机；使用前核对把手、训练凳与保护架。' },
] as const

export default function EquipmentCatalogPicker({ disabled = false, onSelect }: { disabled?: boolean; onSelect: (id: EquipmentId) => void }) {
  const [group, setGroup] = useState('全部')
  const [query, setQuery] = useState('')
  const matching = EQUIPMENT_CATALOG.filter(item => (group === '全部' || item.kind === group) && `${item.name} ${item.area}`.toLowerCase().includes(query.trim().toLowerCase()))
  return <div className="equipment-catalog" aria-label="主动选择器械">
    <div className="equipment-catalog-tools">
      <div className="equipment-kind-filters" aria-label="器械种类">{['全部', ...GROUPS.map(item => item.name)].map(name => <button key={name} aria-pressed={group === name} onClick={() => setGroup(name)}>{name}<small>{EQUIPMENT_CATALOG.filter(item => name === '全部' || item.kind === name).length}</small></button>)}</div>
      <label>查找器械<input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="例如：哑铃、壶铃、推胸" /></label>
    </div>
    <p className="equipment-note" role="status">找到 {matching.length} 类器械 · 选择后查看可练动作</p>
    <div className="equipment-picker-groups">{GROUPS.map(kind => {
      const items = matching.filter(item => item.kind === kind.name)
      return items.length ? <section key={kind.name} aria-label={kind.name}><div className="equipment-group-heading"><h3>{kind.name}</h3><p>{kind.description}</p></div><div className="equipment-picker">{items.map(item => <button key={item.id} disabled={disabled} aria-label={`手动选择${item.name}`} onClick={() => onSelect(item.id)}><small>{item.area} · {exercisesForEquipment(item.id).length} 个动作</small><strong>{item.name}<span aria-hidden="true">↗</span></strong><span>选择器械，查看动作</span></button>)}</div></section> : null
    })}</div>
    {!matching.length && <div className="equipment-catalog-empty"><p>这个分类中没有匹配的器械，可以换个名称，或查看全部种类。</p><button onClick={() => { setGroup('全部'); setQuery('') }}>清除筛选，查看全部</button></div>}
  </div>
}
