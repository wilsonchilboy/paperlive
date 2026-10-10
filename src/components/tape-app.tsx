import { useEffect, useState } from "react";
import { getProtocol, getWalletBatch, type LiveAccount, type LiveProtocol } from "@/lib/live.functions";
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
    <div className="mx-auto min-h-screen max-w-6xl px-4 pb-16 pt-3 sm:px-6">
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
      <header className="mt-2 border-b border-line pb-5">
        <h1 className="text-3xl font-semibold tracking-tight text-fg sm:text-4xl">PaperTrade Live</h1>
      </header>

      <section className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-7">
        <Stat
          label="Volume"
          value={proto ? "$" + compact(proto.volume) : "—"}
          hint={
            proto
              ? "BTC $" + compact(proto.btcVolume) + " · ETH $" + compact(proto.ethVolume)
              : "Waiting for the exchange"
          }
        />
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
        <Stat label="TVL" value={proto ? "$" + compact(proto.tvl) : "—"} hint="Balances" />
        <Stat label="LP" value={proto ? "$" + compact(proto.lp) : "—"} hint={proto ? "Tail $" + compact(proto.tail) : "Tracked pool"} />
        <Stat label="Open margin" value={proto ? "$" + compact(proto.margin) : "—"} hint={proto ? proto.opens.toLocaleString() + " open" : ""} />
        <Stat label="Staker fees" value={proto ? "$" + compact(proto.fees) : "—"} hint="Lifetime USDC" />
      </section>
      {protoError && <p className="mt-2 text-sm text-loss">{protoError}</p>}

      <div className="mt-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex gap-1">
          <SortButton active={sort === "profit"} onClick={() => setSort("profit")}>
            Highest profit
          </SortButton>
          <SortButton active={sort === "loss"} onClick={() => setSort("loss")}>
            Highest loss
          </SortButton>
        </div>
        <label className="relative min-w-0 flex-1">
          <span className="sr-only">Search wallet</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search wallet or name"
            className="min-h-11 w-full rounded-md border border-line bg-surface px-3 font-mono text-sm text-fg outline-none placeholder:text-faint"
          />
        </label>
      </div>

      <section className="mt-4">
        <div className="mb-2 flex items-baseline justify-between gap-3">
          <h2 className="text-sm font-semibold tracking-wide text-fg uppercase">Every wallet</h2>
          <p className="font-mono text-xs text-faint">
            {count.toLocaleString()} accounts
            {loadedPages < totalPages ? " · loading " + loadedPages + "/" + totalPages : ""}
            {sort === "profit" ? " · profit down" : " · loss down"}
          </p>
        </div>
        <ul className="divide-y divide-line rounded-xl border border-line bg-surface">
          <li className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-end gap-x-2 px-3 py-2 font-mono text-xs tracking-wide text-faint uppercase sm:gap-x-4 sm:px-4">
            <span className="pl-8">Wallet</span>
            <span className="text-center">PnL</span>
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
            <WalletRow key={account.address} account={account} rank={index + 1} supply={proto?.paperSupply ?? 0} />
          ))}
        </ul>
        {accounts.length > show && (
          <button
            type="button"
            className="mt-3 min-h-11 w-full rounded-md border border-line bg-surface text-sm text-fg"
            onClick={() => setShow((n) => n + 40)}
          >
            Show more · {show.toLocaleString()} of {accounts.length.toLocaleString()}
          </button>
        )}
        </section>
      </div>

      <footer className="mt-10 border-t border-line pt-4 font-mono text-xs leading-relaxed text-faint">
        <p>
          Volume, PAPER supply, and wallet profit are the exchange’s own figures. $PAPER earned is the sum of
          mints on losing closes: 98% of each loss (a 2% peel), at 100 PAPER per $1 while tracked LP is under $2M,
          then 100 × (120M / (120M + tail))². Wins mint nothing. $PAPER staked is what that wallet currently
          has in the staking contract. Open shows how many trades are still open, their notional, and unrealized PnL.
        </p>
      </footer>
    </div>
  );
}

function mergeHead(prev: LiveAccount[], fresh: LiveAccount[], sort: Sort): LiveAccount[] {
  if (fresh.length === 0) return prev;
  const freshIds = new Set(fresh.map((row) => row.address));
  const rest = prev.filter((row) => !freshIds.has(row.address));
  const merged = fresh.concat(rest);
  merged.sort((a, b) => (sort === "profit" ? b.pnl - a.pnl : a.pnl - b.pnl));
  return merged;
}

function WalletRow({ account, rank, supply }: { account: LiveAccount; rank: number; supply: number }) {
  const win = account.pnl >= 0;
  const label = account.name ? account.name + " · " + shortAddr(account.address) : shortAddr(account.address);
  return (
    <li>
      <a
        href={EXPLORER + "/address/" + account.address}
        target="_blank"
        rel="noreferrer"
        className="grid min-h-11 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-x-2 px-3 py-3 hover:bg-surface-2 sm:gap-x-4 sm:px-4"
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
      </a>
    </li>
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
    <div className="rounded-lg border border-line bg-surface px-2.5 py-2">
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
        "min-h-11 rounded-md px-3 font-mono text-xs " + (active ? "bg-amber text-surface" : "bg-surface text-muted")
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
