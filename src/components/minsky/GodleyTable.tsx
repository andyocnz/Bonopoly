// ── Godley Table Component ──
// Editable double-entry bookkeeping table with asset class columns and row-sum validation.

import { useState, useCallback, useMemo } from 'react'
import type { GodleyTableData, AssetClass } from '../../types/minsky'
import { validateGodleyTable } from '../../engine/minskyEngine'

interface GodleyTableProps {
  table: GodleyTableData
  allValues: Map<string, number>
  onCellChange: (tableId: string, rowIndex: number, colIndex: number, value: string) => void
  onRowAdd: (tableId: string) => void
  onRowRemove: (tableId: string, rowIndex: number) => void
  onRowLabelChange: (tableId: string, rowIndex: number, label: string) => void
  readOnly?: boolean
}

const ASSET_CLASS_COLORS: Record<AssetClass, string> = {
  asset: '#2563eb',
  liability: '#dc2626',
  equity: '#16a34a',
  none: '#6b7280',
}

const ASSET_CLASS_LABELS: Record<AssetClass, string> = {
  asset: 'Asset',
  liability: 'Liability',
  equity: 'Equity',
  none: '',
}

export function GodleyTable({
  table,
  allValues,
  onCellChange,
  onRowAdd,
  onRowRemove,
  onRowLabelChange,
  readOnly = false,
}: GodleyTableProps) {
  const [editingCell, setEditingCell] = useState<{ row: number; col: number } | null>(null)
  const [editValue, setEditValue] = useState('')

  const validation = useMemo(
    () => validateGodleyTable(table, allValues),
    [table, allValues]
  )

  const handleCellClick = useCallback(
    (row: number, col: number) => {
      if (readOnly) return
      setEditingCell({ row, col })
      setEditValue(table.rows[row]?.cells[col] ?? '')
    },
    [readOnly, table]
  )

  const handleCellBlur = useCallback(() => {
    if (editingCell) {
      onCellChange(table.id, editingCell.row, editingCell.col, editValue)
      setEditingCell(null)
    }
  }, [editingCell, editValue, onCellChange, table.id])

  const handleCellKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        handleCellBlur()
      } else if (e.key === 'Escape') {
        setEditingCell(null)
      }
    },
    [handleCellBlur]
  )

  const stockValues = useMemo(() => {
    const vals: Record<string, number> = {}
    for (const col of table.columns) {
      vals[col.variableId] = allValues.get(col.variableId) ?? 0
    }
    return vals
  }, [table.columns, allValues])

  return (
    <div className="minsky-godley-table">
      <div className="minsky-godley-header">
        <h3 className="minsky-godley-title">{table.title}</h3>
      </div>

      {/* Asset class header row */}
      <div className="minsky-godley-asset-classes">
        <div className="minsky-godley-corner" />
        {table.columns.map((col, ci) => (
          <div
            key={ci}
            className="minsky-godley-asset-badge"
            style={{ color: ASSET_CLASS_COLORS[col.assetClass] }}
          >
            {ASSET_CLASS_LABELS[col.assetClass]}
          </div>
        ))}
        <div className="minsky-godley-ale-header">A-L-E</div>
      </div>

      <table className="minsky-godley-grid">
        <thead>
          <tr>
            <th className="minsky-godley-label-col">Flows / Stock Vars</th>
            {table.columns.map((col, ci) => (
              <th
                key={ci}
                className="minsky-godley-col-header"
                style={{ borderBottomColor: ASSET_CLASS_COLORS[col.assetClass] }}
              >
                <span className="minsky-godley-col-name">{col.name}</span>
                <span className="minsky-godley-col-value">
                  {stockValues[col.variableId]?.toFixed(1) ?? '0'}
                </span>
              </th>
            ))}
            <th className="minsky-godley-sum-col">Sum</th>
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row, ri) => {
            const rowValidation = validation[ri]
            const isInitialRow = ri === 0
            return (
              <tr key={ri} className={isInitialRow ? 'minsky-godley-init-row' : ''}>
                <td className="minsky-godley-row-label">
                  {readOnly ? (
                    row.label
                  ) : (
                    <input
                      type="text"
                      className="minsky-godley-label-input"
                      value={row.label}
                      onChange={e => onRowLabelChange(table.id, ri, e.target.value)}
                    />
                  )}
                  {!readOnly && !isInitialRow && (
                    <button
                      className="minsky-godley-row-remove"
                      onClick={() => onRowRemove(table.id, ri)}
                      title="Remove row"
                    >
                      x
                    </button>
                  )}
                </td>
                {row.cells.map((cell, ci) => {
                  const isEditing =
                    editingCell?.row === ri && editingCell?.col === ci
                  return (
                    <td
                      key={ci}
                      className={`minsky-godley-cell ${cell.startsWith('-') ? 'negative' : ''}`}
                      onClick={() => handleCellClick(ri, ci)}
                    >
                      {isEditing ? (
                        <input
                          type="text"
                          className="minsky-godley-cell-input"
                          value={editValue}
                          onChange={e => setEditValue(e.target.value)}
                          onBlur={handleCellBlur}
                          onKeyDown={handleCellKeyDown}
                          autoFocus
                        />
                      ) : (
                        <span className={cell.startsWith('-') ? 'minsky-negative' : ''}>
                          {cell || '\u00A0'}
                        </span>
                      )}
                    </td>
                  )
                })}
                <td className={`minsky-godley-sum ${rowValidation?.valid ? 'valid' : 'invalid'}`}>
                  {rowValidation ? (
                    <>
                      <span>{rowValidation.sum.toFixed(2)}</span>
                      <span className="minsky-godley-check">
                        {rowValidation.valid ? '\u2713' : '\u2717'}
                      </span>
                    </>
                  ) : null}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      {!readOnly && (
        <button className="minsky-godley-add-row" onClick={() => onRowAdd(table.id)}>
          + Add Flow Row
        </button>
      )}
    </div>
  )
}
