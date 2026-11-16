/**
 * Game Types for Strategy Simulation
 *
 * This file provides type aliases and interfaces for the strategy simulation framework.
 */

import type { AIDecision } from '../engine/aiEngine'
import type { TeamState as EngineTeamState } from '../components/DecisionSimulator'
import type { RoundResults, TeamResults } from '../engine/gameEngine'

/**
 * Decision - Type alias for AI decisions
 * Used in strategy simulation to represent team decisions for a round
 */
export type Decision = AIDecision

/**
 * TeamData - Team state for processing a round
 * Maps to the engine's TeamState interface
 */
export type TeamData = EngineTeamState

/**
 * RoundResult - Results from processing a single round
 * Maps to the engine's RoundResults interface
 */
export type RoundResult = RoundResults

/**
 * Single team's results from a round
 */
export type TeamRoundResult = TeamResults
