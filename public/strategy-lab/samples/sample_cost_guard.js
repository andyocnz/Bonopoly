// name: Cost Guard Strategy
// author: Sample Bot
// description: Protects margin while scaling production only when inventory is low.

function execute(context) {
  var avgPrice = context.marketData && context.marketData.avgPrice ? context.marketData.avgPrice : { us: 120, asia: 110, europe: 125 };
  var myPrices = context.myTeam && context.myTeam.prices ? context.myTeam.prices : avgPrice;
  var inventory = context.myTeam && context.myTeam.inventory ? context.myTeam.inventory : { us: 0, asia: 0 };

  var invTotal = (inventory.us || 0) + (inventory.asia || 0);
  var lowInventory = invTotal < 25000;
  var tooExpensive = (myPrices.us || 0) > (avgPrice.us || 0) * 1.08;

  return {
    priceMultiplier: {
      us: tooExpensive ? 0.96 : 1.01,
      asia: 0.98,
      europe: 1.0
    },
    productionMultiplier: lowInventory ? { us: 1.15, asia: 1.1 } : { us: 0.95, asia: 0.95 },
    rdInvestmentMultiplier: 1.05
  };
}

