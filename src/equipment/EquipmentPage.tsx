import EquipmentScanner from './EquipmentScanner'
import { DemoAccessControl } from '../components/DemoAccessControl'
import { ReleaseStatus } from '../components/ReleaseStatus'
import { NetworkStatus } from '../components/NetworkStatus'

export default function EquipmentPage() {
  return <main className="equipment-page">
    <header className="equipment-header"><a href="/">GYM / 器械扫描</a><nav><a href="/?companion-lab=1">熊猫形象</a><a href="/?training-companion=1">熊猫陪练</a><a href="/?equipment-training=1">训练记录 ↗</a><DemoAccessControl /></nav></header>
    <NetworkStatus />
    <section className="equipment-intro"><div><p className="equipment-label">认识器械 · 开始训练</p><h1>先认清器械，再开始训练。</h1><p>拍照 → 人工确认 → 查看资料 → 记录训练</p></div><img src="/companion-assets/d-panda/gentle/stand-original.svg" alt="保留原稿形象的 D 熊猫" /></section>
    <EquipmentScanner />
    <footer>人体动作检测已暂缓。熊猫作为虚拟形象保留。<ReleaseStatus /></footer>
  </main>
}
