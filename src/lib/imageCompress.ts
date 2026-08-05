function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = (e) => {
      URL.revokeObjectURL(url)
      reject(e)
    }
    img.src = url
  })
}

// 压缩为 JPEG:长边不超过 maxEdge,质量 quality。返回不带 data: 前缀的 base64。
export async function compressImage(
  file: File,
  maxEdge: number,
  quality: number,
): Promise<{ base64: string; dataUrl: string }> {
  const img = await loadImage(file)
  const scale = Math.min(1, maxEdge / Math.max(img.width, img.height))
  const w = Math.max(1, Math.round(img.width * scale))
  const h = Math.max(1, Math.round(img.height * scale))

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D context unavailable')
  ctx.drawImage(img, 0, 0, w, h)

  const dataUrl = canvas.toDataURL('image/jpeg', quality)
  const base64 = dataUrl.split(',')[1]
  return { base64, dataUrl }
}

// 供 AI 识别用的版本:长边 1024px,质量 0.7
export function compressForAnalysis(file: File) {
  return compressImage(file, 1024, 0.7)
}

// 存进 localStorage 的缩略图:长边 200px
export function compressForThumb(file: File) {
  return compressImage(file, 200, 0.7)
}
