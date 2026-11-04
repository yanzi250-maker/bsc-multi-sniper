import WebSocket from "ws";

const BSC_WS = "wss://bsc-rpc.publicnode.com";

const V2_FACTORY = "0xca143ce32fe78f1f7019d7d551a6402fc5350c73";
const V3_FACTORY = "0x0bfbcf9fa4f9c56b0f40a671ad40e0805a091865";

const V2_TOPIC =
  "0x0d3648bd0f6ba80134a33ba9275ac585d9d315f0ad8355cddefde31afa28d0e9";

const V3_TOPIC =
  "0x783cca1c0412dd0d695e784568c96da2e9c22ff989357a2e8b1d9b2b4e6b7118";

const WBNB = "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c";

const TEST_DURATION = 30_000;

let totalPools = 0;
let wbnbPools = 0;

console.log("BSC PancakeSwap V2 + V3 新池监控启动");
console.log("模式：只读监控，不执行交易");

const ws = new WebSocket(BSC_WS);

function decodeAddress(value: string): string {
  return "0x" + value.slice(-40);
}

function handlePool(log: any, version: string) {
  const topics = log.topics || [];
  const data = log.data || "0x";

  if (topics.length < 3) return;

  const token0 = decodeAddress(topics[1]);
  const token1 = decodeAddress(topics[2]);

  let pool = "";

  if (version === "V2" && data.length >= 130) {
    pool = decodeAddress(data.slice(2, 66));
  }

  if (version === "V3" && data.length >= 130) {
    pool = decodeAddress(data.slice(66, 130));
  }

  if (!pool) return;

  totalPools++;

  const hasWbnb =
    token0.toLowerCase() === WBNB.toLowerCase() ||
    token1.toLowerCase() === WBNB.toLowerCase();

  if (hasWbnb) wbnbPools++;

  console.log("\n发现新交易池！");
  console.log("版本：", version);
  console.log("Token0：", token0);
  console.log("Token1：", token1);
  console.log("Pool：", pool);
  console.log("是否包含 WBNB：", hasWbnb ? "是" : "否");
  console.log("区块：", parseInt(log.blockNumber, 16));
  console.log("交易哈希：", log.transactionHash);
  console.log("状态：等待流动性检测");
}

const timer = setTimeout(() => {
  console.log("\n====== 监控报告 ======");
  console.log("发现新池：", totalPools);
  console.log("包含 WBNB：", wbnbPools);
  console.log("真实交易：关闭");
  ws.close();
}, TEST_DURATION);

ws.on("open", () => {
  console.log("BSC WebSocket 连接成功");

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

ws.on("message", (data) => {
  try {
    const message = JSON.parse(data.toString());

    if (message.error) {
      console.log("订阅错误：", JSON.stringify(message.error));
      return;
    }

    if (message.id) {
      console.log("订阅响应：", JSON.stringify(message));
      return;
    }

    if (message.params?.result) {
      const log = message.params.result;

      if (log.address?.toLowerCase() === V2_FACTORY.toLowerCase()) {
        handlePool(log, "V2");
      } else if (
        log.address?.toLowerCase() === V3_FACTORY.toLowerCase()
      ) {
        handlePool(log, "V3");
      }
    }
  } catch {
    console.log("数据解析失败");
  }
});

ws.on("error", (error) => {
  console.log("连接错误：", error.message);
});

ws.on("close", () => {
  clearTimeout(timer);
  console.log("监听结束");
});
