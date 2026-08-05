import { BodyIcon, MealIcon, RecordsIcon, TodayIcon, WorkoutIcon } from './icons/TabIcons'

export type TabKey = 'today' | 'workout' | 'meal' | 'body' | 'records'

const TABS: { key: TabKey; label: string; Icon: (props: { className?: string }) => React.ReactElement }[] = [
  { key: 'today', label: '今天', Icon: TodayIcon },
  { key: 'workout', label: '训练', Icon: WorkoutIcon },
  { key: 'meal', label: '饮食', Icon: MealIcon },
  { key: 'body', label: '身体', Icon: BodyIcon },
  { key: 'records', label: '记录', Icon: RecordsIcon },
]

export function BottomTabBar({ active, onChange }: { active: TabKey; onChange: (tab: TabKey) => void }) {
  const activeIndex = TABS.findIndex((t) => t.key === active)

  return (
    <nav className="fixed inset-x-0 bottom-0 z-10 border-t border-neutral-200 bg-card">
      <div className="relative mx-auto flex max-w-[520px]">
        <div
          className="absolute top-0 h-0.5 bg-primary transition-all duration-300 ease-out"
          style={{ width: `${100 / TABS.length}%`, left: `${(activeIndex * 100) / TABS.length}%` }}
        />
        {TABS.map((t) => {
          const isActive = active === t.key
          return (
            <button
              key={t.key}
              onClick={() => onChange(t.key)}
              className={`flex min-h-11 flex-1 flex-col items-center gap-0.5 py-1.5 text-xs font-medium ${
                isActive ? 'text-primary' : 'text-neutral-400'
              }`}
            >
              <t.Icon className={`h-5 w-5 transition-transform ${isActive ? 'scale-110' : ''}`} />
              {t.label}
            </button>
          )
        })}
      </div>
    </nav>
  )
}
