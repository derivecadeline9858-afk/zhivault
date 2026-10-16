import { useEffect, useState } from 'react'
import avatar128 from '../../assets/avatar-128.png'
import { APP_NAME, AUTHOR, REPO_URL } from '@/branding'
import { getAppInfo } from '@/ipc'

export function AboutPage() {
  const [version, setVersion] = useState('')

  useEffect(() => {
    getAppInfo()
      .then((info) => setVersion(info.version))
      .catch(() => setVersion('dev'))
  }, [])

  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
      <img src={avatar128} alt="知藏头像" className="h-32 w-32 rounded-3xl shadow-lg" />
      <h2 className="text-2xl font-semibold">{APP_NAME}</h2>
      <p className="text-sm text-muted-foreground">把知乎装进自己口袋</p>
      <p className="text-sm">
        作者：{AUTHOR}
        {version && <span className="text-muted-foreground"> · v{version}</span>}
      </p>
      {REPO_URL && (
        <a className="text-sm text-primary underline-offset-4 hover:underline" href={REPO_URL}>
          开源仓库
        </a>
      )}
    </div>
  )
}
