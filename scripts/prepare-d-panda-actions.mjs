import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import sharp from 'sharp'

// Select source pixels only. The image bytes are embedded unchanged in each masked SVG.
const root = 'public/companion-assets/d-panda'
const destination = `${root}/actions`
const selections = [
  { id: 'hat', file: 'D2-character-accessories.png', crop: [530, 135, 420, 480], shadowStart: 450 },
  { id: 'stretch', file: 'D2-key-poses.png', crop: [405, 540, 355, 345], shadowStart: 314 },
]
mkdirSync(destination, { recursive: true })
const manifest = []
for (const selection of selections) {
  const source = readFileSync(`${root}/design/${selection.file}`)
  const [left, top, width, height] = selection.crop
  const pixels = await sharp(source).extract({ left, top, width, height }).removeAlpha().raw().toBuffer()
  const outside = new Uint8Array(width * height), queue = new Int32Array(width * height)
  let head = 0, tail = 0
  const dark = i => Math.max(pixels[i * 3], pixels[i * 3 + 1], pixels[i * 3 + 2]) < 170
  const visit = i => { if (!outside[i] && !dark(i)) { outside[i] = 1; queue[tail++] = i } }
  for (let x = 0; x < width; x++) { visit(x); visit((height - 1) * width + x) }
  for (let y = 0; y < height; y++) { visit(y * width); visit(y * width + width - 1) }
  while (head < tail) {
    const i = queue[head++], x = i % width, y = Math.floor(i / width)
    if (x > 0) visit(i - 1)
    if (x + 1 < width) visit(i + 1)
    if (y > 0) visit(i - width)
    if (y + 1 < height) visit(i + width)
  }
  const character = Uint8Array.from(outside, value => value ? 0 : 255)
  for (let y = 1; y < height - 1; y++) for (let x = 1; x < width - 1; x++) {
    const i = y * width + x, brightness = Math.max(pixels[i * 3], pixels[i * 3 + 1], pixels[i * 3 + 2])
    if (outside[i] && (!outside[i - 1] || !outside[i + 1] || !outside[i - width] || !outside[i + width])) character[i] = Math.max(0, Math.min(128, Math.round((245 - brightness) / 75 * 128)))
    else if (!outside[i] && brightness > 120 && (outside[i - 1] || outside[i + 1] || outside[i - width] || outside[i + width])) character[i] = Math.max(128, Math.min(255, Math.round((245 - brightness) / 165 * 255)))
  }
  const shadow = new Uint8Array(width * height)
  for (let y = selection.shadowStart; y < height; y++) for (let x = 0; x < width; x++) {
    const i = y * width + x
    if (!character[i] && Math.min(pixels[i * 3], pixels[i * 3 + 1], pixels[i * 3 + 2]) < 225) shadow[i] = 255
  }
  const svg = mask => {
    const paths = new Map()
    for (let y = 0; y < height; y++) for (let x = 0; x < width;) {
      const alpha = mask[y * width + x], start = x
      while (x < width && mask[y * width + x] === alpha) x++
      if (alpha) paths.set(alpha, (paths.get(alpha) ?? '') + `M${start} ${y}h${x - start}v1H${start}z`)
    }
    const maskPaths = [...paths].map(([alpha, path]) => `<path d="${path}" fill="white" fill-opacity="${alpha / 255}"/>`).join('')
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><defs><mask id="source-selection" maskUnits="userSpaceOnUse" x="0" y="0" width="${width}" height="${height}" style="mask-type:alpha">${maskPaths}</mask></defs><image x="-${left}" y="-${top}" width="1536" height="1024" href="data:image/png;base64,${source.toString('base64')}" mask="url(#source-selection)"/></svg>`
  }
  writeFileSync(`${destination}/${selection.id}-original.svg`, svg(character))
  writeFileSync(`${destination}/${selection.id}-ground.svg`, svg(shadow))
  manifest.push({ ...selection, sha256: createHash('sha256').update(source).digest('hex'), opaquePixels: character.filter(value => value === 255).length })
}
writeFileSync(`${destination}/manifest.json`, JSON.stringify({ method: 'Unchanged original PNG bytes; source-pixel alpha selection only. No new painting or hidden-region fill.', selections: manifest }, null, 2))
console.log(JSON.stringify(manifest, null, 2))
