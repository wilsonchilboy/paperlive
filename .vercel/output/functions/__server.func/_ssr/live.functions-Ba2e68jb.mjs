import { n as TSS_SERVER_FUNCTION, t as createServerFn } from "./ssr.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/live.functions-Ba2e68jb.js
var createServerRpc = (serverFnMeta, splitImportFn) => {
	const url = "/_serverFn/" + serverFnMeta.id;
	return Object.assign(splitImportFn, {
		url,
		serverFnMeta,
		[TSS_SERVER_FUNCTION]: true
	});
};
var ORIGIN = "https://exchange.papertrade.xyz";
function num18(raw) {
	if (raw == null) return 0;
	if (typeof raw === "number") return raw;
	const s = raw.trim();
	if (!/^-?\d+$/.test(s)) return Number(s) || 0;
	const neg = s.startsWith("-");
	const pad = (neg ? s.slice(1) : s).padStart(19, "0");
	const whole = pad.slice(0, -18);
	const frac = pad.slice(-18, -14);
	const value = Number(whole) + Number(frac) / 1e4;
	return neg ? -value : value;
}
function qs(params) {
	return Object.keys(params).sort().map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`).join("&");
}
async function pull(path) {
	let last = "Papertrade request failed";
	for (let attempt = 0; attempt < 3; attempt++) try {
		const res = await fetch(ORIGIN + path, { headers: { accept: "application/json" } });
		if (res.status === 429 || res.status >= 500) {
			last = `Exchange ${res.status}`;
			await new Promise((r) => setTimeout(r, 250 * (attempt + 1)));
			continue;
		}
		if (!res.ok) throw new Error(`Exchange ${res.status}`);
		return await res.json();
	} catch (err) {
		last = err instanceof Error ? err.message : last;
		await new Promise((r) => setTimeout(r, 200 * (attempt + 1)));
	}
	throw new Error(last);
}
function marginalRate(paper) {
	const tracked = num18(paper.trackedLp);
	const cliff = num18(paper.cliff) || 2e6;
	const scale = num18(paper.decay) || 12e7;
	const tail = num18(paper.tailProgress);
	if (tracked < cliff) return 100;
	const ratio = scale / (scale + tail);
	return 100 * ratio * ratio;
}
var getProtocol_createServerFn_handler = createServerRpc({
	id: "45837d1f4acbff1f0b69eec7f6494ceadbe3b72b346ca292634ccaa3eb34f14c",
	name: "getProtocol",
	filename: "src/lib/live.functions.ts"
}, (opts) => getProtocol.__executeServer(opts));
var getProtocol = createServerFn({ method: "GET" }).handler(getProtocol_createServerFn_handler, async () => {
	const [summary, markets, recent] = await Promise.all([
		pull("/query/protocol/summary"),
		pull("/query/protocol/market-stats"),
		pull("/query/protocol/trades/recent")
	]);
	return {
		at: summary.source.at,
		block: Number(summary.source.block),
		volume: num18(summary.activity.volume),
		btcVolume: num18(markets.markets["0"]?.volume_24h),
		ethVolume: num18(markets.markets["1"]?.volume_24h),
		paperSupply: num18(summary.paper.supply),
		paperStaked: num18(summary.paper.staked),
		tvl: num18(summary.balances.tvl),
		lp: num18(summary.balances.lp),
		margin: num18(summary.balances.margin),
		opens: summary.activity.open,
		fees: num18(summary.fees.lifetime),
		rate: marginalRate(summary.paper),
		tail: num18(summary.paper.tailProgress),
		trades: (recent.events ?? []).slice(0, 24).map((event) => ({
			id: event.seq,
			ts: event.ts,
			wallet: event.wallet,
			instrument: event.instrument,
			side: event.side,
			leverage: event.leverage,
			notional: event.notionalUsd,
			kind: event.kind,
			pnl: event.kind === "close" ? event.pnlUsd : null
		}))
	};
});
async function fetchPage(sort, page, q) {
	const params = {
		page: String(page),
		pageSize: "100",
		sortDir: sort === "profit" ? "desc" : "asc",
		sortKey: "realizedPnl",
		window: "all"
	};
	if (q) params.q = q;
	return pull("/state/leaderboard/accounts?" + qs(params));
}
function mapAccounts(rows) {
	return rows.map((row) => ({
		address: row.address.toLowerCase(),
		name: row.leaderboardName,
		pnl: num18(row.realizedPnl),
		paper: num18(row.paperTotal),
		volume: num18(row.totalVolume),
		rank: row._leaderboardRank
	}));
}
var getWalletBatch_createServerFn_handler = createServerRpc({
	id: "cbbe9b29c95d3715b1aa83e702e1bd5e9a2bff0e57b7713a9dd70965d10968e4",
	name: "getWalletBatch",
	filename: "src/lib/live.functions.ts"
}, (opts) => getWalletBatch.__executeServer(opts));
var getWalletBatch = createServerFn({ method: "POST" }).validator((data) => {
	return {
		sort: data?.sort === "loss" ? "loss" : "profit",
		startPage: Math.max(0, Math.min(5e3, Math.floor(Number(data?.startPage) || 0))),
		q: String(data?.q ?? "").trim().slice(0, 80)
	};
}).handler(getWalletBatch_createServerFn_handler, async ({ data }) => {
	const ok = (await Promise.all(Array.from({ length: 6 }, (_, i) => fetchPage(data.sort, data.startPage + i, data.q).catch(() => null)))).filter((page) => page != null && page.ok !== false);
	if (ok.length === 0) throw new Error("Leaderboard unavailable");
	const totalPages = ok[0].pageInfo.totalPages;
	const accounts = ok.filter((page) => page.pageInfo.page < totalPages).sort((a, b) => a.pageInfo.page - b.pageInfo.page).flatMap((page) => mapAccounts(page.accounts));
	return {
		count: ok[0].count,
		totalPages,
		startPage: data.startPage,
		accounts
	};
});
//#endregion
export { getProtocol_createServerFn_handler, getWalletBatch_createServerFn_handler };
