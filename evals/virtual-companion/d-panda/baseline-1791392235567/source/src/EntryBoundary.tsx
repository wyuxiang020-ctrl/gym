import { Component, type ReactNode } from 'react'

export class EntryBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() {
    if (!this.state.failed) return this.props.children
    return <main style={{ maxWidth: 480, margin: '80px auto', padding: 24 }}><h1>页面暂时无法加载</h1><p>资源可能没有加载完整，请重新打开。已有训练记录不会因此被清除。</p><button onClick={() => window.location.reload()}>重新加载</button><p><a href="/">返回 Gym</a></p></main>
  }
}
