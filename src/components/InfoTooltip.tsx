/**
 * Info Tooltip Component
 *
 * Shows helpful information when hovering over (i) icon
 */

import { useState } from 'react'

interface InfoTooltipProps {
  content: string
  position?: 'top' | 'bottom' | 'left' | 'right'
}

export function InfoTooltip({ content, position = 'top' }: InfoTooltipProps) {
  const [isVisible, setIsVisible] = useState(false)

  const positionStyles = {
    top: { bottom: '100%', left: '50%', transform: 'translateX(-50%)', marginBottom: '8px' },
    bottom: { top: '100%', left: '50%', transform: 'translateX(-50%)', marginTop: '8px' },
    left: { right: '100%', top: '50%', transform: 'translateY(-50%)', marginRight: '8px' },
    right: { left: '100%', top: '50%', transform: 'translateY(-50%)', marginLeft: '8px' },
  }

  return (
    <span
      style={{ position: 'relative', display: 'inline-block', marginLeft: '0.4rem' }}
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{
          cursor: 'help',
          color: 'var(--text-muted)',
          verticalAlign: 'middle',
          opacity: 0.6,
        }}
      >
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="16" x2="12" y2="12"></line>
        <line x1="12" y1="8" x2="12.01" y2="8"></line>
      </svg>

      {isVisible && (
        <div
          style={{
            position: 'absolute',
            ...positionStyles[position],
            background: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: '6px',
            padding: '0.75rem',
            fontSize: '0.78rem',
            lineHeight: '1.4',
            fontWeight: 400,
            color: 'var(--text-secondary)',
            whiteSpace: 'normal',
            maxWidth: '340px',
            minWidth: '220px',
            zIndex: 1000,
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
            pointerEvents: 'none',
          }}
        >
          {content}
        </div>
      )}
    </span>
  )
}
