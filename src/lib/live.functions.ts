import { createServerFn } from "@tanstack/react-start";

const ORIGIN = "https://exchange.papertrade.xyz";

export type LiveProtocol = {
  at: number;
  block: number;
  volume: number;
  btcVolume: number;
  ethVolume: number;
  liqVolume: number;
  trades: number;
  users: number;
  paperSupply: number;
  paperStaked: number;
  tvl: number;
  lp: number;
  margin: number;
  opens: number;
  fees: number;
  /** PAPER minted per $1 of loss right now. */
  rate: number;
  tail: number;
};

export type LiveAccount = {
  address: string;
  name: string | null;
  pnl: number;
  paper: number;
  /** Exact minted PAPER, 2 decimals, same units as the exchange. */
  paperLabel: string;
  staked: number;
  stakedLabel: string;
  openCount: number;
  openNotional: number;
  upnl: number;
  volume: number;
  rank: number;
};

export type WalletBatch = {
  count: number;
  totalPages: number;
  startPage: number;
  accounts: LiveAccount[];
};

function num18(raw: string | number | null | undefined): number {
  if (raw == null) return 0;
  if (typeof raw === "number") return raw;
  const s = raw.trim();
  if (!/^-?\d+$/.test(s)) return Number(s) || 0;
  const neg = s.startsWith("-");
  const digits = neg ? s.slice(1) : s;
  const pad = digits.padStart(19, "0");
  const whole = pad.slice(0, -18);
  const frac = pad.slice(-18, -14);
  const value = Number(whole) + Number(frac) / 10000;
  return neg ? -value : value;
}

function formatToken(raw: string): string {
  const trimmed = raw.trim();
  const neg = trimmed.startsWith("-");
  const digits = neg ? trimmed.slice(1) : trimmed;
  if (!/^\d+$/.test(digits)) return "0.00";
  const pad = digits.padStart(20, "0");
  const whole = pad.slice(0, -18).replace(/^0+(?=\d)/, "") || "0";
  const frac = pad.slice(-18, -16);
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return (neg ? "-" : "") + grouped + "." + frac;
}

function qs(params: Record<string, string>): string {
  return Object.keys(params)
    .sort()
    .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
    .join("&");
}

async function pull<T>(path: string): Promise<T> {
  let last = "Papertrade request failed";
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(ORIGIN + path, {
        headers: { accept: "application/json" },
      });
      if (res.status === 429 || res.status >= 500) {
        last = `Exchange ${res.status}`;
        await new Promise((r) => setTimeout(r, 250 * (attempt + 1)));
        continue;
      }
      if (!res.ok) throw new Error(`Exchange ${res.status}`);
      return (await res.json()) as T;
    } catch (err) {
      last = err instanceof Error ? err.message : last;
      await new Promise((r) => setTimeout(r, 200 * (attempt + 1)));
    }
  }
  throw new Error(last);
}

type Summary = {
  ok: boolean;
  source: { block: string; at: number };
  balances: { tvl: string; margin: string; lp: string };
  activity: { volume: string; open: number };
  fees: { lifetime: string };
  paper: {
    supply: string;
    staked: string;
    trackedLp: string;
    tailProgress: string;
    decay: string;
    cliff: string;
  };
};

type History = {
  columns: { volumeBtc?: number[]; volumeEth?: number[] };
  totals: {
    tvlRaw: string | null;
    rewardsRaw: string | null;
    volumeRaw: string | null;
    liquidationRaw: string | null;
    tradesRaw: string | null;
    usersRaw: string | null;
  };
};

function lastNum(values: number[] | undefined): number {
  if (!values || values.length === 0) return 0;
  const n = values[values.length - 1];
  return typeof n === "number" && Number.isFinite(n) ? n : 0;
}

function countRaw(raw: string | null | undefined): number {
  if (!raw) return 0;
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

function marginalRate(paper: Summary["paper"]): number {
  const tracked = num18(paper.trackedLp);
  const cliff = num18(paper.cliff) || 2_000_000;
  const scale = num18(paper.decay) || 120_000_000;
  const tail = num18(paper.tailProgress);
  if (tracked < cliff) return 100;
  const ratio = scale / (scale + tail);
  return 100 * ratio * ratio;
}

export const getProtocol = createServerFn({ method: "GET" }).handler(async (): Promise<LiveProtocol> => {
  const [summary, history] = await Promise.all([
    pull<Summary>("/query/protocol/summary"),
    pull<History>("/query/protocol/history?interval=1h"),
  ]);
  const totals = history.totals;
  return {
    at: summary.source.at,
    block: Number(summary.source.block),
    volume: num18(totals.volumeRaw),
    btcVolume: lastNum(history.columns.volumeBtc),
    ethVolume: lastNum(history.columns.volumeEth),
    liqVolume: num18(totals.liquidationRaw),
    trades: countRaw(totals.tradesRaw),
    users: countRaw(totals.usersRaw),
    paperSupply: num18(summary.paper.supply),
    paperStaked: num18(summary.paper.staked),
    tvl: num18(totals.tvlRaw),
    lp: num18(summary.balances.lp),
    margin: num18(summary.balances.margin),
    opens: summary.activity.open,
    fees: num18(totals.rewardsRaw),
    rate: marginalRate(summary.paper),
    tail: num18(summary.paper.tailProgress),
  };
});

type Board = {
  ok: boolean;
  count: number;
  pageInfo: { page: number; totalPages: number };
  accounts: {
    address: string;
    leaderboardName: string | null;
    realizedPnl: string;
    totalVolume: string;
    paperTotal: string;
    currentOpenPositionCount: number;
    currentOpenNotional: string;
    currentUnrealizedPnl: string;
    _leaderboardRank: number;
  }[];
};

async function fetchPage(sort: "profit" | "loss", page: number, q: string): Promise<Board> {
  const params: Record<string, string> = {
    page: String(page),
    pageSize: "100",
    sortDir: sort === "profit" ? "desc" : "asc",
    sortKey: "realizedPnl",
    window: "all",
  };
  if (q) params.q = q;
  return pull<Board>("/state/leaderboard/accounts?" + qs(params));
}

function mapAccounts(rows: Board["accounts"]): LiveAccount[] {
  return rows.map((row) => ({
    address: row.address.toLowerCase(),
    name: row.leaderboardName,
    pnl: num18(row.realizedPnl),
    paper: num18(row.paperTotal),
    paperLabel: formatToken(row.paperTotal),
    staked: 0,
    stakedLabel: "—",
    openCount: row.currentOpenPositionCount ?? 0,
    openNotional: num18(row.currentOpenNotional),
    upnl: num18(row.currentUnrealizedPnl),
    volume: num18(row.totalVolume),
    rank: row._leaderboardRank,
  }));
}

const STAKING = "0xaad6c7b0cc3014fc80ffedae0ed7ce5967b0f016";
const STAKED_SEL = "0x60217267";
const STAKE_RPCS = ["https://rpc.hypurrscan.io", "https://rpc.hyperliquid.xyz/evm"];

async function stakedRaw(addresses: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const jobs: string[][] = [];
  for (let i = 0; i < addresses.length; i += 20) jobs.push(addresses.slice(i, i + 20));
  let cursor = 0;
  async function worker() {
    while (cursor < jobs.length) {
      const job = jobs[cursor++];
      if (!job) return;
      const body = job.map((addr, id) => ({
        jsonrpc: "2.0",
        id,
        method: "eth_call",
        params: [{ to: STAKING, data: STAKED_SEL + addr.slice(2).padStart(64, "0") }, "latest"],
      }));
      let rows: { id?: number; result?: string }[] | null = null;
      for (const rpc of STAKE_RPCS) {
        try {
          const res = await fetch(rpc, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(body),
          });
          const json = (await res.json()) as { id?: number; result?: string }[] | { error?: unknown };
          if (Array.isArray(json)) {
            rows = json;
            break;
          }
        } catch {
          /* try the next endpoint */
        }
      }
      if (!rows) continue;
      for (const row of rows) {
        if (row.id == null) continue;
        const addr = job[row.id];
        if (addr && typeof row.result === "string" && /^0x[0-9a-fA-F]+$/.test(row.result)) {
          out.set(addr, BigInt(row.result).toString());
        }
      }
    }
  }
  await Promise.all([worker(), worker(), worker(), worker()]);
  return out;
}

export const getWalletBatch = createServerFn({ method: "POST" })
  .validator((data: { sort?: string; startPage?: number; q?: string }) => {
    const sort = data?.sort === "loss" ? "loss" : "profit";
    const startPage = Math.max(0, Math.min(5000, Math.floor(Number(data?.startPage) || 0)));
    const q = String(data?.q ?? "")
      .trim()
      .slice(0, 80);
    return { sort, startPage, q } as { sort: "profit" | "loss"; startPage: number; q: string };
  })
  .handler(async ({ data }): Promise<WalletBatch> => {
    const burst = 6;
    const pages = await Promise.all(
      Array.from({ length: burst }, (_, i) => fetchPage(data.sort, data.startPage + i, data.q).catch(() => null)),
    );
    const ok = pages.filter((page): page is Board => page != null && page.ok !== false);
    if (ok.length === 0) throw new Error("Leaderboard unavailable");
    const totalPages = ok[0].pageInfo.totalPages;
    const accounts = ok
      .filter((page) => page.pageInfo.page < totalPages)
      .sort((a, b) => a.pageInfo.page - b.pageInfo.page)
      .flatMap((page) => mapAccounts(page.accounts));
    try {
      const stakes = await stakedRaw(accounts.map((account) => account.address));
      for (const account of accounts) {
        const raw = stakes.get(account.address);
        if (!raw) continue;
        account.staked = num18(raw);
        account.stakedLabel = formatToken(raw);
      }
    } catch {
      /* stake reads are optional; earned PAPER still shows */
    }
    return {
      count: ok[0].count,
      totalPages,
      startPage: data.startPage,
      accounts,
    };
  });
