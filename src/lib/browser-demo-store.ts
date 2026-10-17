import type { StoreLike } from '@/core/zhihu/collectors'
import type { SaveResult } from '@/core/store/types'

const CREATED: SaveResult = { status: 'created', revisionNo: 1 }

/** 浏览器演示模式内存仓储（E2E/无 Tauri 环境；应用内走真实 SQLite） */
export class BrowserDemoStore implements StoreLike {
  private cursors = new Map<string, string>()
  private activities = new Map<string, unknown>()
  private comments: unknown[] = []

  async saveAnswer(): Promise<SaveResult> {
    return CREATED
  }
  async saveQuestion(): Promise<SaveResult> {
    return CREATED
  }
  async saveArticle(): Promise<SaveResult> {
    return CREATED
  }
  async savePin(): Promise<SaveResult> {
    return CREATED
  }
  async saveComment(): Promise<SaveResult> {
    return CREATED
  }
  async saveAuthor(): Promise<void> {}
  async saveCollection(): Promise<void> {}
  async replaceCollectionItems(): Promise<void> {}
  async saveColumn(): Promise<void> {}
  async replaceColumnItems(): Promise<void> {}
  async saveTopic(): Promise<void> {}
  async replaceTopicItems(): Promise<void> {}
  async saveActivity(r: unknown): Promise<void> {
    const rec = r as { id: string }
    this.activities.set(rec.id, rec)
  }
  async getActivity(id: string): Promise<unknown> {
    return this.activities.get(id)
  }
  async getCaptureMeta(taskId: string, key: string): Promise<string | undefined> {
    return this.cursors.get(`${taskId}:${key}`)
  }
  async saveCaptureMeta(taskId: string, key: string, value: string): Promise<void> {
    this.cursors.set(`${taskId}:${key}`, value)
  }
  async listComments(): Promise<unknown[]> {
    return this.comments
  }
}
