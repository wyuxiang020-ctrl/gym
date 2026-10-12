import { useEffect, useId, useRef } from 'react'

export type EquipmentDialogValue = { title: string; message: string; actionLabel?: string; onConfirm?: () => void }

export default function EquipmentDialog({ value, onClose }: { value: EquipmentDialogValue; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  const id = useId()
  useEffect(() => {
    const dialog = ref.current
    const previous = document.activeElement as HTMLElement | null
    dialog?.showModal()
    return () => { dialog?.close(); if (previous?.isConnected) previous.focus({ preventScroll: true }) }
  }, [])
  return <dialog ref={ref} className="equipment-dialog" aria-labelledby={`${id}-title`} aria-describedby={`${id}-message`} onCancel={onClose}>
    <h2 id={`${id}-title`}>{value.title}</h2>
    <p id={`${id}-message`}>{value.message}</p>
    <div className="equipment-buttons">
      <button autoFocus onClick={onClose}>{value.onConfirm ? '留在当前步骤' : '知道了'}</button>
      {value.onConfirm && <button className="equipment-primary" onClick={() => { onClose(); value.onConfirm?.() }}>{value.actionLabel ?? '确认返回'}</button>}
    </div>
  </dialog>
}
