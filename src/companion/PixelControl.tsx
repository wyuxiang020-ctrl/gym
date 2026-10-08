export default function PixelControl({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  return <label className="pixel-control">显示方式 <select aria-label="显示方式" value={value} onChange={event => onChange(Number(event.target.value))}>
    <option value={0}>清晰原画</option><option value={224}>像素 · 细</option><option value={168}>像素 · 中</option><option value={112}>像素 · 粗</option>
  </select></label>
}
