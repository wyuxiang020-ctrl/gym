export interface TeachingVideo {
  exercise: string
  variant: string
  equipment: string
  publisher: string
  title: string
  videoId: string
  sourceUrl: string
  checkedOn: string
}

// Curated metadata only. No video files, credentials, personal records or scraped media.
// Source-page verification is not a professional review or a playback guarantee.
export const TEACHING_VIDEOS: readonly TeachingVideo[] = [
  {
    exercise: '杠铃深蹲', variant: '背杠深蹲（不是前蹲或史密斯深蹲）', equipment: '自由杠铃、深蹲架',
    publisher: 'CrossFit', title: 'The Back Squat', videoId: 'QmZAiBqPvZw',
    sourceUrl: 'https://www.crossfit.com/essentials/the-back-squat', checkedOn: '2026-10-01',
  },
  {
    exercise: '杠铃卧推', variant: '平板杠铃卧推（不是哑铃或上斜卧推）', equipment: '自由杠铃、平板卧推凳',
    publisher: 'NASM', title: 'Barbell Bench Press', videoId: 'CayG6UYqL8g',
    sourceUrl: 'https://www.nasm.org/resource-center/exercise-library/barbell-bench-press', checkedOn: '2026-10-01',
  },
  {
    exercise: '杠铃划船', variant: '俯身杠铃划船（不是绳索或器械划船）', equipment: '自由杠铃',
    publisher: 'CrossFit', title: 'The Barbell Bent-Over Row', videoId: 'Ho7xUiDkJcg',
    sourceUrl: 'https://www.youtube.com/watch?v=Ho7xUiDkJcg', checkedOn: '2026-10-01',
  },
  {
    exercise: '平板支撑', variant: '前臂平板支撑（不是直臂或侧平板）', equipment: '地面或训练垫',
    publisher: 'NASM', title: 'Plank', videoId: 'mwlp75MS6Rg',
    sourceUrl: 'https://www.nasm.org/resource-center/exercise-library/plank', checkedOn: '2026-10-01',
  },
]

// Deliberately conservative: "卧推", "划船", etc. do not identify equipment/variation.
// Never silently rewrite a user's stored exercise name to obtain a video match.
export function teachingVideoFor(name: string): TeachingVideo | undefined {
  return TEACHING_VIDEOS.find(video => video.exercise === name.trim())
}
