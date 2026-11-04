
import WebSocket from "ws";

const BSC_WS = "wss://bsc-rpc.publicnode.com";

// PancakeSwap V2 官方 Factory（BSC 主网）
const FACTORY = "0xca143ce32fe78f1f7019d7d551a6402fc5350c73";

// PairCreated(address,address,address,uint256)
const PAIR_CREATED_TOPIC =
  "0x0d3648bd0f6ba80134a33ba9275ac585d9d315f0ad8355cddefde31afa28d0e9";

const TEST_DURATION = 30_000;

console.log("PancakeSwap V2 新池监听启动");
console.log("模式：SIMULATION ONLY");
console.log("只读取公开链上事件，不执行交易");

const ws = new WebSocket(BSC_WS);
let pairCount = 0;

const timer = setTimeout(() => {
  console.log(`测试结束，共发现 ${pairCount} 个新交易对`);
  ws.close();
}, TEST_DURATION);

ws.on("open", () => {
  console.log("BSC WebSocket 连接成功");

  ws.send(JSON.stringify({
    jsonrpc: "2.0",
    id: 1,
    method: "eth_subscribe",
    params: [
      "logs",
      {
        address: FACTORY,
        topics: [PAIR_CREATED_TOPIC]
      }
    ]
  }));
});

ws.on("message", (data) => {
  try {
    const message = JSON.parse(data.toString());

    if (message.error) {
      console.log("订阅错误：", JSON.stringify(message.error));
      return;
    }

    if (message.params?.result) {
      const log = message.params.result;
      const topics = log.topics || [];
      const eventData = log.data || "0x";

      if (topics.length < 3 || eventData.length < 130) {
        console.log("收到格式异常的事件");
        return;
      }

      const token0 = "0x" + topics[1].slice(-40);
      const token1 = "0x" + topics[2].slice(-40);
      const pair = "0x" + eventData.slice(2, 66).slice(-40);

      pairCount++;

      console.log("发现 PancakeSwap V2 新交易对：");
      console.log("Token0:", token0);
      console.log("Token1:", token1);
      console.log("Pair:", pair);
      console.log("区块:", parseInt(log.blockNumber, 16));
      console.log("交易:", log.transactionHash);
    } else {
      console.log("订阅响应：", JSON.stringify(message));
    }
  } catch {
    console.log("收到无法解析的数据");
  }
});

ws.on("error", (error) => {
  console.log("连接错误：", error.message);
});

ws.on("close", () => {
  clearTimeout(timer);
  console.log("监听连接已关闭");
});
