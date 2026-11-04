export const CONFIG = {
  network: "BSC",
  chainId: 56,

  mode: "SIMULATION_ONLY",

  startingBalanceBnb: 10,
  positionSizeBnb: 0.1,

  strategies: {
    newPool: true,
    newToken: true,
    largeBuy: true
  },

  filters: {
    minLiquidityBnb: 5,
    largeBuyThresholdBnb: 3
  },

  risk: {
    takeProfitPercent: 20,
    stopLossPercent: 10,
    slippagePercent: 1,
    maxPositions: 5
  },

  safety: {
    realTradingEnabled: false,
    privateKeyRequired: false,
    transactionBroadcastEnabled: false
  }
};
