import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import sharp from 'sharp'
import { ALL_CLIPS } from '../src/companion/companionCatalog.ts'

// Select source pixels only. The image bytes are embedded unchanged in each masked SVG.
const root = 'public/companion-assets/d-panda'
const destination = `${root}/library`
const selections = ALL_CLIPS.filter(clip => clip.texture.startsWith('library/')).map(clip => ({ id: clip.id, file: clip.source, crop: clip.crop, shadowStart: clip.category === 'expressions' ? clip.crop[3] : clip.footY + 5 }))
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
  if (selection.id.startsWith('expression-')) {
    // Bust drawings have an open cream belly at their lower edge. Select the existing pixels
    // between the two inked body edges rather than treating this opening as background.
    for (let y = 232; y < height; y++) {
      let lo = width, hi = -1
      for (let x = 0; x < width; x++) if (dark(y * width + x)) { lo = Math.min(lo, x); hi = Math.max(hi, x) }
      if (lo < width * .46 && hi > width * .54 && hi - lo > width * .4) {
        for (let x = lo + 1; x < hi; x++) character[y * width + x] = 255
      }
    }
  }
  if (selection.id === 'rest') {
    // The adjacent celebration pose enters the left edge of this crop; it is not part of the sitting panda.
    for (let y = 0; y < 195; y++) for (let x = 0; x < 75; x++) character[y * width + x] = 0
  }
  if (selection.id === 'celebrate') {
    for (let y = 244; y < height; y++) for (let x = 260; x < width; x++) character[y * width + x] = 0
  }
  const shadow = new Uint8Array(width * height)
  for (let y = selection.shadowStart; y < height; y++) for (let x = 0; x < width; x++) {
    const i = y * width + x
    if (selection.id === 'celebrate' && x >= 260 && y >= 244) continue
    if (!character[i] && Math.min(pixels[i * 3], pixels[i * 3 + 1], pixels[i * 3 + 2]) < 225) shadow[i] = 255
  }
  const svg = (mask, sourceLeft = left, sourceTop = top) => {
    const paths = new Map()
    for (let y = 0; y < height; y++) for (let x = 0; x < width;) {
      const alpha = mask[y * width + x], start = x
      while (x < width && mask[y * width + x] === alpha) x++
      if (alpha) paths.set(alpha, (paths.get(alpha) ?? '') + `M${start} ${y}h${x - start}v1H${start}z`)
    }
    const maskPaths = [...paths].map(([alpha, path]) => `<path d="${path}" fill="white" fill-opacity="${alpha / 255}"/>`).join('')
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><defs><mask id="source-selection" maskUnits="userSpaceOnUse" x="0" y="0" width="${width}" height="${height}" style="mask-type:alpha">${maskPaths}</mask></defs><image x="-${sourceLeft}" y="-${sourceTop}" width="1536" height="1024" href="data:image/png;base64,${source.toString('base64')}" mask="url(#source-selection)"/></svg>`
  }
  writeFileSync(`${destination}/${selection.id}-original.svg`, svg(character))
  if (selection.id === 'jump') {
    // Reuse the unobstructed shadow under D3's airborne pose. No unseen pixels are painted under the feet.
    const shadowX = Math.floor((width - 290) / 2), shadowY = selection.shadowStart - 15
    const sourceLeft = 630 - shadowX, sourceTop = 473 - shadowY
    const groundPixels = await sharp(source).extract({ left: sourceLeft, top: sourceTop, width, height }).removeAlpha().raw().toBuffer()
    shadow.fill(0)
    for (let y = shadowY; y < shadowY + 24; y++) for (let x = shadowX; x < shadowX + 290; x++) {
      const i = y * width + x
      if (Math.min(groundPixels[i * 3], groundPixels[i * 3 + 1], groundPixels[i * 3 + 2]) < 225) shadow[i] = 255
    }
    writeFileSync(`${destination}/${selection.id}-ground.svg`, svg(shadow, sourceLeft, sourceTop))
    selection.groundSource = { crop: [sourceLeft, sourceTop, width, height], region: [shadowX, shadowY, 290, 24] }
  } else writeFileSync(`${destination}/${selection.id}-ground.svg`, svg(shadow))
  manifest.push({ ...selection, sha256: createHash('sha256').update(source).digest('hex'), opaquePixels: character.filter(value => value === 255).length })
}
writeFileSync(`${destination}/manifest.json`, JSON.stringify({ method: 'Unchanged original PNG bytes; source-pixel alpha selection only. No new painting or hidden-region fill.', selections: manifest }, null, 2))
console.log(JSON.stringify(manifest, null, 2))
