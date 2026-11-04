import WebSocket from "ws";

const BSC_WS = "wss://bsc-rpc.publicnode.com";

console.log("BSC 只读监听启动");
console.log("模式：SIMULATION ONLY");

const ws = new WebSocket(BSC_WS);

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
  const message = JSON.parse(data.toString());

  if (message.params?.result) {
    const block = message.params.result;

    console.log(
      "发现新区块：",
      parseInt(block.number, 16),
      "| 区块哈希：",
      block.hash
    );
  } else {
    console.log("订阅响应：", message);
  }
});

ws.on("error", (error) => {
  console.log("连接错误：", error.message);
});

ws.on("close", () => {
  console.log("WebSocket 已断开");
});
