import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { publicApi } from '../api/client'
import { decryptInvoiceData } from '../utils/crypto'
import COMPANY_DETAILS from '../data/companyDetails.json'

type InvoiceTransaction = {
    id: string
    amount: number
    educatorEmail: string
    createdAt: string
}

type InvoiceDetails = {
    up: number
    ds: number
    nm?: string
    ph?: string
}

function isInvoiceDetails(value: unknown): value is InvoiceDetails {
    if (!value || typeof value !== 'object') return false
    const candidate = value as Partial<InvoiceDetails>
    return typeof candidate.up === 'number' && typeof candidate.ds === 'number'
}

export function InvoicePage() {
    const { txId } = useParams()
    const [searchParams] = useSearchParams()
    const [tx, setTx] = useState<InvoiceTransaction | null>(null)
    const [details, setDetails] = useState<InvoiceDetails | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')

    useEffect(() => {
        async function init() {
            try {
                const dataParam = searchParams.get('d')
                if (!dataParam) {
                    setError('Invalid invoice link (missing data)')
                    setLoading(false)
                    return
                }

                const decoded = decryptInvoiceData(dataParam)
                if (!isInvoiceDetails(decoded)) {
                    setError('Invalid invoice link (signature mismatch)')
                    setLoading(false)
                    return
                }
                setDetails(decoded)

                if (!txId) {
                    setError('Missing transaction ID')
                    setLoading(false)
                    return
                }

                const res = await publicApi.getInvoice(txId)

                if (!res.success) {
                    setError('Transaction not found')
                } else {
                    setTx(res.transaction as InvoiceTransaction)
                }
            } catch {
                setError('Failed to load invoice')
            } finally {
                setLoading(false)
            }
        }
        init()
    }, [txId, searchParams])

    if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading Invoice...</div>
    if (error) return <div style={{ padding: '2rem', textAlign: 'center', color: '#ef4444' }}>{error}</div>
    if (!tx || !details) return null

    const subtotal = Math.abs(tx.amount) * details.up
    const discountAmount = (subtotal * details.ds) / 100
    const total = subtotal - discountAmount

    return (
        <div className="invoice-container" style={{
            background: 'white',
            color: '#1e293b',
            minHeight: '100vh',
            padding: '4rem 2rem',
            maxWidth: '800px',
            margin: '0 auto',
            fontFamily: 'system-ui, -apple-system, sans-serif'
        }}>
            {/* Print Button */}
            <div className="no-print" style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'flex-end' }}>
                <button
                    onClick={() => window.print()}
                    style={{
                        padding: '0.6rem 1.2rem',
                        background: '#3b82f6',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontWeight: 600
                    }}
                >
                    Download / Print PDF
                </button>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4rem' }}>
                <div>
                    <h1 style={{ margin: 0, fontSize: '2rem', color: '#0f172a' }}>INVOICE</h1>
                    <p style={{ color: '#64748b' }}>#INV-{tx.id.slice(0, 8).toUpperCase()}</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                    <h3 style={{ margin: 0 }}>{COMPANY_DETAILS.name}</h3>
                    <p style={{ margin: '0.25rem 0', fontSize: '0.9rem', color: '#64748b' }}>
                        {COMPANY_DETAILS.address}<br />
                        {COMPANY_DETAILS.website}<br />
                        GST: {COMPANY_DETAILS.gstNumber}
                    </p>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginBottom: '4rem' }}>
                <div>
                    <h4 style={{ textTransform: 'uppercase', fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.5rem' }}>Bill To</h4>
                    <p style={{ margin: 0, fontWeight: 700 }}>{details.nm || 'Educator'}</p>
                    <p style={{ margin: '0.25rem 0', color: '#475569' }}>{tx.educatorEmail}</p>
                    {details.ph && <p style={{ margin: 0, color: '#475569' }}>{details.ph}</p>}
                </div>
                <div style={{ textAlign: 'right' }}>
                    <h4 style={{ textTransform: 'uppercase', fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.5rem' }}>Invoice Details</h4>
                    <p style={{ margin: 0 }}><strong>Date:</strong> {new Date(tx.createdAt).toLocaleDateString()}</p>
                    <p style={{ margin: '0.25rem 0' }}><strong>Currency:</strong> {COMPANY_DETAILS.currency}</p>
                </div>
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '2rem' }}>
                <thead>
                    <tr style={{ borderBottom: '2px solid #e2e8f0', textAlign: 'left' }}>
                        <th style={{ padding: '1rem 0', color: '#64748b' }}>Description</th>
                        <th style={{ padding: '1rem 0', textAlign: 'right', color: '#64748b' }}>Qty</th>
                        <th style={{ padding: '1rem 0', textAlign: 'right', color: '#64748b' }}>Unit Price</th>
                        <th style={{ padding: '1rem 0', textAlign: 'right', color: '#64748b' }}>Amount</th>
                    </tr>
                </thead>
                <tbody>
                    <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '1.5rem 0' }}>
                            <strong>Simulation Tokens / Credits</strong><br />
                            <span style={{ fontSize: '0.85rem', color: '#64748b' }}>Credits for AI Decision Lab Simulation</span>
                        </td>
                        <td style={{ padding: '1.5rem 0', textAlign: 'right' }}>{Math.abs(tx.amount)}</td>
                        <td style={{ padding: '1.5rem 0', textAlign: 'right' }}>${details.up.toFixed(2)}</td>
                        <td style={{ padding: '1.5rem 0', textAlign: 'right' }}>${subtotal.toFixed(2)}</td>
                    </tr>
                </tbody>
            </table>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <div style={{ width: '250px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0' }}>
                        <span style={{ color: '#64748b' }}>Subtotal</span>
                        <span>${subtotal.toFixed(2)}</span>
                    </div>
                    {details.ds > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', color: '#10b981' }}>
                            <span>Discount ({details.ds}%)</span>
                            <span>-${discountAmount.toFixed(2)}</span>
                        </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '1rem 0', borderTop: '2px solid #0f172a', fontWeight: 800, fontSize: '1.25rem' }}>
                        <span>Total</span>
                        <span>${total.toFixed(2)}</span>
                    </div>
                </div>
            </div>

            <div style={{ marginTop: '6rem', borderTop: '1px solid #f1f5f9', paddingTop: '2rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem' }}>
                <p>Thank you for choosing AI Decision Lab. This is a computer-generated invoice.</p>
                <p style={{ margin: '0.5rem 0' }}>{COMPANY_DETAILS.website}</p>
            </div>

            <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
          .invoice-container { padding: 0 !important; margin: 0 !important; width: 100% !important; max-width: none !important; }
        }
      `}</style>
        </div>
    )
}
