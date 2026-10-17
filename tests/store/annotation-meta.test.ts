import { beforeEach, describe, expect, it } from 'vitest'
import type { ContentStore } from '@/core/store/content-store'
import { createTestStore } from './helpers'

let store: ContentStore

beforeEach(async () => {
  store = await createTestStore()
})

describe('annotation 前后缀指纹存取（PRD §7.3 / §0 UI-2）', () => {
  it('保存时自动生成前 32/后 32 字符指纹', async () => {
    const selected = '段'.repeat(10) + '目标文本' + '尾'.repeat(40)
    const id = await store.saveAnnotation({
      entityType: 'answer',
      entityId: 'a1',
      selectedText: selected,
      note: '重点',
      color: 'emerald',
    })
    const list = await store.listAnnotations('answer', 'a1')
    expect(list).toHaveLength(1)
    const ann = list[0]
    expect(ann.id).toBe(id)
    expect(ann.selectedText).toBe(selected)
    expect(ann.anchorPrefix).toBe(selected.slice(0, 32))
    expect(ann.anchorSuffix).toBe(selected.slice(-32))
    expect(ann).toMatchObject({ note: '重点', color: 'emerald' })
  })

  it('短选文指纹即全文', async () => {
    await store.saveAnnotation({ entityType: 'article', entityId: 'ar1', selectedText: '短句', color: 'yellow' })
    const ann = (await store.listAnnotations('article', 'ar1'))[0]
    expect(ann.anchorPrefix).toBe('短句')
    expect(ann.anchorSuffix).toBe('短句')
  })

  it('按实体列举与更新批注/颜色', async () => {
    const id1 = await store.saveAnnotation({ entityType: 'answer', entityId: 'a1', selectedText: '文本一', color: 'yellow' })
    await store.saveAnnotation({ entityType: 'answer', entityId: 'a2', selectedText: '文本二', color: 'rose' })
    expect(await store.listAnnotations('answer', 'a1')).toHaveLength(1)

    await store.updateAnnotation(id1, { note: '补充批注', color: 'blue' })
    const updated = (await store.listAnnotations('answer', 'a1'))[0]
    expect(updated).toMatchObject({ note: '补充批注', color: 'blue' })
  })

  it('删除标注', async () => {
    const id = await store.saveAnnotation({ entityType: 'answer', entityId: 'a1', selectedText: '文本', color: 'yellow' })
    await store.deleteAnnotation(id)
    expect(await store.listAnnotations('answer', 'a1')).toEqual([])
  })
})

describe('capture_meta 增量游标（PRD §7.3/§7.4-4，按任务独立持久化）', () => {
  it('set/get/list/delete', async () => {
    await store.saveCaptureMeta('task-1', 'last_offset', '20')
    await store.saveCaptureMeta('task-1', 'updated_until', '2026-01-01')
    await store.saveCaptureMeta('task-2', 'last_offset', '5')

    expect(await store.getCaptureMeta('task-1', 'last_offset')).toBe('20')
    const all = await store.listCaptureMeta('task-1')
    expect(all).toEqual({ last_offset: '20', updated_until: '2026-01-01' })

    await store.saveCaptureMeta('task-1', 'last_offset', '40')
    expect(await store.getCaptureMeta('task-1', 'last_offset')).toBe('40')

    await store.deleteCaptureMeta('task-1', 'last_offset')
    expect(await store.getCaptureMeta('task-1', 'last_offset')).toBeUndefined()
    expect(await store.listCaptureMeta('task-1')).toEqual({ updated_until: '2026-01-01' })
  })
})
