import { useEffect, useRef, useState } from 'react'
import { postJson } from '../lib/apiClient'
import { compressForAnalysis } from '../lib/imageCompress'
import { CHEST_PRESS, validateEquipmentResult, type EquipmentResult } from '../lib/equipment'
import { clearEquipmentHandoff, getEquipmentHandoff, saveEquipmentHandoff } from '../lib/store'
import EquipmentTeaching from './EquipmentTeaching'
import './equipment.css'

type Props = { onAddExercise?: (name: string) => boolean; onContinueTraining?: () => void; onStartCompanion?: (name: string) => boolean; date?: string }

export default function EquipmentScanner({ onAddExercise, onContinueTraining, onStartCompanion, date }: Props) {
  const [handoff, setHandoff] = useState(() => new URLSearchParams(window.location.search).get('equipment-training') === '1' ? getEquipmentHandoff() : null)
  const [photo, setPhoto] = useState<{ base64: string; dataUrl: string } | null>(null)
  const [busy, setBusy] = useState<'image' | 'request' | null>(null)
  const [result, setResult] = useState<EquipmentResult | null>(null)
  const [manual, setManual] = useState(false)
  const [confirmed, setConfirmed] = useState(Boolean(handoff))
  const [modelMatched, setModelMatched] = useState(handoff?.modelMatched ?? false)
  const [service, setService] = useState<{ available: boolean; message: string } | null>(null)
  const [serviceCheck, setServiceCheck] = useState(0)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const fileInput = useRef<HTMLInputElement>(null)
  const cameraInput = useRef<HTMLInputElement>(null)
  const revision = useRef(0)
  const controller = useRef<AbortController | null>(null)
  const locked = useRef(false)
  useEffect(() => () => { revision.current++; controller.current?.abort() }, [])
  useEffect(() => {
    const check = new AbortController()
    setService(null)
    void fetch('/api/equipment-status', { cache: 'no-store', signal: AbortSignal.any([check.signal, AbortSignal.timeout(5000)]) })
      .then(async response => {
        const value = await response.json()
        if (!response.ok || typeof value.available !== 'boolean' || typeof value.message !== 'string' || value.message.length > 400) throw new Error('Invalid status')
        if (!check.signal.aborted) setService({ available: value.available, message: value.message })
      }).catch(() => { if (!check.signal.aborted) setService({ available: false, message: '暂时连接不到识别服务，可以先手动选择器械。' }) })
    return () => check.abort()
  }, [serviceCheck])

  function reset() {
    revision.current++
    controller.current?.abort(); controller.current = null; locked.current = false
    setHandoff(null); clearEquipmentHandoff(); setModelMatched(false)
    setPhoto(null); setBusy(null); setResult(null); setManual(false); setConfirmed(false); setSaved(false); setError('')
  }

  async function choose(file?: File) {
    if (!file) return
    reset()
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 10 * 1024 * 1024) {
      setError('请选择 10 MB 以内的 JPEG、PNG 或 WebP 静态照片。'); return
    }
    const token = revision.current
    setBusy('image')
    try {
      const image = await compressForAnalysis(file)
      if (token === revision.current) setPhoto(image)
    } catch { if (token === revision.current) setError('照片无法读取，请换一张照片。') }
    finally { if (token === revision.current) setBusy(null) }
  }

  async function identify() {
    if (!photo || locked.current || busy || !service?.available) return
    locked.current = true
    const token = ++revision.current
    controller.current = new AbortController()
    setBusy('request'); setError(''); setResult(null); setManual(false); setConfirmed(false); setSaved(false)
    setHandoff(null); clearEquipmentHandoff(); setModelMatched(false)
    try {
      const response = await postJson('/api/identify-equipment', { imageBase64: photo.base64, mediaType: 'image/jpeg' }, '器械识别失败，请手动确认或重拍。', { signal: controller.current.signal })
      const parsed = validateEquipmentResult((response as { result?: unknown } | null)?.result)
      if (token === revision.current) setResult(parsed)
    } catch (cause) { if (token === revision.current) setError(cause instanceof Error ? cause.message : '识别失败，请手动确认。') }
    finally { if (token === revision.current) { setBusy(null); locked.current = false; controller.current = null } }
  }

  function cancel() {
    revision.current++; controller.current?.abort(); controller.current = null; locked.current = false
    setBusy(null); setError('已取消等待。服务端已开始的识别仍可能计费，不会自动重试。')
  }

  const candidate = Boolean(handoff) || manual || result?.equipmentId === CHEST_PRESS.id
  function continueToTraining() {
    if (!saveEquipmentHandoff(modelMatched)) { setError('暂时无法保留已确认器械。请保持本页，或直接进入训练记录手动添加。'); return }
    window.location.assign('/?equipment-training=1')
  }
  return <section className="equipment-scanner" aria-label="静态器械扫描">
    <div className="equipment-steps" aria-label="流程"><span data-active={!candidate}>01 拍摄器械</span><span data-active={candidate && !confirmed}>02 核对类别</span><span data-active={confirmed}>03 查看资料</span></div>
    <div className="equipment-grid">
      <section className="equipment-card">
        <h2>把器械拍完整</h2><p>首轮支持坐姿推胸机。拍到座椅、靠背、握把和推臂，尽量只包含一台器械。</p>
        <div className="equipment-photo">{photo ? <img src={photo.dataUrl} alt="待识别的器械照片，本地预览" /> : <div><span aria-hidden="true">＋</span><strong>先看照片，再决定上传</strong><p>可拍照，也可从相册选择</p></div>}</div>
        <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" hidden aria-label="选择器械照片" onChange={event => { void choose(event.target.files?.[0]); event.target.value = '' }} />
        <input ref={cameraInput} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" hidden aria-label="拍摄器械照片" onChange={event => { void choose(event.target.files?.[0]); event.target.value = '' }} />
        <div className="equipment-buttons"><button onClick={() => cameraInput.current?.click()} disabled={!!busy}>拍一张照片</button><button onClick={() => fileInput.current?.click()} disabled={!!busy}>选择照片</button>{photo && <button onClick={reset}>移除照片</button>}</div>
        <p className="equipment-note">选择照片只在本地预览。点击下方按钮后，压缩照片会发送至 OpenAI 识别并可能计费；请避开人物和私人信息。照片不写入训练档案。</p>
        <p className="equipment-service" role="status">{service?.message ?? '正在检查识别服务…'}</p>
        {service && !service.available && <button onClick={() => setServiceCheck(value => value + 1)}>重新检查服务</button>}
        <button className="equipment-primary" disabled={!photo || !!busy || !service?.available} onClick={() => void identify()}>{busy === 'image' ? '正在准备照片…' : busy === 'request' ? '正在识别…' : '上传并识别器械'}</button>
        {busy === 'request' && <button onClick={cancel}>取消等待</button>}
      </section>
      <section className="equipment-card" aria-live="polite">
        {error && <p className="equipment-error" role="alert">{error}</p>}
        {!candidate && <><h2>{result ? '暂时无法确认' : '识别后，由你确认'}</h2><p>{result ? result.uncertain : '系统只给器械候选，不会自动开始或记为完成训练。'}</p>{result?.evidence.map((item, index) => <p key={index}>可见线索：{item}</p>)}<p className="equipment-note">不支持的器械或看不清的照片会保留为“无法确认”。可以重拍，或对照实物手动选择。</p></>}
        {!candidate && <button disabled={!!busy} onClick={() => { setManual(true); setError('') }}>手动选择坐姿推胸机</button>}
        {candidate && <>
          <p className="equipment-label">{handoff ? '从扫描页带入 · 已人工确认' : manual ? '手动选择 · 未经 AI 识别' : `AI 候选 · ${result?.confidence === 'high' ? '把握较高' : result?.confidence === 'mid' ? '仍有疑问' : '把握较低'}`}</p>
          <h2>{CHEST_PRESS.name}</h2>
          {!manual && !handoff && <>{result?.evidence.map((item, index) => <p key={index}>可见线索：{item}</p>)}<p className="equipment-note">待核对：{result?.uncertain}</p></>}
          {!confirmed ? <><p>请对照器械标牌与实物确认。座椅、靠背和推臂结构应对应坐姿向前推胸，不能只凭外形相近就确认。</p><div className="equipment-buttons"><button className="equipment-primary" onClick={() => setConfirmed(true)}>确认是坐姿推胸机</button><button onClick={() => { setManual(false); setResult(null); setError('已排除该候选，可以重新拍摄或返回训练记录手动选动作。') }}>不是这类器械</button></div></> : <>
            <p className="equipment-label">已确认类别 · 具体品牌型号仍需核对</p>
            <h3>资料与适用范围</h3><p>对应记录动作：<strong>{CHEST_PRESS.exercise}</strong>。不适用于史密斯卧推、器械推肩或蝴蝶机夹胸。</p>
            <p>以下是 Life Fitness Insignia SS-CP 的官方资料示例。只有设备标牌型号相同，才使用其具体调节说明；其他型号请查看机身说明。</p>
            <div className="equipment-links"><a href={CHEST_PRESS.source} target="_blank" rel="noreferrer">查看官方器械介绍 ↗</a><a href={CHEST_PRESS.manual} target="_blank" rel="noreferrer">查看该系列说明书 ↗</a></div>
            <EquipmentTeaching matched={modelMatched} onMatch={setModelMatched} />
            {onAddExercise ? <><p>添加到 {date} 的力量训练，只添加动作名称。重量、次数和完成状态由你填写。</p><button className="equipment-primary" disabled={saved} onClick={() => { if (onAddExercise(CHEST_PRESS.exercise)) { setSaved(true); setError(''); clearEquipmentHandoff() } else setError('未能添加动作，请检查训练记录或存储提示后重试。') }}>{saved ? '已加入训练记录' : '添加到当前训练记录'}</button>{saved && onContinueTraining && <button onClick={onContinueTraining}>开始填写组数与重量</button>}{saved && onStartCompanion && <button className="equipment-primary" onClick={() => { if (!onStartCompanion(CHEST_PRESS.exercise)) { setSaved(false); setError('这个动作已不在当前记录中，请重新添加后开始陪练。') } }}>用熊猫陪练这个动作</button>}</> : <><button className="equipment-primary" onClick={continueToTraining}>带入训练记录 ↗</button><p className="equipment-note">保留已确认类别 30 分钟，不携带照片；进入后点击添加才写入训练记录。</p></>}
            <button onClick={() => { setHandoff(null); clearEquipmentHandoff(); setManual(true); setResult(null); setModelMatched(false); setConfirmed(false); setSaved(false); setError('') }}>重新核对类别</button>
          </>}
        </>}
      </section>
    </div>
  </section>
}
