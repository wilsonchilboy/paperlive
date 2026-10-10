import { n as TSS_SERVER_FUNCTION, t as createServerFn } from "./ssr.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/live.functions-XrXq-7lT.js
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
function formatToken(raw) {
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
function lastNum(values) {
	if (!values || values.length === 0) return 0;
	const n = values[values.length - 1];
	return typeof n === "number" && Number.isFinite(n) ? n : 0;
}
function countRaw(raw) {
	if (!raw) return 0;
	const n = Number(raw);
	return Number.isFinite(n) ? n : 0;
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
	const [summary, history] = await Promise.all([pull("/query/protocol/summary"), pull("/query/protocol/history?interval=1h")]);
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
		tail: num18(summary.paper.tailProgress)
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
		paperLabel: formatToken(row.paperTotal),
		staked: 0,
		stakedLabel: "—",
		openCount: row.currentOpenPositionCount ?? 0,
		openNotional: num18(row.currentOpenNotional),
		upnl: num18(row.currentUnrealizedPnl),
		volume: num18(row.totalVolume),
		rank: row._leaderboardRank
	}));
}
var STAKING = "0xaad6c7b0cc3014fc80ffedae0ed7ce5967b0f016";
var STAKED_SEL = "0x60217267";
var STAKE_RPCS = ["https://rpc.hypurrscan.io", "https://rpc.hyperliquid.xyz/evm"];
async function stakedRaw(addresses) {
	const out = /* @__PURE__ */ new Map();
	const jobs = [];
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
				params: [{
					to: STAKING,
					data: STAKED_SEL + addr.slice(2).padStart(64, "0")
				}, "latest"]
			}));
			let rows = null;
			for (const rpc of STAKE_RPCS) try {
				const json = await (await fetch(rpc, {
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify(body)
				})).json();
				if (Array.isArray(json)) {
					rows = json;
					break;
				}
			} catch {}
			if (!rows) continue;
			for (const row of rows) {
				if (row.id == null) continue;
				const addr = job[row.id];
				if (addr && typeof row.result === "string" && /^0x[0-9a-fA-F]+$/.test(row.result)) out.set(addr, BigInt(row.result).toString());
			}
		}
	}
	await Promise.all([
		worker(),
		worker(),
		worker(),
		worker()
	]);
	return out;
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
	try {
		const stakes = await stakedRaw(accounts.map((account) => account.address));
		for (const account of accounts) {
			const raw = stakes.get(account.address);
			if (!raw) continue;
			account.staked = num18(raw);
			account.stakedLabel = formatToken(raw);
		}
	} catch {}
	return {
		count: ok[0].count,
		totalPages,
		startPage: data.startPage,
		accounts
	};
});
var scanTrades_createServerFn_handler = createServerRpc({
	id: "045afd013b111a4dee761a73617a535295a92a0f8b3094501f46e7e5fb82b4f0",
	name: "scanTrades",
	filename: "src/lib/live.functions.ts"
}, (opts) => scanTrades.__executeServer(opts));
var scanTrades = createServerFn({ method: "POST" }).validator((data) => {
	const address = String(data?.address ?? "").trim().toLowerCase();
	if (!/^0x[0-9a-f]{40}$/.test(address)) throw new Error("Bad address");
	return {
		address,
		cursor: String(data?.cursor ?? "").trim().slice(0, 2048)
	};
}).handler(scanTrades_createServerFn_handler, async ({ data }) => {
	let cursor = data.cursor;
	let trades = 0;
	let profit = 0;
	let loss = 0;
	let profitCount = 0;
	let lossCount = 0;
	let next = cursor || null;
	for (let step = 0; step < 4; step++) {
		const params = { limit: "75" };
		if (next) params.cursor = next;
		const page = await pull("/query/accounts/" + data.address + "/trades?" + qs(params));
		for (const item of page.items ?? []) {
			const pnl = num18(item.adjustedPnlRaw);
			trades += 1;
			if (pnl > 0) {
				profit += pnl;
				profitCount += 1;
			} else if (pnl < 0) {
				loss += pnl;
				lossCount += 1;
			}
		}
		next = page.nextCursor && page.nextCursor !== next ? page.nextCursor : null;
		if (!next) break;
	}
	return {
		trades,
		profit,
		loss,
		profitCount,
		lossCount,
		nextCursor: next
	};
});
//#endregion
export { getProtocol_createServerFn_handler, getWalletBatch_createServerFn_handler, scanTrades_createServerFn_handler };
