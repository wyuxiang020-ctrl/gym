/* Classic worker: MediaPipe's WASM loader uses importScripts. */
// MediaPipe 1.1.0 includes metrics reporting. Install the resource-only boundary
// before any vendor code runs; no input, telemetry or other POST may leave here.
let blockedNetworkRequests = 0
;(() => {
  const nativeFetch = self.fetch.bind(self)
  const nativeImportScripts = self.importScripts.bind(self)
  const resourceRoot = new URL('./', self.location.href)
  const allowedResources = new Set([
    'vision_bundle.js', 'pose_landmarker_lite.task',
    ...['vision_wasm_internal', 'vision_wasm_nosimd_internal', 'vision_wasm_module_internal']
      .flatMap(name => [`wasm/${name}.js`, `wasm/${name}.wasm`]),
  ].map(path => new URL(path, resourceRoot).href))
  const resourceUrl = value => {
    const url = new URL(value, self.location.href)
    if (url.origin !== resourceRoot.origin || !allowedResources.has(url.href)
      || !['https:', 'http:'].includes(url.protocol) || url.username || url.password) {
      blockedNetworkRequests++
      throw new DOMException('Worker permits local static resources only', 'SecurityError')
    }
    return url.href
  }
  const lock = (target, name, value) => Object.defineProperty(target, name, { value, writable: false, configurable: false })
  lock(self, 'fetch', async (input, options) => {
    const request = new Request(input, options)
    resourceUrl(request.url)
    if (!['GET', 'HEAD'].includes(request.method)) {
      blockedNetworkRequests++
      throw new DOMException('Worker uploads are disabled', 'SecurityError')
    }
    return nativeFetch(request, { redirect: 'error', mode: 'same-origin', credentials: 'omit', referrerPolicy: 'no-referrer' })
  })
  lock(self, 'importScripts', (...urls) => nativeImportScripts(...urls.map(resourceUrl)))
  const disabled = function () {
    blockedNetworkRequests++
    throw new DOMException('This network channel is disabled in the pose worker', 'SecurityError')
  }
  // XHR cannot be configured to reject redirects before following them. The
  // supported runtime uses fetch; fail closed instead of allowing that fallback.
  for (const name of ['XMLHttpRequest', 'WebSocket', 'EventSource', 'WebTransport', 'RTCPeerConnection', 'Worker', 'SharedWorker']) {
    lock(self, name, disabled)
  }
  if (self.navigator) lock(self.navigator, 'sendBeacon', () => { blockedNetworkRequests++; return false })
})()

let landmarker = null
let disposed = false
let initialized = false

function sameOrigin(value) {
  const url = new URL(value, self.location.href)
  if (url.origin !== self.location.origin) throw new Error('Only same-origin runtime assets are allowed')
  return url.href
}

self.onmessage = async event => {
  const message = event.data
  if (message.type === 'dispose') {
    disposed = true
    landmarker?.close()
    landmarker = null
    self.close()
    return
  }
  if (message.type === 'init') {
    if (initialized || disposed) return
    initialized = true
    try {
      if (typeof OffscreenCanvas !== 'function') throw new Error('OffscreenCanvas is unavailable')
      const resourceStart = performance.now()
      importScripts(sameOrigin(message.bundleUrl))
      const [vision, response] = await Promise.all([
        self.Vision.FilesetResolver.forVisionTasks(sameOrigin(message.wasmRoot)),
        fetch(sameOrigin(message.modelUrl), { credentials: 'same-origin' }),
      ])
      if (!response.ok) throw new Error(`Model download failed (${response.status})`)
      const model = new Uint8Array(await response.arrayBuffer())
      const resourceLoadMs = performance.now() - resourceStart
      if (disposed) return
      const initializationStart = performance.now()
      landmarker = await self.Vision.PoseLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetBuffer: model, delegate: 'CPU' },
        canvas: new OffscreenCanvas(1, 1),
        runningMode: 'VIDEO',
        numPoses: 2,
        minPoseDetectionConfidence: 0.65,
        minPosePresenceConfidence: 0.65,
        minTrackingConfidence: 0.65,
        outputSegmentationMasks: false,
      })
      if (disposed) { landmarker.close(); landmarker = null; return }
      self.postMessage({ type: 'ready', resourceLoadMs, initializationMs: performance.now() - initializationStart, blockedNetworkRequests })
    } catch (error) {
      if (!disposed) self.postMessage({ type: 'error', stage: 'init', message: String(error?.message || error) })
    }
    return
  }
  if (message.type === 'frame') {
    const bitmap = message.bitmap
    try {
      if (!landmarker || disposed) return
      const start = performance.now()
      // Synchronous inference is deliberately kept off the rendering thread.
      const result = landmarker.detectForVideo(bitmap, message.capturedAt)
      const inferenceMs = performance.now() - start
      self.postMessage({
        type: 'result', id: message.id, capturedAt: message.capturedAt,
        width: message.width, height: message.height,
        landmarks: result.landmarks, inferenceMs,
      })
      result.close()
    } catch (error) {
      if (!disposed) self.postMessage({ type: 'error', stage: 'inference', message: String(error?.message || error) })
    } finally {
      bitmap?.close()
    }
  }
}
