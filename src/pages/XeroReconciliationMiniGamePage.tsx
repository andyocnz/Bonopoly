import { QRCodeSVG } from 'qrcode.react'
import React, { useState, useMemo, useEffect } from 'react'
import { MiniGameShell } from '../features/minigames/MiniGameShell'
import { getEducatorSessionCached } from '../features/minigames/educatorSession'
import { educatorMiniGamesApi } from '../features/minigames/api'

// ─── Xero brand colours ───────────────────────────────────────────────────────
const X_NAVY   = '#1C3A5A'
const X_NAV_BG = '#0078C8'
const X_TEAL  = '#1EC0C0'
const X_BLUE  = '#0078C8'
const X_GREEN = '#2FA84F'
const X_RED   = '#D0021B'
const X_BG    = '#F5F5F5'
const X_BORDER = '#D8D8D8'

// ─── Chart of accounts (NZ Xero defaults) ────────────────────────────────────
type AccountGroup = 'Revenue' | 'Cost of Goods Sold' | 'Expenses' | 'Payroll'

type AccountOption = {
  code: string
  label: string
  group: AccountGroup
  taxDisplay: string
  hasGST: boolean
}

// NZ Xero default chart of accounts — specific codes, NOT a catch-all
const ACCOUNT_OPTIONS: AccountOption[] = [
  // ── Revenue ──────────────────────────────────────────────────────────────
  { code: '200', label: 'Sales',                    group: 'Revenue',           taxDisplay: 'GST on Income (15%)',   hasGST: true  },
  // ── Cost of Goods Sold ───────────────────────────────────────────────────
  { code: '310', label: 'Cost of Goods Sold',       group: 'Cost of Goods Sold',taxDisplay: 'GST on Expenses (15%)', hasGST: true  },
  // ── Expenses (specific — do not use a catch-all) ─────────────────────────
  { code: '400', label: 'Advertising & Marketing',  group: 'Expenses',          taxDisplay: 'GST on Expenses (15%)', hasGST: true  },
  { code: '404', label: 'Bank Fees & Charges',      group: 'Expenses',          taxDisplay: 'GST on Expenses (15%)', hasGST: true  },
  { code: '424', label: 'Freight & Courier',        group: 'Expenses',          taxDisplay: 'GST on Expenses (15%)', hasGST: true  },
  { code: '437', label: 'IT & Software',            group: 'Expenses',          taxDisplay: 'GST on Expenses (15%)', hasGST: true  },
  { code: '445', label: 'Light, Power, Heating',    group: 'Expenses',          taxDisplay: 'GST on Expenses (15%)', hasGST: true  },
  { code: '461', label: 'Rent',                     group: 'Expenses',          taxDisplay: 'GST on Expenses (15%)', hasGST: true  },
  { code: '473', label: 'Telephone & Internet',     group: 'Expenses',          taxDisplay: 'GST on Expenses (15%)', hasGST: true  },
  // ── Payroll (no GST) ─────────────────────────────────────────────────────
  { code: '477', label: 'Wages & Salaries',         group: 'Payroll',           taxDisplay: 'No Tax',                hasGST: false },
]

const ACCOUNT_MAP = Object.fromEntries(ACCOUNT_OPTIONS.map(o => [o.code, o]))

type Transaction = {
  id: number
  date: string
  payee: string
  description: string
  amountInclGST: number
  gstAmount: number
  isReceived: boolean       // true = money in (Revenue), false = money out
  correctCode: string       // Xero account code, e.g. '200', '461', '404'
  isDuplicate?: boolean
}

type ScenarioConfig = {
  id: number
  businessName: string
  businessDescription: string  // short context shown in nav
  accountName: string   // e.g. "ANZ Business Account"
  period: string
  transactions: Transaction[]
  duplicateId: number
  teaching: string
}

type TxStatus = 'pending' | 'reconciled' | 'flagged-duplicate'

type ScenarioResult = {
  scenarioId: number
  reconcileCorrect: number   // categorised correctly (non-dup txns)
  reconcileTotal: number
  errorFound: boolean
  gstSalesCorrect: boolean
  gstPurchasesCorrect: boolean
}

// ─── Scenarios ────────────────────────────────────────────────────────────────
const SCENARIOS: ScenarioConfig[] = [
  {
    id: 1,
    businessName: 'Bay Brew Café Ltd',
    businessDescription: 'Wellington café — food & beverage sales',
    accountName: 'ANZ Business Account',
    period: 'January 2026',
    duplicateId: 9,
    teaching: 'Duplicate transactions are the most common reconciliation error. Peak Roasters charged twice for the same delivery — easy to miss when invoices look identical. The duplicate overstated Cost of Goods Sold (310) by $2,000 and would have incorrectly claimed $300 in GST input credits.',
    transactions: [
      { id:1, date:'3 Jan', payee:'Point of Sale',        description:'Sales — Point of Sale',        amountInclGST:11500, gstAmount:1500, isReceived:true,  correctCode:'200' },
      { id:2, date:'5 Jan', payee:'Staff Wages',          description:'Wages — Barista staff',        amountInclGST:4800,  gstAmount:0,    isReceived:false, correctCode:'477' },
      { id:3, date:'7 Jan', payee:'Peak Roasters Ltd',    description:'Coffee beans — January order', amountInclGST:2300,  gstAmount:300,  isReceived:false, correctCode:'310' },
      { id:4, date:'10 Jan',payee:'Mercury Energy',       description:'Electricity — January',        amountInclGST:345,   gstAmount:45,   isReceived:false, correctCode:'445' },
      { id:5, date:'12 Jan',payee:'Catering Event',       description:'Sales — Corporate catering',   amountInclGST:3450,  gstAmount:450,  isReceived:true,  correctCode:'200' },
      { id:6, date:'14 Jan',payee:'Countdown Supermarket',description:'Kitchen supplies',             amountInclGST:460,   gstAmount:60,   isReceived:false, correctCode:'310' },
      { id:7, date:'15 Jan',payee:'ANZ Bank',             description:'Bank fees — January',          amountInclGST:23,    gstAmount:3,    isReceived:false, correctCode:'404' },
      { id:8, date:'20 Jan',payee:'CBD Landlord Ltd',     description:'Rent — CBD premises',          amountInclGST:2300,  gstAmount:300,  isReceived:false, correctCode:'461' },
      { id:9, date:'25 Jan',payee:'Peak Roasters Ltd',    description:'Coffee beans — January order', amountInclGST:2300,  gstAmount:300,  isReceived:false, correctCode:'310', isDuplicate:true },
    ],
  },
  {
    id: 2,
    businessName: 'TechSpark Consulting Ltd',
    businessDescription: 'IT management consultancy — bills clients for consulting services',
    accountName: 'Westpac Business Account',
    period: 'February 2026',
    duplicateId: 6,
    teaching: 'Cloud hosting invoices on different dates with identical descriptions are a common duplicate source. The second Rackspace charge overstated IT & Software (437) by $500 and incorrectly claimed $75 in GST. Always cross-check invoices against your purchase orders.',
    transactions: [
      { id:1, date:'2 Feb', payee:'Apex Solutions Ltd',   description:'Client payment received — Project Alpha', amountInclGST:23000, gstAmount:3000, isReceived:true,  correctCode:'200' },
      { id:2, date:'4 Feb', payee:'Xero',                 description:'Xero subscription — Feb',           amountInclGST:69,    gstAmount:9,    isReceived:false, correctCode:'437' },
      { id:3, date:'6 Feb', payee:'Rackspace',            description:'Cloud hosting — Feb',               amountInclGST:575,   gstAmount:75,   isReceived:false, correctCode:'437' },
      { id:4, date:'10 Feb',payee:'Momentum Ltd',         description:'Client payment received — Project Beta',  amountInclGST:11500, gstAmount:1500, isReceived:true,  correctCode:'200' },
      { id:5, date:'14 Feb',payee:'Development Team',     description:'Wages — February',                  amountInclGST:9800,  gstAmount:0,    isReceived:false, correctCode:'477' },
      { id:6, date:'18 Feb',payee:'Rackspace',            description:'Cloud hosting — Feb',               amountInclGST:575,   gstAmount:75,   isReceived:false, correctCode:'437', isDuplicate:true },
      { id:7, date:'20 Feb',payee:'Vodafone',             description:'Mobile plan — February',            amountInclGST:115,   gstAmount:15,   isReceived:false, correctCode:'473' },
      { id:8, date:'24 Feb',payee:'Thorndon Office Park', description:'Rent — February',                   amountInclGST:1725,  gstAmount:225,  isReceived:false, correctCode:'461' },
      { id:9, date:'28 Feb',payee:'NZ Post',              description:'Courier — urgent delivery',          amountInclGST:46,    gstAmount:6,    isReceived:false, correctCode:'424' },
    ],
  },
  {
    id: 3,
    businessName: 'Coastal Apparel Ltd',
    businessDescription: 'NZ clothing retailer — sells via in-store and online (Shopify)',
    accountName: 'BNZ Business Account',
    period: 'March 2026',
    duplicateId: 8,
    teaching: 'Stock purchases are high-risk for duplicates — especially with frequent orders. The double invoice from NZ Fashion Ltd overstated Cost of Goods Sold (310) by $10,000, reduced apparent profit, and incorrectly claimed $1,500 in GST. A supplier statement reconciliation would have caught this.',
    transactions: [
      { id:1, date:'3 Mar', payee:'In-Store Sales',       description:'Retail sales — March',         amountInclGST:34500, gstAmount:4500, isReceived:true,  correctCode:'200' },
      { id:2, date:'5 Mar', payee:'Shopify',              description:'Online sales — March',         amountInclGST:5750,  gstAmount:750,  isReceived:true,  correctCode:'200' },
      { id:3, date:'7 Mar', payee:'NZ Fashion Ltd',       description:'Stock purchase — March order', amountInclGST:11500, gstAmount:1500, isReceived:false, correctCode:'310' },
      { id:4, date:'10 Mar',payee:'Retail Staff',         description:'Wages — March',                amountInclGST:8200,  gstAmount:0,    isReceived:false, correctCode:'477' },
      { id:5, date:'12 Mar',payee:'Shopify',              description:'Shopify subscription — March', amountInclGST:69,    gstAmount:9,    isReceived:false, correctCode:'437' },
      { id:6, date:'14 Mar',payee:'Mercury Energy',       description:'Electricity — March',          amountInclGST:460,   gstAmount:60,   isReceived:false, correctCode:'445' },
      { id:7, date:'18 Mar',payee:'Riccarton Mall',       description:'Rent — March',                 amountInclGST:3450,  gstAmount:450,  isReceived:false, correctCode:'461' },
      { id:8, date:'22 Mar',payee:'NZ Fashion Ltd',       description:'Stock purchase — March order', amountInclGST:11500, gstAmount:1500, isReceived:false, correctCode:'310', isDuplicate:true },
      { id:9, date:'26 Mar',payee:'Google',               description:'Google Ads — March',           amountInclGST:575,   gstAmount:75,   isReceived:false, correctCode:'400' },
    ],
  },
]

// ─── GST calculation (valid transactions only) ────────────────────────────────
function calcGST(scenario: ScenarioConfig) {
  const valid = scenario.transactions.filter(t => !t.isDuplicate)
  const gstOnSales     = valid.filter(t => t.isReceived).reduce((s, t) => s + t.gstAmount, 0)
  const gstOnPurchases = valid.filter(t => !t.isReceived && (ACCOUNT_MAP[t.correctCode]?.hasGST ?? false)).reduce((s, t) => s + t.gstAmount, 0)
  return { gstOnSales, gstOnPurchases, netGST: gstOnSales - gstOnPurchases }
}

// ─── Xero-style top nav bar ───────────────────────────────────────────────────
function XeroNav({ businessName, businessDescription, accountName, reconciled, total }: { businessName: string; businessDescription: string; accountName: string; reconciled: number; total: number }) {
  return (
    <div style={{ background: X_NAV_BG, padding: '0 20px' }}>
      {/* Top row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid rgba(0,0,0,0.15)' }}>
        <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 13, color: X_NAV_BG, flexShrink: 0 }}>x</div>
        <div>
          <span style={{ color: 'white', fontWeight: 700, fontSize: 14 }}>{businessName}</span>
          <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: 11, marginLeft: 8, fontStyle: 'italic' }}>{businessDescription}</span>
        </div>
        <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13 }}>/ Bank Accounts /</span>
        <span style={{ color: 'white', fontSize: 13, fontWeight: 500 }}>{accountName}</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 20 }}>
          {['Dashboard', 'Accounts', 'Reports'].map(l => (
            <span key={l} style={{ color: 'white', fontSize: 12, cursor: 'default' }}>{l}</span>
          ))}
        </div>
      </div>
      {/* Reconcile tab bar */}
      <div style={{ display: 'flex', gap: 0, paddingTop: 8 }}>
        {[
          { label: `Reconcile (${total - reconciled})`, active: true },
          { label: 'Cash coding',        active: false },
          { label: 'Bank statements',    active: false },
          { label: 'Account transactions', active: false },
        ].map(({ label, active }) => (
          <div key={label} style={{
            padding: '8px 18px', fontSize: 13, fontWeight: active ? 700 : 400, cursor: 'default',
            color: active ? 'white' : 'rgba(255,255,255,0.75)',
            borderBottom: active ? '3px solid white' : '3px solid transparent',
            marginBottom: -1,
          }}>{label}</div>
        ))}
        <div style={{ marginLeft: 'auto', padding: '8px 0', fontSize: 12, color: 'rgba(255,255,255,0.8)' }}>
          Compact view &nbsp; <span style={{ display: 'inline-block', width: 30, height: 14, borderRadius: 7, background: 'rgba(255,255,255,0.3)', verticalAlign: 'middle' }} />
        </div>
      </div>
    </div>
  )
}

// ─── Left panel: bank statement line ─────────────────────────────────────────
function BankStatementLine({ tx, isDupWarning }: { tx: Transaction; isDupWarning: boolean }) {
  return (
    <div style={{ borderRight: `1px solid ${X_BORDER}`, padding: '0 0 12px', display: 'flex', flexDirection: 'column', gap: 0 }}>
      {/* Header label */}
      <div style={{ padding: '12px 20px 8px', fontSize: 11, color: '#6B7280', borderBottom: `1px solid ${X_BORDER}` }}>
        <em>Review your bank statement lines…</em>
      </div>
      {/* The transaction card */}
      <div style={{ margin: '12px 16px', border: `1px solid ${isDupWarning ? X_RED : X_BORDER}`, borderRadius: 4, background: isDupWarning ? '#FFF5F5' : 'white', overflow: 'hidden' }}>
        {/* Top row: date + amounts */}
        <div style={{ padding: '10px 14px', display: 'grid', gridTemplateColumns: '1fr auto auto', columnGap: 28, rowGap: 0, alignItems: 'start', borderBottom: `1px solid ${X_BORDER}` }}>
          <div style={{ fontSize: 13, color: '#374151', fontWeight: 500, paddingTop: 2 }}>{tx.date} 2026</div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 10, color: '#9CA3AF', marginBottom: 2 }}>Spent</div>
            <div style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 600, color: tx.isReceived ? '#D1D5DB' : '#111827' }}>
              {tx.isReceived ? '' : tx.amountInclGST.toLocaleString('en-NZ', { minimumFractionDigits: 2 })}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 10, color: '#9CA3AF', marginBottom: 2 }}>Received</div>
            <div style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 600, color: tx.isReceived ? X_GREEN : '#D1D5DB' }}>
              {tx.isReceived ? tx.amountInclGST.toLocaleString('en-NZ', { minimumFractionDigits: 2 }) : ''}
            </div>
          </div>
        </div>
        {/* Payee / description */}
        <div style={{ padding: '10px 14px' }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#111827', marginBottom: 2 }}>{tx.payee}</div>
          <div style={{ fontSize: 12, color: '#6B7280' }}>{tx.description}</div>
          <div style={{ marginTop: 8, fontSize: 11, color: X_BLUE, cursor: 'default' }}>More details</div>
        </div>
        {/* Options bar */}
        <div style={{ padding: '8px 14px', background: '#F9FAFB', borderTop: `1px solid ${X_BORDER}`, display: 'flex', justifyContent: 'flex-end' }}>
          <span style={{ fontSize: 11, color: X_BLUE, cursor: 'default' }}>Options ▼</span>
        </div>
      </div>
      {/* Duplicate warning */}
      {isDupWarning && (
        <div style={{ margin: '0 16px 8px', padding: '10px 14px', background: '#FEF2F2', border: `1px solid ${X_RED}44`, borderRadius: 4, fontSize: 12, color: '#991B1B', lineHeight: 1.6 }}>
          <strong>⚠ Looks familiar!</strong> A transaction with the same payee and amount was already reconciled on this account. Could this be a duplicate charge?
        </div>
      )}
    </div>
  )
}

// ─── Right panel: Create form ─────────────────────────────────────────────────
function CreateForm({
  tx, chosenCode, onChoose, onOK, onFlagDuplicate, submitted, isCorrect, isDup,
}: {
  tx: Transaction
  chosenCode: string | null
  onChoose: (c: string) => void
  onOK: () => void
  onFlagDuplicate: () => void
  submitted: boolean
  isCorrect: boolean
  isDup: boolean
}) {
  const opt = chosenCode ? ACCOUNT_MAP[chosenCode] : null

  return (
    <div style={{ padding: '0 0 12px' }}>
      {/* Header label */}
      <div style={{ padding: '12px 20px 8px', fontSize: 11, color: '#6B7280', borderBottom: `1px solid ${X_BORDER}` }}>
        <em>…then match with your transactions in Xero</em>
      </div>
      {/* Tab bar: Match / Create / Discuss */}
      <div style={{ padding: '0 20px', display: 'flex', borderBottom: `1px solid ${X_BORDER}` }}>
        {['Match', 'Create', 'Discuss'].map(tab => (
          <div key={tab} style={{
            padding: '10px 16px', fontSize: 13, cursor: 'default',
            color: tab === 'Create' ? X_BLUE : '#6B7280',
            fontWeight: tab === 'Create' ? 700 : 400,
            borderBottom: tab === 'Create' ? `2px solid ${X_BLUE}` : '2px solid transparent',
            marginBottom: -1,
          }}>{tab}</div>
        ))}
        <div style={{ marginLeft: 'auto', padding: '10px 0', fontSize: 12, color: X_BLUE, cursor: 'default' }}>Find &amp; Match</div>
      </div>

      {/* Form fields */}
      <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* Who */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <label style={{ width: 36, fontSize: 13, color: '#374151', fontWeight: 600, flexShrink: 0 }}>Who</label>
          <div style={{ flex: 1, padding: '7px 10px', border: `1px solid ${X_BORDER}`, borderRadius: 3, fontSize: 13, color: '#374151', background: '#F9FAFB' }}>{tx.payee}</div>
        </div>
        {/* What */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <label style={{ width: 36, fontSize: 13, color: '#374151', fontWeight: 600, flexShrink: 0 }}>What</label>
          <select
            value={chosenCode ?? ''}
            onChange={e => { if (!submitted) onChoose(e.target.value) }}
            disabled={submitted}
            style={{ flex: 1, padding: '7px 10px', border: `1px solid ${submitted ? (isCorrect ? X_GREEN : X_RED) : X_BORDER}`, borderRadius: 3, fontSize: 13, color: '#111827', background: submitted ? (isCorrect ? '#F0FFF4' : '#FFF5F5') : 'white', cursor: submitted ? 'default' : 'pointer' }}
          >
            <option value="" disabled>Choose the account…</option>
            {(['Revenue', 'Cost of Goods Sold', 'Expenses', 'Payroll'] as AccountGroup[]).map(grp => (
              <optgroup key={grp} label={grp}>
                {ACCOUNT_OPTIONS.filter(o => o.group === grp).map(o => (
                  <option key={o.code} value={o.code}>{o.code} — {o.label}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>
        {/* Why */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <label style={{ width: 36, fontSize: 13, color: '#374151', fontWeight: 600, flexShrink: 0 }}>Why</label>
          <div style={{ flex: 1, padding: '7px 10px', border: `1px solid ${X_BORDER}`, borderRadius: 3, fontSize: 13, color: '#6B7280', background: '#F9FAFB' }}>{tx.description}</div>
        </div>
        {/* Tax Rate + Business Unit */}
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 1, display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{ fontSize: 12, color: '#6B7280', flexShrink: 0 }}>ST Business Unit</div>
            <div style={{ flex: 1, padding: '5px 8px', border: `1px solid ${X_BORDER}`, borderRadius: 3, fontSize: 12, color: '#9CA3AF', background: '#F9FAFB' }}>General ▼</div>
          </div>
          <div style={{ flex: 1, display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{ fontSize: 12, color: '#6B7280', flexShrink: 0 }}>Tax Rate</div>
            <div style={{ flex: 1, padding: '5px 8px', border: `1px solid ${X_BORDER}`, borderRadius: 3, fontSize: 12,
              color: opt ? '#111827' : '#9CA3AF', background: '#F9FAFB', fontWeight: opt ? 500 : 400 }}>
              {opt ? opt.taxDisplay : '—'} ▼
            </div>
          </div>
        </div>

        {/* Feedback */}
        {submitted && (
          <div style={{ padding: '10px 14px', borderRadius: 4, fontSize: 13, lineHeight: 1.6,
            background: tx.isDuplicate && !isDup ? '#FEF9C3' : isDup ? '#FEF2F2' : isCorrect ? '#F0FFF4' : '#FFF5F5',
            border: `1px solid ${tx.isDuplicate && !isDup ? '#CA8A04' : isDup ? X_RED + '44' : isCorrect ? X_GREEN + '55' : X_RED + '44'}`,
            color: tx.isDuplicate && !isDup ? '#92400E' : isDup ? '#991B1B' : isCorrect ? '#166534' : '#991B1B' }}>
            {tx.isDuplicate && !isDup
              ? '⚠ This transaction is a duplicate — do not reconcile it. Click "Flag as Duplicate" below.'
              : isDup
                ? '⚠ That transaction is not a duplicate. Select the correct account and click OK.'
                : isCorrect
                  ? `✓ Correct — ${opt?.code} ${opt?.label}.${opt ? ` Tax Rate: "${opt.taxDisplay}".` : ''}`
                  : `✗ Not quite — this should be ${tx.correctCode} — ${ACCOUNT_MAP[tx.correctCode]?.label}. Try again.`}
          </div>
        )}

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
          {!submitted ? (
            <>
              <button onClick={onOK} disabled={!chosenCode}
                style={{ flex: 1, padding: '9px 0', background: chosenCode ? X_BLUE : '#E5E7EB', color: chosenCode ? 'white' : '#9CA3AF',
                  border: 'none', borderRadius: 3, fontSize: 14, fontWeight: 700, cursor: chosenCode ? 'pointer' : 'not-allowed' }}>
                OK
              </button>
              <button onClick={onFlagDuplicate}
                style={{ padding: '9px 16px', background: 'white', color: X_RED, border: `1px solid ${X_RED}88`, borderRadius: 3, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                Flag as Duplicate
              </button>
            </>
          ) : !isDup && !tx.isDuplicate && isCorrect ? (
            <div style={{ flex: 1, padding: '9px 0', background: X_GREEN, color: 'white', borderRadius: 3, fontSize: 14, fontWeight: 700, textAlign: 'center' }}>
              ✓ Reconciled
            </div>
          ) : tx.isDuplicate && !isDup ? (
            <button onClick={onFlagDuplicate}
              style={{ flex: 1, padding: '9px 0', background: X_RED, color: 'white', border: 'none', borderRadius: 3, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
              ⚠ Flag as Duplicate
            </button>
          ) : !isDup && !isCorrect ? (
            <button onClick={() => onChoose('')}
              style={{ flex: 1, padding: '9px 0', background: X_BLUE, color: 'white', border: 'none', borderRadius: 3, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
              Try Again
            </button>
          ) : (
            <div style={{ flex: 1, padding: '9px 0', background: '#6B7280', color: 'white', borderRadius: 3, fontSize: 14, fontWeight: 700, textAlign: 'center' }}>
              ✓ Duplicate flagged
            </div>
          )}
        </div>

        {/* Add details link */}
        <div style={{ fontSize: 12, color: X_BLUE, cursor: 'default', textAlign: 'right' }}>Add details</div>
      </div>
    </div>
  )
}

// ─── Setup SVG illustration ───────────────────────────────────────────────────
function SetupIllustration() {
  return (
    <svg viewBox="0 0 260 150" width="100%" style={{ maxWidth: 260, display: 'block', margin: '0 auto' }}>
      {/* Left panel - bank statement */}
      <rect x="4" y="8" width="118" height="134" rx="5" fill="white" stroke={X_BORDER} strokeWidth="1"/>
      <rect x="4" y="8" width="118" height="26" rx="5" fill={X_NAVY}/>
      <rect x="4" y="27" width="118" height="7" fill={X_NAVY}/>
      <text x="10" y="19" fill="white" fontSize="6.5" fontWeight="700">ANZ Business Account</text>
      <text x="10" y="30" fill={X_TEAL} fontSize="5.5">Reconcile (9)</text>
      {/* Statement lines */}
      {[0,1,2,3,4,5,6].map(i => (
        <g key={i}>
          <rect x="8" y={40 + i*13} width="110" height="11" rx="2" fill={i === 4 ? '#FFF5F5' : '#F9FAFB'} stroke={i === 4 ? '#FECACA' : X_BORDER} strokeWidth="0.5"/>
          <rect x="12" y={43 + i*13} width="50" height="5" rx="1" fill={i === 4 ? '#FECACA' : '#E5E7EB'}/>
          <rect x="86" y={43 + i*13} width="28" height="5" rx="1" fill={i === 4 ? '#FCA5A5' : '#D1FAE5'}/>
          {i === 4 && <text x="14" y={48 + i*13} fontSize="4" fill={X_RED} fontWeight="700">⚠ duplicate?</text>}
        </g>
      ))}
      {/* Divider */}
      <line x1="122" y1="8" x2="122" y2="142" stroke={X_BORDER} strokeWidth="1"/>
      {/* Right panel - Create form */}
      <rect x="122" y="8" width="134" height="134" rx="5" fill="white" stroke={X_BORDER} strokeWidth="1"/>
      <rect x="122" y="8" width="134" height="7" rx="5" fill="white"/>
      <text x="127" y="22" fontSize="5.5" fill="#9CA3AF">…match with your transactions in Xero</text>
      {/* Tabs */}
      <text x="127" y="34" fontSize="6" fill="#9CA3AF">Match</text>
      <text x="148" y="34" fontSize="6" fill={X_BLUE} fontWeight="700">Create</text>
      <line x1="148" y1="36" x2="166" y2="36" stroke={X_BLUE} strokeWidth="1.5"/>
      <text x="170" y="34" fontSize="6" fill="#9CA3AF">Discuss</text>
      {/* Form rows */}
      {[
        { label: 'Who',  val: 'Peak Roasters Ltd' },
        { label: 'What', val: '310 — Cost of Goods Sold', highlight: true },
        { label: 'Why',  val: 'Coffee beans — January' },
      ].map(({ label, val, highlight }, i) => (
        <g key={label}>
          <text x="127" y={48 + i*18} fontSize="5" fill="#374151" fontWeight="700">{label}</text>
          <rect x="141" y={41 + i*18} width="111" height="11" rx="2" fill={highlight ? '#EFF6FF' : '#F9FAFB'} stroke={highlight ? X_BLUE : X_BORDER} strokeWidth="0.7"/>
          <text x="145" y={49 + i*18} fontSize="5.5" fill={highlight ? X_BLUE : '#6B7280'}>{val}</text>
        </g>
      ))}
      {/* Tax Rate row */}
      <text x="127" y="103" fontSize="5" fill="#6B7280">Tax Rate</text>
      <rect x="150" y="96" width="100" height="10" rx="2" fill="#F9FAFB" stroke={X_BORDER} strokeWidth="0.7"/>
      <text x="154" y="103" fontSize="5" fill="#374151">GST on Expenses (15%) ▼</text>
      {/* OK button */}
      <rect x="127" y="112" width="55" height="14" rx="3" fill={X_BLUE}/>
      <text x="154" y="121" textAnchor="middle" fontSize="7" fill="white" fontWeight="700">OK</text>
      <rect x="187" y="112" width="63" height="14" rx="3" fill="white" stroke={X_RED} strokeWidth="0.8"/>
      <text x="218" y="121" textAnchor="middle" fontSize="6" fill={X_RED} fontWeight="600">Flag Duplicate</text>
    </svg>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function XeroReconciliationMiniGamePage() {
  const query = useMemo(() => new URLSearchParams(window.location.search), [])
  const GAME_SLUG = 'xero-reconciliation'
  const roomFromUrl  = (query.get('room')   || '').trim().toUpperCase()
  const inviteToken  = (query.get('invite') || '').trim()
  const hasStudentContext = Boolean(roomFromUrl || inviteToken)

  // ── Educator auth ──
  const [authChecked, setAuthChecked] = useState(hasStudentContext)
  const [canAccessSetup, setCanAccessSetup] = useState(hasStudentContext)
  const [studentAccessResolved, setStudentAccessResolved] = useState(!hasStudentContext)
  const [studentAccessAllowed, setStudentAccessAllowed] = useState(!hasStudentContext)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')
  const [createdLink, setCreatedLink] = useState<{ roomCode: string; joinLink: string } | null>(null)
  const [sessionsRefreshKey, setSessionsRefreshKey] = useState(0)

  // ── Game state ──
  const [gamePhase, setGamePhase] = useState<'setup' | 'playing' | 'done'>(hasStudentContext ? 'playing' : 'setup')
  const [scenarioOrder, setScenarioOrder] = useState<number[]>([])
  const [scenarioIdx, setScenarioIdx] = useState(0)

  // Per-scenario state
  const [txIdx, setTxIdx] = useState(0)                                     // which transaction we're on (0..8)
  const [statuses, setStatuses] = useState<Record<number, TxStatus>>({})    // txId → status
  const [chosenCats, setChosenCats] = useState<Record<number, string | null>>({}) // txId → chosen account code
  const [submitted, setSubmitted] = useState(false)                         // current tx submitted?
  const [isDupSubmitted, setIsDupSubmitted] = useState(false)               // flagged as dup?
  const [allDone, setAllDone] = useState(false)                             // all 9 processed?

  // GST return state
  const [phase, setPhase] = useState<'reconcile' | 'gst-return'>('reconcile')
  const [gstSubmitted, setGstSubmitted] = useState(false)

  // Results
  const [results, setResults] = useState<ScenarioResult[]>([])

  // ── Init ──
  useEffect(() => {
    setScenarioOrder([0, 1, 2].sort(() => Math.random() - 0.5))
  }, [])

  // ── Educator auth ──
  useEffect(() => {
    if (hasStudentContext) return
    let cancelled = false
    getEducatorSessionCached(true).then(s => { if (!cancelled) { setCanAccessSetup(s.ok); setAuthChecked(true) } })
    return () => { cancelled = true }
  }, [hasStudentContext])

  useEffect(() => {
    if (!hasStudentContext && authChecked && !canAccessSetup) window.location.href = '/educator-login'
  }, [hasStudentContext, authChecked, canAccessSetup])

  useEffect(() => {
    if (!hasStudentContext) { setStudentAccessAllowed(true); setStudentAccessResolved(true); return }
    let cancelled = false
    const validate = async () => {
      try {
        let roomCode = roomFromUrl
        if (inviteToken) {
          const r = await fetch(`/api/minigames/invite/${encodeURIComponent(inviteToken)}`, { headers: { 'Content-Type': 'application/json' } })
          if (!r.ok) throw new Error('Invalid invite')
          const d = await r.json() as { success?: boolean; invite?: { gameType?: string; roomCode?: string | null } }
          if (!d.success || d.invite?.gameType !== GAME_SLUG) throw new Error('Invalid invite')
          if (!roomCode) roomCode = String(d.invite?.roomCode || '').trim().toUpperCase()
        }
        if (!roomCode) throw new Error('Missing room code')
        const r2 = await fetch(`/api/minigames/join/${encodeURIComponent(roomCode)}`, { headers: { 'Content-Type': 'application/json' } })
        if (!r2.ok) throw new Error('Invalid room')
        const d2 = await r2.json() as { success?: boolean; room?: { gameType?: string } }
        if (!d2.success || d2.room?.gameType !== GAME_SLUG) throw new Error('Invalid room')
        if (!cancelled) { setStudentAccessAllowed(true); setStudentAccessResolved(true) }
      } catch {
        if (!cancelled) { setStudentAccessAllowed(false); setStudentAccessResolved(true) }
      }
    }
    void validate()
    return () => { cancelled = true }
  }, [hasStudentContext, inviteToken, roomFromUrl])

  async function handleCreateLink() {
    setCreating(true); setCreateError('')
    try {
      const res = await educatorMiniGamesApi.createSession({ gameType: 'xero-reconciliation', teamCount: 1 })
      const roomCode = res.session.roomCode || ''
      const joinLink = roomCode
        ? `${window.location.origin}/mini-games/xero-reconciliation?room=${encodeURIComponent(roomCode)}`
        : `${window.location.origin}/mini-games/join`
      setCreatedLink({ roomCode, joinLink })
      setSessionsRefreshKey(k => k + 1)
    } catch (e) { setCreateError(e instanceof Error ? e.message : 'Failed') } finally { setCreating(false) }
  }

  // ── Derived ──
  const scenario = scenarioOrder.length > 0 ? SCENARIOS[scenarioOrder[scenarioIdx]] : SCENARIOS[0]
  const gstTruth = useMemo(() => calcGST(scenario), [scenario])
  const currentTx = scenario.transactions[txIdx]
  const reconciledCount = Object.values(statuses).filter(s => s === 'reconciled' || s === 'flagged-duplicate').length
  const totalTx = scenario.transactions.length

  // Has a prior transaction with same payee + amount been reconciled already?
  const isDupWarning = useMemo(() => {
    if (!currentTx) return false
    return scenario.transactions.some(t =>
      t.id !== currentTx.id &&
      t.payee === currentTx.payee &&
      t.amountInclGST === currentTx.amountInclGST &&
      (statuses[t.id] === 'reconciled')
    )
  }, [currentTx, scenario.transactions, statuses])

  function resetScenario() {
    setTxIdx(0); setStatuses({}); setChosenCats({}); setSubmitted(false)
    setIsDupSubmitted(false); setAllDone(false)
    setPhase('reconcile'); setGstSubmitted(false)
  }

  function advanceToNext() {
    const next = txIdx + 1
    if (next >= totalTx) { setAllDone(true) }
    else { setTxIdx(next); setSubmitted(false); setIsDupSubmitted(false) }
  }

  function handleOK() {
    const cat = chosenCats[currentTx.id] ?? null
    if (!cat) return
    setSubmitted(true)
    if (currentTx.isDuplicate) {
      // They tried to reconcile the duplicate normally — show feedback, don't reconcile it
      setIsDupSubmitted(true)
    } else if (cat === currentTx.correctCode) {
      setStatuses(s => ({ ...s, [currentTx.id]: 'reconciled' }))
    }
    // If wrong category: feedback shown, they try again (submitted=true but status stays pending)
  }

  function handleFlagDuplicate() {
    setSubmitted(true)
    setIsDupSubmitted(true)
    if (currentTx.isDuplicate) {
      setStatuses(s => ({ ...s, [currentTx.id]: 'flagged-duplicate' }))
    }
    // If not a duplicate: show feedback
  }

  function handleChoose(cat: string) {
    setChosenCats(prev => ({ ...prev, [currentTx.id]: cat || null }))
    setSubmitted(false)
    setIsDupSubmitted(false)
  }

  function handleGSTSubmit() {
    setGstSubmitted(true)
    const reconcileCorrect = scenario.transactions.filter(t => !t.isDuplicate && statuses[t.id] === 'reconciled' && chosenCats[t.id] === t.correctCode).length
    const reconcileTotal   = scenario.transactions.filter(t => !t.isDuplicate).length
    setResults(prev => [...prev, {
      scenarioId: scenario.id,
      reconcileCorrect, reconcileTotal,
      errorFound: statuses[scenario.duplicateId] === 'flagged-duplicate',
      gstSalesCorrect: true,
      gstPurchasesCorrect: true,
    }])
  }

  function handleNextScenario() {
    if (scenarioIdx + 1 >= 3) { setGamePhase('done') }
    else { setScenarioIdx(i => i + 1); resetScenario() }
  }

  function handleRestart() {
    setScenarioOrder([0, 1, 2].sort(() => Math.random() - 0.5))
    setScenarioIdx(0); setResults([]); resetScenario(); setGamePhase('playing')
  }

  // ── Guards ──
  if (hasStudentContext && !studentAccessResolved) {
    return (
      <MiniGameShell title="Xero Reconciliation" subtitle="Bank Reconciliation & GST Return" publicMode>
        <div style={{ maxWidth: 760, margin: '0 auto', padding: '32px 20px' }}>
          <div style={{ background: 'var(--mg-surface)', border: '1px solid var(--mg-border)', borderRadius: 12, padding: 24 }}>Validating classroom access…</div>
        </div>
      </MiniGameShell>
    )
  }
  if (hasStudentContext && !studentAccessAllowed) {
    return (
      <MiniGameShell title="Xero Reconciliation" subtitle="Bank Reconciliation & GST Return" publicMode>
        <div style={{ maxWidth: 760, margin: '0 auto', padding: '32px 20px' }}>
          <div style={{ background: 'var(--mg-surface)', border: '1px solid var(--mg-border)', borderRadius: 12, padding: 24 }}>
            This classroom link is invalid or expired. Please ask your educator for a new share link.
          </div>
        </div>
      </MiniGameShell>
    )
  }

  // ── Setup ──
  if (gamePhase === 'setup') {
    return (
      <MiniGameShell title="Xero Reconciliation" subtitle="Bank Reconciliation & GST Return"
        sessionsGameType="xero-reconciliation" showSessionsTable={authChecked && canAccessSetup}
        sessionsRefreshKey={sessionsRefreshKey} publicMode={false}>
        <div style={{ maxWidth: 820, margin: '0 auto', padding: '32px 20px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 24 }}>
            <div style={{ background: 'var(--mg-surface)', border: '1px solid var(--mg-border)', borderRadius: 12, padding: 24 }}>
              <div style={{ marginBottom: 16 }}><SetupIllustration /></div>
              <h2 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 8px', color: 'var(--mg-text)' }}>Xero Reconciliation</h2>
              <p style={{ fontSize: 13, color: 'var(--mg-muted)', lineHeight: 1.6, margin: '0 0 14px' }}>
                Students work through 3 randomised NZ businesses using the same two-panel layout as real Xero — bank statement on the left, Create form on the right.
              </p>
              <div style={{ fontSize: 13, color: 'var(--mg-muted)', lineHeight: 2 }}>
                <div>📋 <strong style={{ color: 'var(--mg-text)' }}>Who / What / Why</strong> — code each transaction to the right account</div>
                <div>🔍 <strong style={{ color: 'var(--mg-text)' }}>Spot the duplicate</strong> — flag it instead of reconciling</div>
                <div>📊 <strong style={{ color: 'var(--mg-text)' }}>File the GST return</strong> — calculate Box 13, 15 &amp; 20</div>
                <div>🇳🇿 <strong style={{ color: 'var(--mg-text)' }}>NZ GST at 15%</strong> — real account codes, real tax logic</div>
              </div>
            </div>
            <div style={{ background: 'var(--mg-surface)', border: '1px solid var(--mg-border)', borderRadius: 12, padding: 24 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 12px', color: 'var(--mg-text)' }}>Assign to Students</h3>
              <button onClick={() => void handleCreateLink()} disabled={creating}
                style={{ width: '100%', padding: 10, background: X_BLUE, color: '#fff', border: 'none', borderRadius: 6, fontSize: 14, fontWeight: 600, cursor: creating ? 'not-allowed' : 'pointer', marginBottom: 10, opacity: creating ? 0.7 : 1 }}>
                {creating ? 'Creating…' : '+ Create Student Link'}
              </button>
              <button onClick={() => setGamePhase('playing')}
                style={{ width: '100%', padding: 10, background: 'transparent', color: 'var(--mg-muted)', border: '1px solid var(--mg-border)', borderRadius: 6, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                ▶ Test Solo
              </button>
              {createError && <p style={{ color: '#dc2626', fontSize: 12, marginTop: 8 }}>{createError}</p>}
              {createdLink && (
                <div style={{ marginTop: 12, padding: 12, background: 'var(--mg-surface-2)', borderRadius: 8, border: '1px solid var(--mg-border)' }}>
                  <div style={{ fontSize: 12, color: 'var(--mg-muted)', marginBottom: 6 }}>Student link:</div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <input readOnly value={createdLink.joinLink} style={{ flex: 1, fontSize: 11, padding: '6px 8px', borderRadius: 4, border: '1px solid var(--mg-border)', background: 'var(--mg-surface)', color: 'var(--mg-text)', minWidth: 0 }} />
                    <button onClick={() => navigator.clipboard.writeText(createdLink.joinLink)}
                      style={{ padding: '6px 10px', background: X_BLUE, color: '#fff', border: 'none', borderRadius: 4, fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap' }}>Copy</button>
                  </div>
                  <div style={{ marginTop: 12, display: 'flex', justifyContent: 'center', background: '#fff', borderRadius: 8, padding: 12 }}>
                    <QRCodeSVG value={createdLink.joinLink} size={200} bgColor="#ffffff" fgColor="#0f172a" level="M" />
                  </div>
                </div>
              )}
            </div>
          </div>
          {/* Flow explainer */}
          <div style={{ background: 'var(--mg-surface)', border: '1px solid var(--mg-border)', borderRadius: 12, padding: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--mg-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 14 }}>Workflow</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
              {[
                { n: '1', title: 'Reconcile (Xero-style)', desc: 'Code each bank line to Who / What / Why. Flag the duplicate when you spot it.', color: X_BLUE },
                { n: '2', title: 'GST Return', desc: 'Calculate GST on sales and purchases from your reconciled data. File with IRD.', color: X_GREEN },
                { n: '3', title: 'Results', desc: 'See your accuracy across all 3 businesses and the teaching takeaway for each.', color: X_TEAL },
              ].map(({ n, title, desc, color }) => (
                <div key={n} style={{ padding: 14, background: 'var(--mg-surface-2)', borderRadius: 8, borderTop: `3px solid ${color}` }}>
                  <div style={{ fontSize: 18, fontWeight: 800, color, marginBottom: 4 }}>Step {n}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--mg-text)', marginBottom: 4 }}>{title}</div>
                  <div style={{ fontSize: 12, color: 'var(--mg-muted)', lineHeight: 1.5 }}>{desc}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </MiniGameShell>
    )
  }

  // ── Done ──
  if (gamePhase === 'done') {
    const perfectCount = results.filter(r => r.reconcileCorrect === r.reconcileTotal && r.errorFound && r.gstSalesCorrect && r.gstPurchasesCorrect).length
    const grade = perfectCount === 3 ? 'A' : perfectCount === 2 ? 'B' : perfectCount === 1 ? 'C' : 'D'
    const gradeColor = grade === 'A' ? X_GREEN : grade === 'B' ? '#65a30d' : grade === 'C' ? '#ca8a04' : X_RED
    return (
      <MiniGameShell title="Xero Reconciliation" subtitle="Bank Reconciliation & GST Return" publicMode={hasStudentContext}>
        <div style={{ maxWidth: 600, margin: '0 auto', padding: '40px 20px' }}>
          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <div style={{ fontSize: 72, fontWeight: 900, color: gradeColor, lineHeight: 1 }}>{grade}</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: gradeColor, marginTop: 4 }}>
              {grade === 'A' ? 'Accountant-Ready' : grade === 'B' ? 'Strong Work' : grade === 'C' ? 'Getting There' : 'Keep Practising'}
            </div>
            <div style={{ fontSize: 14, color: 'var(--mg-muted)', marginTop: 4 }}>{perfectCount} of 3 businesses fully correct</div>
          </div>
          <div style={{ background: 'var(--mg-surface)', border: '1px solid var(--mg-border)', borderRadius: 12, padding: 20, marginBottom: 20 }}>
            {results.map((r, i) => {
              const sc = SCENARIOS.find(s => s.id === r.scenarioId)!
              return (
                <div key={i} style={{ paddingBottom: 16, marginBottom: 16, borderBottom: i < results.length - 1 ? '1px solid var(--mg-border)' : 'none' }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--mg-text)', marginBottom: 8 }}>{sc.businessName}</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                    {[
                      { label: 'Reconcile', ok: r.reconcileCorrect === r.reconcileTotal, detail: `${r.reconcileCorrect}/${r.reconcileTotal}` },
                      { label: 'Duplicate found', ok: r.errorFound, detail: r.errorFound ? 'Flagged ✓' : 'Missed' },
                      { label: 'GST return', ok: r.gstSalesCorrect && r.gstPurchasesCorrect, detail: r.gstSalesCorrect && r.gstPurchasesCorrect ? 'Correct' : r.gstSalesCorrect ? 'Purchases off' : 'Sales off' },
                    ].map(({ label, ok, detail }) => (
                      <div key={label} style={{ background: 'var(--mg-surface-2)', borderRadius: 8, padding: '8px 10px', textAlign: 'center', border: `1px solid ${ok ? X_GREEN + '44' : X_RED + '44'}` }}>
                        <div style={{ fontSize: 10, color: 'var(--mg-muted)', textTransform: 'uppercase', marginBottom: 2 }}>{label}</div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: ok ? X_GREEN : X_RED }}>{ok ? '✓' : '✗'} {detail}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
          <div style={{ background: 'var(--mg-surface)', border: '1px solid var(--mg-border)', borderLeft: `4px solid ${X_TEAL}`, borderRadius: 12, padding: 16, marginBottom: 20, fontSize: 13, lineHeight: 1.7, color: 'var(--mg-muted)' }}>
            <strong style={{ color: 'var(--mg-text)' }}>Key lesson: </strong>
            Bank reconciliation in Xero is how errors get caught before they affect your P&amp;L and GST return. A duplicate transaction overstates expenses, understates profit, and overclaims GST — all at once. Monthly reconciliation prevents this.
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={handleRestart} style={{ flex: 1, padding: 12, background: X_BLUE, color: '#fff', border: 'none', borderRadius: 6, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>Play Again</button>
            {!hasStudentContext && (
              <button onClick={() => setGamePhase('setup')} style={{ flex: 1, padding: 12, background: 'transparent', border: '1px solid var(--mg-border)', borderRadius: 6, fontSize: 14, fontWeight: 600, cursor: 'pointer', color: 'var(--mg-muted)' }}>Back to Setup</button>
            )}
          </div>
        </div>
      </MiniGameShell>
    )
  }

  // ── Playing ──
  if (scenarioOrder.length === 0) return null

  return (
    <MiniGameShell title="Xero Reconciliation" subtitle="Bank Reconciliation & GST Return" publicMode={hasStudentContext}>
      <div style={{ background: X_BG, minHeight: '100%' }}>

        {/* Xero nav */}
        <XeroNav businessName={scenario.businessName} businessDescription={scenario.businessDescription} accountName={scenario.accountName} reconciled={reconciledCount} total={totalTx} />

        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '16px' }}>

          {/* Progress + leave */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <span style={{ fontSize: 12, color: '#6B7280' }}>Business {scenarioIdx + 1} of 3</span>
            <div style={{ flex: 1, background: X_BORDER, borderRadius: 4, height: 4, overflow: 'hidden' }}>
              <div style={{ width: `${(scenarioIdx / 3) * 100}%`, background: X_TEAL, height: '100%', transition: 'width 0.4s' }} />
            </div>
            {!hasStudentContext && (
              <button onClick={() => setGamePhase('setup')} style={{ padding: '3px 10px', background: 'transparent', border: `1px solid ${X_BORDER}`, borderRadius: 4, fontSize: 11, color: '#6B7280', cursor: 'pointer' }}>← Leave</button>
            )}
          </div>

          {/* ── Reconcile phase ── */}
          {phase === 'reconcile' && !allDone && (
            <>
              {/* Transaction counter */}
              {(() => {
                const canAdvance = submitted && (
                  (!currentTx.isDuplicate && chosenCats[currentTx.id] === currentTx.correctCode) ||
                  (currentTx.isDuplicate && isDupSubmitted && statuses[currentTx.id] === 'flagged-duplicate')
                )
                return (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                    <div style={{ fontSize: 13, color: '#374151', fontWeight: 600 }}>
                      Transaction {txIdx + 1} of {totalTx}
                      <span style={{ marginLeft: 10, fontSize: 12, color: '#9CA3AF', fontWeight: 400 }}>
                        {reconciledCount} reconciled · {statuses[scenario.duplicateId] === 'flagged-duplicate' ? '1 duplicate flagged' : '1 duplicate to find'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {scenario.transactions.map((_, i) => {
                          const tx = scenario.transactions[i]
                          const st = statuses[tx.id]
                          return (
                            <div key={i} style={{ width: 10, height: 10, borderRadius: '50%',
                              background: st === 'reconciled' ? X_GREEN : st === 'flagged-duplicate' ? X_RED : i === txIdx ? X_BLUE : X_BORDER }} />
                          )
                        })}
                      </div>
                      {canAdvance && (
                        <button onClick={advanceToNext}
                          style={{ padding: '7px 18px', background: X_BLUE, color: 'white', border: 'none', borderRadius: 4, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                          {txIdx + 1 < totalTx ? 'Next Transaction →' : 'Review Reconciliation →'}
                        </button>
                      )}
                    </div>
                  </div>
                )
              })()}

              {/* Two-panel Xero layout */}
              <div style={{ background: 'white', border: `1px solid ${X_BORDER}`, borderRadius: 4, display: 'grid', gridTemplateColumns: '1fr 1fr', overflow: 'hidden' }}>
                <BankStatementLine tx={currentTx} isDupWarning={isDupWarning} />
                <CreateForm
                  tx={currentTx}
                  chosenCode={chosenCats[currentTx.id] ?? null}
                  onChoose={handleChoose}
                  onOK={handleOK}
                  onFlagDuplicate={handleFlagDuplicate}
                  submitted={submitted}
                  isCorrect={submitted && !currentTx.isDuplicate && chosenCats[currentTx.id] === currentTx.correctCode}
                  isDup={submitted && isDupSubmitted && !currentTx.isDuplicate}
                />
              </div>


              {/* Already-reconciled list */}
              {reconciledCount > 0 && (
                <div style={{ marginTop: 16 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Reconciled</div>
                  <div style={{ background: 'white', border: `1px solid ${X_BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
                    {scenario.transactions.filter(t => statuses[t.id] && statuses[t.id] !== 'pending').map((t, i, arr) => (
                      <div key={t.id} style={{ padding: '8px 14px', display: 'grid', gridTemplateColumns: '80px 1fr auto auto', gap: 12, alignItems: 'center', borderBottom: i < arr.length - 1 ? `1px solid ${X_BORDER}` : 'none', background: statuses[t.id] === 'flagged-duplicate' ? '#FFF5F5' : 'white' }}>
                        <span style={{ fontSize: 12, color: '#9CA3AF' }}>{t.date}</span>
                        <span style={{ fontSize: 13, color: '#374151' }}>{t.payee}</span>
                        <span style={{ fontSize: 12, fontFamily: 'monospace', color: t.isReceived ? X_GREEN : '#374151' }}>
                          {t.isReceived ? '+' : '-'}${t.amountInclGST.toLocaleString('en-NZ', { minimumFractionDigits: 2 })}
                        </span>
                        <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, fontWeight: 600,
                          background: statuses[t.id] === 'flagged-duplicate' ? '#FEE2E2' : '#D1FAE5',
                          color: statuses[t.id] === 'flagged-duplicate' ? X_RED : X_GREEN }}>
                          {statuses[t.id] === 'flagged-duplicate' ? '⚠ Duplicate' : `✓ ${chosenCats[t.id] ?? ''} — ${ACCOUNT_MAP[chosenCats[t.id] ?? '']?.label ?? ''}`}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* ── All reconciled — review ── */}
          {phase === 'reconcile' && allDone && (
            <div style={{ background: 'white', border: `1px solid ${X_BORDER}`, borderRadius: 4, padding: 24 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: X_NAVY, marginBottom: 4 }}>Reconciliation complete</div>
              <div style={{ fontSize: 13, color: '#6B7280', marginBottom: 20 }}>
                {Object.values(statuses).filter(s => s === 'reconciled').length} transactions reconciled ·&nbsp;
                {statuses[scenario.duplicateId] === 'flagged-duplicate' ? '1 duplicate flagged ✓' : <span style={{ color: X_RED }}>duplicate not flagged ✗</span>}
              </div>
              <div style={{ border: `1px solid ${X_BORDER}`, borderRadius: 4, overflow: 'hidden', marginBottom: 20 }}>
                {scenario.transactions.map((t, i) => (
                  <div key={t.id} style={{ padding: '8px 14px', display: 'grid', gridTemplateColumns: '80px 1fr auto auto', gap: 12, alignItems: 'center', borderBottom: i < scenario.transactions.length - 1 ? `1px solid ${X_BORDER}` : 'none',
                    background: statuses[t.id] === 'flagged-duplicate' ? '#FFF5F5' : 'white' }}>
                    <span style={{ fontSize: 12, color: '#9CA3AF' }}>{t.date}</span>
                    <span style={{ fontSize: 13, color: '#374151' }}>{t.payee}</span>
                    <span style={{ fontSize: 12, fontFamily: 'monospace', color: t.isReceived ? X_GREEN : '#374151' }}>
                      {t.isReceived ? '+' : '-'}${t.amountInclGST.toLocaleString('en-NZ', { minimumFractionDigits: 2 })}
                    </span>
                    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, fontWeight: 600,
                      background: statuses[t.id] === 'flagged-duplicate' ? '#FEE2E2' : statuses[t.id] === 'reconciled' ? '#D1FAE5' : '#F3F4F6',
                      color: statuses[t.id] === 'flagged-duplicate' ? X_RED : statuses[t.id] === 'reconciled' ? X_GREEN : '#9CA3AF' }}>
                      {statuses[t.id] === 'flagged-duplicate' ? '⚠ Duplicate' : statuses[t.id] === 'reconciled' ? `✓ ${chosenCats[t.id] ?? ''}` : '— skipped'}
                    </span>
                  </div>
                ))}
              </div>
              <button onClick={() => setPhase('gst-return')}
                style={{ padding: '10px 28px', background: X_NAVY, color: 'white', border: 'none', borderRadius: 4, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                File GST Return →
              </button>
            </div>
          )}

          {/* ── GST Return phase ── */}
          {phase === 'gst-return' && (() => {
            const validTxs = scenario.transactions.filter(t => !t.isDuplicate)
            const salesTxs = validTxs.filter(t => t.isReceived)
            const purchaseTxs = validTxs.filter(t => !t.isReceived)
            const box5  = salesTxs.reduce((s, t) => s + t.amountInclGST, 0)
            const box11 = purchaseTxs.reduce((s, t) => s + t.amountInclGST, 0)
            const fmt = (n: number) => n.toLocaleString('en-NZ', { minimumFractionDigits: 2 })
            const GSTRow = ({ boxNum, label, value, bold }: { boxNum: string; label: string; value: number; bold?: boolean }) => (
              <div style={{ display: 'flex', alignItems: 'center', padding: '9px 16px', borderBottom: `1px solid ${X_BORDER}` }}>
                <span style={{ width: 52, flexShrink: 0, background: '#E5E7EB', color: '#374151', fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 3, textAlign: 'center' }}>Box {boxNum}</span>
                <span style={{ flex: 1, fontSize: 13, color: '#374151', marginLeft: 12 }}>{label}</span>
                <span style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: bold ? 700 : 400, color: bold ? '#111827' : '#374151' }}>{fmt(value)}</span>
              </div>
            )
            return (
              <div style={{ background: 'white', border: `1px solid ${X_BORDER}`, borderRadius: 4, overflow: 'hidden' }}>

                {/* Xero-style GST return header */}
                <div style={{ padding: '16px 24px', borderBottom: `1px solid ${X_BORDER}`, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 4 }}>GST Return · Invoice Basis · NZ 15%</div>
                    <div style={{ fontSize: 17, fontWeight: 700, color: '#111827' }}>{scenario.businessName}</div>
                    <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>{scenario.period}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 24, fontWeight: 800, color: '#111827' }}>${fmt(gstTruth.netGST)}</div>
                    <div style={{ fontSize: 12, color: '#6B7280' }}>GST to pay</div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0 }}>

                  {/* Left: transaction breakdown */}
                  <div style={{ borderRight: `1px solid ${X_BORDER}`, padding: '16px 20px' }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>Transaction Breakdown</div>

                    {/* Sales */}
                    <div style={{ marginBottom: 14 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: X_GREEN, textTransform: 'uppercase', marginBottom: 6 }}>Sales &amp; Income</div>
                      <div style={{ border: `1px solid ${X_BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
                        {salesTxs.map((t, i) => (
                          <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, padding: '6px 10px', borderBottom: i < salesTxs.length - 1 ? `1px solid ${X_BORDER}` : 'none', background: i % 2 === 0 ? 'white' : '#F9FAFB' }}>
                            <span style={{ color: '#374151' }}>{t.payee}</span>
                            <div style={{ textAlign: 'right' }}>
                              <span style={{ color: X_GREEN, fontFamily: 'monospace', fontWeight: 600 }}>${fmt(t.amountInclGST)}</span>
                              <span style={{ color: '#9CA3AF', fontSize: 10, marginLeft: 6 }}>GST {fmt(t.gstAmount)}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Purchases */}
                    <div style={{ marginBottom: 14 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', marginBottom: 6 }}>Purchases &amp; Expenses</div>
                      <div style={{ border: `1px solid ${X_BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
                        {purchaseTxs.map((t, i) => (
                          <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, padding: '6px 10px', borderBottom: i < purchaseTxs.length - 1 ? `1px solid ${X_BORDER}` : 'none', background: i % 2 === 0 ? 'white' : '#F9FAFB' }}>
                            <span style={{ color: '#374151' }}>{t.payee}</span>
                            <div style={{ textAlign: 'right' }}>
                              <span style={{ color: '#374151', fontFamily: 'monospace' }}>${fmt(t.amountInclGST)}</span>
                              {ACCOUNT_MAP[t.correctCode]?.hasGST
                                ? <span style={{ color: '#9CA3AF', fontSize: 10, marginLeft: 6 }}>GST {fmt(t.gstAmount)}</span>
                                : <span style={{ color: '#D1D5DB', fontSize: 10, marginLeft: 6 }}>No GST</span>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Duplicate note */}
                    <div style={{ padding: '8px 10px', background: '#FEF2F2', border: `1px solid ${X_RED}33`, borderRadius: 4, fontSize: 11, color: '#991B1B' }}>
                      ⚠ 1 duplicate excluded — not included in this return
                    </div>
                  </div>

                  {/* Right: GST return boxes */}
                  <div style={{ padding: '16px 0' }}>
                    {/* Sales and Income section */}
                    <div style={{ padding: '0 20px 12px', borderBottom: `1px solid ${X_BORDER}`, marginBottom: 12 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 8 }}>Sales and Income</div>
                      <div style={{ border: `1px solid ${X_BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
                        <GSTRow boxNum="5"  label="Total sales and income"                     value={box5} />
                        <GSTRow boxNum="6"  label="Zero-rated supplies"                         value={0} />
                        <GSTRow boxNum="7"  label="Net GST sales and income"                    value={box5} />
                        <GSTRow boxNum="8"  label="Total GST collected on sales and income"     value={gstTruth.gstOnSales} bold />
                        <GSTRow boxNum="9"  label="Any debit adjustments"                       value={0} />
                        <div style={{ display: 'flex', alignItems: 'center', padding: '9px 16px' }}>
                          <span style={{ width: 52, flexShrink: 0, background: '#E5E7EB', color: '#374151', fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 3, textAlign: 'center' }}>Box 10</span>
                          <span style={{ flex: 1, fontSize: 13, color: '#374151', marginLeft: 12 }}>Total GST collected for the period</span>
                          <span style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 700, color: '#111827' }}>{fmt(gstTruth.gstOnSales)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Purchases and Expenses section */}
                    <div style={{ padding: '0 20px 12px', borderBottom: `1px solid ${X_BORDER}`, marginBottom: 12 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 8 }}>Purchases and Expenses</div>
                      <div style={{ border: `1px solid ${X_BORDER}`, borderRadius: 4, overflow: 'hidden' }}>
                        <GSTRow boxNum="11" label="Total purchases and expenses"                value={box11} />
                        <GSTRow boxNum="12" label="Total GST credits on purchases and expenses" value={gstTruth.gstOnPurchases} bold />
                        <GSTRow boxNum="13" label="Total credit adjustments"                    value={gstTruth.gstOnPurchases} />
                        <GSTRow boxNum="14" label="Total GST credit"                            value={gstTruth.gstOnPurchases} />
                      </div>
                    </div>

                    {/* Box 15 — GST to pay */}
                    <div style={{ padding: '0 20px 16px' }}>
                      <div style={{ background: X_BLUE, borderRadius: 4, display: 'flex', alignItems: 'center', padding: '12px 16px' }}>
                        <span style={{ background: 'rgba(255,255,255,0.25)', color: 'white', fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 3, marginRight: 12, flexShrink: 0 }}>Box 15</span>
                        <span style={{ flex: 1, color: 'white', fontWeight: 700, fontSize: 14 }}>GST to pay</span>
                        <span style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: 18, color: 'white' }}>${fmt(gstTruth.netGST)}</span>
                      </div>
                    </div>

                    {/* File Return / teaching note */}
                    <div style={{ padding: '0 20px' }}>
                      {!gstSubmitted ? (
                        <button onClick={handleGSTSubmit}
                          style={{ width: '100%', padding: '10px 0', background: X_BLUE, color: 'white', border: 'none', borderRadius: 4, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                          File GST Return
                        </button>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                          <div style={{ padding: '12px 14px', background: `${X_TEAL}18`, border: `1px solid ${X_TEAL}44`, borderRadius: 4, fontSize: 13, lineHeight: 1.6, color: X_NAVY }}>
                            <strong>Teaching note: </strong>{scenario.teaching}
                          </div>
                          <button onClick={handleNextScenario}
                            style={{ width: '100%', padding: '10px 0', background: X_TEAL, color: 'white', border: 'none', borderRadius: 4, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                            {scenarioIdx + 1 < 3 ? 'Next Business →' : 'See Results →'}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })()}
        </div>
      </div>
    </MiniGameShell>
  )
}
