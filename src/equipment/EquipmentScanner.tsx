import { useEffect, useRef, useState } from 'react'
import { postJson } from '../lib/apiClient'
import { compressForAnalysis } from '../lib/imageCompress'
import { EQUIPMENT_CATALOG, EQUIPMENT_EXERCISES, equipmentById, exercisesForEquipment, needsExerciseChoice, type EquipmentId, validateEquipmentResult, type EquipmentExerciseId, type EquipmentResult } from '../lib/equipment'
import { clearEquipmentHandoff, getEquipmentHandoff, saveEquipmentHandoff } from '../lib/store'
import EquipmentTeaching from './EquipmentTeaching'
import EquipmentExercisePicker from './EquipmentExercisePicker'
import EquipmentDialog, { type EquipmentDialogValue } from './EquipmentDialog'
import './equipment.css'
import './equipment-training-theme.css'

type Props = { onAddExercise?: (name: string) => boolean; onContinueTraining?: () => void; onStartCompanion?: (name: string) => boolean; date?: string }
type Step = 1 | 2 | 3 | 4
const STEP_LABELS = ['拍摄器械', '器械与动作', '短视频示范', '训练记录']

export default function EquipmentScanner({ onAddExercise, onContinueTraining, onStartCompanion, date }: Props) {
  const [handoff, setHandoff] = useState(() => new URLSearchParams(window.location.search).get('equipment-training') === '1' ? getEquipmentHandoff() : null)
  const [photo, setPhoto] = useState<{ base64: string; dataUrl: string } | null>(null)
  const [busy, setBusy] = useState<'image' | 'request' | null>(null)
  const [result, setResult] = useState<EquipmentResult | null>(null)
  const [manual, setManual] = useState<EquipmentId | null>(null)
  const [confirmed, setConfirmed] = useState(Boolean(handoff))
  const [step, setStep] = useState<Step>(handoff ? 4 : 1)
  const [exerciseId, setExerciseId] = useState<EquipmentExerciseId | null>(handoff?.exerciseId ?? null)
  const [dialog, setDialog] = useState<EquipmentDialogValue | null>(null)
  const [service, setService] = useState<{ available: boolean; message: string } | null>(null)
  const [serviceCheck, setServiceCheck] = useState(0)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const fileInput = useRef<HTMLInputElement>(null)
  const cameraInput = useRef<HTMLInputElement>(null)
  const revision = useRef(0)
  const controller = useRef<AbortController | null>(null)
  const locked = useRef(false)
  const stepHeading = useRef<HTMLHeadingElement>(null)
  const previousStep = useRef(step)
  const equipment = equipmentById(handoff?.equipmentId ?? manual ?? result?.equipmentId)
  const exercises = equipment ? exercisesForEquipment(equipment.id) : []
  const exercise = exercises.find(item => item.id === exerciseId) ?? exercises[0] ?? EQUIPMENT_EXERCISES[0]
  const candidate = Boolean(equipment)
  useEffect(() => () => { revision.current++; controller.current?.abort() }, [])
  useEffect(() => {
    if (step !== previousStep.current) {
      previousStep.current = step
      stepHeading.current?.focus({ preventScroll: true })
    }
  }, [step])
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
    setHandoff(null); clearEquipmentHandoff(); setExerciseId(null)
    setPhoto(null); setBusy(null); setResult(null); setManual(null); setConfirmed(false); setSaved(false); setError(''); setStep(1)
  }
  function requestRestart() {
    if (!photo && !candidate && !result && !busy) { setStep(1); return }
    setDialog({ title: '返回拍摄，重新选择器械？', message: '本次照片、识别结果和动作选择会清除，已保存的训练记录会保留。', actionLabel: '确认返回拍摄', onConfirm: reset })
  }
  function navigate(target: Step) {
    if (target === 1) { if (step !== 1 || busy) requestRestart(); return }
    if (!candidate && !result) {
      setDialog({ title: busy ? '请先完成器械识别' : '请先拍摄或选择器械', message: busy ? '正在处理当前照片。请等待结果，或返回拍摄取消本次识别。' : '先拍摄并识别一台器械，也可以在第一步手动选择，然后再继续。' }); return
    }
    if (target >= 3 && !confirmed) {
      setDialog({ title: '请先确认器械与动作', message: '在第二步确认器械，并选择这次想练的动作，再查看示范或带入记录。' }); return
    }
    setStep(target); setError('')
  }
  function selectExercise(id: EquipmentExerciseId) {
    if (id === exerciseId) return
    const select = () => { setExerciseId(id); setConfirmed(false); setSaved(false); clearEquipmentHandoff(); setError('') }
    if (id === 'unilateral') setDialog({ title: '这台器械可以单臂使用吗？', message: '单臂推胸仅适用于左右推臂可独立运动、且机身说明允许单臂使用的器械。不确定时，请选择双臂推胸。', actionLabel: '符合条件，选择单臂', onConfirm: select })
    else select()
  }
  async function choose(file?: File) {
    if (!file) return
    reset()
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 10 * 1024 * 1024) {
      setError('请选择 10 MB 以内的 JPEG、PNG 或 WebP 静态照片。'); return
    }
    const token = revision.current
    setBusy('image')
    try { const image = await compressForAnalysis(file); if (token === revision.current) setPhoto(image) }
    catch { if (token === revision.current) setError('照片无法读取，请换一张照片。') }
    finally { if (token === revision.current) setBusy(null) }
  }
  async function identify() {
    if (!photo || locked.current || busy || !service?.available) return
    locked.current = true
    const token = ++revision.current
    controller.current = new AbortController()
    setBusy('request'); setError(''); setResult(null); setManual(null); setConfirmed(false); setSaved(false)
    setHandoff(null); clearEquipmentHandoff(); setExerciseId(null)
    try {
      const response = await postJson('/api/identify-equipment', { imageBase64: photo.base64, mediaType: 'image/jpeg' }, '器械识别失败，请手动确认或重拍。', { signal: controller.current.signal })
      const parsed = validateEquipmentResult((response as { result?: unknown } | null)?.result)
      if (token === revision.current) { setResult(parsed); if (parsed.equipmentId !== 'unknown') setExerciseId(needsExerciseChoice(parsed.equipmentId) ? null : exercisesForEquipment(parsed.equipmentId)[0].id); setStep(2) }
    } catch (cause) { if (token === revision.current) setError(cause instanceof Error ? cause.message : '识别失败，请手动确认。') }
    finally { if (token === revision.current) { setBusy(null); locked.current = false; controller.current = null } }
  }
  function cancel() {
    revision.current++; controller.current?.abort(); controller.current = null; locked.current = false
    setBusy(null); setError('已取消等待。服务端已开始的识别仍可能计费，不会自动重试。')
  }
  function manuallySelect(id: EquipmentId) {
    setHandoff(null); clearEquipmentHandoff(); setManual(id); setResult(null)
    setExerciseId(needsExerciseChoice(id) ? null : exercisesForEquipment(id)[0].id); setConfirmed(false); setSaved(false); setError(''); setStep(2)
  }
  const manualPicker = <div className="equipment-picker-groups" aria-label="手动选择器械">{(['自由重量', '固定器械'] as const).map(kind => <section key={kind} aria-label={kind}><h4>{kind}</h4><div className="equipment-picker">{EQUIPMENT_CATALOG.filter(item => item.kind === kind).map(item => <button key={item.id} disabled={!!busy} aria-label={`手动选择${item.name}`} onClick={() => manuallySelect(item.id)}><small>{item.area} · {exercisesForEquipment(item.id).length} 个动作</small><strong>{item.name}</strong></button>)}</div></section>)}</div>
  function continueToTraining() {
    if (!confirmed || !equipment || !exerciseId) return
    if (!saveEquipmentHandoff(false, exerciseId, equipment.id)) { setError('暂时无法保留已确认器械。请保持本页，或直接进入训练记录手动添加。'); return }
    window.location.assign('/?equipment-training=1')
  }
  const originLabel = handoff ? '从扫描页带入 · 已人工确认' : manual ? '手动选择 · 未经 AI 识别' : '识别结果'
  return <section className="equipment-scanner" aria-label="静态器械扫描">
    <nav className="equipment-steps" aria-label="器械使用步骤">{STEP_LABELS.map((label, index) => {
      const number = (index + 1) as Step
      const complete = number === 1 ? candidate : number === 2 ? confirmed : number === 4 ? saved : false
      return <button key={label} type="button" aria-label={`0${number} ${label}`} aria-current={step === number ? 'step' : undefined} data-active={step === number} data-complete={complete} onClick={() => navigate(number)}><span className="equipment-step-number">0{number}</span><span className="equipment-step-label">{label}</span><span className="equipment-step-dot" aria-hidden="true" /></button>
    })}</nav>
    {error && <p className="equipment-error" role="alert">{error}</p>}
    <div className="equipment-grid" data-step={step}>
      {step === 1 ? <section className="equipment-card">
        <h2 ref={stepHeading} tabIndex={-1}>把器械拍完整</h2><p>支持哑铃、杠铃及常见固定器械，共 {EQUIPMENT_CATALOG.length} 类。自由重量拍清握柄与两端；固定器械拍全关键结构，尽量只包含一类器械。</p>
        <div className="equipment-photo" data-processing={busy === 'request'} aria-busy={Boolean(busy)}>{photo ? <img src={photo.dataUrl} alt="待识别的器械照片，本地预览" /> : <div><span aria-hidden="true">⌗</span><strong>先看照片，再决定上传</strong><p>可拍照，也可从相册选择</p></div>}</div>
        <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" hidden aria-label="选择器械照片" onChange={event => { void choose(event.target.files?.[0]); event.target.value = '' }} />
        <input ref={cameraInput} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" hidden aria-label="拍摄器械照片" onChange={event => { void choose(event.target.files?.[0]); event.target.value = '' }} />
        <div className="equipment-buttons"><button onClick={() => cameraInput.current?.click()} disabled={!!busy}>拍一张照片</button><button onClick={() => fileInput.current?.click()} disabled={!!busy}>选择照片</button>{photo && <button onClick={requestRestart}>移除照片</button>}</div>
        <p className="equipment-note">照片先在本地预览，点击识别后才上传。请避开人物和私人信息。</p>
        <p className="equipment-service" role="status">{service?.available ? '识别服务已连接' : service?.message ?? '正在检查识别服务…'}</p>
        {service && !service.available && <button onClick={() => setServiceCheck(value => value + 1)}>重新检查服务</button>}
        <button className="equipment-primary" disabled={!photo || !!busy || !service?.available} onClick={() => void identify()}>{busy === 'image' ? '正在准备照片…' : busy === 'request' ? '正在识别…' : '上传并识别器械'}</button>
        <p className="equipment-note">上传后由 OpenAI 识别并可能计费，照片不写入训练档案。</p>
        {busy === 'request' && <button onClick={cancel}>取消等待</button>}
      </section> : <aside className="equipment-card equipment-summary">
        <p className="equipment-label">{candidate ? originLabel : '当前照片'}</p>
        {photo ? <div className="equipment-photo"><img src={photo.dataUrl} alt="待识别的器械照片，本地预览" /></div> : <div className="equipment-summary-icon" aria-hidden="true">↗</div>}
        {candidate && <><h2>{equipment?.name}</h2><p>{confirmed ? `本次动作：${exercise.name}` : '选一个动作，开始这次训练。'}</p></>}
        <button onClick={requestRestart}>重新拍摄 / 更换器械</button>
      </aside>}
      <section className="equipment-card equipment-step-panel" key={step}>
        {step === 1 && <><p className="equipment-label">认识器械，只需几步</p><h2>拍一张，看看能练什么</h2><p>确认器械后选择动作，先看约 1 分钟的讲解，再记录训练。</p><h3>也可以直接选择器械</h3>{manualPicker}</>}
        {step === 2 && (!candidate ? <><h2 ref={stepHeading} tabIndex={-1}>暂时无法确认</h2><p>这张照片暂时无法确定为已支持的器械。请换个角度拍摄，或对照实物手动选择。</p><div className="equipment-buttons"><button onClick={requestRestart}>重新拍摄</button></div>{manualPicker}</> : <>
          <p className="equipment-label">这台器械可以练</p><h2 ref={stepHeading} tabIndex={-1}>选择这次的动作</h2>
          {equipment && needsExerciseChoice(equipment.id) && <p className="equipment-note">识别的是器械类型，动作由你选择。先确认现场具备动作所需的训练凳、把手或保护架。</p>}
          <EquipmentExercisePicker key={equipment?.id} exercises={exercises} selected={exerciseId} onSelect={selectExercise} />
          <div className="equipment-buttons"><button className="equipment-primary" disabled={!exerciseId} onClick={() => { setConfirmed(true); setStep(3); setError('') }}>确认是{equipment?.name}</button><button onClick={() => { reset(); setError('已排除该候选，可以重新拍摄或手动选择。') }}>不是这类器械</button></div>
        </>)}
        {step === 3 && confirmed && <><p className="equipment-label">看一遍，再开始</p><h2 ref={stepHeading} tabIndex={-1}>约 1 分钟，看懂怎么练</h2><EquipmentTeaching key={exerciseId} exercise={exercise} /><button className="equipment-primary" onClick={() => setStep(4)}>下一步：训练记录</button><button onClick={() => setStep(2)}>返回选择动作</button></>}
        {step === 4 && confirmed && <><p className="equipment-label">{saved ? '已加入训练' : '动作已准备好'}</p><h2 ref={stepHeading} tabIndex={-1}>{exercise.name}</h2><p>记录为「{exercise.exercise}」。重量、次数与完成状态由你填写。</p>
          {onAddExercise ? <><p>添加到 {date} 的力量训练。</p><button className="equipment-primary" disabled={saved} onClick={() => { if (onAddExercise(exercise.exercise)) { setSaved(true); setError(''); clearEquipmentHandoff() } else setError('未能添加动作，请检查训练记录或存储提示后重试。') }}>{saved ? '已加入训练记录' : '添加到当前训练记录'}</button>{saved && onContinueTraining && <button onClick={onContinueTraining}>开始填写组数与重量</button>}{saved && onStartCompanion && <button className="equipment-primary" onClick={() => { if (!onStartCompanion(exercise.exercise)) { setSaved(false); setError('这个动作已不在当前记录中，请重新添加后开始陪练。') } }}>用熊猫陪练这个动作</button>}</> : <><button className="equipment-primary" onClick={continueToTraining}>带入训练记录 ↗</button><p className="equipment-note">保留选择 30 分钟，进入后点击添加才会保存。</p></>}
          <button onClick={() => setStep(3)}>返回查看示范</button>
        </>}
      </section>
    </div>
    {dialog && <EquipmentDialog value={dialog} onClose={() => setDialog(null)} />}
  </section>
}
