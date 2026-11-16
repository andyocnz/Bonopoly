import type { DecisionModifiers, GameTheoryStrategy, StrategyContext } from './strategyEngine'
import { runStudentStrategyInWorker } from './studentStrategyRuntime'

const MAX_FILE_SIZE_BYTES = 50 * 1024
const FORBIDDEN_PATTERNS = [
  /\bimport\b/,
  /\brequire\s*\(/,
  /\bfetch\s*\(/,
  /\bXMLHttpRequest\b/,
  /\bdocument\b/,
  /\bwindow\b/,
  /\bself\b/,
  /\bglobalThis\b/,
  /\bpostMessage\b/,
  /\bimportScripts\b/,
  /\bsetTimeout\b/,
  /\bsetInterval\b/,
  /\beval\b/,
  /\bFunction\s*\(/,
  /\bconstructor\b/,
  /\bMath\.random\s*\(/,
]

export type ParsedStudentStrategy = {
  id: string
  name: string
  author: string
  description: string
  source: string
  fileName: string
}

function sanitizeId(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function parseMeta(source: string, key: 'name' | 'author' | 'description'): string | null {
  const regex = new RegExp(`^\\s*//\\s*${key}\\s*:\\s*(.+)$`, 'im')
  const match = source.match(regex)
  return match?.[1]?.trim() || null
}

function ensureSafeSource(source: string): void {
  for (const pattern of FORBIDDEN_PATTERNS) {
    if (pattern.test(source)) {
      throw new Error(`Forbidden token detected: ${pattern}`)
    }
  }
}

function ensureHasExecute(source: string): void {
  const executePattern = /\b(function\s+execute\s*\(|execute\s*[:=]\s*\(?\s*context|\bexports\.execute\b|\bmodule\.exports\b)/
  if (!executePattern.test(source)) {
    throw new Error('Missing execute(context) function')
  }
}

export async function parseStudentStrategyFile(file: File): Promise<ParsedStudentStrategy> {
  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new Error(`${file.name}: file exceeds 50KB limit`)
  }

  const source = await file.text()
  ensureSafeSource(source)
  ensureHasExecute(source)

  const baseName = file.name.replace(/\.[^.]+$/, '')
  const parsedName = parseMeta(source, 'name') || baseName
  const parsedAuthor = parseMeta(source, 'author') || 'Student'
  const parsedDescription = parseMeta(source, 'description') || 'Custom student strategy'

  const id = `student-${sanitizeId(baseName)}`
  if (!id || id === 'student-') {
    throw new Error(`${file.name}: invalid strategy id`)
  }

  return {
    id,
    name: parsedName,
    author: parsedAuthor,
    description: parsedDescription,
    source,
    fileName: file.name,
  }
}

export function buildCustomStrategy(parsed: ParsedStudentStrategy): GameTheoryStrategy {
  return {
    id: parsed.id,
    name: parsed.name,
    description: `${parsed.description} (by ${parsed.author})`,
    category: 'mixed',
    execute: async (context: StrategyContext): Promise<DecisionModifiers> => {
      return runStudentStrategyInWorker(parsed.source, context)
    },
    state: {
      custom: true,
      author: parsed.author,
      fileName: parsed.fileName,
    },
  }
}
