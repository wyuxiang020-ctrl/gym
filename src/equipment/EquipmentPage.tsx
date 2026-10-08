import EquipmentScanner from './EquipmentScanner'
import { DemoAccessControl } from '../components/DemoAccessControl'
import { ReleaseStatus } from '../components/ReleaseStatus'

export default function EquipmentPage() {
  return <main className="equipment-page">
    <header className="equipment-header"><a href="/">GYM / 器械扫描</a><nav><a href="/?companion-lab=1">熊猫形象</a><a href="/?training-companion=1">熊猫陪练</a><a href="/?equipment-training=1">训练记录 ↗</a><DemoAccessControl /></nav></header>
    <ReleaseStatus />
    <section className="equipment-intro"><div><p className="equipment-label">阶段二 · 静态照片</p><h1>先认清器械，再开始训练。</h1><p>拍一张器械照片，核对类别，再查看对应资料。</p></div><img src="/companion-assets/d-panda/gentle/stand-original.svg" alt="保留原稿形象的 D 熊猫" /></section>
    <EquipmentScanner />
    <footer>人体动作检测已暂缓。熊猫作为虚拟形象保留。</footer>
  </main>
}
