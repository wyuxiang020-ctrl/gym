import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import sharp from 'sharp'

const root = 'public/companion-assets/d-panda'
const original = readFileSync(`${root}/design/D2-character-accessories.png`)
const expressions = readFileSync(`${root}/design/D2-expressions.png`)
const { data } = await sharp(original).extract({ left: 50, top: 140, width: 390, height: 475 }).removeAlpha().raw().toBuffer({ resolveWithObject: true })
const eyes = [
  { id: 'left', target: [126, 78, 72, 64], source: [1187, 657, 77, 65] },
  { id: 'right', target: [241, 92, 56, 68], source: [1315, 672, 62, 64] },
]
const masks = [], layers = []
for (const eye of eyes) {
  const [x0, y0, w, h] = eye.target
  const filled = new Uint8Array(w * h)
  for (let y = 0; y < h; y++) {
    let left = w, right = -1
    for (let x = 0; x < w; x++) {
      const i = ((y + y0) * 390 + x + x0) * 3
      if (Math.max(data[i], data[i + 1], data[i + 2]) < 135) { left = Math.min(left, x); right = Math.max(right, x) }
    }
    for (let x = left; x <= right; x++) filled[y * w + x] = 1
  }
  // The original eye-patch rim is retained. Only its interior receives an existing closed-eye image.
  const paths = new Map()
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (!filled[y * w + x]) continue
    let distance = 5
    for (let oy = -5; oy <= 5; oy++) for (let ox = -5; ox <= 5; ox++) {
      if (Math.hypot(ox, oy) >= distance) continue
      const nx = x + ox, ny = y + oy
      if (nx < 0 || ny < 0 || nx >= w || ny >= h || !filled[ny * w + nx]) distance = Math.hypot(ox, oy)
    }
    const alpha = Math.round(Math.max(0, Math.min(1, (distance - 1) / 3)) * 255)
    if (!alpha) continue
    paths.set(alpha, (paths.get(alpha) ?? '') + `M${x + x0} ${y + y0}h1v1h-1z`)
  }
  masks.push(`<mask id="${eye.id}" maskUnits="userSpaceOnUse" x="0" y="0" width="390" height="475" style="mask-type:alpha">${[...paths].map(([alpha,path]) => `<path d="${path}" fill="white" fill-opacity="${alpha / 255}"/>`).join('')}</mask>`)
  const [sx, sy, sw, sh] = eye.source
  // Slightly inset the source sample in the closed patch so its pale outer paper never covers the original dark rim.
  const inset = 3
  const scaleX = w / (sw - inset * 2), scaleY = h / (sh - inset * 2)
  const tx = x0 - (sx + inset) * scaleX, ty = y0 - (sy + inset) * scaleY
  layers.push(`<g mask="url(#${eye.id})"><use href="#expression-sheet" transform="matrix(${scaleX} 0 0 ${scaleY} ${tx} ${ty})"/></g>`)
}
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="390" height="475" viewBox="0 0 390 475"><title>D2 放松表情中的闭眼局部，映射到空手站姿眼部</title><defs><image id="expression-sheet" width="1536" height="1024" href="data:image/png;base64,${expressions.toString('base64')}"/>${masks.join('')}</defs>${layers.join('')}</svg>`
mkdirSync(`${root}/idle`, { recursive: true })
writeFileSync(`${root}/idle/closed-eyes-original.svg`, svg)
writeFileSync(`${root}/idle/manifest.json`, JSON.stringify({
  standingSource: 'D2-character-accessories.png', standingSha256: createHash('sha256').update(original).digest('hex'),
  eyeSource: 'D2-expressions.png', eyeSourceSha256: createHash('sha256').update(expressions).digest('hex'),
  eyeRegion: 'D2 六种表情右下角：放松', eyes,
  method: 'Existing source-image regions and masks only; closed eyes reused from the approved expression board. Body stays on one continuous textured mesh with regional motion weights; no hidden-region painting.',
  newPaintedRegions: [], durationMs: 6000,
}, null, 2))
console.log('Prepared existing closed-eye regions: public/companion-assets/d-panda/idle/')
