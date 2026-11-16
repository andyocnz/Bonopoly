// ── Parameter Panel Component ──
// Horizontal bar of labeled sliders for adjusting model parameters in real-time.

import { useCallback } from 'react'
import type { MinskyVariable } from '../../types/minsky'

export interface ParameterConfig {
  id: string
  label: string
  min: number
  max: number
  step: number
  format: (v: number) => string
}

interface ParameterPanelProps {
  parameters: MinskyVariable[]
  configs: readonly ParameterConfig[]
  onParameterChange: (id: string, value: number) => void
  onResetParameter: (id: string) => void
}

export function ParameterPanel({
  parameters,
  configs,
  onParameterChange,
  onResetParameter,
}: ParameterPanelProps) {
  const getConfig = useCallback(
    (paramId: string) => configs.find(c => c.id === paramId),
    [configs]
  )

  return (
    <div className="minsky-param-panel">
      {parameters.map(param => {
        const config = getConfig(param.id)
        if (!config) return null
        return (
          <div key={param.id} className="minsky-param-item">
            <div className="minsky-param-header">
              <label className="minsky-param-label" title={param.description}>
                {config.label}
              </label>
              <span className="minsky-param-value">{config.format(param.value)}</span>
            </div>
            <div className="minsky-param-controls">
              <button
                className="minsky-param-btn"
                onClick={() =>
                  onParameterChange(param.id, Math.max(config.min, param.value - config.step))
                }
              >
                -
              </button>
              <input
                type="range"
                className="minsky-param-slider"
                min={config.min}
                max={config.max}
                step={config.step}
                value={param.value}
                onChange={e => onParameterChange(param.id, parseFloat(e.target.value))}
              />
              <button
                className="minsky-param-btn"
                onClick={() =>
                  onParameterChange(param.id, Math.min(config.max, param.value + config.step))
                }
              >
                +
              </button>
              <button
                className="minsky-param-reset"
                onClick={() => onResetParameter(param.id)}
                title="Reset to default"
              >
                &#8635;
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
