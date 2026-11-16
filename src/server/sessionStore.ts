import { createHmac } from 'crypto'
import type { Request } from 'express'

type SessionRole = 'team' | 'educator' | 'admin'

type Session = {
  role: SessionRole
  teamId?: string
  gameId?: string
  educatorId?: string
  adminUsername?: string
  createdAt: number
}

const SESSION_COOKIE = 'bonopoly_session'
const ROLE_COOKIE = {
  team: 'bonopoly_team',
  educator: 'bonopoly_educator',
  admin: 'bonopoly_admin',
} as const

const SESSION_SECRET = process.env.SESSION_SECRET || 'bonopoly-dev-secret'

function sign(payload: string): string {
  return createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url')
}

function encodeSession(session: Session): string {
  const payload = Buffer.from(JSON.stringify(session)).toString('base64url')
  const signature = sign(payload)
  return `${payload}.${signature}`
}

function decodeSession(token: string): Session | null {
  const [payload, signature] = token.split('.')
  if (!payload || !signature) return null
  if (sign(payload) !== signature) return null
  try {
    const raw = Buffer.from(payload, 'base64url').toString('utf8')
    return JSON.parse(raw) as Session
  } catch {
    return null
  }
}

export function createSession(session: Omit<Session, 'createdAt'>): string {
  return encodeSession({ ...session, createdAt: Date.now() })
}

export function getSession(id: string | undefined): Session | null {
  if (!id) return null
  return decodeSession(id)
}

export function destroySession(id: string | undefined) {
  void id
  return
}

export function getSessionCookie(req: Request, role?: SessionRole): string | undefined {
  const raw = req.headers.cookie
  if (!raw) return undefined
  const parts = raw.split(';').map((part) => part.trim())
  const cookieName = role ? ROLE_COOKIE[role] : SESSION_COOKIE
  const hit = parts.find((part) => part.startsWith(`${cookieName}=`))
  if (!hit) return undefined
  return hit.slice(cookieName.length + 1)
}

export const SESSION_COOKIE_NAME = SESSION_COOKIE
export const SESSION_COOKIE_BY_ROLE = ROLE_COOKIE
