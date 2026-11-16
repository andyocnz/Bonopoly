import { Router } from 'express'
import bankRunRouter from '../routes/minigames'
import fisheryRouter from '../routes/minigamesFishery'
import doubleAuctionRouter from '../routes/minigamesDoubleAuction'
import portfolioRouter from '../routes/minigamesPortfolio'
import inviteRouter from '../routes/minigameInvites'
import prisonersDilemmaRouter from '../routes/minigamesPrisonersDilemma'
import matchingPenniesRouter from '../routes/minigamesMatchingPennies'
import ultimatumRouter from '../routes/minigamesUltimatum'
import trustGameRouter from '../routes/minigamesTrustGame'
import publicGoodsRouter from '../routes/minigamesPublicGoods'
import cournotRouter from '../routes/minigamesCournot'
import bertrandRouter from '../routes/minigamesBertrand'
import englishAuctionRouter from '../routes/minigamesEnglishAuction'
import beautyContestRouter from '../routes/minigamesBeautyContest'
import monteCarloPiRouter from '../routes/minigamesMonteCarloPi'
import marketSurvivalRouter from '../routes/minigamesMarketSurvival'
import portfolioFrontierRouter from '../routes/minigamesPortfolioFrontier'
import adverseSelectionRouter from '../routes/minigamesAdverseSelection'
import signalingRouter from '../routes/minigamesSignaling'
import principalAgentRouter from '../routes/minigamesPrincipalAgent'
import monopolyRouter from '../routes/minigamesMonopoly'
import assetBubbleRouter from '../routes/minigamesAssetBubble'
import conflictOfInterestRouter from '../routes/minigamesConflictOfInterest'
import adAuctionRouter from '../routes/minigamesAdAuction'
import directorDutiesRouter from '../routes/minigamesDirectorDuties'
import socialInfluenceRouter from '../routes/minigamesSocialInfluence'
import cryptoBubbleRouter from '../routes/minigamesCryptoBubble'

const router = Router()

// Public/student-facing mini-game APIs.
router.use(bankRunRouter)
router.use(fisheryRouter)
router.use(doubleAuctionRouter)
router.use(portfolioRouter)
router.use(inviteRouter)
router.use(prisonersDilemmaRouter)
router.use(matchingPenniesRouter)
router.use(ultimatumRouter)
router.use(trustGameRouter)
router.use(publicGoodsRouter)
router.use(cournotRouter)
router.use(bertrandRouter)
router.use(englishAuctionRouter)
router.use(beautyContestRouter)
router.use(monteCarloPiRouter)
router.use(marketSurvivalRouter)
router.use(portfolioFrontierRouter)
router.use(adverseSelectionRouter)
router.use(signalingRouter)
router.use(principalAgentRouter)
router.use(monopolyRouter)
router.use(assetBubbleRouter)
router.use(conflictOfInterestRouter)
router.use(adAuctionRouter)
router.use(directorDutiesRouter)
router.use(socialInfluenceRouter)
router.use(cryptoBubbleRouter)

export default router
