/**
 * Game of Life — Scenario Illustrations
 * One animated SVG per round, keyed by scenarioId.
 * Colours use CSS custom props so they flip with light/dark theme.
 */

import type { ScenarioCategory } from '../engine/gameOfLifeScenarios'

// ─── Shared colour tokens ─────────────────────────────────────────────────────

const C = {
  accent:  'var(--gol-accent)',
  green:   'var(--gol-green)',
  amber:   'var(--gol-amber)',
  red:     'var(--gol-red)',
  purple:  'var(--gol-purple)',
  text:    'var(--gol-text)',
  muted:   'var(--gol-muted)',
  surface: 'var(--gol-surface)',
  border:  'var(--gol-border)',
}

// ─── Container wrapper ────────────────────────────────────────────────────────

function Svg({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <svg
      viewBox="0 0 280 150"
      width="100%"
      style={{ maxHeight: 150, display: 'block', overflow: 'visible', ...style }}
      aria-hidden
    >
      {children}
    </svg>
  )
}

// ─── Round 1 — Three Letters (Education fork) ─────────────────────────────────

function IllustrationR1() {
  return (
    <Svg>
      <style>{`
        .gol-env { animation: gol-fan 0.6s ease-out both; transform-origin: 140px 130px; }
        .gol-env-1 { animation-delay: 0s; }
        .gol-env-2 { animation-delay: 0.1s; }
        .gol-env-3 { animation-delay: 0.2s; }
        @keyframes gol-fan {
          from { opacity:0; transform: translateY(20px) scale(0.85); }
          to   { opacity:1; transform: translateY(0) scale(1); }
        }
        .gol-icon-float { animation: gol-float-y 3s ease-in-out infinite; }
        @keyframes gol-float-y {
          0%,100% { transform: translateY(0); }
          50%     { transform: translateY(-5px); }
        }
      `}</style>
      {/* Left envelope — trades */}
      <g className="gol-env gol-env-1" transform="translate(-35,-10) rotate(-15,140,130)">
        <rect x="60" y="60" width="80" height="55" rx="4" fill={C.surface} stroke={C.amber} strokeWidth="2.5"/>
        <polyline points="60,60 100,90 140,60" fill="none" stroke={C.amber} strokeWidth="2"/>
        {/* wrench icon */}
        <text x="100" y="100" textAnchor="middle" fontSize="22" fill={C.amber}>🔧</text>
      </g>
      {/* Centre envelope — university */}
      <g className="gol-env gol-env-2">
        <rect x="100" y="45" width="80" height="55" rx="4" fill={C.surface} stroke={C.accent} strokeWidth="2.5"/>
        <polyline points="100,45 140,75 180,45" fill="none" stroke={C.accent} strokeWidth="2"/>
        <text x="140" y="90" textAnchor="middle" fontSize="22" fill={C.accent}>🎓</text>
      </g>
      {/* Right envelope — work now */}
      <g className="gol-env gol-env-3" transform="translate(35,-10) rotate(15,140,130)">
        <rect x="140" y="60" width="80" height="55" rx="4" fill={C.surface} stroke={C.green} strokeWidth="2.5"/>
        <polyline points="140,60 180,90 220,60" fill="none" stroke={C.green} strokeWidth="2"/>
        <text x="180" y="100" textAnchor="middle" fontSize="22" fill={C.green}>💼</text>
      </g>
      {/* Question mark floating above */}
      <text className="gol-icon-float" x="140" y="35" textAnchor="middle" fontSize="26" fontWeight="900" fill={C.text} opacity="0.6">?</text>
    </Svg>
  )
}

// ─── Round 2 — The Bond Money (Housing / flatmates) ───────────────────────────

function IllustrationR2() {
  return (
    <Svg>
      <style>{`
        .gol-house-in { animation: gol-slide-up 0.5s ease-out both; }
        .gol-key-spin { animation: gol-float-y 2.5s ease-in-out infinite; }
        .gol-win-blink { animation: gol-blink 2s ease-in-out infinite; }
        @keyframes gol-slide-up {
          from { opacity:0; transform: translateY(25px); }
          to   { opacity:1; transform: translateY(0); }
        }
        @keyframes gol-blink {
          0%,40%,100% { opacity:1; }
          20%          { opacity:0.2; }
        }
      `}</style>
      <g className="gol-house-in">
        {/* House */}
        <polygon points="140,20 220,70 220,140 60,140 60,70" fill={C.surface} stroke={C.accent} strokeWidth="2.5"/>
        <polygon points="140,20 230,65 50,65" fill={C.accent} opacity="0.25"/>
        {/* Door */}
        <rect x="117" y="100" width="26" height="40" rx="3" fill={C.accent} opacity="0.5"/>
        {/* Windows */}
        <rect className="gol-win-blink" x="74" y="90" width="24" height="20" rx="3" fill={C.amber} opacity="0.8" style={{animationDelay:'0s'}}/>
        <rect className="gol-win-blink" x="74" y="90" width="24" height="20" rx="3" fill="none" stroke={C.amber} strokeWidth="1.5"/>
        <rect className="gol-win-blink" x="182" y="90" width="24" height="20" rx="3" fill={C.amber} opacity="0.8" style={{animationDelay:'0.8s'}}/>
        <rect className="gol-win-blink" x="182" y="90" width="24" height="20" rx="3" fill="none" stroke={C.amber} strokeWidth="1.5"/>
        {/* People */}
        <circle cx="86" cy="60" r="6" fill={C.text} opacity="0.5"/>
        <circle cx="140" cy="60" r="6" fill={C.text} opacity="0.5"/>
        <circle cx="194" cy="60" r="6" fill={C.text} opacity="0.5"/>
      </g>
      {/* Key */}
      <g className="gol-key-spin" transform="translate(228,30)">
        <circle cx="0" cy="0" r="10" fill="none" stroke={C.green} strokeWidth="2.5"/>
        <line x1="8" y1="0" x2="22" y2="0" stroke={C.green} strokeWidth="2.5"/>
        <line x1="18" y1="-4" x2="18" y2="0" stroke={C.green} strokeWidth="2"/>
        <line x1="22" y1="-4" x2="22" y2="0" stroke={C.green} strokeWidth="2"/>
      </g>
    </Svg>
  )
}

// ─── Round 3 — KiwiSaver (The compounding seed) ───────────────────────────────

function IllustrationR3() {
  return (
    <Svg>
      <style>{`
        .gol-plant-grow { animation: gol-plant 1s ease-out both; transform-origin: 140px 130px; }
        @keyframes gol-plant {
          from { transform: scaleY(0); opacity:0; }
          to   { transform: scaleY(1); opacity:1; }
        }
        .gol-coin-spin { animation: gol-coin 4s linear infinite; }
        @keyframes gol-coin {
          0%,100% { transform: rotateY(0deg); }
          50%     { transform: rotateY(180deg); }
        }
        .gol-bar-grow { animation: gol-bar-rise 0.8s ease-out both; transform-origin: bottom; }
      `}</style>
      {/* Ground */}
      <ellipse cx="140" cy="132" rx="70" ry="8" fill={C.green} opacity="0.15"/>
      {/* Trunk */}
      <rect className="gol-plant-grow" x="136" y="70" width="8" height="62" rx="4" fill={C.green} opacity="0.8" style={{animationDelay:'0.1s'}}/>
      {/* Left branch */}
      <path className="gol-plant-grow" d="M140 100 Q110 80 95 60" fill="none" stroke={C.green} strokeWidth="5" strokeLinecap="round" style={{animationDelay:'0.3s'}}/>
      {/* Right branch */}
      <path className="gol-plant-grow" d="M140 85 Q170 65 185 45" fill="none" stroke={C.green} strokeWidth="5" strokeLinecap="round" style={{animationDelay:'0.5s'}}/>
      {/* Leaves */}
      <circle className="gol-plant-grow" cx="95" cy="55" r="18" fill={C.green} opacity="0.7" style={{animationDelay:'0.4s'}}/>
      <circle className="gol-plant-grow" cx="185" cy="40" r="22" fill={C.green} opacity="0.7" style={{animationDelay:'0.6s'}}/>
      <circle className="gol-plant-grow" cx="140" cy="45" r="28" fill={C.green} opacity="0.5" style={{animationDelay:'0.7s'}}/>
      {/* Coin */}
      <g transform="translate(140,135)">
        <circle r="16" fill={C.amber} opacity="0.9"/>
        <text textAnchor="middle" y="5" fontSize="13" fontWeight="900" fill="#0f172a">$</text>
      </g>
      {/* % label */}
      <text x="72" y="30" fontSize="12" fontWeight="700" fill={C.accent} opacity="0.9">3% + 3%</text>
      <text x="72" y="44" fontSize="10" fill={C.muted}>KiwiSaver</text>
      {/* Year labels on branches */}
      <text x="80" y="50" fontSize="9" fill={C.green} fontWeight="700">Year 5</text>
      <text x="185" y="35" fontSize="9" fill={C.green} fontWeight="700">Year 20</text>
    </Svg>
  )
}

// ─── Round 4 — BNPL Trap ─────────────────────────────────────────────────────

function IllustrationR4() {
  return (
    <Svg>
      <style>{`
        .gol-chain-pulse { animation: gol-pulse-scale 1.5s ease-in-out infinite; }
        @keyframes gol-pulse-scale {
          0%,100% { transform: scale(1); }
          50%     { transform: scale(1.06); }
        }
        .gol-warn-flash { animation: gol-flash 1.2s ease-in-out infinite; }
        @keyframes gol-flash {
          0%,100% { opacity:1; }
          50%     { opacity:0.3; }
        }
        .gol-box-in { animation: gol-slide-up 0.4s ease-out both; }
      `}</style>
      {/* Cart */}
      <g transform="translate(40,40)">
        <path d="M10 10 L25 10 L35 55 L75 55 L85 25 L25 25" fill="none" stroke={C.muted} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
        <circle cx="42" cy="64" r="7" fill={C.muted}/>
        <circle cx="72" cy="64" r="7" fill={C.muted}/>
        <line x1="10" y1="10" x2="5" y2="0" stroke={C.muted} strokeWidth="2"/>
      </g>
      {/* 4 payment boxes */}
      {[0,1,2,3].map(i => (
        <g key={i} className="gol-box-in" style={{animationDelay:`${i*0.1}s`}} transform={`translate(${140 + i*34},55)`}>
          <rect x="0" y="0" width="28" height="36" rx="5" fill={i===0 ? C.red : C.surface} stroke={i===0 ? C.red : C.border} strokeWidth="2"/>
          <text textAnchor="middle" x="14" y="22" fontSize="13" fontWeight="800" fill={i===0 ? '#fff' : C.muted}>${[89,89,89,89][i]}</text>
        </g>
      ))}
      <text x="140" y="44" fontSize="11" fill={C.muted} textAnchor="start">4 easy payments of</text>
      {/* Warning */}
      <g className="gol-chain-pulse" transform="translate(140,105)">
        <polygon points="0,-22 20,10 -20,10" fill="none" stroke={C.red} strokeWidth="2.5"/>
        <text textAnchor="middle" y="6" fontSize="13" fontWeight="900" fill={C.red}>!</text>
      </g>
      <text className="gol-warn-flash" x="168" y="118" fontSize="11" fontWeight="700" fill={C.red}>Total: $356 + fees</text>
    </Svg>
  )
}

// ─── Round 5 — Career Offer ───────────────────────────────────────────────────

function IllustrationR5() {
  return (
    <Svg>
      <style>{`
        .gol-letter-open { animation: gol-open 0.6s ease-out both; transform-origin: 100px 120px; }
        @keyframes gol-open {
          from { transform: scaleY(0); opacity:0; }
          to   { transform: scaleY(1); opacity:1; }
        }
        .gol-arrow-rise { animation: gol-arrow-up 0.7s ease-out 0.4s both; }
        @keyframes gol-arrow-up {
          from { transform: translateY(30px); opacity:0; }
          to   { transform: translateY(0); opacity:1; }
        }
      `}</style>
      {/* Document */}
      <g className="gol-letter-open">
        <rect x="45" y="30" width="110" height="110" rx="8" fill={C.surface} stroke={C.accent} strokeWidth="2.5"/>
        <line x1="65" y1="60" x2="135" y2="60" stroke={C.border} strokeWidth="2"/>
        <line x1="65" y1="75" x2="135" y2="75" stroke={C.border} strokeWidth="2"/>
        <line x1="65" y1="90" x2="110" y2="90" stroke={C.border} strokeWidth="2"/>
        <text x="100" y="120" textAnchor="middle" fontSize="22">✍️</text>
        <rect x="55" y="40" width="90" height="14" rx="3" fill={C.accent} opacity="0.2"/>
        <text x="100" y="51" textAnchor="middle" fontSize="9" fontWeight="700" fill={C.accent}>OFFER LETTER</text>
      </g>
      {/* Rising arrow chart */}
      <g className="gol-arrow-rise">
        <polyline points="180,130 200,110 215,95 230,70 245,45" fill="none" stroke={C.green} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
        <polygon points="245,45 238,58 252,55" fill={C.green}/>
        {/* bars */}
        <rect x="178" y="110" width="12" height="20" rx="2" fill={C.green} opacity="0.3"/>
        <rect x="196" y="95" width="12" height="35" rx="2" fill={C.green} opacity="0.3"/>
        <rect x="214" y="75" width="12" height="55" rx="2" fill={C.green} opacity="0.3"/>
        <rect x="232" y="52" width="12" height="78" rx="2" fill={C.green} opacity="0.3"/>
      </g>
      <text x="213" y="140" fontSize="9" fill={C.green} fontWeight="700">Income ↑</text>
    </Svg>
  )
}

// ─── Round 6 — Health Habits (Balance scale) ─────────────────────────────────

function IllustrationR6() {
  return (
    <Svg>
      <style>{`
        .gol-scale-left { animation: gol-tilt-left 3s ease-in-out infinite; transform-origin: 140px 65px; }
        .gol-scale-right { animation: gol-tilt-right 3s ease-in-out infinite; transform-origin: 140px 65px; }
        @keyframes gol-tilt-left {
          0%,100% { transform: rotate(0deg); }
          50%     { transform: rotate(-8deg); }
        }
        @keyframes gol-tilt-right {
          0%,100% { transform: rotate(0deg); }
          50%     { transform: rotate(8deg); }
        }
      `}</style>
      {/* Pivot */}
      <line x1="140" y1="25" x2="140" y2="100" stroke={C.muted} strokeWidth="3"/>
      <circle cx="140" cy="65" r="6" fill={C.accent}/>
      {/* Beam */}
      <line x1="55" y1="65" x2="225" y2="65" stroke={C.text} strokeWidth="3" strokeLinecap="round"/>
      {/* Left pan — healthy */}
      <g className="gol-scale-left">
        <line x1="75" y1="65" x2="75" y2="90" stroke={C.muted} strokeWidth="2"/>
        <line x1="55" y1="90" x2="95" y2="90" stroke={C.green} strokeWidth="2.5" strokeLinecap="round"/>
        <text x="75" y="88" textAnchor="middle" fontSize="28">🏃</text>
        <text x="75" y="118" textAnchor="middle" fontSize="9" fill={C.green} fontWeight="700">Exercise</text>
        <text x="75" y="128" textAnchor="middle" fontSize="9" fill={C.green}>+ Sleep</text>
      </g>
      {/* Right pan — work */}
      <g className="gol-scale-right">
        <line x1="205" y1="65" x2="205" y2="90" stroke={C.muted} strokeWidth="2"/>
        <line x1="185" y1="90" x2="225" y2="90" stroke={C.red} strokeWidth="2.5" strokeLinecap="round"/>
        <text x="205" y="88" textAnchor="middle" fontSize="28">💻</text>
        <text x="205" y="118" textAnchor="middle" fontSize="9" fill={C.red} fontWeight="700">Overwork</text>
        <text x="205" y="128" textAnchor="middle" fontSize="9" fill={C.red}>+ Stress</text>
      </g>
      {/* Triangle base */}
      <polygon points="140,100 125,130 155,130" fill={C.text} opacity="0.25"/>
      <line x1="115" y1="130" x2="165" y2="130" stroke={C.text} strokeWidth="2.5" opacity="0.4"/>
    </Svg>
  )
}

// ─── Round 7 — Relationship Money (Chain of debt) ────────────────────────────

function IllustrationR7() {
  return (
    <Svg>
      <style>{`
        .gol-chain-link { animation: gol-chain-in 0.4s ease-out both; }
        .gol-debt-cloud { animation: gol-float-y 2.5s ease-in-out infinite; }
        @keyframes gol-chain-in {
          from { opacity:0; transform: scale(0.5); }
          to   { opacity:1; transform: scale(1); }
        }
      `}</style>
      {/* Person A */}
      <g>
        <circle cx="65" cy="55" r="20" fill={C.surface} stroke={C.accent} strokeWidth="2.5"/>
        <text textAnchor="middle" x="65" y="62" fontSize="20">😊</text>
        <rect x="45" y="78" width="40" height="30" rx="6" fill={C.surface} stroke={C.accent} strokeWidth="2"/>
        <line x1="65" y1="108" x2="65" y2="130" stroke={C.accent} strokeWidth="2"/>
        <line x1="50" y1="120" x2="80" y2="120" stroke={C.accent} strokeWidth="2"/>
      </g>
      {/* Chain links */}
      {[0,1,2,3].map(i => (
        <g key={i} className="gol-chain-link" style={{animationDelay:`${i*0.1}s`}} transform={`translate(${105+i*17},85)`}>
          <rect x="-8" y="-10" width="16" height="20" rx="4" fill="none" stroke={C.amber} strokeWidth="2.5"/>
        </g>
      ))}
      {/* Person B */}
      <g>
        <circle cx="215" cy="55" r="20" fill={C.surface} stroke={C.red} strokeWidth="2.5"/>
        <text textAnchor="middle" x="215" y="62" fontSize="20">😟</text>
        <rect x="195" y="78" width="40" height="30" rx="6" fill={C.surface} stroke={C.red} strokeWidth="2"/>
        <line x1="215" y1="108" x2="215" y2="130" stroke={C.red} strokeWidth="2"/>
        <line x1="200" y1="120" x2="230" y2="120" stroke={C.red} strokeWidth="2"/>
      </g>
      {/* Debt cloud over B */}
      <g className="gol-debt-cloud" transform="translate(215,20)">
        <ellipse cx="0" cy="-5" rx="28" ry="14" fill={C.red} opacity="0.2"/>
        <ellipse cx="-10" cy="-10" rx="14" ry="10" fill={C.red} opacity="0.2"/>
        <ellipse cx="12" cy="-8" rx="12" ry="8" fill={C.red} opacity="0.2"/>
        <text textAnchor="middle" y="-2" fontSize="11" fontWeight="800" fill={C.red}>$$$</text>
      </g>
      <text x="140" y="140" textAnchor="middle" fontSize="10" fill={C.amber} fontWeight="700">Shared finances = shared risk</text>
    </Svg>
  )
}

// ─── Round 8 — $2,200 by Friday (Crisis/car breakdown) ───────────────────────

function IllustrationR8() {
  return (
    <Svg>
      <style>{`
        .gol-clock-tick { animation: gol-tick 1s steps(1) infinite; }
        @keyframes gol-tick {
          0%   { transform: rotate(0deg); }
          25%  { transform: rotate(6deg); }
          50%  { transform: rotate(0deg); }
          75%  { transform: rotate(-6deg); }
          100% { transform: rotate(0deg); }
        }
        .gol-warn-flash { animation: gol-flash 0.9s ease-in-out infinite; }
        .gol-sparks { animation: gol-float-y 1.5s ease-in-out infinite alternate; }
      `}</style>
      {/* Car body */}
      <g transform="translate(20,55)">
        <rect x="10" y="30" width="155" height="50" rx="8" fill={C.surface} stroke={C.muted} strokeWidth="2.5"/>
        <path d="M20 30 L40 5 L130 5 L150 30" fill={C.surface} stroke={C.muted} strokeWidth="2.5"/>
        {/* Windows */}
        <rect x="45" y="10" width="35" height="20" rx="3" fill={C.accent} opacity="0.4"/>
        <rect x="88" y="10" width="35" height="20" rx="3" fill={C.accent} opacity="0.4"/>
        {/* Wheel left — flat */}
        <ellipse cx="42" cy="82" rx="22" ry="10" fill={C.text} opacity="0.3"/>
        <ellipse cx="42" cy="82" rx="22" ry="10" fill="none" stroke={C.red} strokeWidth="2.5"/>
        <text x="42" y="87" textAnchor="middle" fontSize="9" fill={C.red} fontWeight="700">FLAT</text>
        {/* Wheel right */}
        <ellipse cx="133" cy="82" rx="18" ry="18" fill={C.text} opacity="0.2"/>
        <ellipse cx="133" cy="82" rx="18" ry="18" fill="none" stroke={C.muted} strokeWidth="2"/>
      </g>
      {/* Warning triangle */}
      <g className="gol-warn-flash" transform="translate(5,85)">
        <polygon points="20,0 40,34 0,34" fill={C.amber} opacity="0.9"/>
        <text textAnchor="middle" x="20" y="28" fontSize="14" fontWeight="900" fill="#0f172a">!</text>
      </g>
      {/* Clock */}
      <g transform="translate(220,40)">
        <circle cx="0" cy="0" r="32" fill={C.surface} stroke={C.text} strokeWidth="2.5"/>
        <circle cx="0" cy="0" r="3" fill={C.red}/>
        {/* Hour hand pointing to 11 */}
        <line x1="0" y1="0" x2="-12" y2="-20" stroke={C.text} strokeWidth="3" strokeLinecap="round"/>
        {/* Minute hand — nearly at 12 */}
        <line x1="0" y1="0" x2="0" y2="-26" stroke={C.red} strokeWidth="2" strokeLinecap="round"/>
        <g className="gol-clock-tick" style={{transformOrigin:'0 0'}}>
          <line x1="0" y1="0" x2="22" y2="10" stroke={C.muted} strokeWidth="1.5" strokeLinecap="round"/>
        </g>
        <text x="0" y="48" textAnchor="middle" fontSize="10" fill={C.red} fontWeight="700">DEADLINE</text>
      </g>
      <text x="140" y="142" textAnchor="middle" fontSize="12" fontWeight="800" fill={C.red}>$2,200 by Friday</text>
    </Svg>
  )
}

// ─── Round 9 — The Deposit Math (Housing decision) ───────────────────────────

function IllustrationR9() {
  return (
    <Svg>
      <style>{`
        .gol-bar-rise { animation: gol-bar-grow-up 0.8s ease-out both; transform-origin: bottom; }
        @keyframes gol-bar-grow-up {
          from { transform: scaleY(0); }
          to   { transform: scaleY(1); }
        }
        .gol-key-bob { animation: gol-float-y 2s ease-in-out infinite; }
      `}</style>
      {/* House outline */}
      <g transform="translate(30,20)">
        <polygon points="90,10 160,60 160,120 20,120 20,60" fill={C.surface} stroke={C.accent} strokeWidth="2.5"/>
        <polygon points="90,10 170,55 10,55" fill={C.accent} opacity="0.3"/>
        <rect x="70" y="85" width="40" height="35" rx="3" fill={C.accent} opacity="0.5"/>
        <circle cx="105" cy="103" r="3" fill={C.surface}/>
        {/* Price tag */}
        <rect x="55" y="28" width="70" height="22" rx="4" fill={C.amber}/>
        <text x="90" y="43" textAnchor="middle" fontSize="11" fontWeight="900" fill="#0f172a">$780,000</text>
      </g>
      {/* Savings bars */}
      <g transform="translate(200,130)">
        {[{h:25,c:C.red,label:'5%',delay:'0s'},{h:50,c:C.amber,label:'10%',delay:'0.1s'},{h:100,c:C.green,label:'20%',delay:'0.2s'}].map((b,i) => (
          <g key={i} transform={`translate(${i*28-28},0)`}>
            <rect className="gol-bar-rise" x="-10" y={-b.h} width="20" height={b.h} rx="3" fill={b.c} opacity="0.8" style={{animationDelay:b.delay}}/>
            <text x="0" y="12" textAnchor="middle" fontSize="8" fill={b.c} fontWeight="700">{b.label}</text>
          </g>
        ))}
        <text x="-28" y="-108" fontSize="9" fill={C.muted}>Deposit</text>
        <line x1="-42" y1="-100" x2="-42" y2="0" stroke={C.border} strokeWidth="1.5"/>
      </g>
      {/* Keys */}
      <g className="gol-key-bob" transform="translate(248,55)">
        <circle cx="0" cy="0" r="10" fill="none" stroke={C.green} strokeWidth="2.5"/>
        <line x1="8" y1="0" x2="24" y2="0" stroke={C.green} strokeWidth="2.5"/>
        <line x1="20" y1="-4" x2="20" y2="0" stroke={C.green} strokeWidth="2"/>
        <line x1="24" y1="-4" x2="24" y2="0" stroke={C.green} strokeWidth="2"/>
        <text x="-2" y="4" textAnchor="middle" fontSize="8" fill={C.green}>🏠</text>
      </g>
    </Svg>
  )
}

// ─── Round 10 — The Auckland Offer (Career/city move) ────────────────────────

function IllustrationR10() {
  return (
    <Svg>
      <style>{`
        .gol-dot-pulse { animation: gol-pulse-dot 1.5s ease-in-out infinite; }
        @keyframes gol-pulse-dot {
          0%,100% { r: 7; opacity: 0.9; }
          50%     { r: 12; opacity: 0.4; }
        }
        .gol-arrow-in { animation: gol-slide-up 0.5s ease-out 0.4s both; }
      `}</style>
      {/* NZ silhouette (simplified) — North Island */}
      <path d="M155,20 C165,22 175,35 178,50 C182,65 175,80 168,90 C160,100 148,108 140,115 C132,122 124,128 118,132 C110,137 100,138 95,135 C88,130 86,120 88,110 C91,98 100,90 108,80 C116,70 120,58 118,45 C116,32 125,18 135,16 Z"
        fill="none" stroke={C.border} strokeWidth="2" opacity="0.6"/>
      {/* South Island */}
      <path d="M100,140 C90,138 80,132 74,124 C68,116 66,104 70,94 C74,84 84,78 92,80 C100,82 106,90 108,100 C110,110 108,122 104,132 Z"
        fill="none" stroke={C.border} strokeWidth="2" opacity="0.6"/>
      {/* Auckland dot */}
      <circle className="gol-dot-pulse" cx="155" cy="42" r="7" fill={C.accent}/>
      <text x="165" y="40" fontSize="9" fill={C.accent} fontWeight="700">Auckland</text>
      {/* Hamilton dot */}
      <circle cx="145" cy="68" r="4" fill={C.muted}/>
      <text x="152" y="72" fontSize="8" fill={C.muted}>You</text>
      {/* Arrow from Hamilton to Auckland */}
      <g className="gol-arrow-in">
        <line x1="147" y1="64" x2="152" y2="48" stroke={C.green} strokeWidth="2.5" strokeDasharray="5,3" strokeLinecap="round"/>
        <polygon points="152,46 148,54 156,52" fill={C.green}/>
      </g>
      {/* $ salary badge */}
      <g transform="translate(208,70)">
        <rect x="-32" y="-14" width="64" height="26" rx="6" fill={C.green} opacity="0.15" stroke={C.green} strokeWidth="1.5"/>
        <text textAnchor="middle" y="4" fontSize="11" fontWeight="800" fill={C.green}>+$28k salary</text>
      </g>
      <g transform="translate(208,100)">
        <rect x="-32" y="-14" width="64" height="26" rx="6" fill={C.red} opacity="0.1" stroke={C.red} strokeWidth="1.5"/>
        <text textAnchor="middle" y="4" fontSize="10" fontWeight="700" fill={C.red}>+$800/mo rent</text>
      </g>
      <text x="208" y="128" textAnchor="middle" fontSize="9" fill={C.muted}>Worth the move?</text>
    </Svg>
  )
}

// ─── Round 11 — The Timing Question (Family) ─────────────────────────────────

function IllustrationR11() {
  return (
    <Svg>
      <style>{`
        .gol-clock-hands { animation: gol-clock-spin 8s linear infinite; transform-origin: 140px 65px; }
        @keyframes gol-clock-spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        .gol-baby-bounce { animation: gol-float-y 2s ease-in-out infinite; }
      `}</style>
      {/* Clock */}
      <circle cx="140" cy="65" r="60" fill={C.surface} stroke={C.text} strokeWidth="2.5"/>
      {/* Hour ticks */}
      {[0,1,2,3,4,5,6,7,8,9,10,11].map(i => {
        const a = (i*30-90) * Math.PI/180
        return <line key={i} x1={140+50*Math.cos(a)} y1={65+50*Math.sin(a)} x2={140+57*Math.cos(a)} y2={65+57*Math.sin(a)} stroke={C.muted} strokeWidth={i%3===0?2:1}/>
      })}
      {/* Calendar dates inside clock */}
      {['25','26','27','28','29','30'].map((d,i) => (
        <text key={i} x={115+i*10} y="72" textAnchor="middle" fontSize="7" fill={i===2?C.accent:C.muted} fontWeight={i===2?'800':'400'}>{d}</text>
      ))}
      {/* Clock hands */}
      <g className="gol-clock-hands">
        <line x1="140" y1="65" x2="140" y2="20" stroke={C.text} strokeWidth="3" strokeLinecap="round"/>
        <line x1="140" y1="65" x2="175" y2="75" stroke={C.red} strokeWidth="2" strokeLinecap="round"/>
      </g>
      <circle cx="140" cy="65" r="4" fill={C.accent}/>
      {/* Baby emoji bouncing at bottom */}
      <g className="gol-baby-bounce">
        <text x="85" y="148" fontSize="26">👶</text>
        <text x="140" y="148" textAnchor="middle" fontSize="10" fill={C.muted}>Now? Or later?</text>
        <text x="195" y="148" fontSize="26">⏳</text>
      </g>
    </Svg>
  )
}

// ─── Round 12 — The Phone Call (Family care) ─────────────────────────────────

function IllustrationR12() {
  return (
    <Svg>
      <style>{`
        .gol-ring { animation: gol-ring-anim 0.8s ease-in-out infinite; transform-origin: 90px 75px; }
        @keyframes gol-ring-anim {
          0%,100% { transform: rotate(-8deg); }
          50%     { transform: rotate(8deg); }
        }
        .gol-bubble-in { animation: gol-bubble-pop 0.4s ease-out both; transform-origin: bottom left; }
        @keyframes gol-bubble-pop {
          from { transform: scale(0); opacity:0; }
          to   { transform: scale(1); opacity:1; }
        }
      `}</style>
      {/* Phone */}
      <g className="gol-ring">
        <rect x="60" y="30" width="60" height="90" rx="12" fill={C.surface} stroke={C.accent} strokeWidth="2.5"/>
        <rect x="68" y="42" width="44" height="56" rx="4" fill={C.accent} opacity="0.15"/>
        <text x="90" y="75" textAnchor="middle" fontSize="26">🧑‍🦳</text>
        <circle cx="90" cy="108" r="6" fill={C.accent} opacity="0.5"/>
        <line x1="78" y1="37" x2="102" y2="37" stroke={C.muted} strokeWidth="2" strokeLinecap="round"/>
      </g>
      {/* Speech bubbles */}
      <g className="gol-bubble-in" style={{animationDelay:'0.3s'}}>
        <rect x="130" y="35" width="110" height="44" rx="10" fill={C.surface} stroke={C.border} strokeWidth="2"/>
        <polygon points="130,55 118,60 130,65" fill={C.surface} stroke={C.border} strokeWidth="1.5"/>
        <text x="185" y="53" textAnchor="middle" fontSize="10" fill={C.text}>Mum's in hospital…</text>
        <text x="185" y="68" textAnchor="middle" fontSize="10" fill={C.muted}>Can you help?</text>
      </g>
      <g className="gol-bubble-in" style={{animationDelay:'0.6s'}}>
        <rect x="130" y="92" width="110" height="44" rx="10" fill={C.accent} opacity="0.15" stroke={C.accent} strokeWidth="1.5"/>
        <polygon points="130,110 118,115 130,120" fill={C.accent} opacity="0.15" stroke={C.accent} strokeWidth="1.5"/>
        <text x="185" y="110" textAnchor="middle" fontSize="10" fill={C.text}>Take unpaid leave?</text>
        <text x="185" y="125" textAnchor="middle" fontSize="10" fill={C.muted}>Hire carer? Split costs?</text>
      </g>
    </Svg>
  )
}

// ─── Round 13 — The $50,000 Question (Investment) ────────────────────────────

function IllustrationR13() {
  return (
    <Svg>
      <style>{`
        .gol-line-draw { animation: gol-draw-line 1.2s ease-out both; stroke-dasharray: 200; stroke-dashoffset: 200; }
        @keyframes gol-draw-line {
          to { stroke-dashoffset: 0; }
        }
        .gol-crypto-flash { animation: gol-flash 1.5s ease-in-out infinite; }
      `}</style>
      {/* Axes */}
      <line x1="40" y1="20" x2="40" y2="130" stroke={C.border} strokeWidth="1.5"/>
      <line x1="40" y1="130" x2="265" y2="130" stroke={C.border} strokeWidth="1.5"/>
      <text x="40" y="15" fontSize="9" fill={C.muted}>$</text>
      <text x="268" y="134" fontSize="9" fill={C.muted}>Time</text>
      {/* Index funds — steady rise */}
      <polyline className="gol-line-draw" points="40,120 80,108 120,95 160,80 200,65 240,48" fill="none" stroke={C.green} strokeWidth="2.5" strokeLinecap="round" style={{animationDelay:'0s'}}/>
      {/* Crypto — spike then crash */}
      <polyline className="gol-line-draw" points="40,120 80,100 120,40 140,20 160,70 200,105 240,115" fill="none" stroke={C.red} strokeWidth="2.5" strokeLinecap="round" strokeDasharray="200" style={{animationDelay:'0.3s'}}/>
      {/* Bank — flat */}
      <polyline className="gol-line-draw" points="40,120 240,118" fill="none" stroke={C.muted} strokeWidth="2" strokeLinecap="round" strokeDasharray="200" style={{animationDelay:'0.1s'}}/>
      {/* Labels */}
      <text x="245" y="44" fontSize="9" fill={C.green} fontWeight="700">Index Funds</text>
      <g className="gol-crypto-flash">
        <text x="245" y="113" fontSize="9" fill={C.red} fontWeight="700">₿ Crypto</text>
      </g>
      <text x="245" y="122" fontSize="9" fill={C.muted}>Bank</text>
      {/* $50k badge */}
      <rect x="48" y="22" width="62" height="20" rx="5" fill={C.amber}/>
      <text x="79" y="35" textAnchor="middle" fontSize="11" fontWeight="900" fill="#0f172a">$50,000</text>
      <text x="79" y="52" textAnchor="middle" fontSize="9" fill={C.muted}>to invest</text>
    </Svg>
  )
}

// ─── Round 14 — Burnout (The Body Keeps the Score) ───────────────────────────

function IllustrationR14() {
  return (
    <Svg>
      <style>{`
        .gol-battery-drain { animation: gol-battery-empty 3s ease-out both; }
        @keyframes gol-battery-empty {
          from { width: 52px; }
          to   { width: 8px; }
        }
        .gol-zzz { animation: gol-zzz-float 2s ease-in-out infinite; }
        @keyframes gol-zzz-float {
          from { transform: translate(0,0) scale(0.8); opacity:0.4; }
          to   { transform: translate(20px,-30px) scale(1.2); opacity:0; }
        }
        .gol-slump { animation: gol-slide-up 0.6s ease-out both; }
      `}</style>
      {/* Desk */}
      <rect x="30" y="110" width="220" height="10" rx="3" fill={C.muted} opacity="0.4"/>
      {/* Person slumped */}
      <g className="gol-slump">
        <circle cx="110" cy="82" r="22" fill={C.surface} stroke={C.muted} strokeWidth="2"/>
        <text x="110" y="90" textAnchor="middle" fontSize="22">😩</text>
        {/* Arm on desk */}
        <path d="M95 100 Q80 108 60 110" fill="none" stroke={C.muted} strokeWidth="3" strokeLinecap="round"/>
        <path d="M125 100 Q145 108 170 110" fill="none" stroke={C.muted} strokeWidth="3" strokeLinecap="round"/>
        <rect x="100" y="110" width="20" height="8" rx="4" fill={C.muted} opacity="0.5"/>
      </g>
      {/* Laptop */}
      <rect x="155" y="90" width="70" height="20" rx="3" fill={C.surface} stroke={C.border} strokeWidth="2"/>
      <rect x="145" y="110" width="90" height="5" rx="2" fill={C.muted} opacity="0.5"/>
      <rect x="162" y="93" width="56" height="14" rx="2" fill={C.red} opacity="0.2"/>
      <text x="190" y="104" textAnchor="middle" fontSize="9" fill={C.red}>DEADLINE</text>
      {/* Battery */}
      <g transform="translate(195,50)">
        <rect x="-30" y="-16" width="60" height="30" rx="5" fill="none" stroke={C.text} strokeWidth="2.5"/>
        <rect x="30" y="-7" width="6" height="14" rx="2" fill={C.text} opacity="0.5"/>
        <rect className="gol-battery-drain" x="-27" y="-13" width="8" height="24" rx="3" fill={C.red}/>
        <text x="0" y="6" textAnchor="middle" fontSize="9" fill={C.red} fontWeight="700">5%</text>
      </g>
      {/* ZZZ bubbles */}
      {['Z','Z','Z'].map((z,i) => (
        <text key={i} className="gol-zzz" x={125} y={80-i*8} fontSize={10+i*4} fill={C.muted} fontWeight="700" style={{animationDelay:`${i*0.6}s`}}>{z}</text>
      ))}
    </Svg>
  )
}

// ─── Round 15 — The Scan Results (Health reckoning) ──────────────────────────

function IllustrationR15() {
  return (
    <Svg>
      <style>{`
        .gol-scan-line { animation: gol-scan 2s ease-in-out infinite; }
        @keyframes gol-scan {
          0%,100% { transform: translateY(0); }
          50%     { transform: translateY(60px); }
        }
        .gol-cross-in { animation: gol-slide-up 0.5s ease-out both; }
        .gol-option-in { animation: gol-slide-up 0.4s ease-out both; }
      `}</style>
      {/* Medical scan board */}
      <rect x="30" y="20" width="120" height="120" rx="8" fill="#0a0a0a" stroke={C.accent} strokeWidth="2"/>
      {/* Scan lines */}
      <g clipPath="url(#gol-scan-clip)">
        <clipPath id="gol-scan-clip">
          <rect x="30" y="20" width="120" height="120"/>
        </clipPath>
        {/* Body silhouette (simplified) */}
        <ellipse cx="90" cy="55" rx="18" ry="20" fill="none" stroke={C.accent} strokeWidth="1" opacity="0.5"/>
        <path d="M72 75 Q90 125 108 75" fill="none" stroke={C.accent} strokeWidth="1" opacity="0.5"/>
        {/* Scan line */}
        <line className="gol-scan-line" x1="30" y1="25" x2="150" y2="25" stroke={C.green} strokeWidth="2" opacity="0.7"/>
      </g>
      {/* Medical cross */}
      <g className="gol-cross-in" transform="translate(200,55)" style={{animationDelay:'0.2s'}}>
        <rect x="-18" y="-5" width="36" height="10" rx="3" fill={C.red}/>
        <rect x="-5" y="-18" width="10" height="36" rx="3" fill={C.red}/>
      </g>
      {/* Options */}
      <g className="gol-option-in" transform="translate(168,95)" style={{animationDelay:'0.3s'}}>
        <rect x="0" y="0" width="90" height="22" rx="5" fill={C.green} opacity="0.15" stroke={C.green} strokeWidth="1.5"/>
        <text x="45" y="15" textAnchor="middle" fontSize="10" fill={C.green} fontWeight="700">Full treatment</text>
      </g>
      <g className="gol-option-in" transform="translate(168,122)" style={{animationDelay:'0.4s'}}>
        <rect x="0" y="0" width="90" height="22" rx="5" fill={C.amber} opacity="0.15" stroke={C.amber} strokeWidth="1.5"/>
        <text x="45" y="15" textAnchor="middle" fontSize="10" fill={C.amber} fontWeight="700">Lifestyle change</text>
      </g>
      <text x="90" y="152" textAnchor="middle" fontSize="9" fill={C.muted}>Prevention vs. reaction</text>
    </Svg>
  )
}

// ─── Round 16 — The Inheritance (Opportunity) ────────────────────────────────

function IllustrationR16() {
  return (
    <Svg>
      <style>{`
        .gol-sparkle { animation: gol-sparkle-anim 1.5s ease-in-out infinite; }
        @keyframes gol-sparkle-anim {
          0%,100% { opacity: 1; transform: scale(1); }
          50%     { opacity: 0.2; transform: scale(0.5); }
        }
        .gol-gift-in { animation: gol-slide-up 0.6s ease-out both; }
        .gol-path-in { animation: gol-draw-path 0.8s ease-out 0.5s both; stroke-dasharray:120; stroke-dashoffset:120; }
        @keyframes gol-draw-path { to { stroke-dashoffset:0; } }
      `}</style>
      {/* Gift box */}
      <g className="gol-gift-in">
        <rect x="70" y="65" width="80" height="70" rx="6" fill={C.surface} stroke={C.amber} strokeWidth="2.5"/>
        <rect x="70" y="55" width="80" height="20" rx="4" fill={C.amber} opacity="0.8"/>
        <line x1="110" y1="55" x2="110" y2="135" stroke={C.surface} strokeWidth="3"/>
        <line x1="70" y1="65" x2="150" y2="65" stroke={C.surface} strokeWidth="3"/>
        {/* Ribbon bow */}
        <path d="M95 55 Q110 35 125 55" fill="none" stroke={C.amber} strokeWidth="3" strokeLinecap="round"/>
        <path d="M110 35 Q90 25 88 40" fill="none" stroke={C.amber} strokeWidth="2.5" strokeLinecap="round"/>
        <path d="M110 35 Q130 25 132 40" fill="none" stroke={C.amber} strokeWidth="2.5" strokeLinecap="round"/>
      </g>
      {/* Sparkles */}
      {[[50,40,0],[155,35,0.3],[165,80,0.6],[45,90,0.9]].map(([x,y,d],i) => (
        <text key={i} className="gol-sparkle" x={x} y={y} fontSize="16" style={{animationDelay:`${d}s`}}>✨</text>
      ))}
      {/* Decision paths */}
      <g className="gol-path-in" transform="translate(150,100)">
        <line x1="0" y1="0" x2="30" y2="-30" stroke={C.green} strokeWidth="2" strokeLinecap="round"/>
        <line x1="0" y1="0" x2="30" y2="0" stroke={C.accent} strokeWidth="2" strokeLinecap="round"/>
        <line x1="0" y1="0" x2="30" y2="30" stroke={C.purple} strokeWidth="2" strokeLinecap="round"/>
      </g>
      <text x="185" y="72" fontSize="8" fill={C.green}>Pay mortgage</text>
      <text x="185" y="103" fontSize="8" fill={C.accent}>Give to kids</text>
      <text x="185" y="134" fontSize="8" fill={C.purple}>Experience</text>
      {/* Amount */}
      <text x="110" y="110" textAnchor="middle" fontSize="12" fontWeight="800" fill={C.amber}>$85,000</text>
    </Svg>
  )
}

// ─── Round 17 — The Final Push (Pre-retirement) ───────────────────────────────

function IllustrationR17() {
  return (
    <Svg>
      <style>{`
        .gol-sun-rise { animation: gol-sun-up 1.5s ease-out both; }
        @keyframes gol-sun-up {
          from { transform: translateY(30px); opacity:0; }
          to   { transform: translateY(0); opacity:1; }
        }
        .gol-figure-climb { animation: gol-slide-up 0.7s ease-out 0.5s both; }
        .gol-ray { animation: gol-ray-spin 8s linear infinite; transform-origin: 140px 80px; }
        @keyframes gol-ray-spin { to { transform: rotate(360deg); } }
      `}</style>
      {/* Mountain */}
      <polygon points="140,15 40,145 240,145" fill={C.surface} stroke={C.text} strokeWidth="2.5"/>
      <polygon points="140,15 95,90 185,90" fill={C.accent} opacity="0.12"/>
      {/* Snow cap */}
      <polygon points="140,15 120,50 160,50" fill={C.accent} opacity="0.3"/>
      {/* Sun rising behind mountain */}
      <g className="gol-sun-rise">
        <g className="gol-ray">
          {[0,45,90,135,180,225,270,315].map(angle => {
            const r = Math.PI * angle / 180
            return <line key={angle} x1={140+40*Math.cos(r)} y1={80+40*Math.sin(r)} x2={140+54*Math.cos(r)} y2={80+54*Math.sin(r)} stroke={C.amber} strokeWidth="2" opacity="0.6"/>
          })}
        </g>
        <circle cx="140" cy="80" r="36" fill={C.amber} opacity="0.25"/>
        <circle cx="140" cy="80" r="28" fill={C.amber} opacity="0.8"/>
      </g>
      {/* Mountain re-drawn on top of sun */}
      <polygon points="140,15 40,145 240,145" fill="none" stroke={C.text} strokeWidth="2.5"/>
      {/* Climber at peak */}
      <g className="gol-figure-climb" transform="translate(140,22)">
        <circle cx="0" cy="-10" r="6" fill={C.text}/>
        <line x1="0" y1="-4" x2="0" y2="6" stroke={C.text} strokeWidth="2.5"/>
        <line x1="0" y1="0" x2="-6" y2="4" stroke={C.text} strokeWidth="2"/>
        <line x1="0" y1="0" x2="8" y2="2" stroke={C.text} strokeWidth="2"/>
        <line x1="0" y1="6" x2="-4" y2="14" stroke={C.text} strokeWidth="2"/>
        <line x1="0" y1="6" x2="4" y2="14" stroke={C.text} strokeWidth="2"/>
      </g>
      <text x="140" y="143" textAnchor="middle" fontSize="9" fill={C.muted}>Age 60 — one final push</text>
    </Svg>
  )
}

// ─── Round 18 — You've Arrived (Retirement reveal) ───────────────────────────

function IllustrationR18() {
  return (
    <Svg>
      <style>{`
        .gol-bird { animation: gol-bird-fly 4s ease-in-out infinite; }
        @keyframes gol-bird-fly {
          0%,100% { transform: translate(0,0); }
          50%     { transform: translate(20px,-15px); }
        }
        .gol-sun-glow { animation: gol-glow-pulse 3s ease-in-out infinite; }
        @keyframes gol-glow-pulse {
          0%,100% { opacity:0.7; r:30; }
          50%     { opacity:1; r:34; }
        }
        .gol-tree-sway { animation: gol-sway 4s ease-in-out infinite; transform-origin: 200px 120px; }
        @keyframes gol-sway {
          0%,100% { transform: rotate(0deg); }
          50%     { transform: rotate(3deg); }
        }
      `}</style>
      {/* Sky gradient */}
      <defs>
        <linearGradient id="gol-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={C.accent} stopOpacity="0.18"/>
          <stop offset="100%" stopColor={C.surface} stopOpacity="0"/>
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="280" height="150" fill="url(#gol-sky)"/>
      {/* Ground */}
      <ellipse cx="140" cy="138" rx="130" ry="15" fill={C.green} opacity="0.2"/>
      <line x1="10" y1="130" x2="270" y2="130" stroke={C.green} strokeWidth="2" opacity="0.4"/>
      {/* Sun */}
      <circle className="gol-sun-glow" cx="55" cy="35" r="30" fill={C.amber} opacity="0.7"/>
      {[0,45,90,135,180,225,270,315].map(a => {
        const r = Math.PI * a / 180
        return <line key={a} x1={55+33*Math.cos(r)} y1={35+33*Math.sin(r)} x2={55+42*Math.cos(r)} y2={35+42*Math.sin(r)} stroke={C.amber} strokeWidth="1.5" opacity="0.5"/>
      })}
      {/* House */}
      <g transform="translate(60,70)">
        <polygon points="55,0 100,35 100,80 10,80 10,35" fill={C.surface} stroke={C.accent} strokeWidth="2"/>
        <polygon points="55,0 105,30 5,30" fill={C.accent} opacity="0.4"/>
        <rect x="35" y="50" width="20" height="30" rx="2" fill={C.accent} opacity="0.6"/>
        <rect x="15" y="40" width="14" height="14" rx="2" fill={C.amber} opacity="0.6"/>
        <rect x="71" y="40" width="14" height="14" rx="2" fill={C.amber} opacity="0.6"/>
      </g>
      {/* Tree */}
      <g className="gol-tree-sway">
        <rect x="196" y="95" width="8" height="35" fill={C.green} opacity="0.5"/>
        <circle cx="200" cy="75" r="25" fill={C.green} opacity="0.6"/>
        <circle cx="185" cy="85" r="15" fill={C.green} opacity="0.5"/>
        <circle cx="215" cy="85" r="15" fill={C.green} opacity="0.5"/>
      </g>
      {/* Birds */}
      {[[100,25,0],[118,18,0.5],[135,28,1]].map(([x,y,d],i) => (
        <g key={i} className="gol-bird" style={{animationDelay:`${d}s`}} transform={`translate(${x},${y})`}>
          <path d="M-8,0 Q0,-6 8,0" fill="none" stroke={C.text} strokeWidth="1.5" opacity="0.6"/>
        </g>
      ))}
      {/* Congrats banner */}
      <rect x="150" y="90" width="110" height="30" rx="8" fill={C.accent} opacity="0.9"/>
      <text x="205" y="110" textAnchor="middle" fontSize="11" fontWeight="900" fill="#fff">🎉 Age 65!</text>
    </Svg>
  )
}

// ─── Fallback by category ─────────────────────────────────────────────────────

function IllustrationFallback({ category }: { category: ScenarioCategory }) {
  const icon: Record<ScenarioCategory, string> = {
    education: '🎓', career: '📈', housing: '🏡', health: '🏥',
    money: '💰', relationships: '💑', crisis: '⚡', opportunity: '✨',
    family: '👨‍👩‍👧', retirement: '🌅',
  }
  return (
    <Svg>
      <style>{`.gol-fallback-icon { animation: gol-float-y 3s ease-in-out infinite; }`}</style>
      <text className="gol-fallback-icon" x="140" y="90" textAnchor="middle" fontSize="64">{icon[category] ?? '🎮'}</text>
    </Svg>
  )
}

// ─── Global keyframes (injected once) ────────────────────────────────────────

const GLOBAL_KEYFRAMES = `
  @keyframes gol-float-y {
    0%,100% { transform: translateY(0); }
    50%     { transform: translateY(-6px); }
  }
  @keyframes gol-flash {
    0%,100% { opacity:1; }
    50%     { opacity:0.25; }
  }
  @keyframes gol-slide-up {
    from { opacity:0; transform: translateY(18px); }
    to   { opacity:1; transform: translateY(0); }
  }
`

// ─── Public API ───────────────────────────────────────────────────────────────

const ILLUSTRATIONS: Record<string, () => JSX.Element> = {
  'the-fork':             IllustrationR1,
  'leaving-home':         IllustrationR2,
  'kiwisaver-moment':     IllustrationR3,
  'bnpl-trap':            IllustrationR4,
  'career-crossroads-1':  IllustrationR5,
  'health-habits':        IllustrationR6,
  'relationship-money':   IllustrationR7,
  'emergency-fund-test':  IllustrationR8,
  'housing-decision':     IllustrationR9,
  'career-peak':          IllustrationR10,
  'family-timing':        IllustrationR11,
  'parent-in-need':       IllustrationR12,
  'investment-decision':  IllustrationR13,
  'burnout':              IllustrationR14,
  'health-reckoning':     IllustrationR15,
  'inheritance':          IllustrationR16,
  'pre-retirement':       IllustrationR17,
  'retirement-reveal':    IllustrationR18,
}

export function ScenarioIllustration({
  scenarioId,
  category,
}: {
  scenarioId: string
  category: ScenarioCategory
}) {
  const IllComp = ILLUSTRATIONS[scenarioId]
  return (
    <>
      <style>{GLOBAL_KEYFRAMES}</style>
      {IllComp ? <IllComp /> : <IllustrationFallback category={category} />}
    </>
  )
}
