import { i as __toESM } from "../_runtime.mjs";
import { b as require_jsx_runtime, q as require_react } from "../_libs/@tanstack/react-router+[...].mjs";
import { n as TSS_SERVER_FUNCTION, r as getServerFnById, t as createServerFn } from "./ssr.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/routes-C2k_Topj.js
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
var scanTrades = createServerFn({ method: "POST" }).validator((data) => {
	const address = String(data?.address ?? "").trim().toLowerCase();
	if (!/^0x[0-9a-f]{40}$/.test(address)) throw new Error("Bad address");
	return {
		address,
		cursor: String(data?.cursor ?? "").trim().slice(0, 2048)
	};
}).handler(createSsrRpc("045afd013b111a4dee761a73617a535295a92a0f8b3094501f46e7e5fb82b4f0"));
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
	const [selected, setSelected] = (0, import_react.useState)(null);
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
		className: "relative mx-auto min-h-screen max-w-6xl px-4 pb-16 pt-3 sm:px-6",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(WaterField, {}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-center justify-between gap-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ThemeToggle, {}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
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
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("header", {
				className: "mt-2 border-b border-line pb-5",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
					className: "text-3xl font-semibold tracking-tight text-fg sm:text-4xl",
					children: "PaperTrade Live"
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
						label: "Volume",
						value: proto ? "$" + compact(proto.volume) : "—",
						hint: proto ? "BTC $" + compact(proto.btcVolume) + " · ETH $" + compact(proto.ethVolume) : "From the stats page"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
						label: "Liq. Volume",
						value: proto ? "$" + compact(proto.liqVolume) : "—",
						hint: "Liquidated notional"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
						label: "Trades",
						value: proto ? proto.trades.toLocaleString() : "—",
						hint: "Closed and liquidated"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
						label: "Users",
						value: proto ? proto.users.toLocaleString() : "—",
						hint: "Accounts"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
						label: "Rewards",
						value: proto ? "$" + compact(proto.fees) : "—",
						hint: "Staking rewards"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
						label: "TVL",
						value: proto ? "$" + compact(proto.tvl) : "—",
						hint: "Total value locked"
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
					})
				]
			}),
			protoError && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-2 text-sm text-loss",
				children: protoError
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-5",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
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
								className: "min-h-11 w-full rounded-md border border-line bg-surface/70 px-3 font-mono text-sm text-fg outline-none backdrop-blur-md placeholder:text-faint"
							})]
						})]
					}),
					selected && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(WalletScan, {
						account: accounts.find((row) => row.address === selected.address) ?? selected,
						onClose: () => setSelected(null)
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
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
								className: "glass divide-y divide-line/40 rounded-xl border",
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
													children: "$PAPER"
												}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "sm:w-40 sm:text-right",
													children: "$PAPER staked"
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
										supply: proto?.paperSupply ?? 0,
										active: selected?.address === account.address,
										onSelect: () => setSelected((current) => current?.address === account.address ? null : account)
									}, account.address))
								]
							}),
							accounts.length > show && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								type: "button",
								className: "glass mt-3 min-h-11 w-full rounded-md border text-sm text-fg",
								onClick: () => setShow((n) => n + 40),
								children: [
									"Show more · ",
									show.toLocaleString(),
									" of ",
									accounts.length.toLocaleString()
								]
							})
						]
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("footer", {
				className: "mt-10 border-t border-line pt-4 font-mono text-xs leading-relaxed text-faint",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "Volume, liquidations, trades, users, rewards, and TVL are the stats page totals. $PAPER earned is the sum of mints on losing closes: 98% of each loss (a 2% peel), at 100 PAPER per $1 while tracked LP is under $2M, then 100 × (120M / (120M + tail))². Wins mint nothing. $PAPER staked is what that wallet currently has in the staking contract. Open shows how many trades are still open, their notional, and unrealized PnL." })
			})
		]
	});
}
function ThemeToggle() {
	const [dark, setDark] = (0, import_react.useState)(false);
	(0, import_react.useEffect)(() => {
		setDark(document.documentElement.classList.contains("dark"));
	}, []);
	function toggle() {
		setDark((prev) => {
			const next = !prev;
			document.documentElement.classList.toggle("dark", next);
			try {
				localStorage.setItem("pt-theme", next ? "dark" : "light");
			} catch {}
			document.querySelector("meta[name=\"theme-color\"]")?.setAttribute("content", next ? "#120c22" : "#e7c6f4");
			return next;
		});
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
		type: "button",
		onClick: toggle,
		"aria-pressed": dark,
		className: "glass min-h-11 rounded-md border px-3 font-mono text-xs text-fg",
		children: dark ? "Light" : "Dark"
	});
}
function WaterField() {
	const ref = (0, import_react.useRef)(null);
	(0, import_react.useEffect)(() => {
		const canvas = ref.current;
		if (!canvas) return;
		const ctx = canvas.getContext("2d");
		if (!ctx) return;
		const el = canvas;
		const g = ctx;
		const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
		let frame = 0;
		const lobes = [
			{
				ox: .18,
				oy: .62,
				rx: .22,
				ry: .16,
				rgb: "186, 140, 255",
				sp: .55,
				ph: .2
			},
			{
				ox: .38,
				oy: .7,
				rx: .28,
				ry: .18,
				rgb: "120, 170, 255",
				sp: .42,
				ph: 1.1
			},
			{
				ox: .62,
				oy: .66,
				rx: .3,
				ry: .2,
				rgb: "168, 120, 255",
				sp: .48,
				ph: 2.2
			},
			{
				ox: .82,
				oy: .6,
				rx: .2,
				ry: .14,
				rgb: "130, 190, 255",
				sp: .6,
				ph: .7
			},
			{
				ox: .5,
				oy: .78,
				rx: .42,
				ry: .12,
				rgb: "200, 150, 255",
				sp: .36,
				ph: 1.8
			},
			{
				ox: .28,
				oy: .52,
				rx: .1,
				ry: .08,
				rgb: "230, 170, 255",
				sp: .7,
				ph: 2.8
			},
			{
				ox: .74,
				oy: .5,
				rx: .12,
				ry: .09,
				rgb: "150, 190, 255",
				sp: .66,
				ph: .4
			}
		];
		const drops = Array.from({ length: 16 }, (_, i) => ({
			x: (i * .061 + .08) % 1,
			y: .35 + i % 5 * .1,
			r: 3 + i % 4,
			sp: .15 + i % 5 * .04,
			ph: i * .7
		}));
		function resize() {
			const dpr = Math.min(2, window.devicePixelRatio || 1);
			el.width = Math.floor(window.innerWidth * dpr);
			el.height = Math.floor(window.innerHeight * dpr);
			g.setTransform(dpr, 0, 0, dpr, 0, 0);
		}
		function draw(now) {
			const w = window.innerWidth;
			const h = window.innerHeight;
			const t = reduced ? 0 : now / 1e3;
			g.clearRect(0, 0, w, h);
			const dark = document.documentElement.classList.contains("dark");
			const wash = g.createLinearGradient(0, 0, w, h);
			if (dark) {
				wash.addColorStop(0, "#1a1028");
				wash.addColorStop(.46, "#24143a");
				wash.addColorStop(1, "#102033");
			} else {
				wash.addColorStop(0, "#f8d7f6");
				wash.addColorStop(.46, "#e7d4ff");
				wash.addColorStop(1, "#b9dbff");
			}
			g.fillStyle = wash;
			g.fillRect(0, 0, w, h);
			g.globalCompositeOperation = "screen";
			for (const lobe of lobes) {
				const x = (lobe.ox + Math.sin(t * lobe.sp + lobe.ph) * .045) * w;
				const y = (lobe.oy + Math.cos(t * lobe.sp * .8 + lobe.ph) * .035) * h;
				const pulse = 1 + Math.sin(t * .9 + lobe.ph) * .08;
				const rx = lobe.rx * Math.min(w, h) * pulse;
				const ry = lobe.ry * Math.min(w, h) * (1.05 - pulse * .05);
				g.save();
				g.translate(x, y);
				g.rotate(Math.sin(t * .25 + lobe.ph) * .35);
				g.scale(1, ry / rx);
				const glow = g.createRadialGradient(0, 0, rx * .05, 0, 0, rx);
				glow.addColorStop(0, `rgba(255,255,255,0.7)`);
				glow.addColorStop(.22, `rgba(${lobe.rgb},0.62)`);
				glow.addColorStop(.55, `rgba(${lobe.rgb},0.28)`);
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
				g.ellipse(rx * .55, 0, rx * .72, ry * .28, 0, 0, Math.PI * 2);
				g.fill();
				g.restore();
			}
			g.globalCompositeOperation = "source-over";
			for (const drop of drops) {
				const y = ((drop.y - t * drop.sp) % 1 + 1) % 1;
				const x = (drop.x + Math.sin(t * .8 + drop.ph) * .015) * w;
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
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("canvas", {
		ref,
		className: "pointer-events-none fixed inset-0 -z-10 h-screen w-screen",
		"aria-hidden": true
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
function WalletRow({ account, rank, supply, active, onSelect }) {
	const win = account.pnl >= 0;
	const label = account.name ? account.name + " · " + shortAddr(account.address) : shortAddr(account.address);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
		type: "button",
		onClick: onSelect,
		"aria-pressed": active,
		className: "grid w-full min-h-11 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-x-2 px-3 py-3 text-left hover:bg-white/40 sm:gap-x-4 sm:px-4 " + (active ? "bg-white/50" : ""),
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
				className: "flex min-w-0 items-baseline gap-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "w-6 shrink-0 font-mono text-xs text-faint",
					children: rank
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
					className: "min-w-0",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "block truncate font-mono text-sm text-fg",
							children: label
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: "mt-0.5 block truncate font-mono text-xs text-muted",
							children: [
								sharePct(account.paper, supply),
								" · $",
								compact(account.volume)
							]
						}),
						account.openCount > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: "mt-0.5 block truncate font-mono text-xs text-fg",
							children: [
								account.openCount.toLocaleString(),
								" open",
								" · $",
								compact(account.openNotional),
								" · uPnL ",
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: account.upnl >= 0 ? "text-profit" : "text-loss",
									children: usd(account.upnl)
								})
							]
						})
					]
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
					className: "font-mono text-xs tabular-nums text-fg sm:w-40 sm:text-right sm:text-sm",
					children: account.stakedLabel
				})]
			})
		]
	}) });
}
function WalletScan({ account, onClose }) {
	const [trades, setTrades] = (0, import_react.useState)(0);
	const [profit, setProfit] = (0, import_react.useState)(0);
	const [loss, setLoss] = (0, import_react.useState)(0);
	const [profitCount, setProfitCount] = (0, import_react.useState)(0);
	const [lossCount, setLossCount] = (0, import_react.useState)(0);
	const [done, setDone] = (0, import_react.useState)(false);
	const [error, setError] = (0, import_react.useState)(null);
	(0, import_react.useEffect)(() => {
		let dead = false;
		let cursor = null;
		setTrades(0);
		setProfit(0);
		setLoss(0);
		setProfitCount(0);
		setLossCount(0);
		setDone(false);
		setError(null);
		const run = async () => {
			let next = null;
			let total = 0;
			let won = 0;
			let lost = 0;
			let wins = 0;
			let losses = 0;
			do {
				const page = await scanTrades({ data: {
					address: account.address,
					cursor: next
				} });
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
		run().catch((err) => {
			if (dead) return;
			setError(err instanceof Error ? err.message : "Scan failed");
		});
		return () => {
			dead = true;
		};
	}, [account.address]);
	const label = account.name ? account.name + " · " + shortAddr(account.address) : shortAddr(account.address);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		className: "glass mt-4 rounded-xl border p-4",
		"aria-live": "polite",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-start justify-between gap-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "min-w-0",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						className: "truncate font-mono text-sm text-fg",
						children: label
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", {
						href: EXPLORER + "/address/" + account.address,
						target: "_blank",
						rel: "noreferrer",
						className: "font-mono text-xs text-amber underline decoration-line underline-offset-2",
						children: account.address
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					onClick: onClose,
					className: "min-h-11 shrink-0 font-mono text-xs text-muted",
					children: "Close"
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("dl", {
				className: "mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ScanStat, {
						label: "Trades",
						value: trades.toLocaleString(),
						hint: done ? "Closed and liquidated" : "Scanning"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ScanStat, {
						label: "Volume",
						value: "$" + compact(account.volume),
						hint: "All markets"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ScanStat, {
						label: "Profits",
						value: usd(profit),
						hint: profitCount.toLocaleString() + " winning",
						tone: "profit"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ScanStat, {
						label: "Losses",
						value: usd(loss),
						hint: lossCount.toLocaleString() + " losing",
						tone: "loss"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ScanStat, {
						label: "$PAPER",
						value: account.paperLabel,
						hint: "Earned",
						tone: "paper"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ScanStat, {
						label: "$PAPER staked",
						value: account.stakedLabel,
						hint: "In staking"
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-3 font-mono text-xs text-faint",
				children: error ? error : done ? "Scan complete" : "Scan · " + trades.toLocaleString() + " trades"
			})
		]
	});
}
function ScanStat({ label, value, hint, tone }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "rounded-lg bg-white/45 px-2.5 py-2 dark:bg-white/10",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", {
				className: "text-[11px] leading-none text-faint",
				children: label
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", {
				className: "mt-1 font-mono text-sm font-medium tabular-nums " + (tone === "profit" ? "text-profit" : tone === "loss" ? "text-loss" : tone === "paper" ? "text-amber" : "text-fg"),
				children: value
			}),
			hint && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-1 font-mono text-[11px] text-muted",
				children: hint
			})
		]
	});
}
function Stat({ label, value, hint, tone, unit }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "glass rounded-lg border px-2.5 py-2",
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
		className: "min-h-11 rounded-md px-3 font-mono text-xs " + (active ? "bg-amber text-on-accent shadow-md" : "glass border text-muted"),
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
