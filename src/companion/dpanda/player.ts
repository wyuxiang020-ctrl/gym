import { dPose, duration, type DAction, type RaiseSide } from './motion'

// An interrupted performance finishes its contact sequence before starting the
// next one. Pausing/inspection is separate from requesting a safe finish.
export class DPlayer {
  action: DAction = 'idle'
  playing = false
  loop = false
  reduced = false
  side: RaiseSide = 'left'
  pending: DAction | null = null
  private elapsed = 0
  private started = 0
  private afterRise: DAction | null = null
  private nextReduced: boolean | null = null

  time(now: number): number {
    const length = duration(this.action)
    const value = this.elapsed + (this.playing ? Math.max(0, now - this.started) : 0)
    if (value < length || !this.playing) return Math.min(length, value)
    if (this.pending) {
      const next = this.pending; this.pending = null
      if (this.action === 'rest' && next !== 'rise') { this.afterRise = next; this.begin('rise', now) }
      else this.begin(next, now)
      return 0
    }
    if (this.action === 'rise' && this.afterRise) { const next = this.afterRise; this.afterRise = null; this.begin(next, now); return 0 }
    if (this.loop && !['rest', 'rise'].includes(this.action)) { this.elapsed = value % length; this.started = now; return this.elapsed }
    this.elapsed = length; this.playing = false
    return length
  }
  private begin(action: DAction, now: number) { if (this.nextReduced !== null) { this.reduced = this.nextReduced; this.nextReduced = null } this.action = action; this.elapsed = 0; this.started = now; this.playing = true }
  setReduced(value: boolean, now: number) {
    if (this.frame(now).lift > 0) { this.nextReduced = value; this.pending = 'idle'; this.resume(now) }
    else this.reduced = value
  }
  request(action: DAction, now: number) {
    const time = this.time(now)
    if (this.action === 'idle') { this.pending = null; this.begin(action, now); return }
    if (this.action === 'rest' && time >= duration('rest')) {
      this.afterRise = action === 'rise' ? null : action; this.begin('rise', now); return
    }
    if (time > 30 && time < duration(this.action)) { this.pending = action; this.resume(now); return }
    this.pending = null; this.begin(action, now)
  }
  pause(now: number) { this.elapsed = this.time(now); this.playing = false }
  resume(now: number) { if (this.playing) return; this.started = now; this.playing = true }
  seek(time: number) { this.pending = null; this.afterRise = null; this.playing = false; this.elapsed = Math.max(0, Math.min(duration(this.action), time)) }
  reset() { this.action = 'idle'; this.elapsed = 0; this.started = 0; this.playing = false; this.pending = null; this.afterRise = null; this.nextReduced = null }
  frame(now: number) { const time = this.time(now); return dPose(time, this.action, this.reduced, this.side) }
}
