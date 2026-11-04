import WebSocket from "ws";

import {
  pendingLaunchSubscriptions,
  launchSubscriptions,
  subscribeLaunchEvents,
  handleLaunchSwap
} from "./launch-monitor.js";

const BSC_WS = "wss://bsc-rpc.publicnode.com";
const BSC_HTTP = "https://bsc-rpc.publicnode.com";
const V2_FACTORY = "0xca143ce32fe78f1f7019d7d551a6402fc5350c73";
const V3_FACTORY = "0x0bfbcf9fa4f9c56b0f40a671ad40e0805a091865";

const V2_TOPIC =
  "0x0d3648bd0f6ba80134a33ba9275ac585d9d315f0ad8355cddefde31afa28d0e9";

const V3_TOPIC =
  "0x783cca1c0412dd0d695e784568c96da2e9c22ff989357a2e8b1d9b2b4e6b7118";

const V2_MINT =
  "0x4c209b5fc8ad50758f13e2e1088ba56a560dff690a1c6fef26394f4c03821c4f";

const V3_MINT =
  "0x7a53080ba414158be7ec69b987b5fb7d07dee101fe85488f0853ae16239d0bde";

const WBNB = "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c";
const TEST_DURATION = 60_000;

async function getBlockLogs(
  fromBlock: number,
  toBlock: number,
  address: string,
  topic: string
) {
  const response = await fetch(BSC_HTTP, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 99,
      method: "eth_getLogs",
      params: [{
        fromBlock: "0x" + fromBlock.toString(16),
        toBlock: "0x" + toBlock.toString(16),
        address,
        topics: [topic]
      }]
    })
  });

  const result = await response.json() as any;

  if (result.error) {
    throw new Error(JSON.stringify(result.error));
  }

  return result.result || [];
}
const ws = new WebSocket(BSC_WS);

let totalPools = 0;
let liquidityEvents = 0;
let nextId = 10;

const pending = new Map<number, {
  pool: string;
  version: string;
  token: string;
}>();

const subscriptions = new Map<string, {
  pool: string;
  version: string;
  token: string;
}>();

function address(value: string): string {
  return "0x" + value.slice(-40);
}

function subscribeLiquidity(
  pool: string,
  version: string,
  token: string
) {
  const id = nextId++;

  pending.set(id, { pool, version, token });

  ws.send(JSON.stringify({
    jsonrpc: "2.0",
    id,
    method: "eth_subscribe",
    params: [
      "logs",
      {
        address: pool,
        topics: [version === "V2" ? V2_MINT : V3_MINT]
      }
    ]
  }));

  console.log("已请求订阅流动性事件：", pool);
}

function handlePool(log: any, version: "V2" | "V3") {
  const topics = log.topics || [];
  const data = log.data || "0x";

  if (topics.length < 3) return;

  const token0 = address(topics[1]);
  const token1 = address(topics[2]);

  const hasWbnb =
    token0.toLowerCase() === WBNB.toLowerCase() ||
    token1.toLowerCase() === WBNB.toLowerCase();

  if (!hasWbnb) return;

  let pool = "";

  if (version === "V2" && data.length >= 130) {
    pool = address(data.slice(2, 66));
  }

  if (version === "V3" && data.length >= 130) {
    pool = address(data.slice(66, 130));
  }

  if (!pool) return;

  totalPools++;

  const token =
    token0.toLowerCase() === WBNB.toLowerCase()
      ? token1
      : token0;

  console.log("\n发现 WBNB 新池！");
  console.log("版本：", version);
  console.log("代币：", token);
  console.log("池地址：", pool);
  console.log("创建区块：", parseInt(log.blockNumber, 16));
const createdBlock = parseInt(log.blockNumber, 16);
  getBlockLogs(
  createdBlock,
  createdBlock,
  pool,
  version === "V2" ? V2_MINT : V3_MINT
).then((logs) => {
  for (const item of logs) {
    handleLiquidity(item, { pool, version, token });
  }
}).catch((error) => {
  console.log("历史流动性回查失败：", String(error));
});
  
  subscribeLiquidity(pool, version, token);
  subscribeLaunchEvents(ws, nextId++, pool, version, token);
}

function handleLiquidity(log: any, info: any) {
  const data = log.data || "0x";

  const requiredLength = info.version === "V2" ? 130 : 258;

  if (data.length < requiredLength) {
    console.log("流动性事件数据长度异常：", info.pool);
    return;
  }

  let amount0: bigint;
  let amount1: bigint;

  if (info.version === "V2") {
    amount0 = BigInt("0x" + data.slice(2, 66));
    amount1 = BigInt("0x" + data.slice(66, 130));
  } else {
    amount0 = BigInt("0x" + data.slice(130, 194));
    amount1 = BigInt("0x" + data.slice(194, 258));
  }

  liquidityEvents++;

  console.log("\n========== 检测到流动性注入 ==========");
  console.log("版本：", info.version);
  console.log("代币：", info.token);
  console.log("池地址：", info.pool);
  console.log("Token0 原始数量：", amount0.toString());
  console.log("Token1 原始数量：", amount1.toString());
  console.log("区块：", parseInt(log.blockNumber, 16));
  console.log("交易哈希：", log.transactionHash);
  console.log("状态：已检测到 Mint 事件，等待风险检查");
  console.log("====================================");
}

const timer = setTimeout(() => {
  console.log("\n========== 监控报告 ==========");
  console.log("发现 WBNB 新池：", totalPools);
  console.log("检测到流动性注入：", liquidityEvents);
  console.log("真实交易：关闭");
  console.log("==============================");
  ws.close();
}, TEST_DURATION);

ws.on("open", () => {
  console.log("BSC 主网连接成功");
  console.log("V2 + V3 新池及流动性监控启动");

  ws.send(JSON.stringify({
    jsonrpc: "2.0",
    id: 1,
    method: "eth_subscribe",
    params: ["logs", {
      address: V2_FACTORY,
      topics: [V2_TOPIC]
    }]
  }));

  ws.send(JSON.stringify({
    jsonrpc: "2.0",
    id: 2,
    method: "eth_subscribe",
    params: ["logs", {
      address: V3_FACTORY,
      topics: [V3_TOPIC]
    }]
  }));
});

ws.on("message", (raw) => {
  try {
    const message = JSON.parse(raw.toString());

    if (message.error) {
      console.log("订阅错误：", JSON.stringify(message.error));
      return;
    }

    if (message.id !== undefined && message.result) {
      const liquidityInfo = pending.get(message.id);

      if (liquidityInfo) {
        subscriptions.set(message.result, liquidityInfo);
        pending.delete(message.id);
        console.log("流动性订阅成功：", liquidityInfo.pool);
        return;
      }

      const launchInfo =
        pendingLaunchSubscriptions.get(message.id);

      if (launchInfo) {
        launchSubscriptions.set(message.result, launchInfo);
        pendingLaunchSubscriptions.delete(message.id);
        console.log("首次交易订阅成功：", launchInfo.pool);
        return;
      }

      console.log("工厂订阅响应：", JSON.stringify(message));
      return;
    }

    const log = message.params?.result;
    if (!log) return;

    const subscriptionId = message.params.subscription;

    const liquidityInfo = subscriptions.get(subscriptionId);
    if (liquidityInfo) {
      handleLiquidity(log, liquidityInfo);
      return;
    }

    const launchInfo = launchSubscriptions.get(subscriptionId);
    if (launchInfo) {
      handleLaunchSwap(log, launchInfo);
      return;
    }

    const source = log.address?.toLowerCase();

    if (source === V2_FACTORY.toLowerCase()) {
      handlePool(log, "V2");
    } else if (source === V3_FACTORY.toLowerCase()) {
      handlePool(log, "V3");
    }
  } catch (error) {
    console.log("数据处理异常：", String(error));
  }
});

ws.on("error", (error) => {
  console.log("WebSocket 错误：", error.message);
});

ws.on("close", () => {
  clearTimeout(timer);
  console.log("监控连接已关闭");
});
