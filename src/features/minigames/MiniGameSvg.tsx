/**
 * Auto-generated SVG illustrations for each mini-game card.
 * All SVGs use a 120×70 viewBox with no external assets.
 */

import type { JSX } from 'react'
import type { MiniGameTypeSlug } from '../../api/client'

const W = 120
const H = 70

type SvgProps = { className?: string; style?: React.CSSProperties }

// ─── Individual SVGs ──────────────────────────────────────────────────────────

function BankRunSvg(p: SvgProps) {
  return (
    <svg viewBox={`0 0 ${W} ${H}`} {...p}>
      {/* Bank building */}
      <rect x="72" y="28" width="36" height="30" rx="2" fill="#dbeafe" stroke="#3b82f6" strokeWidth="1.5"/>
      <polygon points="68,28 112,28 90,14" fill="#bfdbfe" stroke="#3b82f6" strokeWidth="1.5"/>
      <rect x="83" y="42" width="14" height="16" fill="#3b82f6"/>
      <line x1="79" y1="28" x2="79" y2="58" stroke="#93c5fd" strokeWidth="1"/>
      <line x1="90" y1="28" x2="90" y2="42" stroke="#93c5fd" strokeWidth="1"/>
      <line x1="101" y1="28" x2="101" y2="58" stroke="#93c5fd" strokeWidth="1"/>
      {/* Running figures */}
      {[12, 26, 40].map((x, i) => (
        <g key={i}>
          <circle cx={x} cy={28} r={4} fill="#f59e0b"/>
          <line x1={x} y1={32} x2={x} y2={44} stroke="#f59e0b" strokeWidth="1.5"/>
          <line x1={x} y1={37} x2={x - 5} y2={44} stroke="#f59e0b" strokeWidth="1.5"/>
          <line x1={x} y1={37} x2={x + 5} y2={44} stroke="#f59e0b" strokeWidth="1.5"/>
        </g>
      ))}
      {/* Arrow */}
      <path d="M52 40 L65 40" stroke="#ef4444" strokeWidth="2" fill="none"/>
      <polygon points="65,37 70,40 65,43" fill="#ef4444"/>
    </svg>
  )
}

function PrisonersDilemmaSvg(p: SvgProps) {
  const cells = [
    { x: 42, y: 12, fill: '#bbf7d0', label: '3/3', labelColor: '#15803d' },
    { x: 78, y: 12, fill: '#fef08a', label: '0/5', labelColor: '#854d0e' },
    { x: 42, y: 38, fill: '#fef08a', label: '5/0', labelColor: '#854d0e' },
    { x: 78, y: 38, fill: '#fecaca', label: '1/1', labelColor: '#dc2626' },
  ]
  return (
    <svg viewBox={`0 0 ${W} ${H}`} {...p}>
      {/* Header labels */}
      <text x="60" y="10" textAnchor="middle" fontSize="7" fill="#64748b">Coop</text>
      <text x="97" y="10" textAnchor="middle" fontSize="7" fill="#64748b">Defect</text>
      <text x="12" y="30" textAnchor="middle" fontSize="7" fill="#64748b" transform="rotate(-90,12,30)">Coop</text>
      <text x="12" y="56" textAnchor="middle" fontSize="7" fill="#64748b" transform="rotate(-90,12,56)">Def</text>
      {cells.map((c, i) => (
        <g key={i}>
          <rect x={c.x} y={c.y} width="32" height="24" rx="3" fill={c.fill} stroke="#cbd5e1" strokeWidth="1"/>
          <text x={c.x + 16} y={c.y + 14} textAnchor="middle" fontSize="9" fontWeight="700" fill={c.labelColor}>{c.label}</text>
        </g>
      ))}
      {/* Nash indicator */}
      <rect x="78" y="38" width="32" height="24" rx="3" fill="none" stroke="#dc2626" strokeWidth="2.5" strokeDasharray="4,2"/>
    </svg>
  )
}

function UltimatumSvg(p: SvgProps) {
  return (
    <svg viewBox={`0 0 ${W} ${H}`} {...p}>
      {/* Pie */}
      <circle cx="60" cy="38" r="26" fill="#f1f5f9" stroke="#cbd5e1" strokeWidth="1"/>
      {/* Large slice (proposer keeps) */}
      <path d="M60 38 L60 12 A26 26 0 1 1 34.9 54.1 Z" fill="#bfdbfe" stroke="#3b82f6" strokeWidth="1.5"/>
      {/* Small slice (offer) */}
      <path d="M60 38 L34.9 54.1 A26 26 0 0 1 60 12 Z" fill="#bbf7d0" stroke="#16a34a" strokeWidth="1.5"/>
      {/* Labels */}
      <text x="72" y="35" textAnchor="middle" fontSize="8" fill="#1d4ed8" fontWeight="700">70%</text>
      <text x="44" y="58" textAnchor="middle" fontSize="8" fill="#15803d" fontWeight="700">30%</text>
      {/* Accept/reject */}
      <text x="10" y="20" fontSize="7" fill="#15803d">✓ Accept</text>
      <text x="88" y="20" fontSize="7" fill="#dc2626">✗ Reject</text>
    </svg>
  )
}

function FisherySvg(p: SvgProps) {
  return (
    <svg viewBox={`0 0 ${W} ${H}`} {...p}>
      {/* Water */}
      <ellipse cx="60" cy="50" rx="52" ry="16" fill="#dbeafe" stroke="#93c5fd" strokeWidth="1"/>
      {/* Fish — some present, some caught */}
      {[{x:30,y:48,op:1},{x:48,y:44,op:1},{x:65,y:50,op:1},{x:80,y:46,op:0.3},{x:95,y:49,op:0.2}].map((f,i) => (
        <g key={i} opacity={f.op}>
          <ellipse cx={f.x} cy={f.y} rx="8" ry="5" fill="#60a5fa" stroke="#3b82f6" strokeWidth="1"/>
          <polygon points={`${f.x+8},${f.y} ${f.x+13},${f.y-4} ${f.x+13},${f.y+4}`} fill="#3b82f6"/>
          <circle cx={f.x-3} cy={f.y-1} r="1.2" fill="#fff"/>
        </g>
      ))}
      {/* Fishing lines */}
      <line x1="25" y1="8" x2="30" y2="48" stroke="#94a3b8" strokeWidth="1" strokeDasharray="3,2"/>
      <line x1="75" y1="8" x2="80" y2="46" stroke="#94a3b8" strokeWidth="1" strokeDasharray="3,2"/>
      <text x="60" y="12" textAnchor="middle" fontSize="8" fill="#64748b">Common Pool</text>
    </svg>
  )
}

function TrustGameSvg(p: SvgProps) {
  return (
    <svg viewBox={`0 0 ${W} ${H}`} {...p}>
      {/* Investor node */}
      <circle cx="22" cy="35" r="16" fill="#dbeafe" stroke="#3b82f6" strokeWidth="1.5"/>
      <text x="22" y="32" textAnchor="middle" fontSize="7" fill="#1d4ed8" fontWeight="700">Investor</text>
      <text x="22" y="42" textAnchor="middle" fontSize="8" fill="#1d4ed8">$10</text>
      {/* Trustee node */}
      <circle cx="98" cy="35" r="16" fill="#dcfce7" stroke="#16a34a" strokeWidth="1.5"/>
      <text x="98" y="32" textAnchor="middle" fontSize="7" fill="#15803d" fontWeight="700">Trustee</text>
      <text x="98" y="42" textAnchor="middle" fontSize="8" fill="#15803d">$30</text>
      {/* Arrow: send */}
      <path d="M39 29 Q60 18 81 29" stroke="#3b82f6" strokeWidth="1.5" fill="none"/>
      <polygon points="81,26 84,32 78,31" fill="#3b82f6"/>
      <text x="60" y="18" textAnchor="middle" fontSize="7" fill="#3b82f6">×3</text>
      {/* Arrow: return */}
      <path d="M81 41 Q60 54 39 41" stroke="#16a34a" strokeWidth="1.5" fill="none" strokeDasharray="4,2"/>
      <polygon points="39,44 36,38 42,39" fill="#16a34a"/>
      <text x="60" y="58" textAnchor="middle" fontSize="7" fill="#15803d">return?</text>
    </svg>
  )
}

function PublicGoodsSvg(p: SvgProps) {
  return (
    <svg viewBox={`0 0 ${W} ${H}`} {...p}>
      {/* Central pool */}
      <ellipse cx="60" cy="48" rx="22" ry="14" fill="#dbeafe" stroke="#3b82f6" strokeWidth="1.5"/>
      <text x="60" y="51" textAnchor="middle" fontSize="8" fill="#1d4ed8" fontWeight="700">Pool ×2</text>
      {/* Contributors */}
      {[{x:15,y:20},{x:60,y:8},{x:105,y:20}].map((c,i) => (
        <g key={i}>
          <circle cx={c.x} cy={c.y} r="10" fill="#f0fdf4" stroke="#16a34a" strokeWidth="1.5"/>
          <text x={c.x} y={c.y+4} textAnchor="middle" fontSize="9" fill="#15803d">$</text>
          <line x1={c.x} y1={c.y+10} x2={i===0?38:i===1?60:82} y2={38} stroke="#16a34a" strokeWidth="1.5"/>
          <polygon points={`${i===0?38:i===1?60:82},34 ${i===0?35:i===1?57:79},40 ${i===0?41:i===1?63:85},40`} fill="#16a34a"/>
        </g>
      ))}
    </svg>
  )
}

function AdverseSelectionSvg(p: SvgProps) {
  const bands = [
    { x: 22, y: 34, h: 22, label: 'Low', fill: '#fde68a', stroke: '#f59e0b', active: true },
    { x: 48, y: 24, h: 32, label: 'Med', fill: '#bfdbfe', stroke: '#3b82f6', active: true },
    { x: 74, y: 14, h: 42, label: 'High', fill: '#bbf7d0', stroke: '#16a34a', active: false },
  ]
  return (
    <svg viewBox={`0 0 ${W} ${H}`} {...p}>
      <rect x="12" y="10" width="96" height="50" rx="5" fill="#f8fafc" stroke="#e2e8f0" strokeWidth="1" />
      <line x1="18" y1="56" x2="102" y2="56" stroke="#cbd5e1" strokeWidth="1"/>
      {bands.map((b, i) => (
        <g key={i} opacity={b.active ? 1 : 0.35}>
          <rect x={b.x} y={b.y} width="20" height={b.h} rx="3" fill={b.fill} stroke={b.stroke} strokeWidth="1.5"/>
          <text x={b.x + 10} y="64" textAnchor="middle" fontSize="6.5" fill="#64748b">{b.label}</text>
        </g>
      ))}
      <line x1="16" y1="32" x2="104" y2="32" stroke="#f59e0b" strokeWidth="1" strokeDasharray="4,2"/>
      <text x="14" y="30" textAnchor="end" fontSize="6.5" fill="#f59e0b">P</text>
      <path d="M84 24 L98 13" stroke="#dc2626" strokeWidth="1.5" fill="none"/>
      <polygon points="98,13 94,18 101,17" fill="#dc2626"/>
      <text x="100" y="12" textAnchor="end" fontSize="6.5" fill="#dc2626">exit</text>
    </svg>
  )
}

function PrincipalAgentSvg(p: SvgProps) {
  return (
    <svg viewBox={`0 0 ${W} ${H}`} {...p}>
      {/* Principal box */}
      <rect x="6" y="22" width="38" height="26" rx="5" fill="#dbeafe" stroke="#3b82f6" strokeWidth="1.5"/>
      <text x="25" y="33" textAnchor="middle" fontSize="7" fill="#1d4ed8" fontWeight="700">Principal</text>
      <text x="25" y="42" textAnchor="middle" fontSize="7" fill="#1d4ed8">w + bonus</text>
      {/* Agent box */}
      <rect x="76" y="22" width="38" height="26" rx="5" fill="#dcfce7" stroke="#16a34a" strokeWidth="1.5"/>
      <text x="95" y="33" textAnchor="middle" fontSize="7" fill="#15803d" fontWeight="700">Agent</text>
      <text x="95" y="42" textAnchor="middle" fontSize="7" fill="#15803d">effort?</text>
      {/* Contract arrow */}
      <path d="M44 30 L76 30" stroke="#3b82f6" strokeWidth="1.5" fill="none"/>
      <polygon points="76,27 80,30 76,33" fill="#3b82f6"/>
      <text x="60" y="26" textAnchor="middle" fontSize="6.5" fill="#3b82f6">contract</text>
      {/* Hidden effort arrow (dashed) */}
      <path d="M76 42 L44 42" stroke="#94a3b8" strokeWidth="1.5" fill="none" strokeDasharray="3,3"/>
      <text x="60" y="54" textAnchor="middle" fontSize="6.5" fill="#94a3b8">hidden effort</text>
      {/* Outcome */}
      <rect x="46" y="58" width="28" height="10" rx="3" fill="#fef9c3" stroke="#f59e0b" strokeWidth="1"/>
      <text x="60" y="65" textAnchor="middle" fontSize="7" fill="#92400e">outcome</text>
    </svg>
  )
}

function DoubleAuctionSvg(p: SvgProps) {
  return (
    <svg viewBox={`0 0 ${W} ${H}`} {...p}>
      {/* Axes */}
      <line x1="15" y1="62" x2="110" y2="62" stroke="#cbd5e1" strokeWidth="1"/>
      <line x1="15" y1="62" x2="15" y2="8" stroke="#cbd5e1" strokeWidth="1"/>
      <text x="112" y="65" fontSize="7" fill="#94a3b8">Q</text>
      <text x="8" y="10" fontSize="7" fill="#94a3b8">P</text>
      {/* Demand staircase (blue) */}
      <polyline points="18,14 38,14 38,26 58,26 58,38 78,38 78,50 98,50" fill="none" stroke="#3b82f6" strokeWidth="2"/>
      {/* Supply staircase (red) */}
      <polyline points="18,56 38,56 38,44 58,44 58,32 78,32 78,20 98,20" fill="none" stroke="#ef4444" strokeWidth="2"/>
      {/* Equilibrium point */}
      <circle cx="68" cy="38" r="5" fill="#fff" stroke="#7c3aed" strokeWidth="2"/>
      <line x1="68" y1="43" x2="68" y2="62" stroke="#7c3aed" strokeWidth="1" strokeDasharray="3,2"/>
      <text x="58" y="68" fontSize="7" fill="#7c3aed">P*</text>
    </svg>
  )
}

function MatchingPenniesSvg(p: SvgProps) {
  const cells = [
    { x: 28, y: 10, fill: '#bbf7d0', r: '+1', c: '-1', color: '#15803d' },
    { x: 72, y: 10, fill: '#fecaca', r: '-1', c: '+1', color: '#dc2626' },
    { x: 28, y: 40, fill: '#fecaca', r: '-1', c: '+1', color: '#dc2626' },
    { x: 72, y: 40, fill: '#bbf7d0', r: '+1', c: '-1', color: '#15803d' },
  ]
  return (
    <svg viewBox={`0 0 ${W} ${H}`} {...p}>
      <text x="50" y="9" textAnchor="middle" fontSize="7" fill="#64748b">H</text>
      <text x="94" y="9" textAnchor="middle" fontSize="7" fill="#64748b">T</text>
      <text x="14" y="30" textAnchor="middle" fontSize="7" fill="#64748b">H</text>
      <text x="14" y="58" textAnchor="middle" fontSize="7" fill="#64748b">T</text>
      {cells.map((c, i) => (
        <g key={i}>
          <rect x={c.x} y={c.y} width="36" height="28" rx="4" fill={c.fill} stroke="#cbd5e1" strokeWidth="1"/>
          <text x={c.x + 18} y={c.y + 11} textAnchor="middle" fontSize="8" fill={c.color} fontWeight="700">{c.r}</text>
          <text x={c.x + 18} y={c.y + 22} textAnchor="middle" fontSize="8" fill={c.color}>{c.c}</text>
        </g>
      ))}
      <text x="60" y="68" textAnchor="middle" fontSize="7" fill="#7c3aed" fontStyle="italic">No pure NE</text>
    </svg>
  )
}

function CournotSvg(p: SvgProps) {
  return (
    <svg viewBox={`0 0 ${W} ${H}`} {...p}>
      {/* Axes */}
      <line x1="10" y1="62" x2="110" y2="62" stroke="#cbd5e1" strokeWidth="1"/>
      <line x1="10" y1="62" x2="10" y2="8" stroke="#cbd5e1" strokeWidth="1"/>
      <text x="112" y="65" fontSize="7" fill="#94a3b8">q₂</text>
      <text x="3" y="10" fontSize="7" fill="#94a3b8">q₁</text>
      {/* Firm 1 reaction function (blue) - downward sloping */}
      <line x1="14" y1="14" x2="90" y2="58" stroke="#3b82f6" strokeWidth="2"/>
      <text x="92" y="55" fontSize="7" fill="#3b82f6">RF₁</text>
      {/* Firm 2 reaction function (red) - downward sloping other way */}
      <line x1="90" y1="14" x2="14" y2="58" stroke="#ef4444" strokeWidth="2"/>
      <text x="92" y="18" fontSize="7" fill="#ef4444">RF₂</text>
      {/* Nash equilibrium point */}
      <circle cx="52" cy="36" r="5" fill="#fff" stroke="#7c3aed" strokeWidth="2"/>
      <text x="58" y="30" fontSize="7" fill="#7c3aed" fontWeight="700">NE</text>
    </svg>
  )
}

function BertrandSvg(p: SvgProps) {
  const firms = [
    { x: 20, prices: [52, 40, 30, 22] },
    { x: 65, prices: [48, 38, 28, 22] },
  ]
  return (
    <svg viewBox={`0 0 ${W} ${H}`} {...p}>
      {firms.map((f, fi) => (
        <g key={fi}>
          {f.prices.map((p, i) => (
            <rect key={i} x={f.x} y={62 - p} width="28" height={p} rx="2"
              fill={i === f.prices.length - 1 ? '#fecaca' : fi === 0 ? '#bfdbfe' : '#dcfce7'}
              stroke={fi === 0 ? '#3b82f6' : '#16a34a'} strokeWidth="1"
              opacity={0.4 + i * 0.2}/>
          ))}
          <text x={f.x + 14} y="67" textAnchor="middle" fontSize="7" fill="#64748b">Firm {fi+1}</text>
        </g>
      ))}
      {/* MC line */}
      <line x1="8" y1="40" x2="112" y2="40" stroke="#ef4444" strokeWidth="1.5" strokeDasharray="4,2"/>
      <text x="6" y="38" textAnchor="end" fontSize="7" fill="#ef4444">MC</text>
      {/* Arrow showing race to bottom */}
      <path d="M110 20 L110 36" stroke="#94a3b8" strokeWidth="1.5"/>
      <polygon points="107,36 110,40 113,36" fill="#94a3b8"/>
    </svg>
  )
}

function EnglishAuctionSvg(p: SvgProps) {
  const bids = [14, 22, 32, 44, 52, 60]
  return (
    <svg viewBox={`0 0 ${W} ${H}`} {...p}>
      <line x1="10" y1="62" x2="110" y2="62" stroke="#cbd5e1" strokeWidth="1"/>
      {bids.map((h, i) => (
        <rect key={i} x={12 + i * 16} y={62 - h} width="12" height={h} rx="2"
          fill={i === bids.length - 1 ? '#fde68a' : '#dbeafe'}
          stroke={i === bids.length - 1 ? '#f59e0b' : '#93c5fd'} strokeWidth="1.5"/>
      ))}
      {/* Gavel */}
      <rect x="88" y="8" width="22" height="8" rx="2" fill="#78716c" stroke="#57534e" strokeWidth="1"/>
      <line x1="99" y1="16" x2="107" y2="28" stroke="#a8a29e" strokeWidth="3" strokeLinecap="round"/>
      <text x="60" y="68" textAnchor="middle" fontSize="7" fill="#f59e0b" fontWeight="700">Highest bid wins!</text>
    </svg>
  )
}

function BeautyContestSvg(p: SvgProps) {
  const guesses = [30, 45, 52, 60, 70, 80]
  const target = Math.round(guesses.reduce((a, b) => a + b, 0) / guesses.length * 2 / 3)
  return (
    <svg viewBox={`0 0 ${W} ${H}`} {...p}>
      {/* Number line */}
      <line x1="10" y1="38" x2="110" y2="38" stroke="#cbd5e1" strokeWidth="1.5"/>
      <text x="10" y="48" fontSize="7" fill="#94a3b8">0</text>
      <text x="103" y="48" fontSize="7" fill="#94a3b8">100</text>
      {/* Guesses */}
      {guesses.map((g, i) => (
        <g key={i}>
          <circle cx={10 + g} cy={38} r="4" fill="#bfdbfe" stroke="#3b82f6" strokeWidth="1"/>
          <text x={10 + g} y={30} textAnchor="middle" fontSize="7" fill="#3b82f6">{g}</text>
        </g>
      ))}
      {/* Target (2/3 of avg) */}
      <line x1={10 + target} y1="22" x2={10 + target} y2="50" stroke="#7c3aed" strokeWidth="2"/>
      <text x={10 + target} y="18" textAnchor="middle" fontSize="7" fill="#7c3aed" fontWeight="700">2/3×avg={target}</text>
      <text x="60" y="62" textAnchor="middle" fontSize="7" fill="#64748b" fontStyle="italic">Convergence to 0</text>
    </svg>
  )
}

function MonteCarloPiSvg(p: SvgProps) {
  const dots = [
    [30,30],[45,20],[55,35],[25,45],[50,50],[38,52],[60,25],[42,38],
    [28,38],[55,18],[65,42],[35,22],[70,30],[20,50],[48,58],
  ]
  return (
    <svg viewBox={`0 0 ${W} ${H}`} {...p}>
      <rect x="10" y="5" width="60" height="60" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="1"/>
      <path d="M10 65 A60 60 0 0 1 70 5" fill="#dbeafe" stroke="#3b82f6" strokeWidth="1.5" opacity="0.5"/>
      {dots.map(([x, y], i) => {
        const dx = x - 10, dy = y - 5
        const inside = dx * dx + dy * dy <= 60 * 60
        return <circle key={i} cx={x} cy={y} r="2.5" fill={inside ? '#16a34a' : '#ef4444'} opacity="0.85"/>
      })}
      <text x="85" y="25" textAnchor="middle" fontSize="7" fill="#16a34a">● inside</text>
      <text x="85" y="37" textAnchor="middle" fontSize="7" fill="#ef4444">● outside</text>
      <text x="85" y="52" textAnchor="middle" fontSize="8" fill="#7c3aed" fontWeight="700">≈ π</text>
    </svg>
  )
}

function MarketSurvivalSvg(p: SvgProps) {
  const paths = [
    'M10,50 C25,40 35,20 50,15 S75,10 110,8',
    'M10,50 C25,55 35,60 50,65',
    'M10,50 C25,45 40,35 55,30 S80,25 110,30',
    'M10,50 C20,42 30,30 45,22 S70,18 110,22',
  ]
  const colors = ['#16a34a', '#ef4444', '#3b82f6', '#f59e0b']
  return (
    <svg viewBox={`0 0 ${W} ${H}`} {...p}>
      {/* Target line */}
      <line x1="10" y1="18" x2="110" y2="18" stroke="#16a34a" strokeWidth="1" strokeDasharray="4,2" opacity="0.6"/>
      <text x="112" y="20" fontSize="6" fill="#16a34a">▲</text>
      {/* Bankruptcy line */}
      <line x1="10" y1="58" x2="110" y2="58" stroke="#ef4444" strokeWidth="1" strokeDasharray="4,2" opacity="0.6"/>
      <text x="112" y="60" fontSize="6" fill="#ef4444">▼</text>
      {paths.map((d, i) => (
        <path key={i} d={d} fill="none" stroke={colors[i]} strokeWidth="1.5" opacity="0.8"/>
      ))}
      <text x="10" y="10" fontSize="7" fill="#64748b">Price paths</text>
    </svg>
  )
}

function PortfolioFrontierSvg(p: SvgProps) {
  return (
    <svg viewBox={`0 0 ${W} ${H}`} {...p}>
      {/* Axes */}
      <line x1="15" y1="62" x2="110" y2="62" stroke="#cbd5e1" strokeWidth="1"/>
      <line x1="15" y1="62" x2="15" y2="8" stroke="#cbd5e1" strokeWidth="1"/>
      <text x="112" y="65" fontSize="7" fill="#94a3b8">Risk σ</text>
      <text x="5" y="10" fontSize="7" fill="#94a3b8">R</text>
      {/* Inefficient region */}
      <path d="M20,58 Q40,55 55,45 Q70,32 90,18" fill="none" stroke="#3b82f6" strokeWidth="2.5"/>
      {/* Shaded feasible region */}
      <path d="M20,58 Q40,55 55,45 Q70,32 90,18 L90,62 Z" fill="#dbeafe" opacity="0.4"/>
      {/* Efficient frontier label */}
      <text x="92" y="16" fontSize="7" fill="#3b82f6">EF</text>
      {/* Optimal point */}
      <circle cx="62" cy="38" r="5" fill="#fde68a" stroke="#f59e0b" strokeWidth="2"/>
      <text x="68" y="34" fontSize="7" fill="#f59e0b" fontWeight="700">★</text>
    </svg>
  )
}

function SignalingSvg(p: SvgProps) {
  return (
    <svg viewBox={`0 0 ${W} ${H}`} {...p}>
      {/* Worker */}
      <circle cx="18" cy="28" r="10" fill="#dbeafe" stroke="#3b82f6" strokeWidth="1.5"/>
      <text x="18" y="25" textAnchor="middle" fontSize="6.5" fill="#1d4ed8" fontWeight="700">Worker</text>
      <text x="18" y="35" textAnchor="middle" fontSize="7" fill="#1d4ed8">High/Low</text>
      {/* Diploma */}
      <rect x="47" y="22" width="26" height="18" rx="3" fill="#fef9c3" stroke="#f59e0b" strokeWidth="1.5"/>
      <text x="60" y="30" textAnchor="middle" fontSize="7" fill="#92400e" fontWeight="700">Edu</text>
      <text x="60" y="38" textAnchor="middle" fontSize="7" fill="#92400e">0 / 1 / 2</text>
      {/* Employer */}
      <circle cx="102" cy="28" r="10" fill="#dcfce7" stroke="#16a34a" strokeWidth="1.5"/>
      <text x="102" y="25" textAnchor="middle" fontSize="6.5" fill="#15803d" fontWeight="700">Employer</text>
      <text x="102" y="35" textAnchor="middle" fontSize="7" fill="#15803d">wage</text>
      {/* Arrows */}
      <line x1="28" y1="28" x2="46" y2="28" stroke="#3b82f6" strokeWidth="1.5"/>
      <polygon points="46,25 50,28 46,31" fill="#3b82f6"/>
      <line x1="73" y1="28" x2="91" y2="28" stroke="#16a34a" strokeWidth="1.5"/>
      <polygon points="91,25 95,28 91,31" fill="#16a34a"/>
      {/* Types */}
      <text x="18" y="55" textAnchor="middle" fontSize="7" fill="#16a34a">High → edu=2</text>
      <text x="18" y="63" textAnchor="middle" fontSize="7" fill="#dc2626">Low → edu=0</text>
    </svg>
  )
}

function MonopolyPricingSvg(p: SvgProps) {
  return (
    <svg viewBox={`0 0 ${W} ${H}`} {...p}>
      {/* Axes */}
      <line x1="12" y1="62" x2="110" y2="62" stroke="#cbd5e1" strokeWidth="1"/>
      <line x1="12" y1="62" x2="12" y2="8" stroke="#cbd5e1" strokeWidth="1"/>
      <text x="112" y="65" fontSize="7" fill="#94a3b8">Q</text>
      <text x="5" y="10" fontSize="7" fill="#94a3b8">P</text>
      {/* Demand line */}
      <line x1="16" y1="12" x2="108" y2="60" stroke="#3b82f6" strokeWidth="2"/>
      <text x="110" y="58" fontSize="7" fill="#3b82f6">D</text>
      {/* MC line */}
      <line x1="12" y1="50" x2="110" y2="50" stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="3,2"/>
      <text x="6" y="48" fontSize="7" fill="#94a3b8">MC</text>
      {/* MR line (steeper) */}
      <line x1="16" y1="12" x2="62" y2="60" stroke="#7c3aed" strokeWidth="1.5" strokeDasharray="3,2" opacity="0.7"/>
      {/* Profit rectangle */}
      <rect x="12" y="28" width="42" height="22" fill="#fde68a" opacity="0.5" stroke="#f59e0b" strokeWidth="1"/>
      {/* P* marker */}
      <line x1="12" y1="28" x2="54" y2="28" stroke="#f59e0b" strokeWidth="1.5" strokeDasharray="3,2"/>
      <text x="8" y="27" textAnchor="end" fontSize="7" fill="#f59e0b">P*</text>
      <line x1="54" y1="28" x2="54" y2="62" stroke="#f59e0b" strokeWidth="1.5" strokeDasharray="3,2"/>
      <text x="54" y="68" textAnchor="middle" fontSize="7" fill="#f59e0b">Q*</text>
    </svg>
  )
}

function AssetBubbleSvg(p: SvgProps) {
  return (
    <svg viewBox={`0 0 ${W} ${H}`} {...p}>
      {/* Axes */}
      <line x1="10" y1="62" x2="112" y2="62" stroke="#cbd5e1" strokeWidth="1"/>
      <line x1="10" y1="62" x2="10" y2="8" stroke="#cbd5e1" strokeWidth="1"/>
      <text x="114" y="65" fontSize="7" fill="#94a3b8">t</text>
      <text x="3" y="10" fontSize="7" fill="#94a3b8">P</text>
      {/* Fundamental value (declining) */}
      <line x1="14" y1="20" x2="106" y2="54" stroke="#16a34a" strokeWidth="2"/>
      <text x="108" y="52" fontSize="7" fill="#16a34a">FV</text>
      {/* Bubble price — spikes above FV then crashes */}
      <path d="M14,46 C25,42 35,28 50,14 S68,8 72,8 C78,8 82,18 88,36 S96,52 106,56"
        fill="none" stroke="#ef4444" strokeWidth="2"/>
      <text x="50" y="8" textAnchor="middle" fontSize="7" fill="#ef4444">bubble!</text>
      {/* Shaded area above FV */}
      <path d="M14,46 C25,42 35,28 50,14 S68,8 72,8 C78,8 82,18 88,36 S96,52 106,56 L106,54 C96,50 88,34 80,20 S68,14 60,20 S30,38 14,46 Z"
        fill="#fecaca" opacity="0.3"/>
      <text x="60" y="66" textAnchor="middle" fontSize="7" fill="#ef4444" fontStyle="italic">crash</text>
    </svg>
  )
}

function CreditScoreSvg(p: SvgProps) {
  return (
    <svg viewBox={`0 0 ${W} ${H}`} {...p}>
      {/* Gauge arc background */}
      <path d="M20 55 A40 40 0 0 1 100 55" fill="none" stroke="#e2e8f0" strokeWidth="10" strokeLinecap="round"/>
      {/* Poor zone */}
      <path d="M20 55 A40 40 0 0 1 40 22" fill="none" stroke="#fca5a5" strokeWidth="10" strokeLinecap="round"/>
      {/* Fair zone */}
      <path d="M40 22 A40 40 0 0 1 60 15" fill="none" stroke="#fde68a" strokeWidth="10" strokeLinecap="round"/>
      {/* Good zone */}
      <path d="M60 15 A40 40 0 0 1 80 22" fill="none" stroke="#86efac" strokeWidth="10" strokeLinecap="round"/>
      {/* Excellent zone */}
      <path d="M80 22 A40 40 0 0 1 100 55" fill="none" stroke="#4ade80" strokeWidth="10" strokeLinecap="round"/>
      {/* Needle */}
      <line x1="60" y1="55" x2="74" y2="26" stroke="#1e293b" strokeWidth="2" strokeLinecap="round"/>
      <circle cx="60" cy="55" r="4" fill="#1e293b"/>
      {/* Labels */}
      <text x="14" y="66" fontSize="7" fill="#ef4444">Poor</text>
      <text x="88" y="66" fontSize="7" fill="#16a34a">Great</text>
      <text x="60" y="68" textAnchor="middle" fontSize="8" fill="#1e293b" fontWeight="700">720</text>
    </svg>
  )
}

function MarketBasketSvg(p: SvgProps) {
  return (
    <svg viewBox={`0 0 ${W} ${H}`} {...p}>
      {/* Basket */}
      <path d="M30 44 L36 30 L84 30 L90 44 Z" fill="#dbeafe" stroke="#3b82f6" strokeWidth="1.5"/>
      <line x1="42" y1="30" x2="35" y2="18" stroke="#3b82f6" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="78" y1="30" x2="85" y2="18" stroke="#3b82f6" strokeWidth="1.5" strokeLinecap="round"/>
      {/* Items */}
      <circle cx="48" cy="38" r="5" fill="#fbbf24"/>
      <circle cx="60" cy="37" r="6" fill="#34d399"/>
      <circle cx="72" cy="38" r="5" fill="#f87171"/>
      {/* Rule: bread → butter */}
      <text x="6" y="20" fontSize="9">🍞</text>
      <path d="M17 16 L26 16" stroke="#8b5cf6" strokeWidth="1.5" fill="none" markerEnd="url(#arr)"/>
      <polygon points="25,13 30,16 25,19" fill="#8b5cf6"/>
      <text x="32" y="20" fontSize="9">🧈</text>
      {/* Lift badge */}
      <rect x="92" y="8" width="24" height="14" rx="3" fill="#22c55e20" stroke="#22c55e" strokeWidth="1"/>
      <text x="104" y="18" textAnchor="middle" fontSize="8" fontWeight="700" fill="#22c55e">3.2×</text>
      {/* Bars */}
      <text x="6" y="59" fontSize="6" fill="#94a3b8">conf</text>
      <rect x="20" y="54" width="44" height="5" rx="2" fill="#334155"/>
      <rect x="20" y="54" width="37" height="5" rx="2" fill="#f97316"/>
      <text x="66" y="59" fontSize="6" fill="#f97316">85%</text>
      <text x="6" y="68" fontSize="6" fill="#94a3b8">lift</text>
      <rect x="20" y="63" width="44" height="5" rx="2" fill="#334155"/>
      <rect x="20" y="63" width="20" height="5" rx="2" fill="#22c55e"/>
      <text x="66" y="68" fontSize="6" fill="#22c55e">1.1×</text>
    </svg>
  )
}

function ABTestingSvg(p: SvgProps) {
  const aPoints = [15, 14, 16, 15, 16, 15, 16, 15, 17, 16]
  const bPoints = [15, 17, 18, 20, 21, 22, 23, 24, 25, 26]
  const days = aPoints.length
  const CW = 92, CH = 44, padL = 4, padT = 4
  const minY = 12, maxY = 28
  const toX = (i: number) => padL + 8 + (i / (days - 1)) * CW
  const toY = (v: number) => padT + 6 + CH - ((v - minY) / (maxY - minY)) * CH
  const pathA = aPoints.map((v, i) => `${i === 0 ? 'M' : 'L'}${toX(i).toFixed(1)},${toY(v).toFixed(1)}`).join(' ')
  const pathB = bPoints.map((v, i) => `${i === 0 ? 'M' : 'L'}${toX(i).toFixed(1)},${toY(v).toFixed(1)}`).join(' ')
  return (
    <svg viewBox={`0 0 ${W} ${H}`} {...p}>
      <rect x="8" y="4" width="104" height="52" rx="4" fill="#0f172a" stroke="#334155" strokeWidth="1"/>
      {[0.33, 0.66].map((f, i) => (
        <line key={i} x1="8" x2="112" y1={4 + f * 52} y2={4 + f * 52} stroke="#1e293b" strokeWidth="0.5"/>
      ))}
      <path d={pathA} fill="none" stroke="#60a5fa" strokeWidth="1.5"/>
      <path d={pathB} fill="none" stroke="#f97316" strokeWidth="1.5"/>
      <rect x="12" y="8" width="7" height="2" fill="#60a5fa"/>
      <text x="21" y="11" fontSize="6" fill="#60a5fa">Control A</text>
      <rect x="12" y="14" width="7" height="2" fill="#f97316"/>
      <text x="21" y="17" fontSize="6" fill="#f97316">Treatment B</text>
      <rect x="72" y="42" width="34" height="11" rx="3" fill="#15803d20" stroke="#16a34a" strokeWidth="1"/>
      <text x="89" y="50" textAnchor="middle" fontSize="7" fontWeight="700" fill="#4ade80">B Wins ✓</text>
      <rect x="8" y="60" width="104" height="6" rx="2" fill="#334155"/>
      <rect x="8" y="60" width="84" height="6" rx="2" fill="#22c55e"/>
      <text x="70" y="65" textAnchor="middle" fontSize="6" fill="#fff" fontWeight="700">82% confidence</text>
    </svg>
  )
}

function CustomerChurnSvg(p: SvgProps) {
  const grid = [
    { x: 10, y: 8,  risk: true  }, { x: 28, y: 8,  risk: false },
    { x: 46, y: 8,  risk: true  }, { x: 64, y: 8,  risk: false },
    { x: 82, y: 8,  risk: false }, { x: 100, y: 8, risk: false },
    { x: 10, y: 26, risk: false }, { x: 28, y: 26, risk: true  },
    { x: 46, y: 26, risk: false }, { x: 64, y: 26, risk: true  },
    { x: 82, y: 26, risk: false }, { x: 100, y: 26, risk: false },
  ]
  return (
    <svg viewBox={`0 0 ${W} ${H}`} {...p}>
      {grid.map((c, i) => (
        <g key={i}>
          <rect x={c.x - 7} y={c.y - 7} width="14" height="14" rx="2"
            fill={c.risk ? '#7f1d1d20' : '#14532d15'}
            stroke={c.risk ? '#ef4444' : '#22c55e'} strokeWidth="1"/>
          <circle cx={c.x} cy={c.y - 1} r="2.5" fill={c.risk ? '#f87171' : '#4ade80'}/>
          <line x1={c.x - 3} y1={c.y + 4} x2={c.x + 3} y2={c.y + 4}
            stroke={c.risk ? '#f87171' : '#4ade80'} strokeWidth="1.5" strokeLinecap="round"/>
        </g>
      ))}
      <text x="4" y="52" fontSize="6" fill="#94a3b8">Precision</text>
      <rect x="34" y="47" width="52" height="5" rx="2" fill="#334155"/>
      <rect x="34" y="47" width="36" height="5" rx="2" fill="#60a5fa"/>
      <text x="88" y="52" fontSize="6" fill="#60a5fa">70%</text>
      <text x="4" y="61" fontSize="6" fill="#94a3b8">Recall</text>
      <rect x="34" y="56" width="52" height="5" rx="2" fill="#334155"/>
      <rect x="34" y="56" width="42" height="5" rx="2" fill="#a78bfa"/>
      <text x="88" y="61" fontSize="6" fill="#a78bfa">80%</text>
      <text x="4" y="70" fontSize="7" fontWeight="700" fill="#22c55e">+$800 net revenue</text>
    </svg>
  )
}

function ConflictOfInterestSvg(p: SvgProps) {
  return (
    <svg viewBox={`0 0 ${W} ${H}`} {...p}>
      <rect x="12" y="20" width="96" height="42" rx="6" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="1.5" />
      <path d="M22 50 L98 50" stroke="#94a3b8" strokeWidth="1.5" />
      <path d="M60 22 L60 50" stroke="#94a3b8" strokeWidth="1.5" />
      <circle cx="36" cy="34" r="8" fill="#dbeafe" stroke="#3b82f6" strokeWidth="1.5" />
      <circle cx="84" cy="34" r="8" fill="#fee2e2" stroke="#ef4444" strokeWidth="1.5" />
      <text x="36" y="37" textAnchor="middle" fontSize="8" fontWeight="700" fill="#1d4ed8">$</text>
      <text x="84" y="37" textAnchor="middle" fontSize="8" fontWeight="700" fill="#b91c1c">i</text>
      <text x="60" y="15" textAnchor="middle" fontSize="8" fontWeight="700" fill="#0f172a">COI</text>
      <text x="60" y="61" textAnchor="middle" fontSize="7" fill="#64748b">declare / abstain</text>
    </svg>
  )
}

function AdAuctionSvg(p: SvgProps) {
  return (
    <svg viewBox={`0 0 ${W} ${H}`} {...p}>
      <rect x="10" y="10" width="100" height="50" rx="6" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="1.5" />
      <rect x="18" y="18" width="38" height="34" rx="4" fill="#dbeafe" stroke="#3b82f6" strokeWidth="1.5" />
      <text x="37" y="39" textAnchor="middle" fontSize="14" fill="#1d4ed8">Q</text>
      <path d="M64 46 L104 24" stroke="#16a34a" strokeWidth="2.5" fill="none" />
      <polygon points="104,24 98,24 101,29" fill="#16a34a" />
      <text x="75" y="24" fontSize="7" fill="#16a34a">bid</text>
      <text x="88" y="44" fontSize="9" fontWeight="700" fill="#0f766e">2nd price</text>
      <line x1="64" y1="50" x2="104" y2="50" stroke="#94a3b8" strokeWidth="1.2" strokeDasharray="3,2" />
    </svg>
  )
}

function SocialInfluenceSvg(p: SvgProps) {
  // Two groups: low social proof (amber) vs high social proof (blue)
  // Each shows a confidence bar — high group rates the statement higher
  return (
    <svg viewBox={`0 0 ${W} ${H}`} {...p}>
      {/* Title labels */}
      <text x="30" y="10" textAnchor="middle" fontSize="6.5" fill="#f59e0b" fontWeight="700">Low signal</text>
      <text x="90" y="10" textAnchor="middle" fontSize="6.5" fill="#3b82f6" fontWeight="700">High signal</text>

      {/* Social proof bubbles */}
      <rect x="10" y="13" width="38" height="11" rx="4" fill="#78350f20" stroke="#f59e0b" strokeWidth="1"/>
      <text x="29" y="21" textAnchor="middle" fontSize="7" fill="#f59e0b">18% agreed</text>

      <rect x="72" y="13" width="38" height="11" rx="4" fill="#1e3a8a20" stroke="#3b82f6" strokeWidth="1"/>
      <text x="91" y="21" textAnchor="middle" fontSize="7" fill="#3b82f6">82% agreed</text>

      {/* Connector arrows pointing down */}
      <line x1="29" y1="24" x2="29" y2="29" stroke="#94a3b8" strokeWidth="1"/>
      <polygon points="26,29 29,33 32,29" fill="#94a3b8"/>
      <line x1="91" y1="24" x2="91" y2="29" stroke="#94a3b8" strokeWidth="1"/>
      <polygon points="88,29 91,33 94,29" fill="#94a3b8"/>

      {/* Confidence bars background */}
      <rect x="10" y="34" width="38" height="7" rx="3" fill="#1e293b"/>
      <rect x="72" y="34" width="38" height="7" rx="3" fill="#1e293b"/>

      {/* Confidence fill — low group ~35%, high group ~72% */}
      <rect x="10" y="34" width="13" height="7" rx="3" fill="#f59e0b"/>
      <text x="29" y="48" textAnchor="middle" fontSize="7" fill="#f59e0b" fontWeight="700">35</text>

      <rect x="72" y="34" width="27" height="7" rx="3" fill="#3b82f6"/>
      <text x="91" y="48" textAnchor="middle" fontSize="7" fill="#3b82f6" fontWeight="700">72</text>

      {/* Delta arrow between groups */}
      <line x1="51" y1="37" x2="69" y2="37" stroke="#ef4444" strokeWidth="1.5"/>
      <polygon points="69,34 74,37 69,40" fill="#ef4444"/>
      <text x="60" y="33" textAnchor="middle" fontSize="7" fill="#ef4444" fontWeight="700">Δ37</text>

      {/* Bottom label */}
      <text x="60" y="58" textAnchor="middle" fontSize="6.5" fill="#94a3b8">same statement — different signal</text>
      <text x="60" y="67" textAnchor="middle" fontSize="7" fill="#7c3aed" fontStyle="italic">conformity bias</text>
    </svg>
  )
}

// ─── Registry ─────────────────────────────────────────────────────────────────

function DirectorDutiesSvg(p: SvgProps) {
  const cards = [
    { x: 24, breached: false },
    { x: 44, breached: true },
    { x: 64, breached: false },
    { x: 84, breached: true },
  ]
  return (
    <svg viewBox={`0 0 ${W} ${H}`} {...p}>
      <rect x="12" y="10" width="96" height="52" rx="6" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="1.5" />
      {cards.map((card, i) => (
        <g key={i}>
          <rect
            x={card.x - 7}
            y="16"
            width="14"
            height="14"
            rx="2"
            fill={card.breached ? '#fee2e2' : '#dcfce7'}
            stroke={card.breached ? '#ef4444' : '#22c55e'}
            strokeWidth="1"
          />
          <text
            x={card.x}
            y="26"
            textAnchor="middle"
            fontSize="6.5"
            fontWeight="700"
            fill={card.breached ? '#b91c1c' : '#15803d'}
          >
            {card.breached ? 'X' : 'OK'}
          </text>
        </g>
      ))}
      <line x1="18" y1="38" x2="102" y2="38" stroke="#94a3b8" strokeWidth="1.2" strokeDasharray="3,2" />
      <text x="20" y="50" fontSize="7" fill="#64748b">duty check</text>
      <text x="100" y="50" textAnchor="end" fontSize="8" fontWeight="700" fill="#0f172a">classify</text>
    </svg>
  )
}

function CryptoBubbleSvg(p: SvgProps) {
  // Parabolic price chart rising then crashing — the Minsky Moment
  const rise = [
    [10, 58], [20, 52], [32, 44], [44, 36], [56, 25], [66, 16], [74, 10],
  ] as [number, number][]
  const crash = [
    [74, 10], [80, 18], [86, 32], [92, 50], [100, 60],
  ] as [number, number][]
  const risePath = rise.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x},${y}`).join(' ')
  const crashPath = crash.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x},${y}`).join(' ')
  return (
    <svg viewBox={`0 0 ${W} ${H}`} {...p}>
      {/* Background */}
      <rect x="6" y="4" width="108" height="62" rx="5" fill="#0f0a1e" />
      {/* Grid lines */}
      <line x1="6" y1="60" x2="114" y2="60" stroke="#1e1b4b" strokeWidth="1"/>
      <line x1="10" y1="4" x2="10" y2="62" stroke="#1e1b4b" strokeWidth="1"/>
      {/* Rise — green */}
      <path d={risePath} fill="none" stroke="#22c55e" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
      {/* Crash — red */}
      <path d={crashPath} fill="none" stroke="#ef4444" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
      {/* Peak dot */}
      <circle cx="74" cy="10" r="3" fill="#facc15"/>
      {/* Minsky Moment label */}
      <rect x="55" y="2" width="38" height="10" rx="3" fill="#facc1520" stroke="#facc15" strokeWidth="0.8"/>
      <text x="74" y="9" textAnchor="middle" fontSize="6" fill="#facc15" fontWeight="700">⚡ Minsky</text>
      {/* Bot labels */}
      <text x="12" y="56" fontSize="5.5" fill="#a78bfa">Algo A</text>
      <text x="27" y="56" fontSize="5.5" fill="#a78bfa">Algo B</text>
      <text x="42" y="56" fontSize="5.5" fill="#a78bfa">Algo C</text>
      {/* FV line */}
      <line x1="10" y1="48" x2="104" y2="48" stroke="#64748b" strokeWidth="1" strokeDasharray="3,2"/>
      <text x="106" y="51" fontSize="5" fill="#64748b">FV</text>
      {/* Axis label */}
      <text x="60" y="69" textAnchor="middle" fontSize="6.5" fill="#7c3aed" fontStyle="italic">bubble &amp; crash</text>
    </svg>
  )
}

function XeroReconciliationSvg(p: SvgProps) {
  // Left: bank statement with a duplicate row highlighted; Right: GST return form
  return (
    <svg viewBox={`0 0 ${W} ${H}`} {...p}>
      {/* ── Bank statement card ── */}
      <rect x="3" y="3" width="57" height="64" rx="4" fill="#0B2238"/>
      {/* Teal header */}
      <rect x="3" y="3" width="57" height="13" rx="4" fill="#1EC0C0"/>
      <rect x="3" y="10" width="57" height="6" fill="#1EC0C0"/>
      <text x="6" y="12" fontSize="5" fill="white" fontWeight="700">ANZ Bank Statement</text>
      {/* Normal transaction rows */}
      {[0, 1, 2, 3, 5, 6].map(i => (
        <g key={i}>
          <rect x="7" y={20 + i * 7} width="36" height="4" rx="1" fill="#1A3A55"/>
          <rect x="47" y={20 + i * 7} width="10" height="4" rx="1" fill="#1A3A55"/>
        </g>
      ))}
      {/* Duplicate row (row 4) — highlighted red */}
      <rect x="5" y={20 + 4 * 7} width="53" height="5" rx="1" fill="#E55A2B22" stroke="#E55A2B" strokeWidth="0.6"/>
      <rect x="7" y={21 + 4 * 7} width="36" height="3" rx="1" fill="#E55A2B55"/>
      <rect x="47" y={21 + 4 * 7} width="10" height="3" rx="1" fill="#E55A2B88"/>
      <text x="6" y={25 + 4 * 7} fontSize="3.8" fill="#E55A2B" fontWeight="700">⚠ duplicate</text>
      {/* Reconcile tick at bottom */}
      <rect x="7" y="61" width="49" height="5" rx="2" fill="#1EC0C0"/>
      <text x="31" y="65" textAnchor="middle" fontSize="4.5" fill="white" fontWeight="700">Reconcile All ✓</text>

      {/* ── GST Return card ── */}
      <rect x="63" y="3" width="54" height="64" rx="4" fill="white" stroke="#CBD5E1" strokeWidth="0.8"/>
      {/* Navy header */}
      <rect x="63" y="3" width="54" height="12" rx="4" fill="#0B2238"/>
      <rect x="63" y="10" width="54" height="5" fill="#0B2238"/>
      <text x="90" y="11" textAnchor="middle" fontSize="5" fill="#1EC0C0" fontWeight="700">GST Return (NZ)</text>
      {/* Box 13 */}
      <rect x="66" y="18" width="48" height="13" rx="2" fill="#EFF6FF" stroke="#BAE6FD" strokeWidth="0.7"/>
      <text x="68" y="24" fontSize="4" fill="#0369A1" fontWeight="700">Box 13 — GST on Sales</text>
      <text x="68" y="30" fontSize="6" fill="#0B2238" fontWeight="800" fontFamily="monospace">$1,950</text>
      {/* Box 15 */}
      <rect x="66" y="34" width="48" height="13" rx="2" fill="#F0FFF4" stroke="#BBF7D0" strokeWidth="0.7"/>
      <text x="68" y="40" fontSize="4" fill="#166534" fontWeight="700">Box 15 — GST on Purchases</text>
      <text x="68" y="46" fontSize="6" fill="#0B2238" fontWeight="800" fontFamily="monospace">$708</text>
      {/* Box 20 — Net */}
      <rect x="66" y="50" width="48" height="14" rx="2" fill="#0B2238"/>
      <text x="68" y="56" fontSize="4" fill="#1EC0C0" fontWeight="700">Box 20 — Net GST ▶ IRD</text>
      <text x="68" y="62" fontSize="6.5" fill="white" fontWeight="800" fontFamily="monospace">$1,242</text>
    </svg>
  )
}

function CapitalStructureLabSvg(p: SvgProps) {
  return (
    <svg viewBox={`0 0 ${W} ${H}`} {...p}>
      <rect x="6" y="6" width="108" height="62" rx="7" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="1.2" />

      <rect x="12" y="12" width="48" height="22" rx="4" fill="#e0f2fe" stroke="#7dd3fc" strokeWidth="1" />
      <text x="16" y="20" fontSize="5.4" fill="#0369a1" fontWeight="700">Project Return</text>
      <text x="16" y="29" fontSize="9" fill="#0f172a" fontWeight="800">14.5%</text>

      <rect x="66" y="12" width="42" height="22" rx="4" fill="#fef9c3" stroke="#facc15" strokeWidth="1" />
      <text x="70" y="20" fontSize="5.4" fill="#a16207" fontWeight="700">WACC</text>
      <text x="70" y="29" fontSize="9" fill="#0f172a" fontWeight="800">9.2%</text>

      <line x1="12" y1="44" x2="108" y2="44" stroke="#94a3b8" strokeWidth="1.1" />

      <rect x="12" y="48" width="44" height="14" rx="3" fill="#dcfce7" stroke="#22c55e" strokeWidth="1" />
      <text x="16" y="57" fontSize="5.6" fill="#166534" fontWeight="700">Debt 45%</text>

      <rect x="60" y="48" width="48" height="14" rx="3" fill="#ede9fe" stroke="#8b5cf6" strokeWidth="1" />
      <text x="64" y="57" fontSize="5.6" fill="#5b21b6" fontWeight="700">Equity 55%</text>

      <path d="M58 26 L64 26 L64 40" fill="none" stroke="#0f172a" strokeWidth="1.3" />
      <polygon points="64,40 61,36 67,36" fill="#0f172a" />

      <text x="60" y="70" textAnchor="middle" fontSize="6.3" fill="#334155">capital structure</text>
    </svg>
  )
}

const SVG_MAP: Partial<Record<MiniGameTypeSlug, (p: SvgProps) => JSX.Element>> = {
  'bank-run': BankRunSvg,
  'credit-score': CreditScoreSvg,
  'prisoners-dilemma': PrisonersDilemmaSvg,
  'ultimatum': UltimatumSvg,
  'fishery': FisherySvg,
  'trust-game': TrustGameSvg,
  'public-goods': PublicGoodsSvg,
  'adverse-selection': AdverseSelectionSvg,
  'principal-agent': PrincipalAgentSvg,
  'double-auction': DoubleAuctionSvg,
  'matching-pennies': MatchingPenniesSvg,
  'cournot': CournotSvg,
  'bertrand': BertrandSvg,
  'english-auction': EnglishAuctionSvg,
  'beauty-contest': BeautyContestSvg,
  'monte-carlo-pi': MonteCarloPiSvg,
  'market-survival': MarketSurvivalSvg,
  'portfolio-frontier': PortfolioFrontierSvg,
  'signaling-game': SignalingSvg,
  'monopoly-pricing': MonopolyPricingSvg,
  'asset-bubble': AssetBubbleSvg,
  'market-basket': MarketBasketSvg,
  'ab-testing': ABTestingSvg,
  'customer-churn': CustomerChurnSvg,
  'conflict-of-interest': ConflictOfInterestSvg,
  'ad-auction': AdAuctionSvg,
  'director-duties': DirectorDutiesSvg,
  'social-influence': SocialInfluenceSvg,
  'crypto-bubble': CryptoBubbleSvg,
  'capital-structure-lab': CapitalStructureLabSvg,
  'xero-reconciliation': XeroReconciliationSvg,
}

export function MiniGameSvg({ type, className, style }: { type: MiniGameTypeSlug } & SvgProps) {
  const Svg = SVG_MAP[type]
  if (!Svg) return null
  return <Svg className={className} style={style} />
}
