import { mkdirSync, readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { createHash } from 'node:crypto'
import sharp from 'sharp'

const root = 'public/companion-assets/d-panda', out = `${root}/interaction`
mkdirSync(out, { recursive: true })
const file = 'D4-hand-interaction.png', source = readFileSync(`${root}/design/${file}`)
const crop = [690, 520, 315, 307], [left, top, width, height] = crop
const pixels = await sharp(source).extract({ left, top, width, height }).removeAlpha().raw().toBuffer()
const outside = new Uint8Array(width * height), queue = []
const dark = i => Math.max(...pixels.subarray(i * 3, i * 3 + 3)) < 170
function visit(i) { if (!outside[i] && !dark(i)) { outside[i] = 1; queue.push(i) } }
for (let x = 0; x < width; x++) { visit(x); visit((height - 1) * width + x) }
for (let y = 0; y < height; y++) { visit(y * width); visit(y * width + width - 1) }
for (let q = 0; q < queue.length; q++) {
  const i = queue[q], x = i % width, y = Math.floor(i / width)
  if (x) visit(i - 1); if (x < width - 1) visit(i + 1)
  if (y) visit(i - width); if (y < height - 1) visit(i + width)
}
function inside(x, y, polygon) {
  let yes = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i], [xj, yj] = polygon[j]
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) yes = !yes
  }
  return yes
}
const masks = Object.fromEntries(['body','left','right','collar'].map(key => [key, new Uint8Array(width * height)]))
const faceEdges=[]
for(let y=0;y<145;y++) {
  let lo=width,hi=-1
  for(let x=70;x<243;x++) {
    const i=y*width+x
    if(!outside[i] && Math.min(...pixels.subarray(i*3,i*3+3))>180){lo=Math.min(lo,x);hi=Math.max(hi,x)}
  }
  faceEdges[y]=[lo-3,hi+3]
}
for (let y = 1; y < height - 1; y++) for (let x = 1; x < width - 1; x++) {
  const i = y * width + x, brightness = Math.max(...pixels.subarray(i * 3, i * 3 + 3))
  let alpha = outside[i] ? 0 : 255
  if (outside[i] && [i-1,i+1,i-width,i+width].some(n => !outside[n])) alpha = Math.max(0, Math.min(128, Math.round((245-brightness)/75*128)))
  if (y > 296) alpha = 0
  if (x < 22 && y > 180) alpha = 0
  const headPixel=(y<145&&x>=faceEdges[y][0]&&x<=faceEdges[y][1]) || inside(x,y,[[124,37],[121,17],[139,17],[132,3],[151,7],[165,13],[181,29],[183,42]]) || (y<68&&((x>=73&&x<=123)||(x>=196&&x<=246)))
  const trunk=Math.hypot((x-160)/83,(y-201)/72)<=1||y>=177
  const part = headPixel||trunk?'body':x<160?'right':'left'
  masks[part][i] = alpha
  if(!headPixel&&y>=147&&y<=151&&x>=110&&x<=210&&brightness<125) masks.collar[i]=alpha
  for(const [side,cx,cy,sign] of [['right',53,94,-1],['left',246,136,1]]) {
    const along=(x-cx)*sign*.57-(y-cy)*.82
    const across=(x-cx)*.82+(y-cy)*sign*.57
    const cap=along>=10 || (across/26)**2+((along-10)/15)**2<=1
    masks[side][i]=!headPixel && (side==='right'?x<125:x>205) && along>=-5 && cap?alpha:0
  }
}
// Discard detached outline fragments; they belong to the head's ink, not paws.
for(const side of ['left','right']) {
  const mask=masks[side], seen=new Uint8Array(width*height), components=[]
  for(let i=0;i<mask.length;i++) if(mask[i]&&!seen[i]) {
    const component=[i];seen[i]=1
    for(let n=0;n<component.length;n++) {
      const p=component[n],x=p%width,y=Math.floor(p/width)
      for(const k of [x?p-1:-1,x<width-1?p+1:-1,y?p-width:-1,y<height-1?p+width:-1]) if(k>=0&&mask[k]&&!seen[k]){seen[k]=1;component.push(k)}
    }
    components.push(component)
  }
  components.sort((a,b)=>b.length-a.length)
  for(const component of components.slice(1)) for(const i of component)mask[i]=0
}
for (const [part, mask] of Object.entries(masks)) {
  const paths = new Map()
  for (let y=0;y<height;y++) for(let x=0;x<width;) {
    const alpha=mask[y*width+x],start=x
    while(x<width && mask[y*width+x]===alpha)x++
    if(alpha)paths.set(alpha,(paths.get(alpha)??'')+`M${start} ${y}h${x-start}v1H${start}z`)
  }
  const maskPaths=[...paths].map(([a,p])=>`<path fill="white" fill-opacity="${a/255}" d="${p}"/>`).join('')
  writeFileSync(`${out}/${part}.svg`,`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><defs><mask id="selection" style="mask-type:alpha">${maskPaths}</mask></defs><image x="-${left}" y="-${top}" width="1536" height="1024" href="data:image/png;base64,${source.toString('base64')}" mask="url(#selection)"/></svg>`)
}
const hash = data => createHash('sha256').update(data).digest('hex')
writeFileSync(`${out}/manifest.json`,JSON.stringify({source:file,sha256:hash(source),crop,method:'Source-pixel alpha masks. Body/head fixed; visible paw/forearm pixels articulate; a visible black neck strip is reused at the attachment. Runtime mesh deformation creates intermediate poses, not exact authored frames. Embedded PNG bytes unchanged, no painting or reflection.',files:Object.fromEntries(readdirSync(out).filter(p=>p.endsWith('.svg')).map(p=>[p,hash(readFileSync(`${out}/${p}`))]))},null,2))
console.log(out)
