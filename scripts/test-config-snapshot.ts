/**
 * Config Snapshot Integration Test
 *
 * Creates REAL games in the database to verify:
 * 1. New games store gameConfig snapshot
 * 2. Legacy games (null gameConfig) use fallback
 * 3. Round calculations use frozen config
 * 4. Custom config overrides work
 *
 * After running, you can login to the frontend and see these games.
 */

import { PrismaClient, type Prisma } from '@prisma/client'
import { getGameConfigForIndustry, calculateRoundMinus1 } from '../src/engine/gameEngine'
import { resolveGameConfig } from '../src/server/utils/configResolver'

const prisma = new PrismaClient()

type SnapshotConfigView = {
  capacityPerPlant?: number
  features?: unknown[]
  financial?: {
    startingCash?: number
  }
}

type CreatedGameWithTeams = {
  gameCode: string
  gamePin: string
  gameConfig: unknown
  industry: string
  capacityPerFactory: number | null
  scenarioSequence: number[]
  teams: Array<{ teamCode: string; teamPin: string }>
}

function toSnapshotConfig(value: unknown): SnapshotConfigView | undefined {
  if (!value || typeof value !== 'object') return undefined
  return value as SnapshotConfigView
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

// Helper to generate unique codes
function generateCode(prefix: string) {
  return `${prefix}${Math.random().toString(36).substring(2, 8).toUpperCase()}`
}

function generatePin() {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

// Test result tracking
const testResults: { name: string; passed: boolean; error?: string }[] = []

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`)
  }
}

async function createTestGames() {
  console.log('🧪 Starting Config Snapshot Integration Tests...\n')

  let game1: CreatedGameWithTeams
  let game2: CreatedGameWithTeams
  let game3: CreatedGameWithTeams

  // ========================================
  // TEST 1: Create new game with snapshot
  // ========================================
  console.log('TEST 1: Creating new game with Oil industry snapshot...')

  try {
    const oilConfig = getGameConfigForIndustry('Oil & Energy')
    const oilSnapshot = JSON.parse(JSON.stringify(oilConfig))

    game1 = await prisma.game.create({
      data: {
        gameCode: generateCode('OIL'),
        gamePin: generatePin(),
        name: 'TEST: Oil Industry with Snapshot',
        companyName: 'PetroTest Corp',
        industry: 'Oil & Energy',
        totalRounds: 3,
        scenarioSequence: [0, 1, 2],
        gameConfig: oilSnapshot as Prisma.InputJsonValue, // ← SNAPSHOT STORED
        teams: {
          create: [
            {
              teamCode: generateCode('T'),
              teamPin: generatePin(),
              name: 'Team Alpha',
              color: '#1e3a5f',
              displayOrder: 0
            }
          ]
        }
      },
      include: { teams: true }
    })

    // ASSERTIONS
    assert(game1.gameConfig !== null, 'gameConfig should not be null')
    assert(toSnapshotConfig(game1.gameConfig)?.capacityPerPlant === 2000000, 'Oil capacity should be 2,000,000')
    assert(toSnapshotConfig(game1.gameConfig)?.features?.length === 20, 'Should have 20 features')
    assert(toSnapshotConfig(game1.gameConfig)?.financial?.startingCash > 0, 'Should have starting cash')

    console.log(`✅ PASSED`)
    console.log(`   - Game: ${game1.gameCode}`)
    console.log(`   - Has gameConfig: ${!!game1.gameConfig} ✓`)
    console.log(`   - Capacity: ${toSnapshotConfig(game1.gameConfig)?.capacityPerPlant} ✓`)
    console.log(`   - Team login: ${game1.teams[0].teamCode} / ${game1.teams[0].teamPin}\n`)

    testResults.push({ name: 'TEST 1: Snapshot at creation', passed: true })
  } catch (error: unknown) {
    console.log(`❌ FAILED: ${getErrorMessage(error)}\n`)
    testResults.push({ name: 'TEST 1: Snapshot at creation', passed: false, error: getErrorMessage(error) })
    throw error
  }

  // ========================================
  // TEST 2: Create legacy game (no snapshot)
  // ========================================
  console.log('TEST 2: Creating legacy game (no snapshot, null gameConfig)...')

  try {
    game2 = await prisma.game.create({
      data: {
        gameCode: generateCode('LEG'),
        gamePin: generatePin(),
        name: 'TEST: Legacy Game (no snapshot)',
        companyName: 'Legacy Corp',
        industry: 'Automotive',
        totalRounds: 3,
        capacityPerFactory: 150000,
        scenarioSequence: [0, 1, 2],
        // gameConfig field omitted (undefined) to simulate legacy game
        teams: {
          create: [
            {
              teamCode: generateCode('T'),
              teamPin: generatePin(),
              name: 'Team Beta',
              color: '#c0392b',
              displayOrder: 0
            }
          ]
        }
      },
      include: { teams: true }
    })

    // ASSERTIONS
    assert(game2.gameConfig === null, 'gameConfig should be null for legacy game')
    assert(game2.industry === 'Automotive', 'Industry should be Automotive')

    console.log(`✅ PASSED`)
    console.log(`   - Game: ${game2.gameCode}`)
    console.log(`   - Has gameConfig: ${!!game2.gameConfig} ✓ (null as expected)`)
    console.log(`   - Will fallback to code resolution ✓`)
    console.log(`   - Team login: ${game2.teams[0].teamCode} / ${game2.teams[0].teamPin}\n`)

    testResults.push({ name: 'TEST 2: Legacy game (null config)', passed: true })
  } catch (error: unknown) {
    console.log(`❌ FAILED: ${getErrorMessage(error)}\n`)
    testResults.push({ name: 'TEST 2: Legacy game (null config)', passed: false, error: getErrorMessage(error) })
    throw error
  }

  // ========================================
  // TEST 3: Verify resolveGameConfig works
  // ========================================
  console.log('TEST 3: Testing resolveGameConfig() helper...')

  try {
    const resolvedOil = resolveGameConfig(game1)
    const resolvedLegacy = resolveGameConfig(game2)

    // ASSERTIONS
    assert(resolvedOil.capacityPerPlant === 2000000, 'Oil resolved capacity should be 2,000,000 from snapshot')
    assert(resolvedLegacy.capacityPerPlant === 150000, 'Automotive resolved capacity should be 150,000 from code fallback')
    assert(resolvedOil.featureCatalog.length === 20, 'Oil should have 20 features')
    assert(resolvedLegacy.featureCatalog.length === 20, 'Automotive should have 20 features')

    console.log(`✅ PASSED`)
    console.log(`   - Game 1 (Oil with snapshot): ${resolvedOil.capacityPerPlant} ✓`)
    console.log(`     Source: ${game1.gameConfig ? 'DB snapshot' : 'code fallback'} ✓`)
    console.log(`   - Game 2 (Legacy no snapshot): ${resolvedLegacy.capacityPerPlant} ✓`)
    console.log(`     Source: ${game2.gameConfig ? 'DB snapshot' : 'code fallback'} ✓\n`)

    testResults.push({ name: 'TEST 3: resolveGameConfig() function', passed: true })
  } catch (error: unknown) {
    console.log(`❌ FAILED: ${getErrorMessage(error)}\n`)
    testResults.push({ name: 'TEST 3: resolveGameConfig() function', passed: false, error: getErrorMessage(error) })
    throw error
  }

  // ========================================
  // TEST 4: Custom config override
  // ========================================
  console.log('TEST 4: Creating game with CUSTOM config override...')

  try {
    const baseConfig = getGameConfigForIndustry('Electronics & Technology')
    const customConfig = JSON.parse(JSON.stringify(baseConfig))

    // Override capacity to a weird custom value
    customConfig.capacityPerPlant = 777777
    customConfig.financial.startingCash = 50000000

    game3 = await prisma.game.create({
      data: {
        gameCode: generateCode('CUST'),
        gamePin: generatePin(),
        name: 'TEST: Custom Config Overrides',
        companyName: 'Custom Corp',
        industry: 'Electronics & Technology',
        totalRounds: 3,
        capacityPerFactory: 777777, // Also store in column for queries
        scenarioSequence: [0, 1, 2],
        gameConfig: customConfig as Prisma.InputJsonValue, // ← CUSTOM snapshot
        teams: {
          create: [
            {
              teamCode: generateCode('T'),
              teamPin: generatePin(),
              name: 'Team Gamma',
              color: '#27ae60',
              displayOrder: 0
            }
          ]
        }
      },
      include: { teams: true }
    })

    // ASSERTIONS
    assert(toSnapshotConfig(game3.gameConfig)?.capacityPerPlant === 777777, 'Custom capacity should be 777,777')
    assert(toSnapshotConfig(game3.gameConfig)?.financial?.startingCash === 50000000, 'Custom cash should be $50M')
    assert(game3.capacityPerFactory === 777777, 'capacityPerFactory column should match')

    console.log(`✅ PASSED`)
    console.log(`   - Game: ${game3.gameCode}`)
    console.log(`   - Custom capacity: ${toSnapshotConfig(game3.gameConfig)?.capacityPerPlant} ✓`)
    console.log(`   - Custom starting cash: ${toSnapshotConfig(game3.gameConfig)?.financial?.startingCash} ✓`)
    console.log(`   - Team login: ${game3.teams[0].teamCode} / ${game3.teams[0].teamPin}\n`)

    testResults.push({ name: 'TEST 4: Custom config overrides', passed: true })
  } catch (error: unknown) {
    console.log(`❌ FAILED: ${getErrorMessage(error)}\n`)
    testResults.push({ name: 'TEST 4: Custom config overrides', passed: false, error: getErrorMessage(error) })
    throw error
  }

  // ========================================
  // TEST 5: Play a round to verify frozen config used
  // ========================================
  console.log('TEST 5: Simulating round -1 (trial round) for all games...')

  try {
    const expectedCapacities = [2000000, 150000, 777777]
    const games = [game1, game2, game3]

    for (let i = 0; i < games.length; i++) {
      const game = games[i]
      const config = resolveGameConfig(game)
      const round0Results = calculateRoundMinus1(
        game.teams.length,
        config,
        game.scenarioSequence,
        1.0,
        { us: 0.22, asia: 0.60, europe: 0.18 }
      )

      // ASSERTIONS
      assert(config.capacityPerPlant === expectedCapacities[i],
        `${game.gameCode} should use capacity ${expectedCapacities[i]}`)
      assert(round0Results.teams.length === 1,
        `Round should have results for 1 team`)
      assert(round0Results.teams[0].productionUnits >= 0,
        'Team should have production units calculated')

      console.log(`   ${game.gameCode}: Trial round calculated ✓`)
      console.log(`      - Used capacity: ${config.capacityPerPlant} (expected: ${expectedCapacities[i]}) ✓`)
      console.log(`      - Production units: ${round0Results.teams[0].productionUnits.toLocaleString()} ✓`)
    }

    console.log(`✅ PASSED\n`)
    testResults.push({ name: 'TEST 5: Round calculations use frozen config', passed: true })
  } catch (error: unknown) {
    console.log(`❌ FAILED: ${getErrorMessage(error)}\n`)
    testResults.push({ name: 'TEST 5: Round calculations use frozen config', passed: false, error: getErrorMessage(error) })
    throw error
  }

  // ========================================
  // SUMMARY
  // ========================================
  console.log('\n' + '='.repeat(60))
  console.log('📊 TEST RESULTS SUMMARY')
  console.log('='.repeat(60))

  const passed = testResults.filter(t => t.passed).length
  const failed = testResults.filter(t => !t.passed).length
  const total = testResults.length

  testResults.forEach((test) => {
    const icon = test.passed ? '✅' : '❌'
    const status = test.passed ? 'PASSED' : 'FAILED'
    console.log(`${icon} ${test.name}: ${status}`)
    if (test.error) {
      console.log(`   Error: ${test.error}`)
    }
  })

  console.log('='.repeat(60))
  console.log(`TOTAL: ${passed}/${total} passed, ${failed} failed`)
  console.log('='.repeat(60))

  if (failed === 0) {
    console.log(`\n🎉 ALL TESTS PASSED!\n`)
    console.log(`🎮 LOGIN TO FRONTEND TO VERIFY:`)
    console.log(`   Go to: http://localhost:5173/team-login\n`)
    console.log(`   Game 1 (Oil):       ${game1.teams[0].teamCode} / ${game1.teams[0].teamPin}`)
    console.log(`   Game 2 (Legacy):    ${game2.teams[0].teamCode} / ${game2.teams[0].teamPin}`)
    console.log(`   Game 3 (Custom):    ${game3.teams[0].teamCode} / ${game3.teams[0].teamPin}\n`)
    console.log(`📝 MANUAL VERIFICATION:`)
    console.log(`   [ ] Login to Game 1 → check Oil industry params (capacity 2M)`)
    console.log(`   [ ] Login to Game 2 → check Automotive params (capacity 150K)`)
    console.log(`   [ ] Login to Game 3 → check custom capacity 777,777`)
    console.log(`   [ ] Play a round in Game 3 → verify capacity stays 777,777\n`)
  } else {
    console.log(`\n❌ SOME TESTS FAILED\n`)
  }

  console.log('='.repeat(60))

  return { game1, game2, game3 }
}

async function main() {
  try {
    await createTestGames()

    const failed = testResults.filter(t => !t.passed).length

    if (failed > 0) {
      console.log('\n❌ Tests failed. Exiting with error code 1.')
      process.exit(1)
    }

    console.log('\n🧹 CLEANUP:')
    console.log('   To delete test games, run: npm run test:cleanup\n')

  } catch (error: unknown) {
    console.error('\n💥 UNEXPECTED ERROR:', getErrorMessage(error))
    if (error instanceof Error && error.stack) {
      console.error(error.stack)
    }
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()


