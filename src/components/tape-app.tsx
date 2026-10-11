import { useEffect, useRef, useState } from "react";
import { getProtocol, getWalletBatch, scanTrades, type LiveAccount, type LiveProtocol, type TradeScan } from "@/lib/live.functions";
import { EXPLORER, paperAmt, sharePct, shortAddr, usd } from "@/lib/papertrade";

type Sort = "profit" | "loss";

export function TapeApp() {
  const [proto, setProto] = useState<LiveProtocol | null>(null);
  const [protoError, setProtoError] = useState<string | null>(null);
  const [sort, setSort] = useState<Sort>("profit");
  const [query, setQuery] = useState("");
  const [q, setQ] = useState("");
  const [accounts, setAccounts] = useState<LiveAccount[]>([]);
  const [count, setCount] = useState(0);
  const [loadedPages, setLoadedPages] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [listError, setListError] = useState<string | null>(null);
  const [show, setShow] = useState(40);
  const [selected, setSelected] = useState<LiveAccount | null>(null);

  useEffect(() => {
    const handle = window.setTimeout(() => setQ(query.trim()), 300);
    return () => window.clearTimeout(handle);
  }, [query]);

  useEffect(() => {
    let dead = false;
    const tick = () => {
      void getProtocol()
        .then((next) => {
          if (dead) return;
          setProto(next);
          setProtoError(null);
        })
        .catch((err: unknown) => {
          if (dead) return;
          setProtoError(err instanceof Error ? err.message : "Exchange unavailable");
        });
    };
    tick();
    const id = window.setInterval(tick, 8000);
    return () => {
      dead = true;
      window.clearInterval(id);
    };
  }, []);

  useEffect(() => {
    let dead = false;
    setAccounts([]);
    setLoadedPages(0);
    setShow(40);
    setListError(null);
    const run = async () => {
      let start = 0;
      let pages = 1;
      const all: LiveAccount[] = [];
      while (start < pages && !dead) {
        const batch = await getWalletBatch({ data: { sort, startPage: start, q } });
        if (dead) return;
        pages = Math.max(1, batch.totalPages);
        all.push(...batch.accounts);
        all.sort((a, b) => (sort === "profit" ? b.pnl - a.pnl : a.pnl - b.pnl));
        start += 6;
        setTotalPages(pages);
        setCount(batch.count);
        setLoadedPages(Math.min(start, pages));
        setAccounts(all.slice());
      }
    };
    void run().catch((err: unknown) => {
      if (dead) return;
      setListError(err instanceof Error ? err.message : "Could not load wallets");
    });
    return () => {
      dead = true;
    };
  }, [sort, q]);

  useEffect(() => {
    const id = window.setInterval(() => {
      void getWalletBatch({ data: { sort, startPage: 0, q } })
        .then((batch) => {
          setCount(batch.count);
          setTotalPages(batch.totalPages);
          setAccounts((prev) => mergeHead(prev, batch.accounts, sort));
        })
        .catch(() => {});
    }, 15000);
    return () => window.clearInterval(id);
  }, [sort, q]);

  const visible = accounts.slice(0, show);
  const stakePct = proto && proto.paperSupply > 0 ? (proto.paperStaked / proto.paperSupply) * 100 : 0;

  return (
    <div className="relative mx-auto min-h-screen max-w-6xl px-4 pb-16 pt-3 sm:px-6">
      <WaterField />
      <div className="flex items-center justify-between gap-3">
        <ThemeToggle />
        <p className="text-right font-mono text-xs text-muted">
          build by:{" "}
          <a
            href="https://x.com/wilson_"
            target="_blank"
            rel="noreferrer"
            className="text-fg underline decoration-line underline-offset-2 hover:text-amber"
          >
            wilson
          </a>
        </p>
      </div>
      <header className="mt-2 border-b border-line pb-5">
        <h1 className="text-center text-3xl font-semibold tracking-tight text-fg sm:text-4xl">PaperTrade Live</h1>
      </header>

      <section className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat
          label="Volume"
          value={proto ? "$" + compact(proto.volume) : "—"}
          hint={
            proto
              ? "BTC $" + compact(proto.btcVolume) + " · ETH $" + compact(proto.ethVolume)
              : "From the stats page"
          }
        />
        <Stat label="Liq. Volume" value={proto ? "$" + compact(proto.liqVolume) : "—"} hint="Liquidated notional" />
        <Stat label="Trades" value={proto ? proto.trades.toLocaleString() : "—"} hint="Closed and liquidated" />
        <Stat label="Users" value={proto ? proto.users.toLocaleString() : "—"} hint="Accounts" />
        <Stat label="Rewards" value={proto ? "$" + compact(proto.fees) : "—"} hint="Staking rewards" />
        <Stat label="TVL" value={proto ? "$" + compact(proto.tvl) : "—"} hint="Total value locked" />
        <Stat
          label="PAPER supply"
          value={proto ? paperAmt(proto.paperSupply).replace(" PAPER", "") : "—"}
          hint={proto ? stakePct.toFixed(1) + "% staked" : "Minted from losses"}
          tone="amber"
        />
        <Stat
          label="Mint rate"
          value={proto ? proto.rate.toFixed(proto.rate >= 10 ? 1 : 2) : "—"}
          hint={proto ? proto.rate.toFixed(1) + "% of launch" : "PAPER per $1 lost"}
          unit={proto ? "/ $1" : undefined}
        />
      </section>
      {protoError && <p className="mt-2 text-sm text-loss">{protoError}</p>}

      <div className="mt-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex gap-1">
          <SortButton active={sort === "profit"} onClick={() => setSort("profit")}>
            Winners
          </SortButton>
          <SortButton active={sort === "loss"} onClick={() => setSort("loss")}>
            Losers
          </SortButton>
        </div>
        <label className="relative min-w-0 flex-1">
          <span className="sr-only">Search wallet</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search wallet or name"
            className="min-h-11 w-full rounded-md border border-line bg-surface/70 px-3 font-mono text-sm text-fg outline-none backdrop-blur-md placeholder:text-faint"
          />
        </label>
      </div>

      {selected && (
        <WalletScan
          account={accounts.find((row) => row.address === selected.address) ?? selected}
          onClose={() => setSelected(null)}
        />
      )}

      <section className="mt-4">
        <div className="mb-2 flex items-baseline justify-between gap-3">
          <h2 className="text-sm font-semibold tracking-wide text-fg uppercase">Every wallet</h2>
          <p className="font-mono text-xs text-faint">
            {count.toLocaleString()} accounts
            {loadedPages < totalPages ? " · loading " + loadedPages + "/" + totalPages : ""}
            {sort === "profit" ? " · winners" : " · losers"}
          </p>
        </div>
        <ul className="glass divide-y divide-line/40 rounded-xl border">
          <li className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-end gap-x-2 px-3 py-2 font-mono text-xs tracking-wide text-faint uppercase sm:gap-x-4 sm:px-4">
            <span className="pl-8">Wallet</span>
            <span className="text-center">Realized profit</span>
            <span className="flex flex-col items-end gap-0.5 sm:flex-row sm:justify-end sm:gap-4">
              <span className="sm:w-36 sm:text-right">$PAPER</span>
              <span className="sm:w-40 sm:text-right">$PAPER staked</span>
            </span>
          </li>
          {visible.length === 0 && (
            <li className="px-4 py-8 text-center text-sm text-faint">
              {listError ?? "Loading wallets from the exchange."}
            </li>
          )}
          {visible.map((account, index) => (
            <WalletRow
              key={account.address}
              account={account}
              rank={index + 1}
              supply={proto?.paperSupply ?? 0}
              active={selected?.address === account.address}
              onSelect={() => setSelected((current) => (current?.address === account.address ? null : account))}
            />
          ))}
        </ul>
        {accounts.length > show && (
          <button
            type="button"
            className="glass mt-3 min-h-11 w-full rounded-md border text-sm text-fg"
            onClick={() => setShow((n) => n + 40)}
          >
            Show more · {show.toLocaleString()} of {accounts.length.toLocaleString()}
          </button>
        )}
        </section>
      </div>

      <footer className="mt-10 border-t border-line pt-4 font-mono text-xs leading-relaxed text-faint">
        <p>
          Volume, liquidations, trades, users, rewards, and TVL are the stats page totals. $PAPER earned is the sum of
          mints on losing closes: 98% of each loss (a 2% peel), at 100 PAPER per $1 while tracked LP is under $2M,
          then 100 × (120M / (120M + tail))². Wins mint nothing. $PAPER staked is what that wallet currently
          has in the staking contract. Open shows how many trades are still open, their notional, and unrealized PnL.
        </p>
      </footer>
    </div>
  );
}

function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggle() {
    setDark((prev) => {
      const next = !prev;
      document.documentElement.classList.toggle("dark", next);
      try {
        localStorage.setItem("pt-theme", next ? "dark" : "light");
      } catch {
        /* private mode */
      }
      document.querySelector('meta[name="theme-color"]')?.setAttribute("content", next ? "#120c22" : "#e7c6f4");
      return next;
    });
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={dark}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      onClick={toggle}
      className={
        "relative h-6 w-11 shrink-0 rounded-full border " + (dark ? "border-amber bg-amber" : "glass border-line")
      }
    >
      <span
        className={
          "absolute top-0.5 left-0.5 size-5 rounded-full shadow transition-transform duration-200 " +
          (dark ? "translate-x-5 bg-on-accent" : "bg-amber")
        }
      />
    </button>
  );
}

function WaterField() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const el = canvas;
    const g = ctx;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let frame = 0;
    const lobes = [
      { ox: 0.18, oy: 0.62, rx: 0.22, ry: 0.16, rgb: "186, 140, 255", sp: 0.55, ph: 0.2 },
      { ox: 0.38, oy: 0.7, rx: 0.28, ry: 0.18, rgb: "120, 170, 255", sp: 0.42, ph: 1.1 },
      { ox: 0.62, oy: 0.66, rx: 0.3, ry: 0.2, rgb: "168, 120, 255", sp: 0.48, ph: 2.2 },
      { ox: 0.82, oy: 0.6, rx: 0.2, ry: 0.14, rgb: "130, 190, 255", sp: 0.6, ph: 0.7 },
      { ox: 0.5, oy: 0.78, rx: 0.42, ry: 0.12, rgb: "200, 150, 255", sp: 0.36, ph: 1.8 },
      { ox: 0.28, oy: 0.52, rx: 0.1, ry: 0.08, rgb: "230, 170, 255", sp: 0.7, ph: 2.8 },
      { ox: 0.74, oy: 0.5, rx: 0.12, ry: 0.09, rgb: "150, 190, 255", sp: 0.66, ph: 0.4 },
    ];
    const drops = Array.from({ length: 16 }, (_, i) => ({
      x: (i * 0.061 + 0.08) % 1,
      y: 0.35 + (i % 5) * 0.1,
      r: 3 + (i % 4),
      sp: 0.15 + (i % 5) * 0.04,
      ph: i * 0.7,
    }));

    function resize() {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      el.width = Math.floor(window.innerWidth * dpr);
      el.height = Math.floor(window.innerHeight * dpr);
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function draw(now: number) {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const t = reduced ? 0 : now / 1000;
      g.clearRect(0, 0, w, h);
      const dark = document.documentElement.classList.contains("dark");
      const wash = g.createLinearGradient(0, 0, w, h);
      if (dark) {
        wash.addColorStop(0, "#1a1028");
        wash.addColorStop(0.46, "#24143a");
        wash.addColorStop(1, "#102033");
      } else {
        wash.addColorStop(0, "#f8d7f6");
        wash.addColorStop(0.46, "#e7d4ff");
        wash.addColorStop(1, "#b9dbff");
      }
      g.fillStyle = wash;
      g.fillRect(0, 0, w, h);

      g.globalCompositeOperation = "screen";
      for (const lobe of lobes) {
        const x = (lobe.ox + Math.sin(t * lobe.sp + lobe.ph) * 0.045) * w;
        const y = (lobe.oy + Math.cos(t * lobe.sp * 0.8 + lobe.ph) * 0.035) * h;
        const pulse = 1 + Math.sin(t * 0.9 + lobe.ph) * 0.08;
        const rx = lobe.rx * Math.min(w, h) * pulse;
        const ry = lobe.ry * Math.min(w, h) * (1.05 - pulse * 0.05);
        g.save();
        g.translate(x, y);
        g.rotate(Math.sin(t * 0.25 + lobe.ph) * 0.35);
        g.scale(1, ry / rx);
        const glow = g.createRadialGradient(0, 0, rx * 0.05, 0, 0, rx);
        glow.addColorStop(0, `rgba(255,255,255,0.7)`);
        glow.addColorStop(0.22, `rgba(${lobe.rgb},0.62)`);
        glow.addColorStop(0.55, `rgba(${lobe.rgb},0.28)`);
        glow.addColorStop(1, `rgba(${lobe.rgb},0)`);
        g.fillStyle = glow;
        g.beginPath();
        g.arc(0, 0, rx, 0, Math.PI * 2);
        g.fill();
        g.restore();
        g.save();
        g.translate(x, y);
        g.rotate(Math.sin(t * lobe.sp + lobe.ph) * 1.1);
        g.fillStyle = `rgba(${lobe.rgb},0.28)`;
        g.beginPath();
        g.ellipse(rx * 0.55, 0, rx * 0.72, ry * 0.28, 0, 0, Math.PI * 2);
        g.fill();
        g.restore();
      }

      g.globalCompositeOperation = "source-over";
      for (const drop of drops) {
        const y = ((drop.y - t * drop.sp) % 1 + 1) % 1;
        const x = (drop.x + Math.sin(t * 0.8 + drop.ph) * 0.015) * w;
        const py = y * h;
        g.beginPath();
        g.fillStyle = dark ? "rgba(210,190,255,0.35)" : "rgba(255,255,255,0.55)";
        g.arc(x, py, drop.r, 0, Math.PI * 2);
        g.fill();
        g.beginPath();
        g.strokeStyle = "rgba(140,170,255,0.45)";
        g.lineWidth = 1;
        g.arc(x, py, drop.r + 1.5, 0, Math.PI * 2);
        g.stroke();
      }

      if (!reduced) frame = window.requestAnimationFrame(draw);
    }

    resize();
    frame = window.requestAnimationFrame(draw);
    window.addEventListener("resize", resize);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return <canvas ref={ref} className="pointer-events-none fixed inset-0 -z-10 h-screen w-screen" aria-hidden />;
}

function mergeHead(prev: LiveAccount[], fresh: LiveAccount[], sort: Sort): LiveAccount[] {
  if (fresh.length === 0) return prev;
  const freshIds = new Set(fresh.map((row) => row.address));
  const rest = prev.filter((row) => !freshIds.has(row.address));
  const merged = fresh.concat(rest);
  merged.sort((a, b) => (sort === "profit" ? b.pnl - a.pnl : a.pnl - b.pnl));
  return merged;
}

function WalletRow({
  account,
  rank,
  supply,
  active,
  onSelect,
}: {
  account: LiveAccount;
  rank: number;
  supply: number;
  active: boolean;
  onSelect: () => void;
}) {
  const win = account.pnl >= 0;
  const label = account.name ? account.name + " · " + shortAddr(account.address) : shortAddr(account.address);
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={active}
        className={
          "grid w-full min-h-11 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-x-2 px-3 py-3 text-left hover:bg-white/40 sm:gap-x-4 sm:px-4 " +
          (active ? "bg-white/50" : "")
        }
      >
        <span className="flex min-w-0 items-baseline gap-2">
          <span className="w-6 shrink-0 font-mono text-xs text-faint">{rank}</span>
          <span className="min-w-0">
            <span className="block truncate font-mono text-sm text-fg">{label}</span>
            <span className="mt-0.5 block truncate font-mono text-xs text-muted">
              {sharePct(account.paper, supply)} · ${compact(account.volume)}
            </span>
            {account.openCount > 0 && (
              <span className="mt-0.5 block truncate font-mono text-xs text-fg">
                {account.openCount.toLocaleString()} open
                {" · $"}
                {compact(account.openNotional)}
                {" · uPnL "}
                <span className={account.upnl >= 0 ? "text-profit" : "text-loss"}>{usd(account.upnl)}</span>
              </span>
            )}
          </span>
        </span>
        <span className={"text-center font-mono text-sm font-medium tabular-nums " + (win ? "text-profit" : "text-loss")}>
          {usd(account.pnl)}
        </span>
        <span className="flex flex-col items-end gap-0.5 sm:flex-row sm:items-baseline sm:justify-end sm:gap-4">
          <span className="font-mono text-xs text-amber tabular-nums sm:w-36 sm:text-right sm:text-sm">{account.paperLabel}</span>
          <span className="font-mono text-xs tabular-nums text-fg sm:w-40 sm:text-right sm:text-sm">{account.stakedLabel}</span>
        </span>
      </button>
    </li>
  );
}

function WalletScan({ account, onClose }: { account: LiveAccount; onClose: () => void }) {
  const [trades, setTrades] = useState(0);
  const [profit, setProfit] = useState(0);
  const [loss, setLoss] = useState(0);
  const [profitCount, setProfitCount] = useState(0);
  const [lossCount, setLossCount] = useState(0);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let dead = false;
    let cursor: string | null = null;
    setTrades(0);
    setProfit(0);
    setLoss(0);
    setProfitCount(0);
    setLossCount(0);
    setDone(false);
    setError(null);
    const run = async () => {
      let next: string | null = null;
      let total = 0;
      let won = 0;
      let lost = 0;
      let wins = 0;
      let losses = 0;
      do {
        const page: TradeScan = await scanTrades({ data: { address: account.address, cursor: next } });
        if (dead) return;
        total += page.trades;
        won += page.profit;
        lost += page.loss;
        wins += page.profitCount;
        losses += page.lossCount;
        next = page.nextCursor;
        cursor = next;
        setTrades(total);
        setProfit(won);
        setLoss(lost);
        setProfitCount(wins);
        setLossCount(losses);
      } while (cursor);
      if (!dead) setDone(true);
    };
    void run().catch((err: unknown) => {
      if (dead) return;
      setError(err instanceof Error ? err.message : "Scan failed");
    });
    return () => {
      dead = true;
    };
  }, [account.address]);

  const label = account.name ? account.name + " · " + shortAddr(account.address) : shortAddr(account.address);
  return (
    <section className="glass mt-4 rounded-xl border p-4" aria-live="polite">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate font-mono text-sm text-fg">{label}</h2>
          <a
            href={EXPLORER + "/address/" + account.address}
            target="_blank"
            rel="noreferrer"
            className="font-mono text-xs text-amber underline decoration-line underline-offset-2"
          >
            {account.address}
          </a>
        </div>
        <button type="button" onClick={onClose} className="min-h-11 shrink-0 font-mono text-xs text-muted">
          Close
        </button>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
        <ScanStat
          label="Realized profit"
          value={usd(account.pnl)}
          hint="Settled on the exchange"
          tone={account.pnl >= 0 ? "profit" : "loss"}
        />
        <ScanStat label="Trades" value={trades.toLocaleString()} hint={done ? "Closed and liquidated" : "Scanning"} />
        <ScanStat label="Volume" value={"$" + compact(account.volume)} hint="All markets" />
        <ScanStat
          label="Profits"
          value={usd(profit)}
          hint={profitCount.toLocaleString() + " winning"}
          tone="profit"
        />
        <ScanStat label="Losses" value={usd(loss)} hint={lossCount.toLocaleString() + " losing"} tone="loss" />
        <ScanStat label="$PAPER" value={account.paperLabel} hint="Earned" tone="paper" />
        <ScanStat label="$PAPER staked" value={account.stakedLabel} hint="In staking" />
      </dl>
      <p className="mt-3 font-mono text-xs text-faint">
        {error ? error : done ? "Scan complete" : "Scan · " + trades.toLocaleString() + " trades"}
      </p>
    </section>
  );
}

function ScanStat({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "profit" | "loss" | "paper";
}) {
  const color = tone === "profit" ? "text-profit" : tone === "loss" ? "text-loss" : tone === "paper" ? "text-amber" : "text-fg";
  return (
    <div className="rounded-lg bg-white/45 px-2.5 py-2 dark:bg-white/10">
      <dt className="text-[11px] leading-none text-faint">{label}</dt>
      <dd className={"mt-1 font-mono text-sm font-medium tabular-nums " + color}>{value}</dd>
      {hint && <p className="mt-1 font-mono text-[11px] text-muted">{hint}</p>}
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
  tone,
  unit,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "amber";
  unit?: string;
}) {
  const color = tone === "amber" ? "text-amber" : "text-fg";
  return (
    <div className="glass rounded-lg border px-2.5 py-2">
      <p className="text-[11px] leading-none text-faint">{label}</p>
      <p className={"mt-1 font-mono text-lg font-medium leading-none tracking-tight sm:text-xl " + color}>
        {value}
        {unit && <span className="text-xs text-muted"> {unit}</span>}
      </p>
      {hint && <p className="mt-1 font-mono text-[11px] leading-snug text-muted">{hint}</p>}
    </div>
  );
}

function SortButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "min-h-11 rounded-md px-4 font-mono text-xs tracking-wide uppercase " +
        (active ? "bg-amber text-on-accent shadow-md" : "glass border text-muted")
      }
    >
      {children}
    </button>
  );
}

function compact(n: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? "−" : "";
  if (abs >= 1_000_000_000_000) return sign + (abs / 1_000_000_000_000).toFixed(2) + "T";
  if (abs >= 1_000_000_000) return sign + (abs / 1_000_000_000).toFixed(2) + "B";
  if (abs >= 1_000_000) return sign + (abs / 1_000_000).toFixed(2) + "M";
  if (abs >= 1_000) return sign + (abs / 1_000).toFixed(1) + "k";
  return sign + abs.toFixed(abs >= 10 ? 0 : 2);
}
