export const ORIGINAL_BOARDS = [
  { id: 'body', file: 'D2-character-accessories.png', label: '本体与道具' },
  { id: 'hands', file: 'D4-hand-interaction.png', label: '抬手互动' },
  { id: 'poses', file: 'D2-key-poses.png', label: '八个全身姿势' },
  { id: 'movement', file: 'D3-movement.png', label: '大幅动作关键态' },
  { id: 'expressions', file: 'D2-expressions.png', label: '常态表情' },
  { id: 'big-expressions', file: 'D3-expressions.png', label: '夸张表情' },
  { id: 'turnaround', file: 'D1-character-turnaround.png', label: '初始转面' },
] as const

export type OriginalBoardId = typeof ORIGINAL_BOARDS[number]['id']
export type OriginalRegion = {
  id: string
  label: string
  board: OriginalBoardId
  rect: readonly [number, number, number, number]
}

// These rectangles are display windows into unchanged source PNGs, not new artwork.
export const ORIGINAL_POSES: readonly OriginalRegion[] = [
  { id: 'stand', label: '日常 · 空手', board: 'body', rect: [50, 140, 390, 475] },
  { id: 'hat', label: '招呼 · 戴帽', board: 'body', rect: [530, 135, 420, 480] },
  { id: 'bamboo', label: '同行 · 持竹', board: 'body', rect: [1025, 135, 455, 480] },
  { id: 'ready', label: '准备', board: 'hands', rect: [27, 126, 485, 352] },
  { id: 'half', label: '抬到一半', board: 'hands', rect: [526, 126, 485, 352] },
  { id: 'high', label: '举高保持', board: 'hands', rect: [1025, 126, 484, 352] },
  { id: 'lower', label: '慢慢放下', board: 'hands', rect: [27, 489, 485, 350] },
  { id: 'both', label: '双手举高', board: 'hands', rect: [526, 489, 485, 350] },
  { id: 'wave', label: '轻轻挥手', board: 'hands', rect: [1025, 489, 484, 350] },
]

export function originalBoard(id: OriginalBoardId) {
  return ORIGINAL_BOARDS.find(board => board.id === id)!
}

export function originalUrl(id: OriginalBoardId) {
  return `/companion-assets/d-panda/design/${originalBoard(id).file}`
}
