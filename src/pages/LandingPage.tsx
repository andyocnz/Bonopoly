import { useEffect } from 'react'

export function LandingPage() {
  useEffect(() => {
    window.location.replace('/landing.html')
  }, [])

  return null
}

export default LandingPage
