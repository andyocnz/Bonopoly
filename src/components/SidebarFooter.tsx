export function SidebarFooter() {
    const handleDisclaimerClick = () => {
        window.open('/legal', '_blank', 'noopener,noreferrer')
    }

    return (
        <div className="dm-sidebar-footer">
            <div className="dm-sidebar-footer-links">
                <button
                    type="button"
                    className="dm-sidebar-footer-link"
                    onClick={handleDisclaimerClick}
                >
                    Disclaimer
                </button>
            </div>
            <div className="dm-sidebar-disclaimer">
                AI Decision Lab is an educational simulation. All data is fictional.
            </div>
        </div>
    )
}
