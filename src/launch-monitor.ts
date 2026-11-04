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

  if (info.wbnbIsToken0 === undefined) {
    console.log("无法判断交易方向：缺少 WBNB 排序信息");
    return;
  }

  const data = log.data || "0x";
  let direction = "UNKNOWN";

  if (info.version === "V2") {
    if (data.length < 258) {
      console.log("V2 Swap 数据长度异常：", info.pool);
      return;
    }

    const amount0In = BigInt("0x" + data.slice(2, 66));
    const amount1In = BigInt("0x" + data.slice(66, 130));
    const amount0Out = BigInt("0x" + data.slice(130, 194));
    const amount1Out = BigInt("0x" + data.slice(194, 258));

    const wbnbIn = info.wbnbIsToken0
      ? amount0In : amount1In;
    const wbnbOut = info.wbnbIsToken0
      ? amount0Out : amount1Out;
    const tokenIn = info.wbnbIsToken0
      ? amount1In : amount0In;
    const tokenOut = info.wbnbIsToken0
      ? amount1Out : amount0Out;

    if (wbnbIn > 0n && tokenOut > 0n) {
      direction = "BUY";
    } else if (tokenIn > 0n && wbnbOut > 0n) {
      direction = "SELL";
    }
  } else {
    if (data.length < 322) {
      console.log("V3 Swap 数据长度异常：", info.pool);
      return;
    }

    function signedInt256(hex: string): bigint {
      const value = BigInt("0x" + hex);
      const limit = 1n << 255n;
      const full = 1n << 256n;
      return value >= limit ? value - full : value;
    }

    const amount0 = signedInt256(data.slice(2, 66));
    const amount1 = signedInt256(data.slice(66, 130));

    const wbnbAmount = info.wbnbIsToken0
      ? amount0 : amount1;
    const tokenAmount = info.wbnbIsToken0
      ? amount1 : amount0;

    if (wbnbAmount > 0n && tokenAmount < 0n) {
      direction = "BUY";
    } else if (tokenAmount > 0n && wbnbAmount < 0n) {
      direction = "SELL";
    }
  }

  detectedFirstSwap.add(poolKey);

  console.log("\n========== 检测到首次交易 ==========");
  console.log("版本：", info.version);
  console.log("交易方向：", direction);
  console.log("代币地址：", info.token);
  console.log("池地址：", info.pool);
  console.log("交易区块：", parseInt(log.blockNumber, 16));
  console.log("交易哈希：", log.transactionHash);
  console.log("====================================");
}
