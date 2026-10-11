import {readFileSync,writeFileSync,copyFileSync,mkdirSync,readdirSync} from 'node:fs'
import {join,relative,resolve,dirname} from 'node:path'
const source=resolve('E:/gym/docs/portfolio/2026-10-09/site-overlay')
const target=resolve('E:/ai作品网站/unified-portfolio')
const backup=resolve('E:/gym/docs/portfolio/2026-10-09/before-site')
for(const f of ['src/data/profile.ts','src/data/ai-projects.ts','src/content/ai/gym.astro','src/pages/projects/gym/index.astro']){
 if(!readFileSync(join(target,f)).equals(readFileSync(join(backup,f))))throw new Error('Website changed since preparation: '+f)
}
function install(dir){for(const entry of readdirSync(dir,{withFileTypes:true})){const from=join(dir,entry.name);if(entry.isDirectory()){install(from);continue}const to=resolve(target,relative(source,from));if(!to.startsWith(target+'\\'))throw new Error('Unexpected target '+to);mkdirSync(dirname(to),{recursive:true});copyFileSync(from,to)}}
install(source)
const releasePath=join(target,'public/release.json'),release=JSON.parse(readFileSync(releasePath,'utf8'))
copyFileSync(releasePath,join(backup,'release.json'))
release.version='2026-10-09.5';release.features=[...new Set([...release.features,'gym-result-led-case-study','gym-prd-and-resume-downloads'])]
writeFileSync(releasePath,JSON.stringify(release,null,2)+'\n')
const note=`# 2026-10-09 Gym 完整产品案例更新\n\n用户指定本整合站，更新 Gym 项目页与对应网页简历。仅修改 Gym 内容，其他项目与个人事实保留。\n\n- 11 张最新实际界面、原稿及前后对比，以成果大图为主，原生图库可放大。\n- 提供六页产品作品集、四页 PRD、一页简历项目 PDF、可复制文字和证据说明。\n- 作者自述/转述反馈与设计情境分开；未编造参与者、引语、指标。\n- 熊猫三种运动试作已从 Gym 本地产品撤下，不列入当前成果；人体识别暂缓。\n- 基础产品已有线上版本；本页新版视觉为本地成果，页面明确二者版本差异。\n- 来源与覆盖前备份：E:/gym/docs/portfolio/2026-10-09。\n\n版本标识：2026-10-09.5。构建、浏览器、下载和发布结果待验收记录补充。\n`
mkdirSync(join(target,'docs/gym-case-2026-10-09'),{recursive:true});writeFileSync(join(target,'docs/gym-case-2026-10-09/DELIVERY.md'),note)
console.log('Installed Gym case, metadata, résumé entry, assets and downloads')
