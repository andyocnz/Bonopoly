import { useEffect, useRef } from 'react'

/**
 * A hook that polls a function at a specified interval, but only when the page is visible.
 * Automatically pauses polling when the browser tab is hidden to reduce unnecessary API calls.
 *
 * @param pollFn - The async function to call on each poll
 * @param interval - Polling interval in milliseconds
 * @param enabled - Whether polling is enabled (default: true)
 */
export function useVisibilityPolling(
  pollFn: () => void | Promise<void>,
  interval: number,
  enabled = true
) {
  const savedCallback = useRef(pollFn)
  const intervalIdRef = useRef<NodeJS.Timeout | null>(null)
  const isVisibleRef = useRef(true)

  // Update callback ref when pollFn changes
  useEffect(() => {
    savedCallback.current = pollFn
  }, [pollFn])

  useEffect(() => {
    if (!enabled) {
      if (intervalIdRef.current) {
        clearInterval(intervalIdRef.current)
        intervalIdRef.current = null
      }
      return
    }

    // Track page visibility
    const handleVisibilityChange = () => {
      const isVisible = document.visibilityState === 'visible'
      isVisibleRef.current = isVisible

      if (isVisible) {
        // Page became visible - poll immediately and restart interval
        savedCallback.current()
        if (intervalIdRef.current) clearInterval(intervalIdRef.current)
        intervalIdRef.current = setInterval(() => {
          if (isVisibleRef.current) {
            savedCallback.current()
          }
        }, interval)
      } else {
        // Page hidden - stop polling to save bandwidth
        if (intervalIdRef.current) {
          clearInterval(intervalIdRef.current)
          intervalIdRef.current = null
        }
      }
    }

    // Initial poll
    savedCallback.current()

    // Start polling if page is visible
    if (document.visibilityState === 'visible') {
      intervalIdRef.current = setInterval(() => {
        if (isVisibleRef.current) {
          savedCallback.current()
        }
      }, interval)
    }

    // Listen for visibility changes
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      if (intervalIdRef.current) {
        clearInterval(intervalIdRef.current)
        intervalIdRef.current = null
      }
    }
  }, [interval, enabled])
}
