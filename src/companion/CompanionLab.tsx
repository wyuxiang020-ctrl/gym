import { useEffect, useState } from 'react'
import { ORIGINAL_BOARDS, ORIGINAL_POSES, originalBoard, originalUrl, type OriginalBoardId } from './originals'
import './originals.css'
import GentleSample from './GentleSample'
import IdleSample from './IdleSample'
import ActionSamples from './ActionSamples'
import OriginalCompanion from './OriginalCompanion'

export default function CompanionLab() {
  const review = new URLSearchParams(window.location.search).get('review')
  if (review === 'mirror') return <main className="original-lab">
    <header className="original-header"><a href="/">GYM</a><a href="/?companion-lab=1">查看熊猫形象 ↗</a></header>
    <section className="original-intro"><p className="original-eyebrow">当前进度</p><h1>人体动作检测已暂缓。</h1><p>接下来专注静态器械扫描。D 熊猫保留为虚拟形象。</p><a className="original-gentle-link" href="/?equipment-scan=1">进入器械扫描 ↗</a></section>
  </main>
  if (review === 'actions') return <ActionSamples />
  if (review === 'idle' || review === 'gentle') return <IdleSample />
  if (review === 'gentle-v1') return <GentleSample />
  if (review === 'originals') return <OriginalReview />
  return <OriginalCompanion />
}

function OriginalReview() {
  const [poseId, setPoseId] = useState('stand')
  const [boardId, setBoardId] = useState<OriginalBoardId>('body')
  const [wholeBoard, setWholeBoard] = useState(false)
  const [nativeSize, setNativeSize] = useState(false)
  const [failedSource, setFailedSource] = useState('')
  const pose = ORIGINAL_POSES.find(item => item.id === poseId)!
  const source = wholeBoard ? boardId : pose.board
  const board = originalBoard(source)
  const url = originalUrl(source)
  const rect = wholeBoard ? [0, 0, 1536, 1024] : pose.rect
  const [x, y, width, height] = rect
  const title = wholeBoard ? board.label : pose.label

  useEffect(() => {
    let cancelled = false
    const image = new Image()
    image.src = url
    void image.decode().catch(() => { if (!cancelled) setFailedSource(url) })
    return () => { cancelled = true }
  }, [url])

  return <main className="original-lab" data-version="D-originals" data-renderer="source-image" data-pose={poseId} data-whole-board={wholeBoard}>
    <header className="original-header"><a href="/">GYM <span>/ D 熊猫</span></a><a href="/">返回训练记录 ↗</a></header>
    <section className="original-intro"><p className="original-eyebrow">D PANDA / 原图核对</p><h1>就用你给的这只熊猫。</h1><p>直接展示设计原图中的形象与姿势。</p><a className="original-gentle-link" href="/?companion-lab=1">查看动作与表情 ↗</a></section>
    <div className="original-layout">
      <section className="original-stage" aria-label="熊猫原图画面">
        <div className="original-stage-heading"><h2>{title}</h2><span>{wholeBoard ? '完整原图' : '原图局部'}</span></div>
        <div className={`original-scroll${nativeSize ? ' original-native' : ''}`} tabIndex={0} aria-label="原图查看区域">
          {failedSource === url ? <p role="alert">原图暂时无法加载。请刷新页面重试。</p> :
            <svg key={url} className={`original-art${wholeBoard ? ' original-board-art' : ''}`} role="img" aria-label={`${title}，来自${board.label}原图`}
              width={width} height={height} viewBox={rect.join(' ')}
              style={nativeSize ? { width, height } : undefined}
              data-source={board.file} data-rect={rect.join(',')}>
              <image href={url} x="0" y="0" width="1536" height="1024" onError={() => setFailedSource(url)} />
            </svg>}
        </div>
        <div className="original-view-options" role="group" aria-label="查看尺寸">
          <button aria-pressed={!nativeSize} onClick={() => setNativeSize(false)}>适应画面</button>
          <button aria-pressed={nativeSize} onClick={() => setNativeSize(true)}>原始尺寸 1:1</button>
          <a href={url} target="_blank" rel="noreferrer">打开完整原图 ↗</a>
        </div>
        <p className="original-caption">{wholeBoard ? '整张设计板保留原样。' : '保留原稿的表情、轮廓、配色、道具与背景。'}</p>
      </section>
      <aside className="original-controls" aria-label="原稿选择">
        <h2>查看已有姿势</h2><p>点击切换原图中的定格姿势。</p>
        {(['body', 'hands'] as const).map(group => <section className="original-pose-group" key={group}>
          <h3>{group === 'body' ? '站姿与道具' : '抬手互动 · 六格原稿'}</h3>
          <div className="original-pose-buttons" role="group" aria-label={group === 'body' ? '站姿与道具' : '抬手姿势'}>
            {ORIGINAL_POSES.filter(item => item.board === group).map(item => <button key={item.id}
              data-pose-choice={item.id} aria-pressed={!wholeBoard && poseId === item.id}
              onClick={() => { setPoseId(item.id); setBoardId(item.board); setWholeBoard(false) }}>{item.label}</button>)}
          </div>
        </section>)}
        <section className="original-boards"><h3>完整资料 · 七张原图</h3><p>其他姿势、表情与转面可在原板中逐一查看。</p>
          <div role="group" aria-label="完整设计板">{ORIGINAL_BOARDS.map(item => <button key={item.id}
            data-board-choice={item.id} aria-pressed={wholeBoard && boardId === item.id}
            onClick={() => { setBoardId(item.id); setWholeBoard(true) }}>{item.label}<span>↗</span></button>)}</div>
        </section>
      </aside>
    </div>
    <p className="original-boundary">这里保留未经修改的设计原图，供动作与表情逐项核对。</p>
    <details className="original-source"><summary>查看当前画面的来源</summary>
      <p>交付包：panda-ip-handoff-2026-10-08 / assets / {board.file}</p>
      <p>原图 1536 × 1024；当前显示区域：左 {x}、上 {y}、宽 {width}、高 {height} 像素。这里只改变查看范围；没有重画、抠图、调色、翻转或补帧。</p>
    </details>
  </main>
}
