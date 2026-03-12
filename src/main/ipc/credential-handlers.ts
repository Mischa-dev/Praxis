// IPC handlers for credential management operations

import type { IpcMain } from 'electron'
import { getDatabase } from '@main/workspace-manager'
import type {
  CredentialUpdateStatusRequest,
  CredentialDeleteRequest
} from '@shared/types/ipc'

export function registerCredentialHandlers(ipc: IpcMain): void {
  ipc.handle('credential:list-all', () => {
    const db = getDatabase()
    return db.listAllCredentials()
  })

  ipc.handle('credential:update-status', (_event, data: CredentialUpdateStatusRequest) => {
    const db = getDatabase()
    const cred = db.updateCredentialStatus(data.credentialId, data.status)
    if (!cred) {
      throw new Error(`Credential not found: ${data.credentialId}`)
    }
    return cred
  })

  ipc.handle('credential:delete', (_event, data: CredentialDeleteRequest) => {
    const db = getDatabase()
    db.deleteCredential(data.credentialId)
  })
}
