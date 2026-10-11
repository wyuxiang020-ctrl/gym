import { useEffect, useState } from 'react'

export function NetworkStatus() {
  const [offline, setOffline] = useState(!navigator.onLine)
  useEffect(() => {
    const update = () => setOffline(!navigator.onLine)
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update) }
  }, [])
  return offline ? <p className="network-status" role="status">当前离线 · 已缓存的记录页面可继续使用；器械识别、视频及未缓存资源需要联网。记录保存在当前设备。</p> : null
}
