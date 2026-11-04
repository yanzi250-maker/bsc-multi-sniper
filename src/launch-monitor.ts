import WebSocket from "ws";

export type PoolVersion = "V2" | "V3";

export interface LaunchInfo {
  pool: string;
  version: PoolVersion;
  token: string;
  wbnbIsToken0?: boolean;
}

export const pendingLaunchSubscriptions =
  new Map<number, LaunchInfo>();

export const launchSubscriptions =
  new Map<string, LaunchInfo>();

const V2_SWAP_TOPIC =
  "0xd78ad95fa46c994b6551d0da85fc275fe613ce37657fb8d5e3d130840159d822";

const V3_SWAP_TOPIC =
  "0xc42079f94a6350d7e6235f29174924f928cc2ac818eb64fed8004e115fbcca67";

const detectedFirstSwap = new Set<string>();

export function subscribeLaunchEvents(
  ws: WebSocket,
  id: number,
  pool: string,
  version: PoolVersion,
  token: string,
  wbnbIsToken0?: boolean
): void {
  const info: LaunchInfo = {
    pool,
    version,
    token,
    wbnbIsToken0
  };

  pendingLaunchSubscriptions.set(id, info);

  ws.send(JSON.stringify({
    jsonrpc: "2.0",
    id,
    method: "eth_subscribe",
    params: [
      "logs",
      {
        address: pool,
        topics: [
          version === "V2"
            ? V2_SWAP_TOPIC
            : V3_SWAP_TOPIC
        ]
      }
    ]
  }));

  console.log("已请求订阅开盘交易事件：", pool);
}

export function handleLaunchSwap(
  log: any,
  info: LaunchInfo
): void {
  const poolKey = info.pool.toLowerCase();

  if (detectedFirstSwap.has(poolKey)) {
    return;
  }

  detectedFirstSwap.add(poolKey);

  console.log("\n========== 检测到首次交易 ==========");
  console.log("版本：", info.version);
  console.log("代币地址：", info.token);
  console.log("池地址：", info.pool);
  console.log(
    "首次交易区块：",
    parseInt(log.blockNumber, 16)
  );
  console.log("交易哈希：", log.transactionHash);
  console.log("状态：该池已出现链上 Swap 事件");
  console.log("注意：不代表所有用户都能成功买入");
  console.log("====================================");
}
