import WebSocket from "ws";

const BSC_WS = "wss://bsc-rpc.publicnode.com";
const TEST_DURATION = 30_000;

console.log("BSC 只读监听测试启动");
console.log("模式：SIMULATION ONLY");
console.log("测试时长：30 秒");

const ws = new WebSocket(BSC_WS);
let blockCount = 0;

const timer = setTimeout(() => {
  console.log(`测试结束，共收到 ${blockCount} 个新区块`);
  ws.close();
}, TEST_DURATION);

ws.on("open", () => {
  console.log("BSC WebSocket 连接成功");

  ws.send(JSON.stringify({
    jsonrpc: "2.0",
    id: 1,
    method: "eth_subscribe",
    params: ["newHeads"]
  }));
});

ws.on("message", (data) => {
  try {
    const message = JSON.parse(data.toString());

    if (message.params?.result) {
      const block = message.params.result;
      blockCount++;

      console.log(
        "新区块：",
        parseInt(block.number, 16),
        block.hash
      );
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
  console.log("WebSocket 已断开，测试结束");
});
