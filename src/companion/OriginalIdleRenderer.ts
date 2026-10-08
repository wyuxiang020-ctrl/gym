import { deformOriginal, idlePose } from './idleMotion'

const VERTEX = `
attribute vec2 position;
attribute vec2 sourceUV;
varying vec2 uv;
uniform vec2 stageSize;
uniform vec3 placement;
void main() {
  uv = sourceUV;
  vec2 placed = position * placement.x + placement.yz;
  gl_Position = vec4(placed.x / stageSize.x * 2.0 - 1.0, 1.0 - placed.y / stageSize.y * 2.0, 0.0, 1.0);
}`
const FRAGMENT = `
precision mediump float;
uniform sampler2D original;
uniform sampler2D closedEyes;
uniform float blink;
varying vec2 uv;
void main() {
  vec4 base = texture2D(original, uv);
  vec4 eyes = texture2D(closedEyes, uv);
  vec2 pixel = uv * vec2(390.0, 475.0);
  float top = pixel.x < 220.0 ? 78.0 : 92.0;
  float bottom = pixel.x < 220.0 ? 143.0 : 161.0;
  float lid = mix(top - 5.0, bottom + 5.0, blink);
  float cover = (1.0 - smoothstep(lid - 1.8, lid + 1.8, pixel.y)) * step(0.001, blink);
  gl_FragColor = vec4(mix(base.rgb, eyes.rgb, eyes.a * cover), base.a);
}`

function loadImage(url: string) {
  const image = new Image()
  image.src = url
  return image.decode().then(() => image)
}

export type OriginalMotionSource = {
  width: number
  height: number
  stage: readonly [number, number]
  placement: readonly [number, number, number]
  texture: string
  eyes?: string
  sample: (time: number) => { blink: number; deform: (x: number, y: number) => [number, number] }
}

export class OriginalIdleRenderer {
  private readonly canvas: HTMLCanvasElement
  private readonly gl: WebGLRenderingContext
  private readonly program: WebGLProgram
  private readonly vertices: WebGLBuffer
  private readonly uvs: WebGLBuffer
  private readonly indices: WebGLBuffer
  private readonly textures: WebGLTexture[]
  private readonly originals: Float32Array
  private readonly positions: Float32Array
  private readonly count: number
  private disposed = false
  private initialized = false
  private pixelHeight = 0
  private readonly source?: OriginalMotionSource

  constructor(canvas: HTMLCanvasElement, source?: OriginalMotionSource) {
    this.canvas = canvas
    this.source = source
    const gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: false, antialias: true, preserveDrawingBuffer: true })
    if (!gl) throw new Error('浏览器暂不支持原画局部动画。原图核对仍然可用。')
    this.gl = gl
    const compile = (type: number, source: string) => {
      const shader = gl.createShader(type)!
      gl.shaderSource(shader, source); gl.compileShader(shader)
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) { gl.deleteShader(shader); throw new Error('原画动画无法初始化，请刷新重试。') }
      return shader
    }
    const vertex = compile(gl.VERTEX_SHADER, VERTEX), fragment = compile(gl.FRAGMENT_SHADER, FRAGMENT)
    this.program = gl.createProgram()!
    gl.attachShader(this.program, vertex); gl.attachShader(this.program, fragment); gl.linkProgram(this.program)
    gl.deleteShader(vertex); gl.deleteShader(fragment)
    if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) { gl.deleteProgram(this.program); throw new Error('原画动画无法初始化，请刷新重试。') }
    const textureWidth = source?.width ?? 390, textureHeight = source?.height ?? 475
    const nx = Math.ceil(textureWidth / 6), ny = Math.ceil(textureHeight / 5), points: number[] = [], uvs: number[] = [], indices: number[] = []
    for (let row = 0; row <= ny; row++) for (let column = 0; column <= nx; column++) {
      points.push(column / nx * textureWidth, row / ny * textureHeight)
      uvs.push(column / nx, row / ny)
      if (row < ny && column < nx) {
        const a = row * (nx + 1) + column, b = a + 1, c = a + nx + 1, d = c + 1
        indices.push(a, b, c, b, d, c)
      }
    }
    this.originals = new Float32Array(points); this.positions = new Float32Array(points)
    this.count = indices.length
    this.vertices = gl.createBuffer()!; this.uvs = gl.createBuffer()!; this.indices = gl.createBuffer()!
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vertices); gl.bufferData(gl.ARRAY_BUFFER, this.positions, gl.DYNAMIC_DRAW)
    gl.bindBuffer(gl.ARRAY_BUFFER, this.uvs); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(uvs), gl.STATIC_DRAW)
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indices); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW)
    this.textures = [gl.createTexture()!, gl.createTexture()!]
    gl.useProgram(this.program)
    gl.uniform1i(gl.getUniformLocation(this.program, 'original'), 0)
    gl.uniform1i(gl.getUniformLocation(this.program, 'closedEyes'), 1)
    gl.uniform2f(gl.getUniformLocation(this.program, 'stageSize'), ...(source?.stage ?? [438, 523] as const))
    gl.uniform3f(gl.getUniformLocation(this.program, 'placement'), ...(source?.placement ?? [1, 24, 24] as const))
    gl.disable(gl.DEPTH_TEST); gl.disable(gl.BLEND)
  }

  async initialize() {
    const images = await Promise.all([
      loadImage(this.source?.texture ?? '/companion-assets/d-panda/gentle/stand-original.svg'),
      loadImage(this.source ? this.source.eyes ?? this.source.texture : '/companion-assets/d-panda/idle/closed-eyes-original.svg'),
    ])
    if (this.disposed) return
    const gl = this.gl
    images.forEach((image, index) => {
      gl.activeTexture(gl.TEXTURE0 + index); gl.bindTexture(gl.TEXTURE_2D, this.textures[index])
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image)
    })
    if (gl.getError() !== gl.NO_ERROR) throw new Error('原画素材无法用于动画，请刷新重试。')
    this.initialized = true
    this.draw(0)
  }

  setPixelHeight(height: number) {
    this.pixelHeight = height
    this.canvas.style.imageRendering = height ? 'pixelated' : 'auto'
  }

  draw(time: number) {
    if (this.disposed || !this.initialized || this.gl.isContextLost()) return
    const gl = this.gl, pose = idlePose(time)
    const sampled = this.source?.sample(time)
    const ratio = Math.min(window.devicePixelRatio || 1, 2)
    const height = this.pixelHeight || Math.max(1, Math.round(this.canvas.clientHeight * ratio))
    const width = this.pixelHeight ? Math.max(1, Math.round(height * this.canvas.clientWidth / Math.max(1, this.canvas.clientHeight))) : Math.max(1, Math.round(this.canvas.clientWidth * ratio))
    if (this.canvas.width !== width || this.canvas.height !== height) { this.canvas.width = width; this.canvas.height = height }
    gl.viewport(0, 0, width, height)
    for (let i = 0; i < this.originals.length; i += 2) {
      const [x, y] = sampled ? sampled.deform(this.originals[i], this.originals[i + 1]) : deformOriginal(this.originals[i], this.originals[i + 1], pose)
      this.positions[i] = x; this.positions[i + 1] = y
    }
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT)
    gl.useProgram(this.program)
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vertices); gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.positions)
    const position = gl.getAttribLocation(this.program, 'position')
    gl.enableVertexAttribArray(position); gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0)
    gl.bindBuffer(gl.ARRAY_BUFFER, this.uvs)
    const sourceUV = gl.getAttribLocation(this.program, 'sourceUV')
    gl.enableVertexAttribArray(sourceUV); gl.vertexAttribPointer(sourceUV, 2, gl.FLOAT, false, 0, 0)
    gl.uniform1f(gl.getUniformLocation(this.program, 'blink'), sampled?.blink ?? pose.blink)
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indices)
    gl.drawElements(gl.TRIANGLES, this.count, gl.UNSIGNED_SHORT, 0)
    this.canvas.dataset.blink = (sampled?.blink ?? pose.blink).toFixed(4)
    this.canvas.dataset.chest = pose.chest.toFixed(4)
    this.canvas.dataset.frameTime = String(time)
  }

  dispose() {
    if (this.disposed) return
    this.disposed = true
    const gl = this.gl
    this.textures.forEach(texture => gl.deleteTexture(texture))
    gl.deleteBuffer(this.vertices); gl.deleteBuffer(this.uvs); gl.deleteBuffer(this.indices); gl.deleteProgram(this.program)
  }
}
