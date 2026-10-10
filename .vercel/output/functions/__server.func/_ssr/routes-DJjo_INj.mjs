import { i as __toESM } from "../_runtime.mjs";
import { b as require_jsx_runtime, q as require_react } from "../_libs/@tanstack/react-router+[...].mjs";
import { n as TSS_SERVER_FUNCTION, r as getServerFnById, t as createServerFn } from "./ssr.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/routes-DJjo_INj.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var createSsrRpc = (functionId) => {
	const url = "/_serverFn/" + functionId;
	const serverFnMeta = { id: functionId };
	const fn = async (...args) => {
		return (await getServerFnById(functionId, { origin: "server" }))(...args);
	};
	return Object.assign(fn, {
		url,
		serverFnMeta,
		[TSS_SERVER_FUNCTION]: true
	});
};
var getProtocol = createServerFn({ method: "GET" }).handler(createSsrRpc("45837d1f4acbff1f0b69eec7f6494ceadbe3b72b346ca292634ccaa3eb34f14c"));
var getWalletBatch = createServerFn({ method: "POST" }).validator((data) => {
	return {
		sort: data?.sort === "loss" ? "loss" : "profit",
		startPage: Math.max(0, Math.min(5e3, Math.floor(Number(data?.startPage) || 0))),
		q: String(data?.q ?? "").trim().slice(0, 80)
	};
}).handler(createSsrRpc("cbbe9b29c95d3715b1aa83e702e1bd5e9a2bff0e57b7713a9dd70965d10968e4"));
var EXPLORER = "https://hyperevmscan.io";
function shortAddr(addr) {
	if (addr.length < 12) return addr;
	return addr.slice(0, 6) + "…" + addr.slice(-4);
}
function usd(n, digits) {
	const sign = n < 0 ? "−" : n > 0 ? "+" : "";
	const abs = Math.abs(n);
	const max = digits ?? (abs >= 1e3 ? 0 : abs >= 10 ? 2 : 2);
	const body = abs.toLocaleString("en-US", {
		minimumFractionDigits: abs >= 1e3 && max === 0 ? 0 : max,
		maximumFractionDigits: max
	});
	return sign + "$" + body;
}
function paperAmt(n) {
	const abs = Math.abs(n);
	return (abs >= 1e9 ? (abs / 1e9).toFixed(2) + "B" : abs >= 1e6 ? (abs / 1e6).toFixed(2) + "M" : abs >= 1e3 ? (abs / 1e3).toFixed(abs >= 1e4 ? 0 : 1) + "k" : abs.toFixed(0)) + " PAPER";
}
function sharePct(part, total) {
	if (!(total > 0) || !(part > 0)) return "0%";
	const p = part / total * 100;
	if (p >= 10) return p.toFixed(1) + "%";
	if (p >= 1) return p.toFixed(2) + "%";
	if (p >= .01) return p.toFixed(2) + "%";
	return "<0.01%";
}
function TapeApp() {
	const [proto, setProto] = (0, import_react.useState)(null);
	const [protoError, setProtoError] = (0, import_react.useState)(null);
	const [sort, setSort] = (0, import_react.useState)("profit");
	const [query, setQuery] = (0, import_react.useState)("");
	const [q, setQ] = (0, import_react.useState)("");
	const [accounts, setAccounts] = (0, import_react.useState)([]);
	const [count, setCount] = (0, import_react.useState)(0);
	const [loadedPages, setLoadedPages] = (0, import_react.useState)(0);
	const [totalPages, setTotalPages] = (0, import_react.useState)(1);
	const [listError, setListError] = (0, import_react.useState)(null);
	const [show, setShow] = (0, import_react.useState)(40);
	const [dark, setDark] = (0, import_react.useState)(false);
	(0, import_react.useEffect)(() => {
		setDark(document.documentElement.classList.contains("dark"));
	}, []);
	function toggleTheme() {
		setDark((prev) => {
			const next = !prev;
			document.documentElement.classList.toggle("dark", next);
			try {
				localStorage.setItem("pt-theme", next ? "dark" : "light");
			} catch {}
			document.querySelector("meta[name=\"theme-color\"]")?.setAttribute("content", next ? "#16130f" : "#f4ecd8");
			return next;
		});
	}
	(0, import_react.useEffect)(() => {
		const handle = window.setTimeout(() => setQ(query.trim()), 300);
		return () => window.clearTimeout(handle);
	}, [query]);
	(0, import_react.useEffect)(() => {
		let dead = false;
		const tick = () => {
			getProtocol().then((next) => {
				if (dead) return;
				setProto(next);
				setProtoError(null);
			}).catch((err) => {
				if (dead) return;
				setProtoError(err instanceof Error ? err.message : "Exchange unavailable");
			});
		};
		tick();
		const id = window.setInterval(tick, 8e3);
		return () => {
			dead = true;
			window.clearInterval(id);
		};
	}, []);
	(0, import_react.useEffect)(() => {
		let dead = false;
		setAccounts([]);
		setLoadedPages(0);
		setShow(40);
		setListError(null);
		const run = async () => {
			let start = 0;
			let pages = 1;
			const all = [];
			while (start < pages && !dead) {
				const batch = await getWalletBatch({ data: {
					sort,
					startPage: start,
					q
				} });
				if (dead) return;
				pages = Math.max(1, batch.totalPages);
				all.push(...batch.accounts);
				all.sort((a, b) => sort === "profit" ? b.pnl - a.pnl : a.pnl - b.pnl);
				start += 6;
				setTotalPages(pages);
				setCount(batch.count);
				setLoadedPages(Math.min(start, pages));
				setAccounts(all.slice());
			}
		};
		run().catch((err) => {
			if (dead) return;
			setListError(err instanceof Error ? err.message : "Could not load wallets");
		});
		return () => {
			dead = true;
		};
	}, [sort, q]);
	(0, import_react.useEffect)(() => {
		const id = window.setInterval(() => {
			getWalletBatch({ data: {
				sort,
				startPage: 0,
				q
			} }).then((batch) => {
				setCount(batch.count);
				setTotalPages(batch.totalPages);
				setAccounts((prev) => mergeHead(prev, batch.accounts, sort));
			}).catch(() => {});
		}, 15e3);
		return () => window.clearInterval(id);
	}, [sort, q]);
	const visible = accounts.slice(0, show);
	const stakePct = proto && proto.paperSupply > 0 ? proto.paperStaked / proto.paperSupply * 100 : 0;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "mx-auto min-h-screen max-w-6xl px-4 pb-16 pt-3 sm:px-6",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "text-right font-mono text-xs text-muted",
				children: [
					"build by:",
					" ",
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", {
						href: "https://x.com/wilson_",
						target: "_blank",
						rel: "noreferrer",
						className: "text-fg underline decoration-line underline-offset-2 hover:text-amber",
						children: "wilson"
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
				className: "mt-2 flex items-end justify-between gap-3 border-b border-line pb-5",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
					className: "text-3xl font-semibold tracking-tight text-fg sm:text-4xl",
					children: "PaperTrade Live"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					onClick: toggleTheme,
					"aria-pressed": dark,
					className: "min-h-11 shrink-0 rounded-md border border-line bg-surface px-3 font-mono text-xs text-fg",
					children: dark ? "Light" : "Dark"
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-7",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
						label: "Volume",
						value: proto ? "$" + compact(proto.volume) : "—",
						hint: proto ? "BTC $" + compact(proto.btcVolume) + " · ETH $" + compact(proto.ethVolume) : "Waiting for the exchange"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
						label: "PAPER supply",
						value: proto ? paperAmt(proto.paperSupply).replace(" PAPER", "") : "—",
						hint: proto ? stakePct.toFixed(1) + "% staked" : "Minted from losses",
						tone: "amber"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
						label: "Mint rate",
						value: proto ? proto.rate.toFixed(proto.rate >= 10 ? 1 : 2) : "—",
						hint: proto ? proto.rate.toFixed(1) + "% of launch" : "PAPER per $1 lost",
						unit: proto ? "/ $1" : void 0
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
						label: "TVL",
						value: proto ? "$" + compact(proto.tvl) : "—",
						hint: "Balances"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
						label: "LP",
						value: proto ? "$" + compact(proto.lp) : "—",
						hint: proto ? "Tail $" + compact(proto.tail) : "Tracked pool"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
						label: "Open margin",
						value: proto ? "$" + compact(proto.margin) : "—",
						hint: proto ? proto.opens.toLocaleString() + " open" : ""
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
						label: "Staker fees",
						value: proto ? "$" + compact(proto.fees) : "—",
						hint: "Lifetime USDC"
					})
				]
			}),
			protoError && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-2 text-sm text-loss",
				children: protoError
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-5",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex flex-col gap-3 sm:flex-row sm:items-center",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex gap-1",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SortButton, {
							active: sort === "profit",
							onClick: () => setSort("profit"),
							children: "Highest profit"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SortButton, {
							active: sort === "loss",
							onClick: () => setSort("loss"),
							children: "Highest loss"
						})]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
						className: "relative min-w-0 flex-1",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "sr-only",
							children: "Search wallet"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
							value: query,
							onChange: (e) => setQuery(e.target.value),
							placeholder: "Search wallet or name",
							className: "min-h-11 w-full rounded-md border border-line bg-surface px-3 font-mono text-sm text-fg outline-none placeholder:text-faint"
						})]
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
					className: "mt-4",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "mb-2 flex items-baseline justify-between gap-3",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
								className: "text-sm font-semibold tracking-wide text-fg uppercase",
								children: "Every wallet"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
								className: "font-mono text-xs text-faint",
								children: [
									count.toLocaleString(),
									" accounts",
									loadedPages < totalPages ? " · loading " + loadedPages + "/" + totalPages : "",
									sort === "profit" ? " · profit down" : " · loss down"
								]
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("ul", {
							className: "divide-y divide-line rounded-xl border border-line bg-surface",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
									className: "grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-end gap-x-2 px-3 py-2 font-mono text-xs tracking-wide text-faint uppercase sm:gap-x-4 sm:px-4",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "pl-8",
											children: "Wallet"
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "text-center",
											children: "PnL"
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
											className: "flex flex-col items-end gap-0.5 sm:flex-row sm:justify-end sm:gap-4",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: "sm:w-36 sm:text-right",
												children: "Earned"
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
												className: "sm:w-36 sm:text-right",
												children: "Staked"
											})]
										})
									]
								}),
								visible.length === 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", {
									className: "px-4 py-8 text-center text-sm text-faint",
									children: listError ?? "Loading wallets from the exchange."
								}),
								visible.map((account, index) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(WalletRow, {
									account,
									rank: index + 1,
									supply: proto?.paperSupply ?? 0
								}, account.address))
							]
						}),
						accounts.length > show && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							type: "button",
							className: "mt-3 min-h-11 w-full rounded-md border border-line bg-surface text-sm text-fg",
							onClick: () => setShow((n) => n + 40),
							children: [
								"Show more · ",
								show.toLocaleString(),
								" of ",
								accounts.length.toLocaleString()
							]
						})
					]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("footer", {
				className: "mt-10 border-t border-line pt-4 font-mono text-xs leading-relaxed text-faint",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "Volume, PAPER supply, and wallet profit are the exchange’s own figures. $PAPER earned is the sum of mints on losing closes: 98% of each loss (a 2% peel), at 100 PAPER per $1 while tracked LP is under $2M, then 100 × (120M / (120M + tail))². Wins mint nothing. Staked is how much of that PAPER the wallet currently has in the staking contract." })
			})
		]
	});
}
function mergeHead(prev, fresh, sort) {
	if (fresh.length === 0) return prev;
	const freshIds = new Set(fresh.map((row) => row.address));
	const rest = prev.filter((row) => !freshIds.has(row.address));
	const merged = fresh.concat(rest);
	merged.sort((a, b) => sort === "profit" ? b.pnl - a.pnl : a.pnl - b.pnl);
	return merged;
}
function WalletRow({ account, rank, supply }) {
	const win = account.pnl >= 0;
	const label = account.name ? account.name + " · " + shortAddr(account.address) : shortAddr(account.address);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("a", {
		href: EXPLORER + "/address/" + account.address,
		target: "_blank",
		rel: "noreferrer",
		className: "grid min-h-11 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-x-2 px-3 py-3 hover:bg-surface-2 sm:gap-x-4 sm:px-4",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
				className: "flex min-w-0 items-baseline gap-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "w-6 shrink-0 font-mono text-xs text-faint",
					children: rank
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
					className: "min-w-0",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "block truncate font-mono text-sm text-fg",
						children: label
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: "mt-0.5 block truncate font-mono text-xs text-muted",
						children: [
							sharePct(account.paper, supply),
							" · $",
							compact(account.volume)
						]
					})]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "text-center font-mono text-sm font-medium tabular-nums " + (win ? "text-profit" : "text-loss"),
				children: usd(account.pnl)
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
				className: "flex flex-col items-end gap-0.5 sm:flex-row sm:items-baseline sm:justify-end sm:gap-4",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "font-mono text-xs text-amber tabular-nums sm:w-36 sm:text-right sm:text-sm",
					children: account.paperLabel
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "font-mono text-xs tabular-nums text-fg sm:w-36 sm:text-right sm:text-sm",
					children: account.stakedLabel
				})]
			})
		]
	}) });
}
function Stat({ label, value, hint, tone, unit }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "rounded-lg border border-line bg-surface px-2.5 py-2",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-[11px] leading-none text-faint",
				children: label
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "mt-1 font-mono text-lg font-medium leading-none tracking-tight sm:text-xl " + (tone === "amber" ? "text-amber" : "text-fg"),
				children: [value, unit && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
					className: "text-xs text-muted",
					children: [" ", unit]
				})]
			}),
			hint && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-1 font-mono text-[11px] leading-snug text-muted",
				children: hint
			})
		]
	});
}
function SortButton({ active, onClick, children }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
		type: "button",
		onClick,
		className: "min-h-11 rounded-md px-3 font-mono text-xs " + (active ? "bg-amber text-surface" : "bg-surface text-muted"),
		children
	});
}
function compact(n) {
	const abs = Math.abs(n);
	const sign = n < 0 ? "−" : "";
	if (abs >= 0xe8d4a51000) return sign + (abs / 0xe8d4a51000).toFixed(2) + "T";
	if (abs >= 1e9) return sign + (abs / 1e9).toFixed(2) + "B";
	if (abs >= 1e6) return sign + (abs / 1e6).toFixed(2) + "M";
	if (abs >= 1e3) return sign + (abs / 1e3).toFixed(1) + "k";
	return sign + abs.toFixed(abs >= 10 ? 0 : 2);
}
function Home() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TapeApp, {});
}
//#endregion
export { Home as component };
