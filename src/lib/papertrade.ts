/** Papertrade on HyperEVM (chain 999). Close events carry realized PnL. */

export const EXCHANGE = "0x6cd5661646289fb6e65ea5c032310fded797d0a2";
export const STAKING = "0xaad6c7b0cc3014fc80ffedae0ed7ce5967b0f016";
export const PAPER = "0xe40f17915DAa230324030003A197cdAEf2261C0e";
export const OPEN_TOPIC =
  "0x88451ea1189f73b554f0bf39c09868560ed149b3d788fcc933ff66ba926827f3";
export const CLOSE_TOPIC =
  "0x87902ed2451849f465fc4d36a01d7f5c67b53af12f63ee85d2814a2d582f89bf";
/** A few blocks before the first position at 14:00:01 UTC on 10 Oct 2026. */
export const START_BLOCK = 48_173_800;

export const EXPLORER = "https://hyperevmscan.io";

export type Close = {
  id: number;
  user: string;
  block: number;
  tx: string;
  /** Oracle entry, integer. BTC is price×10, ETH is price×100. */
  entry: number;
  raw: number;
  /** Settled PnL after the win haircut, before the 2% win cut. USDC. */
  pnl: number;
  /** On-chain 2% leg of |settled|. Charged to the trader on wins only. */
  fee: number;
};

export type OpenFill = {
  id: number;
  user: string;
  block: number;
  /** Same integer encoding as a close entry. */
  entry: number;
  margin: number;
  leverage: number;
  notional: number;
};

/** Docs curve: 100 PAPER per $1 of loss mint basis under $2M tracked LP, then squared decay. */
export const PAPER_FLAT_RATE = 100;
export const PAPER_LP_THRESHOLD = 2_000_000;
export const PAPER_DECAY_SCALE = 120_000_000;
export const PAPER_LP_CAP = 5_000_000;

export type EmissionCurve = {
  /** Cash LP after the $5M staker cap. Flat vs decay uses this, including underwater at 0. */
  lp: number;
  /** High-water mark of mint basis already priced on the decaying tail. Never falls. */
  tail: number;
  queue: number;
  paper: number;
};

export function blankCurve(): EmissionCurve {
  return { lp: 0, tail: 0, queue: 0, paper: 0 };
}

/** Marginal PAPER per $1 of mint basis at the current curve position. */
export function marginalRate(curve: EmissionCurve): number {
  if (curve.lp < PAPER_LP_THRESHOLD) return PAPER_FLAT_RATE;
  const ratio = PAPER_DECAY_SCALE / (PAPER_DECAY_SCALE + curve.tail);
  return PAPER_FLAT_RATE * ratio * ratio;
}

function mintOnBasis(basis: number, curve: EmissionCurve): number {
  const lpPre = curve.lp;
  let flatPart = 0;
  let tailPart = 0;
  if (lpPre < PAPER_LP_THRESHOLD) {
    const room = PAPER_LP_THRESHOLD - lpPre;
    if (basis <= room) flatPart = basis;
    else {
      flatPart = room;
      tailPart = basis - room;
    }
  } else {
    tailPart = basis;
  }
  let paper = flatPart * PAPER_FLAT_RATE;
  if (tailPart > 0) {
    const h0 = curve.tail;
    const h1 = h0 + tailPart;
    const scale = PAPER_DECAY_SCALE;
    paper += PAPER_FLAT_RATE * scale * scale * (1 / (scale + h0) - 1 / (scale + h1));
    curve.tail = h1;
  }
  return paper;
}

/**
 * Replay one close through the docs emission curve.
 * Losses mint PAPER on the loss after the 2% peel (1% stakers + 1% frontend).
 * The flat 100 rate holds whenever tracked LP is under $2M, including underwater.
 * Wins pay the trader out of the LP and mint nothing.
 */
export function applyCloseToCurve(c: Pick<Close, "pnl" | "fee">, curve: EmissionCurve): number {
  if (c.pnl < 0) {
    const gross = -c.pnl;
    const peel = Math.min(gross, Math.max(0, c.fee));
    const basis = gross - peel;
    const minted = basis > 0 ? mintOnBasis(basis, curve) : 0;
    curve.paper += minted;
    let credit = basis;
    if (curve.queue > 0 && credit > 0) {
      const pay = Math.min(curve.queue, credit);
      curve.queue -= pay;
      credit -= pay;
    }
    if (credit > 0) {
      if (curve.lp < PAPER_LP_CAP) {
        curve.lp = Math.min(PAPER_LP_CAP, curve.lp + credit);
      }
    }
    return minted;
  }
  const payout = c.pnl > 0 ? Math.max(0, c.pnl - Math.max(0, c.fee)) : 0;
  if (payout > 0) {
    if (curve.lp >= payout) curve.lp -= payout;
    else {
      curve.queue += payout - curve.lp;
      curve.lp = 0;
    }
  }
  return 0;
}

export type PositionInfo = {
  id: number;
  instrument: number;
  /** 1 = long, 0 = short. Matches the open-event side byte. */
  side: number;
  margin: number;
  leverage: number;
  openedAt: number;
};

export type ChainMeta = {
  latest: number;
  latestTs: number;
  spb: number;
  start: number;
  btc: number;
  eth: number;
  locked: number;
  queued: number;
  balances: number;
  nextId: number;
};

export type Asset = "BTC" | "ETH";

export function traderPnl(c: Pick<Close, "pnl" | "fee">): number {
  if (c.pnl > 0) return c.pnl - c.fee;
  return c.pnl;
}

export function assetOf(entry: number, btc: number, eth: number): Asset {
  const btcStored = btc * 10;
  const ethStored = eth * 100;
  return Math.abs(entry - btcStored) <= Math.abs(entry - ethStored) ? "BTC" : "ETH";
}

export function entryPrice(entry: number, asset: Asset): number {
  return entry / (asset === "BTC" ? 10 : 100);
}

/** Reconstruct exit from raw PnL once margin, leverage and side are known. */
export function exitPrice(
  entry: number,
  asset: Asset,
  raw: number,
  margin: number,
  leverage: number,
  side: number,
): number | null {
  if (margin <= 0 || leverage <= 0) return null;
  const notional = margin * leverage;
  const frac = raw / notional;
  const px = entryPrice(entry, asset);
  return side === 1 ? px * (1 + frac) : px * (1 - frac);
}

export function signedWord(hex64: string): bigint {
  const n = BigInt("0x" + hex64);
  return n >= 1n << 255n ? n - (1n << 256n) : n;
}

export function decodeClose(log: {
  topics: string[];
  data: string;
  blockNumber: string;
  transactionHash: string;
}): Close | null {
  if (log.topics.length < 3 || log.topics[0] !== CLOSE_TOPIC) return null;
  const body = log.data.startsWith("0x") ? log.data.slice(2) : log.data;
  if (body.length < 64 * 5) return null;
  const words: bigint[] = [];
  for (let i = 0; i < 5; i++) words.push(signedWord(body.slice(i * 64, (i + 1) * 64)));
  const usdc = (n: bigint) => Number(n) / 1e18;
  return {
    id: Number(BigInt(log.topics[1])),
    user: ("0x" + log.topics[2].slice(-40)).toLowerCase(),
    block: Number(BigInt(log.blockNumber)),
    tx: log.transactionHash,
    entry: Number(words[0]),
    raw: usdc(words[1]),
    pnl: usdc(words[2]),
    fee: Math.abs(usdc(words[4])),
  };
}

export function decodeOpen(log: {
  topics: string[];
  data: string;
  blockNumber: string;
}): OpenFill | null {
  if (log.topics.length < 3 || log.topics[0] !== OPEN_TOPIC) return null;
  const body = log.data.startsWith("0x") ? log.data.slice(2) : log.data;
  if (body.length < 64 * 6) return null;
  const words: bigint[] = [];
  for (let i = 0; i < 6; i++) words.push(signedWord(body.slice(i * 64, (i + 1) * 64)));
  const margin = Number(words[4]) / 1e18;
  const leverage = Number(words[5]);
  if (!(margin > 0) || !(leverage > 0) || leverage > 10_000) return null;
  return {
    id: Number(BigInt(log.topics[1])),
    user: ("0x" + log.topics[2].slice(-40)).toLowerCase(),
    block: Number(BigInt(log.blockNumber)),
    entry: Number(words[3]),
    margin,
    leverage,
    notional: margin * leverage,
  };
}

export function decodePosition(id: number, data: string): PositionInfo | null {
  const body = data.startsWith("0x") ? data.slice(2) : data;
  if (body.length < 64 * 7) return null;
  const w: bigint[] = [];
  const n = Math.floor(body.length / 64);
  for (let i = 0; i < n; i++) w.push(signedWord(body.slice(i * 64, (i + 1) * 64)));
  const margin = Number(w[3]) / 1e18;
  if (!Number.isFinite(margin) || margin < 0) return null;
  return {
    id,
    instrument: Number(w[1]),
    side: Number(w[6] ?? 0),
    margin,
    leverage: Number(w[4]),
    openedAt: Number(w[5]),
  };
}

export function shortAddr(addr: string): string {
  if (addr.length < 12) return addr;
  return addr.slice(0, 6) + "…" + addr.slice(-4);
}

export function usd(n: number, digits?: number): string {
  const sign = n < 0 ? "−" : n > 0 ? "+" : "";
  const abs = Math.abs(n);
  const max =
    digits ??
    (abs >= 1000 ? 0 : abs >= 10 ? 2 : 2);
  const body = abs.toLocaleString("en-US", {
    minimumFractionDigits: abs >= 1000 && max === 0 ? 0 : max,
    maximumFractionDigits: max,
  });
  return sign + "$" + body;
}

export function paperAmt(n: number): string {
  const abs = Math.abs(n);
  const body =
    abs >= 1_000_000_000
      ? (abs / 1_000_000_000).toFixed(2) + "B"
      : abs >= 1_000_000
        ? (abs / 1_000_000).toFixed(2) + "M"
        : abs >= 1_000
          ? (abs / 1_000).toFixed(abs >= 10_000 ? 0 : 1) + "k"
          : abs.toFixed(0);
  return body + " PAPER";
}

export function sharePct(part: number, total: number): string {
  if (!(total > 0) || !(part > 0)) return "0%";
  const p = (part / total) * 100;
  if (p >= 10) return p.toFixed(1) + "%";
  if (p >= 1) return p.toFixed(2) + "%";
  if (p >= 0.01) return p.toFixed(2) + "%";
  return "<0.01%";
}

export function usdAbs(n: number): string {
  return usd(Math.abs(n)).replace("+", "").replace("−", "");
}

export function px(n: number): string {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: n >= 1000 ? 1 : 2,
    maximumFractionDigits: n >= 1000 ? 1 : 2,
  });
}

export function blockTimeMs(block: number, meta: ChainMeta): number {
  return (meta.latestTs + (block - meta.latest) * meta.spb) * 1000;
}

export function formatTime(ms: number): string {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    day: "2-digit",
    month: "short",
    timeZone: "Africa/Lagos",
  }).format(new Date(ms));
}

export function holdLabel(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "—";
  if (seconds < 60) return Math.round(seconds) + "s";
  if (seconds < 3600) return Math.round(seconds / 60) + "m";
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return h + "h " + m + "m";
}
