import type { PoseLandmark } from './mapping'

export type PoseWorkerInput =
  | { type: 'init'; bundleUrl: string; wasmRoot: string; modelUrl: string }
  | { type: 'frame'; id: number; capturedAt: number; width: number; height: number; bitmap: ImageBitmap }
  | { type: 'dispose' }

export type PoseWorkerOutput =
  | { type: 'ready'; resourceLoadMs: number; initializationMs: number; blockedNetworkRequests?: number }
  | { type: 'result'; id: number; capturedAt: number; width: number; height: number; landmarks: PoseLandmark[][]; inferenceMs: number }
  | { type: 'error'; stage: 'init' | 'inference'; message: string }
