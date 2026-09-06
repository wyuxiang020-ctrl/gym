export function AiBadge({ assisted = false }: { assisted?: boolean }) {
  return (
    <span
      className="inline-flex items-center rounded-full bg-violet-100 px-1.5 py-0.5 text-[9px] font-semibold text-violet-700"
      title={assisted ? '包含 AI 辅助合并的内容，建议核对' : 'AI 生成,建议核对'}
    >
      {assisted ? 'AI辅助' : 'AI'}
    </span>
  )
}
