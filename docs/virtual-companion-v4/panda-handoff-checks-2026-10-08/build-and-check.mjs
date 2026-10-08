import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const packageDir = path.resolve('docs/virtual-companion-v4/panda-ip-handoff-2026-10-08');
const checksDir = path.resolve('docs/virtual-companion-v4/panda-handoff-checks-2026-10-08');
const runtimeRequire = createRequire('C:/Users/WangYuxiang/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json');
const { marked } = await import(pathToFileURL(runtimeRequire.resolve('marked')).href);
const { chromium } = runtimeRequire('playwright');
await fs.mkdir(checksDir, { recursive: true });
const esc = s => String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');

const documents = [
 ['README.md','readme','交付说明'],
 ['IP-SPEC.md','identity','形象与道具'],
 ['MOTION-SPEC.md','motion','动态与表情'],
 ['INTERACTION-SPEC.md','interaction','抬手互动'],
 ['PRODUCTION-AND-ACCEPTANCE.md','production','制作与验收'],
 ['PROJECT-PROMPT.md','prompt','项目实施提示词'],
];
const gallery = [
 ['D2-character-accessories.png','本体与道具','主形象基准'],
 ['D3-movement.png','活力动作','六个大幅关键态'],
 ['D3-expressions.png','夸张表情','六种表演峰值'],
 ['D4-hand-interaction.png','抬手互动','六格行为分镜'],
 ['D2-key-poses.png','日常姿势','八个关键姿势'],
 ['D2-expressions.png','常态表情','六种日常表情'],
 ['D1-character-turnaround.png','初始转面','概念轮廓参考'],
];
const anchorMap = Object.fromEntries(documents.map(([file,id])=>[file,id]));
const sections=[];
for(const [file,id,title] of documents){
 let content=marked.parse(await fs.readFile(path.join(packageDir,file),'utf8'));
 content=content.replace(/href="([^"]+)"/g,(_,href)=>'href="'+(anchorMap[href]?'#'+anchorMap[href]:href)+'"');
 content=content.replace(/<table>/g,'<div class="table-scroll"><table>').replace(/<\/table>/g,'</table></div>');
 sections.push('<section class="document" id="'+id+'"><div class="section-meta">'+esc(title)+'<a href="'+file+'">打开原文</a></div>'+content+'</section>');
}
const html='<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>D 熊猫 IP 完整设计交付包</title><style>'+
'*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:#f7f5ee;color:#302f2b;font-family:"Microsoft YaHei","PingFang SC",sans-serif;font-size:15px;line-height:1.8}a{color:#466337;text-underline-offset:3px}aside{position:fixed;left:0;top:0;width:238px;height:100vh;padding:34px 24px;background:#e9eddf;border-right:1px solid #d9dece;overflow:auto}.brand{font-size:24px;font-weight:750;line-height:1.4;margin-bottom:4px}.edition{font-size:12px;color:#6e755f;margin-bottom:28px}nav a{display:block;text-decoration:none;color:#424e37;padding:10px 8px;border-bottom:1px solid #d3dbc8}nav a:hover{background:#dce5ce}main{max-width:1440px;margin-left:238px;padding:40px 52px 80px}.eyebrow{color:#778262;font-size:13px;letter-spacing:2px}.hero h1{font-size:38px;line-height:1.3;margin:12px 0 14px}.lead{font-size:18px;color:#53574a;max-width:850px}.status{border-left:4px solid #839566;background:#ecf0e3;padding:16px 20px;margin:24px 0}.hero-image{width:100%;display:block;border-radius:12px;margin:24px 0;border:1px solid #e2dfd4}.actions{display:flex;gap:10px;flex-wrap:wrap}.actions a{padding:9px 17px;border:1px solid #8b9b75;border-radius:7px;text-decoration:none}.actions a:first-child{background:#5e7449;color:white}.gallery{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:22px}figure{margin:0;background:white;border:1px solid #e3e0d6;border-radius:10px;overflow:hidden}figure img{display:block;width:100%;height:auto}figcaption{padding:11px 16px;color:#677257;font-size:13px}figcaption strong{color:#303b29;margin-right:10px}.document{margin-top:54px;padding:34px 38px;background:#fffefa;border:1px solid #e4e1d8;border-radius:12px;scroll-margin-top:24px}.section-meta{display:flex;justify-content:space-between;font-size:12px;color:#7b836d;border-bottom:1px solid #e5e7dd;padding-bottom:12px;margin-bottom:24px}.document h1{font-size:27px;line-height:1.4}.document h2{font-size:21px;margin:36px 0 14px}.document h3{font-size:17px;margin:26px 0 12px}.document img{max-width:100%;height:auto;border:1px solid #e7e3da;border-radius:7px}.document p,.document li{overflow-wrap:anywhere}.table-scroll{overflow-x:auto;margin:20px 0;border:1px solid #e2e5d8;border-radius:7px}table{border-collapse:collapse;width:100%;font-size:14px;line-height:1.65}th,td{text-align:left;padding:12px 13px;vertical-align:top;border-bottom:1px solid #e5e6dc;min-width:100px}th{background:#edf0e6;font-weight:650}tr:last-child td{border-bottom:0}tr:nth-child(even) td{background:#fafbf6}code{font-family:Consolas,monospace;font-size:.92em;overflow-wrap:anywhere;background:#f0f1e9;padding:2px 4px;border-radius:3px}strong{font-weight:700}ul,ol{padding-left:25px}li+li{margin-top:7px}footer{padding-top:34px;color:#737568;font-size:13px}#gallery{scroll-margin-top:24px}h2{font-size:25px}.subtext{color:#777f6b;font-size:14px}hr{border:0;border-top:1px solid #e1e4d9;margin:28px 0}'+
'@media(max-width:900px){aside{position:static;width:auto;height:auto;padding:18px 22px}.brand{font-size:22px}.edition{margin-bottom:8px}nav{display:flex;gap:10px;overflow-x:auto}nav a{white-space:nowrap;padding:6px 8px}main{margin:0;padding:25px 20px 50px}.hero h1{font-size:29px}.lead{font-size:16px}.document{padding:22px 19px}.gallery{grid-template-columns:1fr}.table-scroll table{min-width:700px}.table-scroll:before{content:"表格可横向滚动";display:block;color:#71805f;font-size:12px;padding:6px 12px;position:sticky;left:0}.document h1{font-size:23px}.document h2{font-size:19px}.status{padding:12px 14px}}@media print{aside,.actions,.section-meta a{display:none}main{margin:0;padding:0}.document{border:0;padding:20px 0;break-before:page}.gallery{display:block}figure{break-inside:avoid;margin-bottom:20px}a{color:inherit}.table-scroll{overflow:visible}body{background:white;font-size:11px}}'+
'</style></head><body><aside><div class="brand">D 熊猫<br>设计交付包</div><div class="edition">2026.10.08 · GYM</div><nav><a href="#top">交付概览</a><a href="#gallery">七张设计原图</a>'+documents.map(([,id,title])=>'<a href="#'+id+'">'+title+'</a>').join('')+'<a href="references/RESEARCH-LINKS.md">案例与出处</a></nav></aside><main><header class="hero" id="top"><div class="eyebrow">CHARACTER DESIGN HANDOFF</div><h1>短爪圆身，动作放开</h1><p class="lead">把已认可的形象、草帽竹子、表情、动作与抬手互动完整交给制作方。保持同一只 D，让身体、眼神和节奏一起参与表演。</p><div class="actions"><a href="PROJECT-PROMPT.md">打开项目实施提示词</a><a href="#gallery">查看七张原图</a><a href="README.md">阅读交付说明</a></div><div class="status"><strong>本包是设计实施交接。</strong> 已有静态原图、关键姿势、互动分镜与动态规则；连续动画、可绑定资产和真实相机验证仍由项目窗口后续完成。</div><img class="hero-image" src="assets/D2-character-accessories.png" alt="D 熊猫主形象与草帽竹子道具"></header><section id="gallery"><h2>七张设计原图</h2><p class="subtext">D2 定本体和道具，D3 定表演峰值，D4 定互动行为。点击图片查看原尺寸。</p><div class="gallery">'+gallery.map(([file,title,caption])=>'<figure><a href="assets/'+file+'"><img src="assets/'+file+'" alt="'+esc(title)+'" loading="lazy"></a><figcaption><strong>'+esc(title)+'</strong>'+esc(caption)+'</figcaption></figure>').join('')+'</div></section>'+sections.join('')+'<footer>本页面可离线浏览，不加载外部字体、图片或脚本。参考案例链接联网后访问。文件校验见 <a href="MANIFEST.json">MANIFEST.json</a>。</footer></main></body></html>';
await fs.writeFile(path.join(packageDir,'START-HERE.html'),html,'utf8');

async function walk(dir){
 const result=[];
 for(const item of await fs.readdir(dir,{withFileTypes:true})){
  const p=path.join(dir,item.name);
  if(item.isDirectory())result.push(...await walk(p));else result.push(p);
 }
 return result.sort();
}
let files=await walk(packageDir);
const localLinks=[];
for(const file of files.filter(p=>p.endsWith('.md'))){
 const md=await fs.readFile(file,'utf8');
 for(const match of md.matchAll(/!?\[[^\]]*\]\(([^)]+)\)/g)){
  let target=match[1].replace(/^<|>$/g,'');
  if(/^(?:https?:|#|mailto:)/.test(target))continue;
  target=target.split('#')[0];
  const resolved=path.resolve(path.dirname(file),decodeURIComponent(target));
  if(!resolved.startsWith(packageDir+path.sep))throw new Error('Out of package link: '+file+' => '+target);
  if(path.basename(resolved)!=='MANIFEST.json')await fs.access(resolved);
  localLinks.push({file:path.relative(packageDir,file).replaceAll('\\','/'),target});
 }
}
const items=[];
for(const file of files.filter(p=>path.basename(p)!=='MANIFEST.json')){
 const bytes=await fs.readFile(file);
 const item={path:path.relative(packageDir,file).replaceAll('\\','/'),bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')};
 if(file.endsWith('.png')){item.width=bytes.readUInt32BE(16);item.height=bytes.readUInt32BE(20);}
 if(file.endsWith('.json'))JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/,''));
 items.push(item);
}
await fs.writeFile(path.join(packageDir,'MANIFEST.json'),JSON.stringify({
 package:'D Panda IP Design Handoff',date:'2026-10-08',timezone:'Asia/Shanghai',
 state:'Design boards and motion specifications; no finished animation or camera validation',
 selected_design_boards:7,hash_algorithm:'SHA-256',excluded:['MANIFEST.json'],files:items
},null,2)+'\n','utf8');
const result={packageDir,filesIncludingManifest:items.length+1,selectedDesignBoards:7,localMarkdownLinksChecked:localLinks.length,jsonParsed:true,render:[]};
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
try{
 const page=await browser.newPage();
 await page.route('**/*',r=>r.request().url().startsWith('file:')?r.continue():r.abort());
 for(const viewport of [{width:1440,height:1100},{width:390,height:844}]){
  await page.setViewportSize(viewport);
  await page.goto(pathToFileURL(path.join(packageDir,'START-HERE.html')).href);
  await page.locator('img').evaluateAll(nodes=>nodes.forEach(n=>n.loading='eager'));
  await page.waitForFunction(()=>Array.from(document.images).every(i=>i.complete&&i.naturalWidth>0));
  const state=await page.evaluate(()=>({title:document.title,images:document.images.length,allImagesLoaded:Array.from(document.images).every(i=>i.complete&&i.naturalWidth>0),bodyWidth:document.documentElement.scrollWidth,viewportWidth:innerWidth,sections:document.querySelectorAll('section.document').length}));
  if(state.bodyWidth>viewport.width)throw new Error('Horizontal overflow: '+JSON.stringify(state));
  await page.screenshot({path:path.join(checksDir,'overview-'+viewport.width+'.png')});
  await page.locator('#motion').scrollIntoViewIfNeeded();
  await page.screenshot({path:path.join(checksDir,'motion-'+viewport.width+'.png')});
  await page.locator('#top').scrollIntoViewIfNeeded();
  result.render.push({...viewport,...state});
 }
}finally{await browser.close();}
await fs.writeFile(path.join(checksDir,'validation.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result,null,2));

