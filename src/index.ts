
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
}

const CONFIG = {
  startingBalance: 10,
  positionSize: 0.1,
  minLiquidityBnb: 5,
  largeBuyThresholdBnb: 3,
  takeProfitPercent: 20,
  stopLossPercent: 10,
  slippagePercent: 1
};

class Simulator {
  private balance = CONFIG.startingBalance;
  private positions = new Map<string, Position>();

  buy(signal: Signal, price: number) {
    if (this.positions.has(signal.token)) return;
    if (this.balance < CONFIG.positionSize) return;

    const entryPrice = price * (1 + CONFIG.slippagePercent / 100);
    const quantity = CONFIG.positionSize / entryPrice;

    this.balance -= CONFIG.positionSize;

    this.positions.set(signal.token, {
      token: signal.token,
      symbol: signal.symbol,
      entryPrice,
      quantity
    });

    console.log(
      `[模拟买入] ${signal.symbol} | 价格 ${entryPrice.toFixed(8)} | 投入 0.1 BNB`
    );
  }

  updatePrice(token: string, price: number) {
    const position = this.positions.get(token);
    if (!position) return;

    const change =
      ((price - position.entryPrice) / position.entryPrice) * 100;

    console.log(`[行情] ${position.symbol} | 盈亏 ${change.toFixed(2)}%`);

    if (
      change >= CONFIG.takeProfitPercent ||
      change <= -CONFIG.stopLossPercent
    ) {
      this.sell(token, price, change);
    }
  }

  private sell(token: string, price: number, change: number) {
    const position = this.positions.get(token);
    if (!position) return;

    const sellPrice = price * (1 - CONFIG.slippagePercent / 100);
    const proceeds = position.quantity * sellPrice;

    this.balance += proceeds;
    this.positions.delete(token);

    console.log(
      `[模拟卖出] ${position.symbol} | 回收 ${proceeds.toFixed(6)} BNB | 盈亏 ${change.toFixed(2)}%`
    );
  }

  report() {
    console.log("\n========== 模拟账户 ==========");
    console.log(`虚拟余额：${this.balance.toFixed(6)} BNB`);
    console.log(`当前持仓：${this.positions.size}`);
    console.log("真实交易：禁用");
    console.log("==============================");
  }
}

function checkStrategy(signal: Signal): boolean {
  switch (signal.type) {
    case "NEW_POOL":
      return (signal.liquidityBnb ?? 0) >= CONFIG.minLiquidityBnb;

    case "NEW_TOKEN":
      return true;

    case "LARGE_BUY":
      return (signal.buyAmountBnb ?? 0) >= CONFIG.largeBuyThresholdBnb;

    default:
      return false;
  }
}

async function main() {
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
    const start = Date.now();

    console.log(`[发现信号] ${signal.type} | ${signal.symbol}`);

    if (checkStrategy(signal)) {
      simulator.buy(signal, 0.00001);
    } else {
      console.log("[策略] 未达到触发条件");
    }

    console.log(`[处理耗时] ${Date.now() - start} ms\n`);
  }

  console.log("开始模拟价格变化...\n");

  simulator.updatePrice("DEMO001", 0.000013);
  simulator.updatePrice("DEMO002", 0.0000085);
  simulator.updatePrice("DEMO003", 0.000011);

  simulator.report();
}

main().catch(console.error);
