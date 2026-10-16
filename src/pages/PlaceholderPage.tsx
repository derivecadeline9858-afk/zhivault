export function PlaceholderPage({ title, taskNote }: { title: string; taskNote: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 p-8 text-center">
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="text-sm text-muted-foreground">此页面由{taskNote}，当前为占位。</p>
    </div>
  )
}
