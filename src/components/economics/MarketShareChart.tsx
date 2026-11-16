import { useMemo } from 'react'
import type { TeamRow } from '../../utils/normalizeTeamRow'

interface MarketShareChartProps {
  currentTeamData: TeamRow | null
  allRoundsData: Array<{ roundNumber: number; teams: TeamRow[] }>
  regionLabels: { us: string; asia: string; europe: string }
}

type RoundRow = {
  round: number
  hhi: number
  structure: string
  topTeam: string
  topShare: number
  shares: Record<string, number>
  transitionNote: string
}

function pct(v: number) {
  return `${v.toFixed(1)}%`
}

function shareBg(share: number, teamCount: number): string {
  const equal = 100 / teamCount
  const ratio = share / equal // 1.0 = exactly equal share
  if (ratio >= 1.3) return 'rgba(34, 197, 94, 0.25)'   // well above average → green
  if (ratio >= 1.05) return 'rgba(34, 197, 94, 0.12)'   // slightly above → light green
  if (ratio >= 0.7) return 'transparent'                  // near average → neutral
  if (ratio >= 0.4) return 'rgba(234, 179, 8, 0.12)'    // below average → light amber
  return 'rgba(239, 68, 68, 0.12)'                        // well below → light red
}

function roundLabel(round: number) {
  if (round === -1) return 'Starting Position'
  if (round === 0) return 'Trial Round'
  return `Round ${round}`
}

function classifyStructure(round: number, hhi: number, topShare: number) {
  if (round === -1) return 'Perfect Competition (Baseline)'
  if (hhi < 2600 && topShare < 30) return 'Balanced Competition'
  if (hhi < 3200) return 'Emerging Oligopoly'
  return 'Dominant Oligopoly'
}

export function MarketShareChart({
  currentTeamData,
  allRoundsData,
  regionLabels,
}: MarketShareChartProps) {
  void currentTeamData
  void regionLabels

  const model = useMemo(() => {
    if (!Array.isArray(allRoundsData) || allRoundsData.length === 0) return null

    const rounds = allRoundsData
      .filter((round) => round.roundNumber >= -1)
      .sort((a, b) => a.roundNumber - b.roundNumber)

    if (rounds.length === 0) return null

    const teamNamesSet = new Set<string>()
    rounds.forEach((round) => round.teams.forEach((team) => teamNamesSet.add(team.teamName)))
    const teamNames = Array.from(teamNamesSet).sort((a, b) => a.localeCompare(b))
    if (teamNames.length === 0) return null

    const rows: RoundRow[] = rounds.map((round, idx) => {
      const shares: Record<string, number> = {}

      if (round.roundNumber === -1) {
        // Teaching baseline: force equal shares at Round -1.
        const equalShare = 100 / teamNames.length
        teamNames.forEach((name) => {
          shares[name] = equalShare
        })
      } else {
        const totalUnits = round.teams.reduce((sum, team) => sum + (team.unitsSold ?? 0), 0)
        if (totalUnits <= 0) {
          const equalShare = 100 / teamNames.length
          teamNames.forEach((name) => {
            shares[name] = equalShare
          })
        } else {
          teamNames.forEach((name) => {
            const team = round.teams.find((t) => t.teamName === name)
            const units = team?.unitsSold ?? 0
            shares[name] = (units / totalUnits) * 100
          })
        }
      }

      let hhi = 0
      let topTeam = teamNames[0]
      let topShare = shares[topTeam] ?? 0
      teamNames.forEach((name) => {
        const share = shares[name] ?? 0
        hhi += share * share
        if (share > topShare) {
          topShare = share
          topTeam = name
        }
      })

      const structure = classifyStructure(round.roundNumber, hhi, topShare)

      let transitionNote = 'Baseline: equal shares assumed for teaching perfect competition.'
      if (round.roundNumber !== -1 && idx > 0) {
        const prev = rowsSafeShare(rounds[idx - 1], teamNames)
        const prevHhi = teamNames.reduce((sum, name) => sum + (prev[name] ?? 0) ** 2, 0)
        const prevTop = Math.max(...teamNames.map((name) => prev[name] ?? 0), 0)
        const hhiDelta = hhi - prevHhi
        const topDelta = topShare - prevTop

        if (hhiDelta > 120) {
          transitionNote = `Concentration rising (+${Math.round(hhiDelta)} HHI), leader strengthened (${topDelta >= 0 ? '+' : ''}${topDelta.toFixed(1)} pts).`
        } else if (hhiDelta < -120) {
          transitionNote = `Competition increased (${Math.round(hhiDelta)} HHI), leader weakened (${topDelta >= 0 ? '+' : ''}${topDelta.toFixed(1)} pts).`
        } else {
          transitionNote = `Structure mostly stable (${hhiDelta >= 0 ? '+' : ''}${Math.round(hhiDelta)} HHI).`
        }
      }

      return {
        round: round.roundNumber,
        hhi: Math.round(hhi),
        structure,
        topTeam,
        topShare,
        shares,
        transitionNote,
      }
    })

    const first = rows[0]
    const latest = rows[rows.length - 1]
    const milestoneRounds = [1, 3, 5]
    const milestoneRows = milestoneRounds
      .map((target) => rows.find((row) => row.round === target))
      .filter((row): row is RoundRow => Boolean(row))
    const includeLatest = milestoneRows.every((row) => row.round !== latest.round)
    const evolutionRows = includeLatest ? [...milestoneRows, latest] : milestoneRows

    return { teamNames, rows, first, latest, evolutionRows }
  }, [allRoundsData])

  if (!model) {
    return (
      <div style={{
        padding: '24px',
        background: 'var(--bg-secondary)',
        borderRadius: '8px',
        border: '1px solid var(--border-color)',
        marginBottom: '24px',
      }}>
        <h4 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '12px', color: 'var(--text-main)' }}>
          1. Global Competitive Dynamics
        </h4>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
          No data available yet.
        </p>
      </div>
    )
  }

  return (
    <div style={{
      background: 'var(--bg-main)',
      border: '1px solid var(--border-color)',
      borderRadius: '8px',
      padding: '24px',
      marginBottom: '32px',
    }}>
      <h4 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '8px', color: 'var(--text-main)' }}>
        1. Global Competitive Dynamics
      </h4>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '12px', fontSize: '0.9rem' }}>
        Shares are computed from global units sold across {regionLabels.us}, {regionLabels.asia}, and {regionLabels.europe}. Round -1 is shown as a perfect competition teaching baseline.
      </p>

      <div style={{
        marginBottom: '12px',
        padding: '10px 12px',
        borderRadius: '6px',
        border: '1px solid var(--border-color)',
        background: 'var(--bg-secondary)',
        color: 'var(--text-secondary)',
        fontSize: '0.86rem',
        lineHeight: 1.45,
      }}>
        <div>
          <strong>HHI Formula:</strong> HHI = Σ(share<sub>i</sub><sup>2</sup>), where each market share is in percent.
        </div>
        <div>Example with 4 equal teams: 25^2 + 25^2 + 25^2 + 25^2 = 2,500.</div>
      </div>

      <div style={{ display: 'grid', gap: '12px' }}>
        <div style={{ overflowX: 'auto', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
          <div style={{ padding: '8px 10px', fontWeight: 700, borderBottom: '1px solid var(--border-color)', background: 'var(--bg-secondary)' }}>
            Evolution Snapshot
          </div>
          <table style={{ width: '100%', minWidth: '760px', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--bg-secondary)' }}>
                <th style={{ textAlign: 'left', padding: '10px 12px', borderBottom: '1px solid var(--border-color)' }}>Round</th>
                <th style={{ textAlign: 'left', padding: '10px 12px', borderBottom: '1px solid var(--border-color)' }}>Shares</th>
                <th style={{ textAlign: 'right', padding: '10px 12px', borderBottom: '1px solid var(--border-color)' }}>HHI</th>
                <th style={{ textAlign: 'left', padding: '10px 12px', borderBottom: '1px solid var(--border-color)' }}>Type</th>
              </tr>
            </thead>
            <tbody>
              {model.evolutionRows.map((row) => (
                <tr key={`evo-${row.round}`} style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '10px 12px', fontWeight: 700 }}>{roundLabel(row.round)}</td>
                  <td style={{ padding: '10px 12px', color: 'var(--text-secondary)' }}>
                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                      {model.teamNames.map((name) => {
                        const share = row.shares[name] ?? 0
                        return (
                          <span
                            key={`evo-share-${row.round}-${name}`}
                            style={{
                              padding: '2px 6px',
                              borderRadius: '4px',
                              background: shareBg(share, model.teamNames.length),
                              fontSize: '0.85rem',
                            }}
                            title={`${name}: ${pct(share)}`}
                          >
                            {pct(share)}
                          </span>
                        )
                      })}
                    </div>
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700 }}>{row.hhi}</td>
                  <td style={{ padding: '10px 12px' }}>{row.structure}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ overflowX: 'auto', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
          <div style={{ padding: '8px 10px', fontWeight: 700, borderBottom: '1px solid var(--border-color)', background: 'var(--bg-secondary)' }}>
            Table A: Global Market Share by Round
          </div>
          <table style={{ width: '100%', minWidth: '780px', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--bg-secondary)' }}>
                <th style={{ textAlign: 'left', padding: '10px 12px', borderBottom: '1px solid var(--border-color)' }}>Round</th>
                <th style={{ textAlign: 'left', padding: '10px 12px', borderBottom: '1px solid var(--border-color)' }}>Type</th>
                {model.teamNames.map((name) => (
                  <th key={`head-share-${name}`} style={{ textAlign: 'right', padding: '10px 12px', borderBottom: '1px solid var(--border-color)' }}>{name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {model.rows.map((row) => (
                <tr key={`share-row-${row.round}`} style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '10px 12px', fontWeight: 700 }}>{roundLabel(row.round)}</td>
                  <td style={{ padding: '10px 12px' }}>{row.structure}</td>
                  {model.teamNames.map((name) => {
                    const share = row.shares[name] ?? 0
                    return (
                      <td
                        key={`share-${row.round}-${name}`}
                        style={{
                          padding: '10px 12px',
                          textAlign: 'right',
                          background: shareBg(share, model.teamNames.length),
                          fontWeight: share >= 100 / model.teamNames.length * 1.3 ? 700 : 400,
                        }}
                      >
                        {pct(share)}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ overflowX: 'auto', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
          <div style={{ padding: '8px 10px', fontWeight: 700, borderBottom: '1px solid var(--border-color)', background: 'var(--bg-secondary)' }}>
            Table B: Concentration Summary (HHI)
          </div>
          <table style={{ width: '100%', minWidth: '680px', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--bg-secondary)' }}>
                <th style={{ textAlign: 'left', padding: '10px 12px', borderBottom: '1px solid var(--border-color)' }}>Round</th>
                <th style={{ textAlign: 'right', padding: '10px 12px', borderBottom: '1px solid var(--border-color)' }}>HHI</th>
                <th style={{ textAlign: 'left', padding: '10px 12px', borderBottom: '1px solid var(--border-color)' }}>Market Structure</th>
                <th style={{ textAlign: 'left', padding: '10px 12px', borderBottom: '1px solid var(--border-color)' }}>Top Team</th>
                <th style={{ textAlign: 'right', padding: '10px 12px', borderBottom: '1px solid var(--border-color)' }}>Top Share</th>
              </tr>
            </thead>
            <tbody>
              {model.rows.map((row) => (
                <tr key={`hhi-row-${row.round}`} style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '10px 12px', fontWeight: 700 }}>{roundLabel(row.round)}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700 }}>{row.hhi}</td>
                  <td style={{ padding: '10px 12px' }}>{row.structure}</td>
                  <td style={{ padding: '10px 12px' }}>{row.topTeam}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right' }}>{pct(row.topShare)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ overflowX: 'auto', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
          <div style={{ padding: '8px 10px', fontWeight: 700, borderBottom: '1px solid var(--border-color)', background: 'var(--bg-secondary)' }}>
            Table C: Transition Notes
          </div>
          <table style={{ width: '100%', minWidth: '620px', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--bg-secondary)' }}>
                <th style={{ textAlign: 'left', padding: '10px 12px', borderBottom: '1px solid var(--border-color)' }}>Round</th>
                <th style={{ textAlign: 'left', padding: '10px 12px', borderBottom: '1px solid var(--border-color)' }}>Teaching Note</th>
              </tr>
            </thead>
            <tbody>
              {model.rows.map((row) => (
                <tr key={`note-row-${row.round}`} style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '10px 12px', fontWeight: 700 }}>{roundLabel(row.round)}</td>
                  <td style={{ padding: '10px 12px', color: 'var(--text-secondary)' }}>{row.transitionNote}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{
        marginTop: '12px',
        padding: '10px 12px',
        borderRadius: '6px',
        border: '1px solid var(--border-color)',
        background: 'var(--bg-secondary)',
        color: 'var(--text-secondary)',
        fontSize: '0.86rem',
        lineHeight: 1.45,
      }}>
        HHI progression: {model.first.hhi} {'->'} {model.latest.hhi}. Current leader: {model.latest.topTeam} ({pct(model.latest.topShare)}). Higher HHI means stronger concentration and fewer effective competitors.
      </div>
    </div>
  )
}

function rowsSafeShare(round: { roundNumber: number; teams: TeamRow[] }, teamNames: string[]) {
  const shares: Record<string, number> = {}
  if (round.roundNumber === -1) {
    const equal = 100 / teamNames.length
    teamNames.forEach((name) => {
      shares[name] = equal
    })
    return shares
  }

  const totalUnits = round.teams.reduce((sum, team) => sum + (team.unitsSold ?? 0), 0)
  if (totalUnits <= 0) {
    const equal = 100 / teamNames.length
    teamNames.forEach((name) => {
      shares[name] = equal
    })
    return shares
  }

  teamNames.forEach((name) => {
    const team = round.teams.find((t) => t.teamName === name)
    shares[name] = team ? ((team.unitsSold ?? 0) / totalUnits) * 100 : 0
  })
  return shares
}
