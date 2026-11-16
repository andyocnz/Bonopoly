const ROOM_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const CLAIMED_ROOM_CODES = new Set<string>()

function normalizeCode(code: string): string {
  return String(code || '').trim().toUpperCase()
}

function buildRoomCode(length = 6): string {
  let value = ''
  for (let i = 0; i < length; i += 1) {
    value += ROOM_CODE_CHARS[Math.floor(Math.random() * ROOM_CODE_CHARS.length)]
  }
  return value
}

export function claimUniqueRoomCode(localHasCode?: (code: string) => boolean): string {
  let attempts = 0
  while (attempts < 5000) {
    const code = buildRoomCode()
    const locallyTaken = localHasCode ? localHasCode(code) : false
    if (!CLAIMED_ROOM_CODES.has(code) && !locallyTaken && claimExistingRoomCode(code)) {
      return code
    }
    attempts += 1
  }
  throw new Error('Unable to allocate unique mini-game room code')
}

export function claimExistingRoomCode(code: string): boolean {
  const normalized = normalizeCode(code)
  if (!normalized) {
    return false
  }
  if (CLAIMED_ROOM_CODES.has(normalized)) {
    return false
  }
  CLAIMED_ROOM_CODES.add(normalized)
  return true
}

export function releaseRoomCode(code: string) {
  const normalized = normalizeCode(code)
  if (normalized) {
    CLAIMED_ROOM_CODES.delete(normalized)
  }
}
