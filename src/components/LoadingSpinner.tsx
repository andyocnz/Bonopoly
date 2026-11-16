export function LoadingSpinner() {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '400px',
        color: 'var(--text-secondary)',
      }}
    >
      <div className="spinner">Loading...</div>
    </div>
  )
}
