import { useEffect, useState } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { authApi } from '../api/client'

type RequireAuthProps = {
    role?: 'admin' | 'educator' | 'team'
    redirectTo?: string
}

export const RequireAuth = ({ role, redirectTo = '/modlab' }: RequireAuthProps) => {
    const [loading, setLoading] = useState(true)
    const [authorized, setAuthorized] = useState(false)
    const location = useLocation()

    useEffect(() => {
        const checkAuth = async () => {
            try {
                const res = await authApi.me(role)
                if (res.success) {
                    setAuthorized(true)
                } else {
                    setAuthorized(false)
                }
            } catch {
                setAuthorized(false)
            } finally {
                setLoading(false)
            }
        }

        checkAuth()
    }, [role])

    if (loading) {
        return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading...</div>
    }

    if (!authorized) {
        // Redirect to login, saving the current location
        return <Navigate to={redirectTo} state={{ from: location }} replace />
    }

    return <Outlet />
}
