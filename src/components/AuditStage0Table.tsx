import React from 'react'
import { formatCurrency } from '../engine/gameEngine'

export const AuditStage0Table: React.FC = () => (
  <div style={{ fontSize: '0.85rem', color: '#ccc' }}>
    <div style={{ borderBottom: '1px solid #333', marginBottom: '0.5rem', paddingBottom: '0.25rem', color: '#888', fontWeight: 700 }}>
      STAGE 1: ZERO STATE
    </div>
    <div style={{ color: '#666', marginBottom: '0.75rem', fontSize: '0.7rem' }}>
      Pre-Formation<br />
      Assets: $0 | Liab: $0
    </div>
    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
      <span>Cash:</span>
      <span style={{ color: '#fff' }}>{formatCurrency(0)}</span>
    </div>
    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
      <span>Inventory:</span>
      <span style={{ color: '#fff' }}>{formatCurrency(0)}</span>
    </div>
    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
      <span>Fixed Assets:</span>
      <span style={{ color: '#fff' }}>{formatCurrency(0)}</span>
    </div>
    <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed #333', marginTop: '4px', paddingTop: '4px' }}>
      <span style={{ fontWeight: 600 }}>Total Assets:</span>
      <span style={{ color: '#10b981', fontWeight: 600 }}>{formatCurrency(0)}</span>
    </div>
    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #333' }}>
      <span style={{ fontWeight: 700 }}>CHECK (L+E):</span>
      <span style={{ fontWeight: 700, color: '#10b981' }}>{formatCurrency(0)} OK</span>
    </div>
  </div>
)
