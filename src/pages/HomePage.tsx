import { APP_NAME } from '@/branding'

export function HomePage() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
      <h2 className="text-xl font-semibold">{APP_NAME}</h2>
      <p className="max-w-md text-sm text-muted-foreground">
        粘贴知乎链接，把内容装进自己口袋。任务采集界面将在任务 5 交付。
      </p>
    </div>
  )
}
