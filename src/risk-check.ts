
const BSC_RPC = "https://bsc-rpc.publicnode.com";

type CheckResult = {
  name: string;
  status: "正常信号" | "风险信号" | "无法判断";
  detail: string;
};

async function rpc(method: string, params: unknown[]): Promise<any> {
  const response = await fetch(BSC_RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method,
      params
    })
  });

  const result = await response.json() as any;

  if (result.error) {
    throw new Error(result.error.message || "RPC 请求失败");
  }

  return result.result;
}

async function callToken(
  token: string,
  selector: string
): Promise<string | null> {
  try {
    return await rpc("eth_call", [
      { to: token, data: selector },
      "latest"
    ]);
  } catch {
    return null;
  }
}

function decodeUint(value: string | null): bigint | null {
  if (!value || value === "0x") return null;
  try {
    return BigInt(value);
  } catch {
    return null;
  }
}

function decodeAddress(value: string | null): string | null {
  if (!value || value.length < 66) return null;
  return "0x" + value.slice(-40);
}

function decodeString(value: string | null): string {
  if (!value || value === "0x") return "无法读取";

  try {
    const hex = value.slice(2);

    // ABI 动态字符串
    if (hex.length >= 128) {
      const offset = Number(BigInt("0x" + hex.slice(0, 64))) * 2;
      const length = Number(BigInt("0x" + hex.slice(offset, offset + 64)));
      const data = hex.slice(offset + 64, offset + 64 + length * 2);

      if (length > 0 && data.length === length * 2) {
        return decodeURIComponent(
          data.replace(/(..)/g, "%$1")
        );
      }
    }

    // bytes32 格式
    const bytes = hex.slice(0, 64).match(/.{2}/g) || [];
    const text = bytes
      .map(byte => parseInt(byte, 16))
      .filter(byte => byte !== 0);

    return new TextDecoder().decode(new Uint8Array(text)) || "无法读取";
  } catch {
    return "无法读取";
  }
}

export async function inspectToken(
  tokenAddress: string
): Promise<CheckResult[]> {
  const token = tokenAddress.toLowerCase();

  if (!/^0x[a-f0-9]{40}$/.test(token)) {
    throw new Error("代币地址格式错误");
  }

  const results: CheckResult[] = [];

  // 1. 检查合约代码
  const code = await rpc("eth_getCode", [token, "latest"]);

  if (!code || code === "0x") {
    results.push({
      name: "合约代码",
      status: "风险信号",
      detail: "该地址没有检测到合约代码"
    });

    return results;
  }

  results.push({
    name: "合约代码",
    status: "正常信号",
    detail: `已检测到合约代码，字节长度约 ${(code.length - 2) / 2}`
  });

  // 2. 检查管理员 owner()
  const ownerRaw = await callToken(token, "0x8da5cb5b");
  const owner = decodeAddress(ownerRaw);

  if (owner) {
    const isZero = /^0x0{40}$/.test(owner);

    results.push({
      name: "管理员权限",
      status: isZero ? "无法判断" : "风险信号",
      detail: isZero
  ? "owner() 返回零地址，但不代表不存在其他管理权限"
  : `检测到管理员地址：${owner}`
    });
  } else {
    results.push({
      name: "管理员权限",
      status: "无法判断",
      detail: "合约未提供可读取的 owner() 信息"
    });
  }

  // 3. 检查暂停状态 paused()
  const pausedRaw = await callToken(token, "0x5c975abb");
  const paused = decodeUint(pausedRaw);

  if (paused !== null) {
    results.push({
      name: "暂停状态",
      status: paused === 1n ? "风险信号" : "正常信号",
      detail: paused === 1n
        ? "paused() 返回 true"
        : "paused() 返回 false"
    });
  } else {
    results.push({
      name: "暂停状态",
      status: "无法判断",
      detail: "没有读取到标准 paused() 状态"
    });
  }

  // 4. 读取代币基本信息
  const [nameRaw, symbolRaw, decimalsRaw, supplyRaw] =
    await Promise.all([
      callToken(token, "0x06fdde03"),
      callToken(token, "0x95d89b41"),
      callToken(token, "0x313ce567"),
      callToken(token, "0x18160ddd")
    ]);

  results.push({
    name: "代币名称",
    status: nameRaw ? "正常信号" : "无法判断",
    detail: decodeString(nameRaw)
  });

  results.push({
    name: "代币符号",
    status: symbolRaw ? "正常信号" : "无法判断",
    detail: decodeString(symbolRaw)
  });

  const decimals = decodeUint(decimalsRaw);
  results.push({
    name: "精度",
    status: decimals !== null ? "正常信号" : "无法判断",
    detail: decimals !== null ? decimals.toString() : "无法读取"
  });

  const supply = decodeUint(supplyRaw);
  results.push({
    name: "总供应量",
    status: supply !== null ? "正常信号" : "无法判断",
    detail: supply !== null ? supply.toString() : "无法读取"
  });

  // 5. 检查 EIP-1967 代理实现槽
  const implementationSlot =
    "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";

  try {
    const storage = await rpc("eth_getStorageAt", [
      token,
      implementationSlot,
      "latest"
    ]);

    const implementation = decodeAddress(storage);

    if (implementation && !/^0x0{40}$/.test(implementation)) {
      results.push({
        name: "代理合约",
        status: "无法判断",
        detail: `可能存在可升级代理，实现合约：${implementation}，需要进一步检查`
      });
    } else {
      results.push({
        name: "代理合约",
        status: "无法判断",
        detail: "未检测到 EIP-1967 标准实现地址，但不排除其他代理模式"
      });
    }
  } catch {
    results.push({
      name: "代理合约",
      status: "无法判断",
      detail: "代理存储槽读取失败"
    });
  }

  console.log("\n========== 代币风险检查 ==========");
  console.log("代币地址：", token);

  for (const item of results) {
    console.log(
      `[${item.status}] ${item.name}：${item.detail}`
    );
  }

  console.log("注意：这不是完整安全审计，不能保证可买卖。");
  console.log("================================");

  return results;
}
