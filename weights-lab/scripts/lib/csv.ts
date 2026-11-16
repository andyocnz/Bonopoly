export type CsvRow = Record<string, string>

export function parseCsv(text: string): { header: string[]; rows: CsvRow[] } {
  const rows: string[][] = []
  let current: string[] = []
  let value = ''
  let inQuotes = false

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i]
    const next = text[i + 1]

    if (inQuotes) {
      if (char === '"' && next === '"') {
        value += '"'
        i += 1
      } else if (char === '"') {
        inQuotes = false
      } else {
        value += char
      }
      continue
    }

    if (char === '"') {
      inQuotes = true
      continue
    }

    if (char === ',') {
      current.push(value)
      value = ''
      continue
    }

    if (char === '\n') {
      current.push(value)
      value = ''
      if (current.length > 1 || current[0].trim() !== '') {
        rows.push(current)
      }
      current = []
      continue
    }

    if (char === '\r') {
      continue
    }

    value += char
  }

  if (value.length > 0 || current.length > 0) {
    current.push(value)
    rows.push(current)
  }

  const header = rows.shift() ?? []
  const normalizedHeader = header.map((h) => h.trim())

  const mappedRows = rows
    .filter((row) => row.some((cell) => cell.trim() !== ''))
    .map((row) => {
      const record: CsvRow = {}
      normalizedHeader.forEach((key, idx) => {
        record[key] = (row[idx] ?? '').trim()
      })
      return record
    })

  return { header: normalizedHeader, rows: mappedRows }
}

export function toCsv(rows: CsvRow[], header: string[]): string {
  const escape = (value: string) => {
    if (value.includes('"') || value.includes(',') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`
    }
    return value
  }

  const lines = [header.join(',')]
  for (const row of rows) {
    lines.push(header.map((key) => escape(row[key] ?? '')).join(','))
  }
  return `${lines.join('\n')}\n`
}
