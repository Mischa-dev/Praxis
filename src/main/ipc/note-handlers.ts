// IPC handlers for note CRUD operations

import type { IpcMain } from 'electron'
import { getDatabase } from '@main/workspace-manager'
import type {
  NoteAddRequest,
  NoteUpdateRequest,
  NoteRemoveRequest,
  NoteListRequest
} from '@shared/types/ipc'

export function registerNoteHandlers(ipc: IpcMain): void {
  ipc.handle('note:add', (_event, data: NoteAddRequest) => {
    const db = getDatabase()
    return db.addNote({
      target_id: data.targetId,
      content: data.content,
      title: data.title
    })
  })

  ipc.handle('note:list', (_event, data: NoteListRequest) => {
    const db = getDatabase()
    return db.listNotes(data.targetId)
  })

  ipc.handle('note:update', (_event, data: NoteUpdateRequest) => {
    const db = getDatabase()
    const note = db.updateNote(data.noteId, data.updates)
    if (!note) {
      throw new Error(`Note not found: ${data.noteId}`)
    }
    return note
  })

  ipc.handle('note:remove', (_event, data: NoteRemoveRequest) => {
    const db = getDatabase()
    db.removeNote(data.noteId)
  })
}
