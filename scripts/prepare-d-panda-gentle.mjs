import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import sharp from 'sharp'

const source = 'public/companion-assets/d-panda/design/D2-character-accessories.png'
const destination = 'public/companion-assets/d-panda/gentle'
const reference = readFileSync(source)
const crop = { left: 50, top: 140, width: 390, height: 475 }
const { width: w, height: h } = crop
const pixels = await sharp(reference).extract(crop).removeAlpha().raw().toBuffer()
const outside = new Uint8Array(w * h)
const queue = new Int32Array(w * h)
let head = 0, tail = 0
const dark = index => Math.max(pixels[index * 3], pixels[index * 3 + 1], pixels[index * 3 + 2]) < 170
function visit(index) {
  if (outside[index] || dark(index)) return
  outside[index] = 1
  queue[tail++] = index
}
for (let x = 0; x < w; x++) { visit(x); visit((h - 1) * w + x) }
for (let y = 0; y < h; y++) { visit(y * w); visit(y * w + w - 1) }
while (head < tail) {
  const i = queue[head++], x = i % w, y = Math.floor(i / w)
  if (x > 0) visit(i - 1)
  if (x + 1 < w) visit(i + 1)
  if (y > 0) visit(i - w)
  if (y + 1 < h) visit(i + w)
}
// A source-pixel selection, not a redraw: enclosures in the original ink remain solid.
const character = Uint8Array.from(outside, value => value ? 0 : 255)
// Only soften the source's antialias band. RGB stays in the embedded PNG.
for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
  const i = y * w + x
  const brightness = Math.max(pixels[i * 3], pixels[i * 3 + 1], pixels[i * 3 + 2])
  if (outside[i] && (!outside[i - 1] || !outside[i + 1] || !outside[i - w] || !outside[i + w])) {
    character[i] = Math.max(0, Math.min(128, Math.round((245 - brightness) / 75 * 128)))
  } else if (!outside[i] && brightness > 120 && (outside[i - 1] || outside[i + 1] || outside[i - w] || outside[i + w])) {
    character[i] = Math.max(128, Math.min(255, Math.round((245 - brightness) / 165 * 255)))
  }
}
assert.equal(character[160 * w + 190], 255, 'Face must remain opaque')
assert.equal(character[320 * w + 190], 255, 'Belly must remain opaque')
assert.equal(character[430 * w + 195], 0, 'Gap between feet must be transparent')
assert.equal(character[20 * w + 20], 0, 'Paper must be transparent')

function maskPath(mask, alpha) {
  const runs = []
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w;) {
      if (mask[y * w + x] !== alpha) { x++; continue }
      const start = x
      while (x < w && mask[y * w + x] === alpha) x++
      runs.push(`M${start} ${y}h${x - start}v1H${start}z`)
    }
  }
  return runs.join('')
}
function svg(mask, name) {
  const selection = [...new Set(mask)].filter(alpha => alpha > 0).map(alpha => `<path d="${maskPath(mask, alpha)}" fill="white" fill-opacity="${alpha / 255}"/>`).join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><title>${name}</title><defs><mask id="selection" maskUnits="userSpaceOnUse" x="0" y="0" width="${w}" height="${h}" style="mask-type:alpha">${selection}</mask></defs><image x="-${crop.left}" y="-${crop.top}" width="1536" height="1024" href="data:image/png;base64,${reference.toString('base64')}" mask="url(#selection)"/></svg>`
}

mkdirSync(destination, { recursive: true })
writeFileSync(`${destination}/stand-original.svg`, svg(character, 'D 熊猫空手站姿，原 PNG 加背景遮罩'))
// Only retain the visible original ground shadow; do not invent pixels hidden by feet.
const shadow = new Uint8Array(w * h)
for (let y = 440; y < h; y++) for (let x = 0; x < w; x++) {
  const i = y * w + x
  if (!character[i] && Math.min(pixels[i * 3], pixels[i * 3 + 1], pixels[i * 3 + 2]) < 225) shadow[i] = 255
}
writeFileSync(`${destination}/ground-original.svg`, svg(shadow, '原图中可见的地面阴影'))
const manifest = {
  source, sourceSha256: createHash('sha256').update(reference).digest('hex'), crop,
  method: 'Unmodified PNG embedded in SVG; alpha selection only. No generated artwork, source RGB edits, recoloring, deformation or hidden-pixel reconstruction.',
  width: w, height: h, opaquePixels: character.filter(value => value === 255).length,
  edgePixels: character.filter(value => value > 0 && value < 255).length,
  pivot: [205, 455], durationMs: 4800, maximumRotationDegrees: 1.2,
}
writeFileSync(`${destination}/manifest.json`, JSON.stringify(manifest, null, 2))
console.log(JSON.stringify(manifest, null, 2))
