import { CONFIG } from "./config.js";

type SignalType = "NEW_POOL" | "NEW_TOKEN" | "LARGE_BUY";

interface Signal {
  type: SignalType;
  token: string;
  symbol: string;
  liquidityBnb?: number;
  buyAmountBnb?: number;
}

interface Position {
  token: string;
  symbol: string;
  entryPrice: number;
  quantity: number;
  investedBnb: number;
}

class Simulator {
  private balance = CONFIG.startingBalanceBnb;
  private positions = new Map<string, Position>();
  private realizedPnl = 0;

  buy(signal: Signal, price: number): void {
    if (this.positions.has(signal.token)) {
      console.log(`[风控] ${signal.symbol} 已持仓，拒绝重复买入`);
      return;
    }

    if (this.positions.size >= CONFIG.risk.maxPositions) {
      console.log("[风控] 已达到最大持仓数量，拒绝买入");
      return;
    }

    if (this.balance < CONFIG.positionSizeBnb) {
      console.log("[风控] 虚拟余额不足，拒绝买入");
      return;
    }

    const entryPrice =
      price * (1 + CONFIG.risk.slippagePercent / 100);

    const quantity = CONFIG.positionSizeBnb / entryPrice;

    this.balance -= CONFIG.positionSizeBnb;

    this.positions.set(signal.token, {
      token: signal.token,
      symbol: signal.symbol,
      entryPrice,
      quantity,
      investedBnb: CONFIG.positionSizeBnb
    });

    console.log(
      `[模拟买入] ${signal.symbol} | 投入 ${CONFIG.positionSizeBnb} BNB | 成交价 ${entryPrice.toFixed(8)}`
    );
  }

  updatePrice(token: string, price: number): void {
    const position = this.positions.get(token);
    if (!position) return;

    const sellPrice =
      price * (1 - CONFIG.risk.slippagePercent / 100);

    const proceeds = position.quantity * sellPrice;

    const pnl = proceeds - position.investedBnb;

    const pnlPercent =
      (pnl / position.investedBnb) * 100;

    console.log(
      `[行情] ${position.symbol} | 预计净盈亏 ${pnlPercent.toFixed(2)}%`
    );

    if (pnlPercent >= CONFIG.risk.takeProfitPercent) {
      console.log("[风控] 达到止盈条件");
      this.sell(token, proceeds, pnl, pnlPercent);
      return;
    }

    if (pnlPercent <= -CONFIG.risk.stopLossPercent) {
      console.log("[风控] 达到止损条件");
      this.sell(token, proceeds, pnl, pnlPercent);
    }
  }

  private sell(
    token: string,
    proceeds: number,
    pnl: number,
    pnlPercent: number
  ): void {
    const position = this.positions.get(token);
    if (!position) return;

    this.balance += proceeds;
    this.realizedPnl += pnl;
    this.positions.delete(token);

    console.log(
      `[模拟卖出] ${position.symbol} | 回收 ${proceeds.toFixed(6)} BNB`
    );

    console.log(
      `[交易盈亏] ${pnl >= 0 ? "+" : ""}${pnl.toFixed(6)} BNB (${pnlPercent.toFixed(2)}%)`
    );
  }

  report(): void {
    console.log("\n========== 模拟账户报告 ==========");
    console.log(`虚拟余额：${this.balance.toFixed(6)} BNB`);
    console.log(`当前持仓：${this.positions.size}`);
    console.log(`最大持仓：${CONFIG.risk.maxPositions}`);
    console.log(`累计已实现盈亏：${this.realizedPnl.toFixed(6)} BNB`);
    console.log(`止盈比例：${CONFIG.risk.takeProfitPercent}%`);
    console.log(`止损比例：${CONFIG.risk.stopLossPercent}%`);
    console.log("真实钱包：未连接");
    console.log("真实交易：已禁用");
    console.log("==================================");
  }
}

function checkStrategy(signal: Signal): boolean {
  switch (signal.type) {
    case "NEW_POOL":
      return (
        CONFIG.strategies.newPool &&
        (signal.liquidityBnb ?? 0) >= CONFIG.filters.minLiquidityBnb
      );

    case "NEW_TOKEN":
      return CONFIG.strategies.newToken;

    case "LARGE_BUY":
      return (
        CONFIG.strategies.largeBuy &&
        (signal.buyAmountBnb ?? 0) >= CONFIG.filters.largeBuyThresholdBnb
      );

    default:
      return false;
  }
}

async function main(): Promise<void> {
  console.log("==================================");
  console.log("BSC 多策略模拟狙击系统");
  console.log("模式：SIMULATION ONLY");
  console.log("真实钱包：未连接");
  console.log("真实交易：已禁用");
  console.log("==================================\n");

  const simulator = new Simulator();

  const demoSignals: Signal[] = [
    {
      type: "NEW_POOL",
      token: "DEMO001",
      symbol: "POOL",
      liquidityBnb: 12
    },
    {
      type: "NEW_TOKEN",
      token: "DEMO002",
      symbol: "TOKEN"
    },
    {
      type: "LARGE_BUY",
      token: "DEMO003",
      symbol: "WHALE",
      buyAmountBnb: 5
    }
  ];

  for (const signal of demoSignals) {
    console.log(`[发现信号] ${signal.type} | ${signal.symbol}`);

    if (checkStrategy(signal)) {
      simulator.buy(signal, 0.00001);
    } else {
      console.log("[策略] 未达到触发条件或策略已关闭");
    }
  }

  console.log("\n开始模拟价格变化...\n");

  simulator.updatePrice("DEMO001", 0.000013);
  simulator.updatePrice("DEMO002", 0.0000085);
  simulator.updatePrice("DEMO003", 0.000011);

  simulator.report();
}

main().catch((error: unknown) => {
  console.error("[系统错误]", error);
});
