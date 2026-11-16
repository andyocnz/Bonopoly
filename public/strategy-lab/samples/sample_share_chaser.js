// name: Share Chaser Strategy
// author: Sample Bot
// description: Discounts when behind market share, normalizes when leading.

function execute(context) {
  var myShare = 0.25;
  if (context.myTeam && context.myTeam.marketShare) {
    myShare = ((context.myTeam.marketShare.us || 0) + (context.myTeam.marketShare.asia || 0) + (context.myTeam.marketShare.europe || 0)) / 3;
  }

  var avgShare = context.marketData && context.marketData.avgMarketShare ? context.marketData.avgMarketShare : 0.25;
  var behind = myShare < avgShare - 0.01;
  var ahead = myShare > avgShare + 0.02;

  return {
    priceMultiplier: {
      us: behind ? 0.95 : ahead ? 1.06 : 1.0,
      asia: behind ? 0.92 : ahead ? 1.04 : 0.98,
      europe: behind ? 0.97 : ahead ? 1.05 : 1.0
    },
    productionMultiplier: behind ? { us: 1.12, asia: 1.12 } : { us: 1.0, asia: 1.0 },
    regionalFocus: behind ? 'asia' : 'us'
  };
}

