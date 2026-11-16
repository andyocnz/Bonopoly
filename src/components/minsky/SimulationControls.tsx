// ── Simulation Controls Component ──
// Play/Pause/Step/Reset buttons + speed slider + time display.

interface SimulationControlsProps {
  running: boolean
  t: number
  speed: number
  onPlay: () => void
  onPause: () => void
  onStep: () => void
  onReset: () => void
  onSpeedChange: (speed: number) => void
}

export function SimulationControls({
  running,
  t,
  speed,
  onPlay,
  onPause,
  onStep,
  onReset,
  onSpeedChange,
}: SimulationControlsProps) {
  return (
    <div className="minsky-sim-controls">
      <div className="minsky-sim-buttons">
        {running ? (
          <button className="minsky-sim-btn minsky-btn-pause" onClick={onPause} title="Pause">
            <span className="minsky-btn-icon">&#9646;&#9646;</span>
            Pause
          </button>
        ) : (
          <button className="minsky-sim-btn minsky-btn-play" onClick={onPlay} title="Play">
            <span className="minsky-btn-icon">&#9654;</span>
            Play
          </button>
        )}
        <button
          className="minsky-sim-btn minsky-btn-step"
          onClick={onStep}
          disabled={running}
          title="Step"
        >
          <span className="minsky-btn-icon">&#9654;|</span>
          Step
        </button>
        <button className="minsky-sim-btn minsky-btn-reset" onClick={onReset} title="Reset">
          <span className="minsky-btn-icon">&#8634;</span>
          Reset
        </button>
      </div>

      <div className="minsky-sim-speed">
        <label className="minsky-speed-label">Speed</label>
        <span className="minsky-speed-slow">Slow</span>
        <input
          type="range"
          className="minsky-speed-slider"
          min={1}
          max={20}
          step={1}
          value={speed}
          onChange={e => onSpeedChange(parseInt(e.target.value))}
        />
        <span className="minsky-speed-fast">Fast</span>
        <span className="minsky-speed-value">{speed}x</span>
      </div>

      <div className="minsky-sim-time">
        <span className="minsky-time-label">t =</span>
        <span className="minsky-time-value">{t.toFixed(1)}</span>
        <span className="minsky-time-unit">years</span>
      </div>
    </div>
  )
}
