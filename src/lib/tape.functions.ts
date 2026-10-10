import { createServerFn } from "@tanstack/react-start";
import {
  CLOSE_TOPIC,
  EXCHANGE,
  OPEN_TOPIC,
  START_BLOCK,
  decodeClose,
  decodeOpen,
  decodePosition,
  type ChainMeta,
  type Close,
  type OpenFill,
  type PositionInfo,
} from "@/lib/papertrade";

const RPCS = ["https://rpc.hypurrscan.io", "https://rpc.hyperliquid.xyz/evm"];

type RpcError = { message?: string };

async function rpc<T>(method: string, params: unknown[], attempt = 0): Promise<T> {
  const url = RPCS[attempt % RPCS.length];
  let json: { result?: T; error?: RpcError };
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    });
    json = (await res.json()) as { result?: T; error?: RpcError };
  } catch (err) {
    if (attempt < 4) {
      await sleep(180 * (attempt + 1));
      return rpc(method, params, attempt + 1);
    }
    throw err;
  }
  if (json.error) {
    const msg = json.error.message ?? "rpc error";
    const retryable = /rate|limit|timeout|temporar|unavailable|429/i.test(msg);
    if (retryable && attempt < 5) {
      await sleep(220 * (attempt + 1));
      return rpc(method, params, attempt + 1);
    }
    throw new Error(msg);
  }
  return json.result as T;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function usdc(hex: string): number {
  return Number(BigInt(hex)) / 1e18;
}

type Span = { closes: Close[]; opens: OpenFill[] };

function emptySpan(): Span {
  return { closes: [], opens: [] };
}

async function logsSpan(from: number, to: number): Promise<Span> {
  if (to < from) return emptySpan();
  if (to - from > 199) {
    const mid = Math.floor((from + to) / 2);
    const [a, b] = await Promise.all([logsSpan(from, mid), logsSpan(mid + 1, to)]);
    return { closes: a.closes.concat(b.closes), opens: a.opens.concat(b.opens) };
  }
  try {
    const result = await rpc<
      {
        topics: string[];
        data: string;
        blockNumber: string;
        transactionHash: string;
      }[]
    >("eth_getLogs", [
      {
        address: EXCHANGE,
        fromBlock: "0x" + from.toString(16),
        toBlock: "0x" + to.toString(16),
        topics: [[CLOSE_TOPIC, OPEN_TOPIC]],
      },
    ]);
    const closes: Close[] = [];
    const opens: OpenFill[] = [];
    for (const log of result ?? []) {
      if (log.topics[0] === CLOSE_TOPIC) {
        const row = decodeClose(log);
        if (row) closes.push(row);
      } else if (log.topics[0] === OPEN_TOPIC) {
        const row = decodeOpen(log);
        if (row) opens.push(row);
      }
    }
    return { closes, opens };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/too big|exceeded max|response is too/i.test(msg) && to > from) {
      const mid = Math.floor((from + to) / 2);
      const [a, b] = await Promise.all([logsSpan(from, mid), logsSpan(mid + 1, to)]);
      return { closes: a.closes.concat(b.closes), opens: a.opens.concat(b.opens) };
    }
    throw err;
  }
}

async function mapPool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let cursor = 0;
  async function worker() {
    for (;;) {
      const i = cursor++;
      if (i >= items.length) return;
      out[i] = await fn(items[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return out;
}

export const getChainMeta = createServerFn({ method: "GET" }).handler(async (): Promise<ChainMeta> => {
  const latestHex = await rpc<string>("eth_blockNumber", []);
  const latest = Number(BigInt(latestHex));
  const olderNum = Math.max(0, latest - 2000);
  const [head, older, mids, locked, queued, balances, nextId] = await Promise.all([
    rpc<{ timestamp: string }>("eth_getBlockByNumber", ["0x" + latest.toString(16), false]),
    rpc<{ timestamp: string }>("eth_getBlockByNumber", ["0x" + olderNum.toString(16), false]),
    fetch("https://api.hyperliquid.xyz/info", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type: "allMids" }),
    }).then((r) => r.json() as Promise<Record<string, string>>),
    rpc<string>("eth_call", [{ to: EXCHANGE, data: "0x01ad056f" }, "latest"]),
    rpc<string>("eth_call", [{ to: EXCHANGE, data: "0x53ac4b66" }, "latest"]),
    rpc<string>("eth_call", [{ to: EXCHANGE, data: "0xa69a2ad1" }, "latest"]),
    rpc<string>("eth_call", [{ to: EXCHANGE, data: "0x899346c7" }, "latest"]),
  ]);
  const latestTs = Number(BigInt(head.timestamp));
  const olderTs = Number(BigInt(older.timestamp));
  const span = Math.max(1, latest - olderNum);
  return {
    latest,
    latestTs,
    spb: (latestTs - olderTs) / span,
    start: START_BLOCK,
    btc: Number(mids.BTC ?? 0),
    eth: Number(mids.ETH ?? 0),
    locked: usdc(locked),
    queued: usdc(queued),
    balances: usdc(balances),
    nextId: Number(BigInt(nextId)),
  };
});

export const scanCloses = createServerFn({ method: "POST" })
  .validator((data: { fromBlock: number; toBlock: number }) => {
    const fromBlock = Math.floor(Number(data?.fromBlock));
    const toBlock = Math.floor(Number(data?.toBlock));
    if (!Number.isFinite(fromBlock) || !Number.isFinite(toBlock) || toBlock < fromBlock) {
      throw new Error("Bad block range");
    }
    if (toBlock - fromBlock > 2400) throw new Error("Range too wide");
    if (fromBlock < START_BLOCK - 5000) throw new Error("Before launch");
    return { fromBlock, toBlock };
  })
  .handler(async ({ data }): Promise<{ closes: Close[]; opens: OpenFill[] }> => {
    const chunks: { from: number; to: number }[] = [];
    for (let b = data.fromBlock; b <= data.toBlock; b += 200) {
      chunks.push({ from: b, to: Math.min(data.toBlock, b + 199) });
    }
    const parts = await mapPool(chunks, 4, (c) => logsSpan(c.from, c.to));
    const closes = parts.flatMap((p) => p.closes);
    const opens = parts.flatMap((p) => p.opens);
    closes.sort((a, b) => a.block - b.block || a.id - b.id);
    opens.sort((a, b) => a.block - b.block || a.id - b.id);
    return { closes, opens };
  });

export const enrichPositions = createServerFn({ method: "POST" })
  .validator((data: { ids: number[] }) => {
    const ids = (data?.ids ?? [])
      .map((n) => Math.floor(Number(n)))
      .filter((n) => Number.isFinite(n) && n > 0)
      .slice(0, 40);
    return { ids };
  })
  .handler(async ({ data }): Promise<{ positions: PositionInfo[] }> => {
    const positions: PositionInfo[] = [];
    for (let offset = 0; offset < data.ids.length; offset += 16) {
      const slice = data.ids.slice(offset, offset + 16);
      const payload = slice.map((id, i) => ({
        jsonrpc: "2.0",
        id: i,
        method: "eth_call",
        params: [
          {
            to: EXCHANGE,
            data: "0x99fbab88" + id.toString(16).padStart(64, "0"),
          },
          "latest",
        ],
      }));
      let rows: { id: number; result?: string; error?: RpcError }[] | null = null;
      let lastErr: unknown;
      for (let attempt = 0; attempt < 4 && !rows; attempt++) {
        try {
          const res = await fetch(RPCS[attempt % RPCS.length], {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(payload),
          });
          const json = (await res.json()) as
            | { id: number; result?: string; error?: RpcError }[]
            | { error?: RpcError };
          if (!Array.isArray(json)) {
            throw new Error(json.error?.message ?? "batch failed");
          }
          rows = json;
        } catch (err) {
          lastErr = err;
          await sleep(250 * (attempt + 1));
        }
      }
      if (!rows) throw lastErr instanceof Error ? lastErr : new Error("enrich failed");
      for (const row of rows) {
        const id = slice[row.id];
        if (!row.result || row.error || id == null) continue;
        const info = decodePosition(id, row.result);
        if (info && info.margin > 0) positions.push(info);
      }
    }
    return { positions };
  });
