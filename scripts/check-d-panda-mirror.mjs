import './ts-test-loader.mjs'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { runInNewContext } from 'node:vm'
const { MirrorSession } = await import('../src/companion/mirror/MirrorSession.ts')
const { mapMirrorPose, MirrorPoseFilter } = await import('../src/companion/mirror/mapping.ts')

// All landmarks and camera/worker events in this suite are fixed synthetic fixtures.
// This suite never opens a real camera or loads/runs a real model.
const checks = []
async function test(name, fn) {
  try { await fn(); checks.push({ name, pass: true }) }
  catch (error) { checks.push({ name, pass: false, error: error.stack }) }
}
const point = (x, y) => ({ x, y, z: 0, visibility: 0.99, presence: 0.99 })
function fixture(left = [0, 0], right = [0, 0], width = 640, height = 480) {
  const landmarks = Array.from({ length: 33 }, () => point(0.5, 0.5))
  for (const [indexes, direction, angles] of [[[11, 13, 15], 1, left], [[12, 14, 16], -1, right]]) {
    const shoulder = point((320 + direction * 64) / width, 190 / height)
    const elbow = point(shoulder.x + direction * Math.sin(angles[0]) * 80 / width, shoulder.y + Math.cos(angles[0]) * 80 / height)
    const wrist = point(elbow.x + direction * Math.sin(angles[0] + angles[1]) * 72 / width, elbow.y + Math.cos(angles[0] + angles[1]) * 72 / height)
    ;[shoulder, elbow, wrist].forEach((value, index) => { landmarks[indexes[index]] = value })
  }
  return [landmarks]
}
const mapped = (bodies, width = 640, height = 480, capturedAt = 1000, now = 1050) => mapMirrorPose(bodies, width, height, capturedAt, now)
const approx = (actual, expected) => assert.ok(Math.abs(actual - expected) < 0.00001, `${actual} != ${expected}`)

await test('fixed replay: anatomical left maps to panda right, with no second screen flip', () => {
  const value = mapped(fixture([1.4, 0.2]))
  assert.equal(value.ok, true)
  approx(value.pose.right.shoulder, 1.4)
  approx(value.pose.right.elbow, 0.2)
  approx(value.pose.left.shoulder, 0)
})
await test('fixed replay: anatomical right maps to panda left independently', () => {
  const value = mapped(fixture([0, 0], [1.7, 0.4]))
  assert.equal(value.ok, true)
  approx(value.pose.left.shoulder, 1.7)
  approx(value.pose.left.elbow, 0.4)
  approx(value.pose.right.shoulder, 0)
})
await test('fixed replay: both arms and lowered arms preserve independent joints', () => {
  const value = mapped(fixture([1.8, 0.3], [1.1, 0.6]))
  assert.equal(value.ok, true)
  approx(value.pose.right.shoulder, 1.8)
  approx(value.pose.left.elbow, 0.6)
  const down = mapped(fixture())
  assert.equal(down.ok, true)
  approx(down.pose.left.shoulder, 0)
  approx(down.pose.right.elbow, 0)
})
await test('non-square frame coordinates are corrected in pixels before angular mapping', () => {
  const landscape = mapped(fixture([1.1, 0.7]), 640, 480)
  const tall = mapped(fixture([1.1, 0.7], [0, 0], 640, 800), 640, 800)
  assert.equal(tall.ok, true)
  assert.deepEqual(tall.pose, landscape.pose)
})
for (const index of [11, 13, 15, 12, 14, 16]) {
  await test(`occluded joint ${index} rejects the entire pose without inferred continuation`, () => {
    const bodies = fixture([1, 0.3])
    bodies[0][index].visibility = 0.2
    assert.equal(mapped(bodies).reason, 'visibility')
  })
}
await test('absent/multiple people, missing joints and unknown visibility are rejected', () => {
  assert.equal(mapped([]).reason, 'body-count')
  assert.equal(mapped([...fixture(), ...fixture()]).reason, 'body-count')
  const bodies = fixture()
  delete bodies[0][15].visibility
  assert.equal(mapped(bodies).reason, 'visibility')
  delete bodies[0][15]
  assert.equal(mapped(bodies).reason, 'visibility')
})
await test('stale, future, NaN and zero-size frames cannot become trusted', () => {
  assert.equal(mapped(fixture(), 640, 480, 1000, 1351).reason, 'stale')
  assert.equal(mapped(fixture(), 640, 480, 1000, 999).reason, 'stale')
  assert.equal(mapped(fixture(), 0).reason, 'dimensions')
  const bodies = fixture()
  bodies[0][13].x = NaN
  assert.equal(mapped(bodies).reason, 'visibility')
})
await test('cross-body, elbow reverse bend and rig overflow are rejected rather than trusted clamping', () => {
  for (const angles of [[-0.5, 0], [1, -0.4], [2.8, 0], [1, 1.5], [2.3, 0.9]]) {
    assert.equal(mapped(fixture(angles)).reason, 'unsupported-pose')
  }
})
await test('side/back orientation and depth foreshortening produce explicit unsupported states', () => {
  const reversed = fixture()
  ;[reversed[0][11], reversed[0][12]] = [reversed[0][12], reversed[0][11]]
  assert.equal(mapped(reversed).reason, 'orientation')
  const depth = fixture()
  depth[0][13].z = 1
  assert.equal(mapped(depth).reason, 'unsupported-pose')
})
await test('smoothing limits initial and post-loss jumps while preserving valid rest bounds', () => {
  const filter = new MirrorPoseFilter()
  const target = { left: { shoulder: 2.5, elbow: 0.3 }, right: { shoulder: 2.5, elbow: 0.3 } }
  const first = filter.apply(target, 1000)
  assert.ok(first.left.shoulder <= 0.35)
  filter.pause()
  const recovered = filter.apply(target, 60000)
  assert.ok(recovered.left.shoulder - first.left.shoulder <= 0.25)
})

const deferred = () => {
  let resolve, reject
  const promise = new Promise((a, b) => { resolve = a; reject = b })
  return { promise, resolve, reject }
}
const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve() }
class Clock {
  time = 1000
  next = 0
  timers = new Map()
  later = (fn, delay) => { const id = ++this.next; this.timers.set(id, { at: this.time + delay, fn }); return id }
  cancel = id => this.timers.delete(id)
  async advance(ms) {
    const end = this.time + ms
    for (;;) {
      const next = [...this.timers.entries()].filter(([, item]) => item.at <= end).sort((a, b) => a[1].at - b[1].at)[0]
      if (!next) break
      this.time = next[1].at
      this.timers.delete(next[0])
      next[1].fn()
      await flush()
    }
    this.time = end
    await flush()
  }
}
function mockTrack() {
  const listeners = new Set()
  return {
    readyState: 'live', stops: 0,
    stop() { this.stops++; this.readyState = 'ended' },
    addEventListener(_name, callback) { listeners.add(callback) },
    removeEventListener(_name, callback) { listeners.delete(callback) },
    end() { this.readyState = 'ended'; for (const callback of listeners) callback() },
  }
}
function harness(overrides = {}) {
  const clock = new Clock()
  const track = mockTrack()
  const stream = { getTracks: () => [track], getVideoTracks: () => [track] }
  const video = { muted: false, playsInline: false, srcObject: null, readyState: 2, videoWidth: 640, videoHeight: 480, currentTime: 0.1, pause() {}, play: async () => {} }
  const states = [], poses = [], metrics = [], workers = [], bitmaps = []
  let requests = 0, hidden = false, visibility = null
  class MockWorker {
    messages = []
    terminated = false
    postMessage(message) {
      this.messages.push(message)
      if (message.type === 'init' && overrides.autoReady !== false) queueMicrotask(() => this.emit({ type: 'ready', resourceLoadMs: 10, initializationMs: 15 }))
    }
    emit(data) { this.onmessage?.({ data }) }
    terminate() { this.terminated = true }
  }
  const platform = {
    now: () => clock.time, secure: () => true, capable: () => true, hidden: () => hidden,
    listenVisibility: callback => { visibility = callback; return () => { visibility = null } },
    getUserMedia: async () => { requests++; return stream },
    createWorker: () => { const worker = new MockWorker(); workers.push(worker); return worker },
    bitmap: async () => { const bitmap = { closed: 0, close() { this.closed++ } }; bitmaps.push(bitmap); return bitmap },
    later: clock.later, cancel: clock.cancel, asset: path => `https://test.local/companion-assets/${path}`,
    ...overrides.platform,
  }
  const session = new MirrorSession({ video, onState: (state, message) => states.push({ state, message }), onPose: pose => poses.push(pose), onMetrics: value => metrics.push(value) }, platform)
  return {
    session, clock, track, stream, video, states, poses, metrics, workers, bitmaps,
    requests: () => requests,
    hide(value = true) { hidden = value; visibility?.() },
    lastState: () => states.at(-1)?.state,
    async result(landmarks = fixture([1, 0.2])) {
      await flush()
      const worker = workers.at(-1)
      const frame = worker.messages.filter(message => message.type === 'frame').at(-1)
      assert.ok(frame, 'expected in-flight frame')
      worker.emit({ type: 'result', id: frame.id, capturedAt: frame.capturedAt, width: frame.width, height: frame.height, landmarks, inferenceMs: 20 })
      return frame
    },
    async nextFrame() { video.currentTime += 0.05; await clock.advance(50) },
  }
}
async function using(overrides, fn) {
  const h = harness(overrides)
  try { await fn(h) } finally { h.session.dispose() }
}

await test('no secure context and unsupported workers do not request camera or model', async () => {
  for (const property of ['secure', 'capable']) await using({ platform: { [property]: () => false } }, async h => {
    await h.session.start()
    assert.equal(h.lastState(), 'error')
    assert.equal(h.requests(), 0)
    assert.equal(h.workers.length, 0)
  })
})
for (const name of ['NotAllowedError', 'NotFoundError', 'NotReadableError']) {
  await test(`${name}: explicit failure with no model worker and no active media`, async () => {
    await using({ platform: { getUserMedia: async () => { throw new DOMException('injected', name) } } }, async h => {
      await h.session.start()
      assert.equal(h.lastState(), 'error')
      assert.equal(h.workers.length, 0)
      assert.equal(h.video.srcObject, null)
      assert.equal(h.metrics.at(-1).activeTracks, 0)
    })
  })
}
await test('late permission after exit stops every returned track without creating a worker', async () => {
  const permission = deferred()
  await using({ platform: { getUserMedia: () => permission.promise } }, async h => {
    const start = h.session.start()
    h.session.stop()
    permission.resolve(h.stream)
    await start; await flush()
    assert.equal(h.track.readyState, 'ended')
    assert.equal(h.workers.length, 0)
    assert.equal(h.lastState(), 'stopped')
  })
})
await test('rapid start-start ignores an older permission grant without stopping the new session', async () => {
  const first = deferred(), second = deferred()
  let requests = 0
  await using({ platform: { getUserMedia: () => (++requests === 1 ? first.promise : second.promise) } }, async h => {
    const oldTrack = mockTrack()
    const oldStream = { getTracks: () => [oldTrack], getVideoTracks: () => [oldTrack] }
    const oldStart = h.session.start()
    const newStart = h.session.start()
    second.resolve(h.stream)
    await newStart
    first.resolve(oldStream)
    await oldStart; await flush()
    assert.equal(oldTrack.readyState, 'ended')
    assert.equal(h.track.readyState, 'live')
    assert.equal(h.video.srcObject, h.stream)
    assert.equal(h.workers.length, 1)
    assert.equal(h.workers[0].terminated, false)
  })
})
await test('restarting an active session stops old media and worker before opening replacements', async () => {
  const tracks = []
  await using({ platform: { getUserMedia: async () => {
    const track = mockTrack()
    tracks.push(track)
    return { getTracks: () => [track], getVideoTracks: () => [track] }
  } } }, async h => {
    await h.session.start()
    await h.session.start()
    assert.equal(tracks[0].readyState, 'ended')
    assert.equal(tracks[1].readyState, 'live')
    assert.equal(h.workers[0].terminated, true)
    assert.equal(h.workers[1].terminated, false)
    h.session.dispose()
    assert.equal(tracks[1].readyState, 'ended')
    assert.equal(h.clock.timers.size, 0)
  })
})
await test('permission deadline then late grant also closes the late stream', async () => {
  const permission = deferred()
  await using({ platform: { getUserMedia: () => permission.promise } }, async h => {
    const start = h.session.start()
    await h.clock.advance(30001)
    await start
    assert.equal(h.lastState(), 'error')
    permission.resolve(h.stream)
    await flush()
    assert.equal(h.track.readyState, 'ended')
  })
})
await test('exit during model initialization terminates worker and ignores its late ready', async () => {
  await using({ autoReady: false }, async h => {
    const start = h.session.start()
    await flush()
    const worker = h.workers[0], late = worker.onmessage
    h.session.stop()
    late({ data: { type: 'ready', resourceLoadMs: 1, initializationMs: 1 } })
    await start
    assert.equal(worker.terminated, true)
    assert.equal(h.track.readyState, 'ended')
    assert.equal(h.lastState(), 'stopped')
    assert.equal(h.clock.timers.size, 0)
  })
})
await test('model initialization timeout stops camera and worker', async () => {
  await using({ autoReady: false }, async h => {
    const start = h.session.start()
    await flush(); await h.clock.advance(45001); await start
    assert.equal(h.lastState(), 'error')
    assert.equal(h.track.readyState, 'ended')
    assert.equal(h.workers[0].terminated, true)
  })
})
await test('model initialization and worker transport errors release resources', async () => {
  for (const kind of ['message', 'worker', 'transport']) await using({ autoReady: false }, async h => {
    const start = h.session.start()
    await flush()
    const worker = h.workers[0]
    if (kind === 'message') worker.emit({ type: 'error', stage: 'init', message: 'synthetic failure' })
    else if (kind === 'worker') worker.onerror({})
    else worker.onmessageerror({})
    await start
    assert.equal(h.lastState(), 'error')
    assert.equal(h.track.readyState, 'ended')
    assert.equal(worker.terminated, true)
  })
})
await test('late video play completion cannot revive a stopped session', async () => {
  const play = deferred()
  await using({}, async h => {
    h.video.play = () => play.promise
    const start = h.session.start()
    await flush()
    h.session.stop()
    play.resolve()
    await start
    assert.equal(h.lastState(), 'stopped')
    assert.equal(h.poses.length, 0)
    assert.equal(h.clock.timers.size, 0)
  })
})
await test('two trustworthy samples required; occlusion freezes output and recovery eases in', async () => {
  await using({}, async h => {
    await h.session.start(); await h.result()
    assert.equal(h.poses.length, 0)
    await h.nextFrame(); await h.result()
    assert.equal(h.lastState(), 'tracking')
    const before = h.poses.length
    await h.nextFrame(); await h.result([])
    assert.equal(h.lastState(), 'lost')
    assert.equal(h.poses.length, before)
    await h.nextFrame(); await h.result()
    assert.equal(h.poses.length, before)
    await h.nextFrame(); await h.result()
    assert.equal(h.lastState(), 'tracking')
    assert.equal(h.metrics.at(-1).losses, 1)
    assert.equal(h.metrics.at(-1).recoveries, 1)
  })
})
await test('stale result is rejected and cannot output a pose', async () => {
  await using({}, async h => {
    await h.session.start()
    await h.clock.advance(351)
    await h.result()
    assert.equal(h.lastState(), 'lost')
    assert.equal(h.poses.length, 0)
    assert.match(h.states.at(-1).message, /过慢/)
  })
})
await test('at most one frame remains in flight; duplicate frames are not resent', async () => {
  await using({}, async h => {
    await h.session.start(); await flush()
    h.video.currentTime = 1
    await h.clock.advance(300)
    assert.equal(h.workers[0].messages.filter(message => message.type === 'frame').length, 1)
    await h.result()
    await h.clock.advance(50)
    assert.equal(h.workers[0].messages.filter(message => message.type === 'frame').length, 2)
    await h.result()
    await h.clock.advance(100)
    assert.equal(h.workers[0].messages.filter(message => message.type === 'frame').length, 2)
  })
})
await test('unresponsive inference times out with camera stop, no unbounded queue', async () => {
  await using({}, async h => {
    await h.session.start(); await h.clock.advance(5026)
    assert.equal(h.lastState(), 'error')
    assert.equal(h.track.readyState, 'ended')
    assert.equal(h.workers[0].messages.filter(message => message.type === 'frame').length, 1)
  })
})
await test('camera producing no decoded frames has a finite startup deadline', async () => {
  await using({}, async h => {
    h.video.readyState = 0
    await h.session.start(); await h.clock.advance(10026)
    assert.equal(h.lastState(), 'error')
    assert.equal(h.track.readyState, 'ended')
  })
})
await test('late bitmap after exit is closed rather than delivered to a worker', async () => {
  const bitmap = deferred()
  await using({ platform: { bitmap: () => bitmap.promise } }, async h => {
    await h.session.start()
    const image = { closed: 0, close() { this.closed++ } }
    h.session.stop()
    bitmap.resolve(image)
    await flush()
    assert.equal(image.closed, 1)
    assert.equal(h.workers[0].messages.filter(message => message.type === 'frame').length, 0)
  })
})
await test('a pending bitmap capture cannot hold the camera open indefinitely', async () => {
  const bitmap = deferred()
  await using({ platform: { bitmap: () => bitmap.promise } }, async h => {
    await h.session.start(); await h.clock.advance(5026)
    assert.equal(h.lastState(), 'error')
    assert.equal(h.track.readyState, 'ended')
    const image = { closed: 0, close() { this.closed++ } }
    bitmap.resolve(image)
    await flush()
    assert.equal(image.closed, 1)
  })
})
await test('hide stops tracks synchronously and returning never restarts camera', async () => {
  await using({}, async h => {
    await h.session.start()
    h.hide()
    assert.equal(h.lastState(), 'stopped')
    assert.equal(h.track.readyState, 'ended')
    assert.equal(h.workers[0].terminated, true)
    h.hide(false)
    await h.clock.advance(1000)
    assert.equal(h.requests(), 1)
    assert.equal(h.lastState(), 'stopped')
  })
})
await test('late result after stop and repeated disposal cannot resume pose output', async () => {
  const h = harness()
  await h.session.start(); await flush()
  const worker = h.workers[0], late = worker.onmessage
  const frame = worker.messages.find(message => message.type === 'frame')
  h.session.dispose(); h.session.dispose(); h.session.stop()
  late({ data: { ...frame, type: 'result', landmarks: fixture(), inferenceMs: 1 } })
  await h.session.start()
  assert.equal(h.poses.length, 0)
  assert.equal(h.requests(), 1)
  assert.equal(h.clock.timers.size, 0)
  assert.equal(h.metrics.at(-1).activeTracks, 0)
})
await test('device removal exits instead of retaining an apparently live camera', async () => {
  await using({}, async h => {
    await h.session.start()
    h.track.end()
    assert.equal(h.lastState(), 'error')
    assert.equal(h.workers[0].terminated, true)
  })
})
await test('same-origin worker source declares no outbound inference or persistence', () => {
  const source = readFileSync('public/companion-assets/pose-worker.js', 'utf8')
  assert.match(source, /url\.origin !== self\.location\.origin/)
  assert.match(source, /detectForVideo\(bitmap, message\.capturedAt\)/)
  assert.doesNotMatch(source, /localStorage|indexedDB|method:\s*['"]POST/)
})

function networkBoundary() {
  const calls = [], imports = []
  const sandbox = {
    URL, Request, DOMException,
    location: { href: 'https://gym.local/companion-assets/pose-worker.js', origin: 'https://gym.local' },
    navigator: {},
    fetch: async (request, options) => { calls.push({ url: request.url, method: request.method, options }); return { ok: true } },
    importScripts: (...urls) => { imports.push(...urls) },
  }
  sandbox.self = sandbox
  runInNewContext(readFileSync('public/companion-assets/pose-worker.js', 'utf8'), sandbox)
  return { sandbox, calls, imports }
}
await test('worker blocks SDK telemetry before any native network request', async () => {
  const { sandbox, calls } = networkBoundary()
  await assert.rejects(sandbox.fetch('https://odml.pa.googleapis.com/v1/log', { method: 'POST', body: 'synthetic metrics only' }), { name: 'SecurityError' })
  assert.equal(calls.length, 0)
})
await test('worker permits exact static GET only and forces no redirects or credentials', async () => {
  const { sandbox, calls } = networkBoundary()
  await sandbox.fetch('https://gym.local/companion-assets/pose_landmarker_lite.task', { redirect: 'follow', credentials: 'include' })
  assert.equal(calls.length, 1)
  assert.equal(calls[0].options.redirect, 'error')
  assert.equal(calls[0].options.mode, 'same-origin')
  assert.equal(calls[0].options.credentials, 'omit')
  assert.equal(calls[0].options.referrerPolicy, 'no-referrer')
  assert.equal(Object.getOwnPropertyDescriptor(sandbox, 'fetch').writable, false)
})
await test('worker rejects same-origin uploads, API, unknown assets and query channels', async () => {
  const { sandbox, calls } = networkBoundary()
  for (const url of [
    'https://gym.local/api/parse-workout',
    'https://gym.local/companion-assets/other-file',
    'https://gym.local/companion-assets/pose_landmarker_lite.task?payload=synthetic',
  ]) await assert.rejects(sandbox.fetch(url), { name: 'SecurityError' })
  await assert.rejects(sandbox.fetch('https://gym.local/companion-assets/pose_landmarker_lite.task', { method: 'POST', body: 'synthetic' }), { name: 'SecurityError' })
  assert.equal(calls.length, 0)
})
await test('worker blocks XHR and alternate transports without initiating native I/O', () => {
  const { sandbox, calls } = networkBoundary()
  for (const name of ['XMLHttpRequest', 'WebSocket', 'EventSource', 'WebTransport', 'RTCPeerConnection', 'Worker', 'SharedWorker']) {
    assert.throws(() => new sandbox[name]('https://example.invalid'), { name: 'SecurityError' })
    assert.equal(Object.getOwnPropertyDescriptor(sandbox, name).writable, false)
  }
  assert.equal(sandbox.navigator.sendBeacon('https://example.invalid', 'synthetic'), false)
  assert.equal(calls.length, 0)
})
await test('worker script loading only allows the versioned local runtime resources', () => {
  const { sandbox, imports } = networkBoundary()
  sandbox.importScripts('https://gym.local/companion-assets/vision_bundle.js')
  sandbox.importScripts('https://gym.local/companion-assets/wasm/vision_wasm_internal.js')
  assert.equal(imports.length, 2)
  assert.throws(() => sandbox.importScripts('https://external.invalid/script.js'), { name: 'SecurityError' })
  assert.throws(() => sandbox.importScripts('https://gym.local/api/script.js'), { name: 'SecurityError' })
  assert.equal(imports.length, 2)
})

await test('D partial occlusion: reliable arm continues, recovered arm requires two fresh samples', async () => {
  await using({}, async h => {
    await h.session.start()
    for(let i=0;i<10;i++){if(i)await h.nextFrame();await h.result(fixture([1,.2],[1,.2]))}
    const held=h.poses.at(-1)
    for(let i=0;i<6;i++){const input=fixture([1,.2],[1.9,.4]);input[0][15].visibility=.1;await h.nextFrame();await h.result(input)}
    assert.equal(h.lastState(),'partial');approx(h.poses.at(-1).right.shoulder,held.right.shoulder)
    assert.ok(h.poses.at(-1).left.shoulder>held.left.shoulder+.5)
    await h.nextFrame();await h.result(fixture([2,.3],[1.9,.4]));approx(h.poses.at(-1).right.shoulder,held.right.shoulder)
    await h.nextFrame();await h.result(fixture([2,.3],[1.9,.4]));assert.ok(h.poses.at(-1).right.shoulder>held.right.shoulder)
    assert.ok(h.poses.at(-1).right.shoulder-held.right.shoulder<=.25)
  })
})
await test('D long loss: visibly rest after grace period; stale results never replay a gesture', async () => {
  await using({}, async h=>{
    await h.session.start()
    for(let i=0;i<12;i++){if(i)await h.nextFrame();await h.result(fixture([1.8,.2],[1.8,.2]))}
    const before=h.poses.at(-1)
    await h.nextFrame();await h.result([]);await h.nextFrame();await h.clock.advance(2400)
    assert.equal(h.lastState(),'lost');const rest=h.poses.at(-1);assert.ok(rest.left.shoulder<before.left.shoulder*.4)
    await h.result(fixture([2.2,.3],[2.2,.3]));assert.equal(h.lastState(),'lost')
    await h.nextFrame();await h.result(fixture());await h.nextFrame();await h.result(fixture())
    assert.equal(h.lastState(),'tracking');assert.ok(h.poses.at(-1).left.shoulder<rest.left.shoulder)
  })
})
await test('D partial tracking releases camera and worker when hidden', async () => {
  await using({},async h=>{
    await h.session.start();const input=fixture();input[0][15].visibility=.1
    await h.result(input);await h.nextFrame();await h.result(input);assert.equal(h.lastState(),'partial')
    h.hide();assert.equal(h.lastState(),'stopped');assert.equal(h.track.readyState,'ended');assert.equal(h.workers[0].terminated,true)
    h.hide(false);await h.clock.advance(1500);assert.equal(h.requests(),1)
  })
})
const files = ['src/companion/mirror/MirrorSession.ts', 'src/companion/mirror/mapping.ts', 'src/companion/mirror/protocol.ts', 'public/companion-assets/pose-worker.js', 'scripts/check-d-panda-mirror.mjs']
const directory = join('evals', 'virtual-companion', 'd-panda', `mirror-${Date.now()}`)
mkdirSync(directory, { recursive: true })
const result = {
  version: 'D-panda-2026-10-08', at: new Date().toISOString(),
  evidenceType: 'DETERMINISTIC_SOFTWARE_FIXED_LANDMARK_REPLAY_AND_LIFECYCLE_FAULT_INJECTION',
  realCamera: 'NOT_RUN', realModel: 'NOT_RUN', realPhone: 'NOT_RUN', cloudModelCalls: 0,
  environment: { node: process.version, platform: process.platform, architecture: process.arch },
  files: Object.fromEntries(files.map(path => [path, createHash('sha256').update(readFileSync(path)).digest('hex')])),
  checks, passed: checks.filter(check => check.pass).length, total: checks.length,
}
writeFileSync(join(directory, 'results.json'), JSON.stringify(result, null, 2))
console.log(JSON.stringify({ directory, passed: result.passed, total: result.total, failed: checks.filter(check => !check.pass) }, null, 2))
if (result.passed !== result.total) process.exitCode = 1
