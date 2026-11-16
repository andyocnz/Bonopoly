import { BrowserRouter, Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom'
import { lazy, Suspense, useEffect, useState } from 'react'
import { GameProvider } from './context/GameContext'
import { LoadingSpinner } from './components/LoadingSpinner'
import { RequireAuth } from './components/RequireAuth'
import { ErrorBoundary } from './components/ErrorBoundary'
import { authApi } from './api/client'
import './App.css'

// Lazy load all page components
const HomePage = lazy(() => import('./pages/HomePage').then(m => ({ default: m.HomePage })))
const LandingPage = lazy(() => import('./pages/LandingPage').then(m => ({ default: m.LandingPage })))
const TeamLoginPage = lazy(() => import('./pages/TeamLoginPage').then(m => ({ default: m.TeamLoginPage })))
const EducatorLoginPage = lazy(() => import('./pages/EducatorLoginPage').then(m => ({ default: m.EducatorLoginPage })))
const CreateGamePage = lazy(() => import('./pages/CreateGamePage').then(m => ({ default: m.CreateGamePage })))
const WaitingPage = lazy(() => import('./pages/WaitingPage').then(m => ({ default: m.WaitingPage })))
const MissionModernPage = lazy(() => import('./pages/MissionModernPage').then(m => ({ default: m.MissionModernPage })))
const ScenarioPage = lazy(() => import('./pages/ScenarioPage').then(m => ({ default: m.ScenarioPage })))
const DecisionsModernPage = lazy(() => import('./pages/DecisionsModernPage').then(m => ({ default: m.DecisionsModernPage })))
const ResultsModernPage = lazy(() => import('./pages/ResultsModernPage').then(m => ({ default: m.ResultsModernPage })))
const EducatorDashboardPage = lazy(() => import('./pages/EducatorDashboardPage').then(m => ({ default: m.EducatorDashboardPage })))
const AdminPage = lazy(() => import('./pages/AdminPage').then(m => ({ default: m.AdminPage })))
const SimulatorPage = lazy(() => import('./pages/SimulatorPage').then(m => ({ default: m.SimulatorPage })))
const StrategySimulatorPage = lazy(() => import('./pages/StrategySimulatorPage'))
const DemoGamePage = lazy(() => import('./pages/DemoGamePage'))
const EducatorGameView = lazy(() => import('./pages/EducatorGameView').then(m => ({ default: m.EducatorGameView })))
const LegalPage = lazy(() => import('./pages/LegalPage').then(m => ({ default: m.LegalPage })))
const InvoicePage = lazy(() => import('./pages/InvoicePage').then(m => ({ default: m.InvoicePage })))
const WeightsLabPage = lazy(() => import('./pages/WeightsLabPage').then(m => ({ default: m.WeightsLabPage })))
const StudentStrategyGuidePage = lazy(() => import('./pages/StudentStrategyGuidePage'))
const MinskyLabPage = lazy(() => import('./pages/MinskyLabPage'))
const CreditScoreMvpPage = lazy(() => import('./pages/CreditScoreMvpPage'))
const BankRunMiniGamePage = lazy(() => import('./pages/BankRunMiniGamePage'))
const FisheryMiniGamePage = lazy(() => import('./pages/FisheryMiniGamePage'))
const DoubleAuctionMiniGamePage = lazy(() => import('./pages/DoubleAuctionMiniGamePage'))
const PortfolioMonteCarloPage = lazy(() => import('./pages/PortfolioMonteCarloPage'))
const MiniGameJoinPage = lazy(() => import('./pages/MiniGameJoinPage'))
const PublicGoodsMiniGamePage = lazy(() => import('./pages/PublicGoodsMiniGamePage'))
const PrisonersDilemmaMiniGamePage = lazy(() => import('./pages/PrisonersDilemmaMiniGamePage'))
const MatchingPenniesMiniGamePage = lazy(() => import('./pages/MatchingPenniesMiniGamePage'))
const UltimatumMiniGamePage = lazy(() => import('./pages/UltimatumMiniGamePage'))
const TrustGameMiniGamePage = lazy(() => import('./pages/TrustGameMiniGamePage'))
const CournotMiniGamePage = lazy(() => import('./pages/CournotMiniGamePage'))
const BertrandMiniGamePage = lazy(() => import('./pages/BertrandMiniGamePage'))
const EnglishAuctionMiniGamePage = lazy(() => import('./pages/EnglishAuctionMiniGamePage'))
const BeautyContestMiniGamePage = lazy(() => import('./pages/BeautyContestMiniGamePage'))
const MonteCarloPiMiniGamePage = lazy(() => import('./pages/MonteCarloPiMiniGamePage'))
const MarketSurvivalMiniGamePage = lazy(() => import('./pages/MarketSurvivalMiniGamePage'))
const PortfolioFrontierMiniGamePage = lazy(() => import('./pages/PortfolioFrontierMiniGamePage'))
const AdverseSelectionMiniGamePage = lazy(() => import('./pages/AdverseSelectionMiniGamePage'))
const SignalingMiniGamePage = lazy(() => import('./pages/SignalingMiniGamePage'))
const PrincipalAgentMiniGamePage = lazy(() => import('./pages/PrincipalAgentMiniGamePage'))
const MonopolyPricingMiniGamePage = lazy(() => import('./pages/MonopolyPricingMiniGamePage'))
const AssetBubbleMiniGamePage = lazy(() => import('./pages/AssetBubbleMiniGamePage'))
const MarketBasketMiniGamePage = lazy(() => import('./pages/MarketBasketMiniGamePage'))
const ABTestingMiniGamePage = lazy(() => import('./pages/ABTestingMiniGamePage'))
const CustomerChurnMiniGamePage = lazy(() => import("./pages/CustomerChurnMiniGamePage"))
const ConflictOfInterestMiniGamePage = lazy(() => import("./pages/ConflictOfInterestMiniGamePage"))
const AdAuctionMiniGamePage = lazy(() => import("./pages/AdAuctionMiniGamePage"))
const DirectorDutiesMiniGamePage = lazy(() => import("./pages/DirectorDutiesMiniGamePage"))
const SocialInfluenceMiniGamePage = lazy(() => import("./pages/SocialInfluenceMiniGamePage"))
const CryptoBubbleMiniGamePage = lazy(() => import('./pages/CryptoBubbleMiniGamePage'))
const CapitalStructureLabMiniGamePage = lazy(() => import('./pages/CapitalStructureLabMiniGamePage'))
const XeroReconciliationMiniGamePage = lazy(() => import('./pages/XeroReconciliationMiniGamePage'))
const GameOfLifePage = lazy(() => import('./pages/GameOfLifePage'))

function MiniGameAccessGate() {
  const location = useLocation()
  const [checking, setChecking] = useState(true)
  const [allowed, setAllowed] = useState(false)

  useEffect(() => {
    let cancelled = false
    const query = new URLSearchParams(location.search)
    const hasPublicContext = Boolean(
      query.get('room') || query.get('invite') || query.get('hostToken'),
    )

    if (hasPublicContext) {
      setAllowed(true)
      setChecking(false)
      return
    }

    const checkEducator = async () => {
      try {
        const res = await authApi.me('educator')
        if (!cancelled) {
          setAllowed(Boolean(res.success && res.role === 'educator'))
        }
      } catch {
        if (!cancelled) setAllowed(false)
      } finally {
        if (!cancelled) setChecking(false)
      }
    }
    void checkEducator()
    return () => { cancelled = true }
  }, [location.search])

  if (checking) return <LoadingSpinner />
  if (!allowed) return <Navigate to="/educator-login" replace />
  return <Outlet />
}

function App() {
  return (
    <GameProvider>
      <BrowserRouter>
        <Suspense fallback={<LoadingSpinner />}>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/landing" element={<LandingPage />} />
            <Route path="/team-login" element={<TeamLoginPage />} />
            <Route path="/login-dev" element={<HomePage />} />
            <Route path="/educator-login" element={<EducatorLoginPage />} />
            <Route path="/educator" element={<CreateGamePage />} />
            <Route path="/waiting" element={<WaitingPage />} />
            <Route path="/dashboard" element={<Navigate to="/mission" replace />} />
            <Route path="/mission" element={<MissionModernPage />} />
            <Route path="/scenario" element={<ScenarioPage />} />
            <Route path="/decisions" element={<DecisionsModernPage />} />

            <Route path="/results" element={<ResultsModernPage />} />
            <Route path="/educator-dev" element={<EducatorGameView />} />
            <Route element={<RequireAuth role="admin" />}>
              <Route path="/admin-create" element={<CreateGamePage />} />
              <Route path="/admin-game" element={<EducatorDashboardPage />} />
              <Route path="/simulator" element={<SimulatorPage />} />
            </Route>
            <Route path="/modlab" element={<AdminPage />} />
            <Route element={<RequireAuth role="educator" redirectTo="/educator-login" />}>
              <Route path="/educator-dashboard" element={<EducatorDashboardPage />} />
              <Route path="/educator-dashboard/tournaments" element={<EducatorDashboardPage />} />
              <Route path="/strategy-lab" element={
                <ErrorBoundary>
                  <StrategySimulatorPage />
                </ErrorBoundary>
              } />
              <Route path="/student-strategy-lab" element={
                <ErrorBoundary>
                  <StrategySimulatorPage />
                </ErrorBoundary>
              } />
            </Route>
            {/* Weights Lab - accessible by both educator and admin, auth handled in component */}
            <Route path="/weights-lab" element={<WeightsLabPage />} />
            <Route path="/strategy-lab/student-guide" element={<StudentStrategyGuidePage />} />

            <Route path="/minsky-lab" element={<MinskyLabPage />} />
            <Route path="/credit-score-mvp" element={<Navigate to="/mini-games/credit-score" replace />} />
            <Route path="/mini-games/join" element={<MiniGameJoinPage />} />
            <Route element={<MiniGameAccessGate />}>
              <Route path="/mini-games/credit-score" element={<CreditScoreMvpPage />} />
              <Route path="/mini-games/bank-run" element={<BankRunMiniGamePage />} />
              <Route path="/mini-games/fishery" element={<FisheryMiniGamePage />} />
              <Route path="/mini-games/double-auction" element={<DoubleAuctionMiniGamePage />} />
              <Route path="/mini-games/portfolio-monte-carlo" element={<PortfolioMonteCarloPage />} />
              <Route path="/mini-games/public-goods" element={<PublicGoodsMiniGamePage />} />
              <Route path="/mini-games/prisoners-dilemma" element={<PrisonersDilemmaMiniGamePage />} />
              <Route path="/mini-games/matching-pennies" element={<MatchingPenniesMiniGamePage />} />
              <Route path="/mini-games/ultimatum" element={<UltimatumMiniGamePage />} />
              <Route path="/mini-games/trust-game" element={<TrustGameMiniGamePage />} />
              <Route path="/mini-games/cournot" element={<CournotMiniGamePage />} />
              <Route path="/mini-games/bertrand" element={<BertrandMiniGamePage />} />
              <Route path="/mini-games/english-auction" element={<EnglishAuctionMiniGamePage />} />
              <Route path="/mini-games/beauty-contest" element={<BeautyContestMiniGamePage />} />
              <Route path="/mini-games/monte-carlo-pi" element={<MonteCarloPiMiniGamePage />} />
              <Route path="/mini-games/market-survival" element={<MarketSurvivalMiniGamePage />} />
              <Route path="/mini-games/portfolio-frontier" element={<PortfolioFrontierMiniGamePage />} />
              <Route path="/mini-games/adverse-selection" element={<AdverseSelectionMiniGamePage />} />
              <Route path="/mini-games/signaling-game" element={<SignalingMiniGamePage />} />
              <Route path="/mini-games/principal-agent" element={<PrincipalAgentMiniGamePage />} />
              <Route path="/mini-games/monopoly-pricing" element={<MonopolyPricingMiniGamePage />} />
              <Route path="/mini-games/asset-bubble" element={<AssetBubbleMiniGamePage />} />
              <Route path="/mini-games/market-basket" element={<MarketBasketMiniGamePage />} />
              <Route path="/mini-games/ab-testing" element={<ABTestingMiniGamePage />} />
              <Route path="/mini-games/customer-churn" element={<CustomerChurnMiniGamePage />} />
              <Route path="/mini-games/conflict-of-interest" element={<ConflictOfInterestMiniGamePage />} />
              <Route path="/mini-games/ad-auction" element={<AdAuctionMiniGamePage />} />
              <Route path="/mini-games/director-duties" element={<DirectorDutiesMiniGamePage />} />
              <Route path="/mini-games/social-influence" element={<SocialInfluenceMiniGamePage />} />
              <Route path="/mini-games/crypto-bubble" element={<CryptoBubbleMiniGamePage />} />
              <Route path="/mini-games/capital-structure-lab" element={<CapitalStructureLabMiniGamePage />} />
              <Route path="/mini-games/xero-reconciliation" element={<XeroReconciliationMiniGamePage />} />
              <Route path="/mini-games/game-of-life" element={<GameOfLifePage />} />
            </Route>
            <Route path="/demo-game" element={<DemoGamePage />} />
            <Route path="/privacy" element={<LegalPage />} />
            <Route path="/legal" element={<LegalPage />} />
            <Route path="/invoice/:txId" element={<InvoicePage />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </GameProvider>
  )
}

export default App
