import { useEffect, useMemo, useState } from 'react'

type CliPhaseLoaderProps = {
  phases?: string[]
  scheduleMs?: number[]
  slowMessageAfterMs?: number
  slowMessage?: string
  className?: string
}

const DEFAULT_PHASES = [
  'Initializing session',
  'Verifying game state',
  'Fetching performance data',
  'Building your dashboard',
]

const DEFAULT_SCHEDULE_MS = [0, 1800, 4200, 7000]

export function CliPhaseLoader({
  phases = DEFAULT_PHASES,
  scheduleMs = DEFAULT_SCHEDULE_MS,
  slowMessageAfterMs = 9500,
  slowMessage = 'Still working on large data set...',
  className,
}: CliPhaseLoaderProps) {
  const [activeIndex, setActiveIndex] = useState(0)
  const [showSlowMessage, setShowSlowMessage] = useState(false)
  const [elapsedMs, setElapsedMs] = useState(0)

  const normalizedSchedule = useMemo(() => {
    if (scheduleMs.length === phases.length) return scheduleMs
    return phases.map((_, index) => DEFAULT_SCHEDULE_MS[index] ?? (DEFAULT_SCHEDULE_MS[DEFAULT_SCHEDULE_MS.length - 1] + (index - DEFAULT_SCHEDULE_MS.length + 1) * 1800))
  }, [phases, scheduleMs])

  useEffect(() => {
    const startedAt = Date.now()
    const tick = window.setInterval(() => {
      setElapsedMs(Date.now() - startedAt)
    }, 120)

    const timers = normalizedSchedule.map((delay, index) =>
      window.setTimeout(() => setActiveIndex(index), Math.max(0, delay))
    )
    const slowTimer = window.setTimeout(() => setShowSlowMessage(true), slowMessageAfterMs)

    return () => {
      window.clearInterval(tick)
      timers.forEach((timerId) => window.clearTimeout(timerId))
      window.clearTimeout(slowTimer)
    }
  }, [normalizedSchedule, slowMessageAfterMs])

  const getPhasePercent = (index: number) => {
    if (index < activeIndex) return 100
    if (index > activeIndex) return 0

    const start = normalizedSchedule[index] ?? 0
    const next = normalizedSchedule[index + 1] ?? slowMessageAfterMs
    const span = Math.max(600, next - start)
    const rawPercent = ((elapsedMs - start) / span) * 100
    return Math.max(1, Math.min(99, Math.round(rawPercent)))
  }

  const makeBar = (percent: number) => {
    const total = 14
    const filled = Math.max(0, Math.min(total, Math.round((percent / 100) * total)))
    return `${'|'.repeat(filled)}${'.'.repeat(total - filled)}`
  }

  return (
    <div className={`dm-cli-loader ${className ?? ''}`.trim()} role="status" aria-live="polite" aria-busy="true">
      <div className="dm-cli-loader-body">
        {phases.map((phase, index) => {
          const isDone = index < activeIndex
          const isActive = index === activeIndex
          const percent = getPhasePercent(index)
          const bar = makeBar(percent)
          return (
            <div
              key={phase}
              className={[
                'dm-cli-loader-line',
                isDone ? 'is-done' : '',
                isActive ? 'is-active' : '',
              ].join(' ').trim()}
            >
              <span className="dm-cli-loader-prefix">[{index + 1}/{phases.length}]</span>
              <span className="dm-cli-loader-text">{phase}</span>
              <span className="dm-cli-loader-metric" aria-hidden="true">[{bar}] {String(percent).padStart(3, ' ')}%</span>
              {isActive && <span className="dm-cli-loader-cursor" aria-hidden="true">|</span>}
            </div>
          )
        })}
        {showSlowMessage && (
          <div className="dm-cli-loader-slow">{slowMessage}</div>
        )}
      </div>
    </div>
  )
}
