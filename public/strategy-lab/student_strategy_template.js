// name: Market Share Challenger
// author: Your Name
// description: Adjust price and output based on share trend and inventory pressure.

// REQUIRED: define execute(context) and return DecisionModifiers object.
// context fields:
// - context.round, context.totalRounds, context.scenarioId
// - context.myTeam (cash, inventory, production, marketShare, prices, etc.)
// - context.competitors (array of team snapshots)
// - context.marketData (avgPrice, totalDemand, priceRange, etc.)
// - context.history (recent rounds)
//
// Allowed return fields (all optional):
// - priceMultiplier: { us, asia, europe } each 0.5 to 2.0
// - absolutePrices: { us, asia, europe }
// - productionMultiplier: number (0.1 to 3.0) or { us, asia }
// - rdInvestmentMultiplier: number (0 to 5)
// - forceInvestment: { us, asia } each 0 to 3
// - blockInvestment: boolean
// - regionalFocus: 'us' | 'asia' | 'europe'
// - cooperativeMode: boolean
// - aggressiveMode: boolean

function execute(context) {
  var avgShare = context.marketData && context.marketData.avgMarketShare ? context.marketData.avgMarketShare : 0.25;
  var myShare = 0;
  if (context.myTeam && context.myTeam.marketShare) {
    myShare = (context.myTeam.marketShare.us + context.myTeam.marketShare.asia + context.myTeam.marketShare.europe) / 3;
  }

  var shareGap = avgShare - myShare;
  var priceCut = shareGap > 0.02 ? 0.96 : 1.01;

  var lowInventory = false;
  if (context.myTeam && context.myTeam.inventory) {
    lowInventory = (context.myTeam.inventory.us + context.myTeam.inventory.asia) < 20000;
  }

  return {
    priceMultiplier: {
      us: priceCut,
      asia: priceCut,
      europe: priceCut
    },
    productionMultiplier: lowInventory ? { us: 1.1, asia: 1.1 } : { us: 1.0, asia: 1.0 },
    rdInvestmentMultiplier: context.round > context.totalRounds * 0.6 ? 1.15 : 1.0
  };
}

