export type BoardEventEnumValue =
  | 'task_created'
  | 'task_updated'
  | 'task_deleted'
  | 'task_moved'
  | 'column_created'
  | 'column_updated'
  | 'column_deleted'
  | 'column_moved'

export const BoardEventType = {
  TaskCreated: 'task_created' as const,
  TaskUpdated: 'task_updated' as const,
  TaskDeleted: 'task_deleted' as const,
  TaskMoved: 'task_moved' as const,
  ColumnCreated: 'column_created' as const,
  ColumnUpdated: 'column_updated' as const,
  ColumnDeleted: 'column_deleted' as const,
  ColumnMoved: 'column_moved' as const,
} as const

export type BoardEventType = (typeof BoardEventType)[keyof typeof BoardEventType]

export type BoardEventEnvelope =
  | {
      id: string
      type: Exclude<BoardEventType, (typeof BoardEventType)['TaskMoved']>
      board_id: string
      entity_id: string
      column_id: string
      source_column_id?: string
      version: number
      actor_id: string
      occurred_at: string
    }
  | {
      id: string
      type: (typeof BoardEventType)['TaskMoved']
      board_id: string
      entity_id: string
      column_id: string
      source_column_id: string
      version: number
      actor_id: string
      occurred_at: string
    }

const eventTypes = new Set<BoardEventEnumValue>([
  'task_created',
  'task_updated',
  'task_deleted',
  'task_moved',
  'column_created',
  'column_updated',
  'column_deleted',
  'column_moved',
])

export function isBoardEventType(value: unknown): value is BoardEventType {
  return typeof value === 'string' && eventTypes.has(value as BoardEventEnumValue)
}

export function isBoardEventEnvelope(value: unknown): value is BoardEventEnvelope {
  if (value == null || typeof value !== 'object' || Array.isArray(value)) {
    return false
  }
  const payload = value as Record<string, unknown>
  if (!isBoardEventType(payload.type)) {
    return false
  }
  if (typeof payload.id !== 'string' || typeof payload.board_id !== 'string') {
    return false
  }
  if (typeof payload.version !== 'number' || typeof payload.actor_id !== 'string') {
    return false
  }
  if (typeof payload.occurred_at !== 'string') {
    return false
  }
  if (payload.type === 'task_moved') {
    return (
      typeof payload.entity_id === 'string' &&
      typeof payload.column_id === 'string' &&
      typeof payload.source_column_id === 'string'
    )
  }
  return (
    typeof payload.entity_id === 'string' &&
    typeof payload.column_id === 'string'
  )
}
