"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell
} from "recharts";
import { TrendingUp, TrendingDown, Activity, AlertTriangle, ArrowLeft, RefreshCw } from "lucide-react";

const BOT_API = process.env.NEXT_PUBLIC_BOT_API_URL || "";

function StatCard({ label, value, sub, color = "text-white" }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className={`text-xl font-bold ${color}`}>{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
    </div>
  );
}

function WinRateCell({ wr }: { wr: number | null }) {
  if (wr === null) return <div className="w-full h-8 rounded bg-gray-800 opacity-30" />;
  const bg = wr >= 65 ? "bg-green-600" : wr >= 50 ? "bg-yellow-600" : wr >= 35 ? "bg-orange-600" : "bg-red-700";
  return (
    <div className={`w-full h-8 rounded ${bg} flex items-center justify-center text-xs font-bold text-white`}>
      {wr}%
    </div>
  );
}

const DOW_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function AnalyticsPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  async function fetchData() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${BOT_API}/api/dashboard`, { cache: "no-store" });
      if (!res.ok) throw new Error(`Backend returned ${res.status}`);
      const json = await res.json();
      setData(json);
      setLastUpdated(new Date());
    } catch (err: any) {
      setError(err.message || "Failed to connect to bot backend");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchData(); }, []);

  const stats = data?.stats || {};
  const plHistory: { date: string; pl: number }[] = data?.plHistory || [];
  const winByHour: { hour: number; winRate: number | null; total: number }[] = data?.winByHour || [];
  const winByDay: { day: string; winRate: number | null; total: number }[] = data?.winByDay || [];
  const winByMarket: { market: string; winRate: number; pl: number; total: number }[] = data?.winByMarket || [];
  const plBySymbol: { symbol: string; totalPL: number; trades: number; winRate: number }[] = (data?.plBySymbol || []).slice(0, 15);
  const corr: { symbols: string[]; matrix: (number | string)[][] } | null = data?.correlationMatrix || null;

  const plColor = (v: number) => v >= 0 ? "#22c55e" : "#ef4444";

  return (
    <main className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <div className="border-b border-gray-800 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-gray-400 hover:text-white transition-colors">
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div>
              <h1 className="text-xl font-bold">Bot Analytics</h1>
              <p className="text-xs text-gray-400">
                {lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString()}` : "Loading…"}
              </p>
            </div>
          </div>
          <button onClick={fetchData} disabled={loading} className="flex items-center gap-2 text-xs text-gray-400 hover:text-white border border-gray-700 rounded-lg px-3 py-1.5 transition-colors disabled:opacity-50">
            <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {error && (
          <div className="bg-red-900/30 border border-red-700 rounded-xl p-4 text-red-300 text-sm flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}

        {loading && !data && (
          <div className="flex items-center justify-center py-24 text-gray-500">
            <RefreshCw className="w-5 h-5 animate-spin mr-2" />
            Connecting to bot…
          </div>
        )}

        {data && (
          <>
            {/* Key Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
              <div className="col-span-2">
                <StatCard
                  label="Total P/L"
                  value={`${stats.totalProfitLoss >= 0 ? "+" : ""}$${Number(stats.totalProfitLoss || 0).toFixed(2)}`}
                  sub={`${stats.totalTrades || 0} closed trades`}
                  color={stats.totalProfitLoss >= 0 ? "text-green-400" : "text-red-400"}
                />
              </div>
              <div className="col-span-2">
                <StatCard label="Win Rate" value={`${stats.winRate || 0}%`} sub={`${stats.openPositions || 0} open now`} color="text-blue-400" />
              </div>
              <div className="col-span-2">
                <StatCard
                  label="Max Drawdown"
                  value={`-$${Number(data.maxDrawdown || 0).toFixed(2)}`}
                  sub="Peak → trough"
                  color="text-orange-400"
                />
              </div>
              <div className="col-span-2">
                <StatCard
                  label="VaR 95%"
                  value={`-$${Number(data.var95 || 0).toFixed(2)}`}
                  sub="Worst expected daily"
                  color="text-yellow-400"
                />
              </div>
              <div className="col-span-2">
                <StatCard label="Today P/L" value={`${(data.todayStats?.pl || 0) >= 0 ? "+" : ""}$${Number(data.todayStats?.pl || 0).toFixed(2)}`} sub={`${data.todayStats?.trades || 0} trades today`} color={(data.todayStats?.pl || 0) >= 0 ? "text-green-400" : "text-red-400"} />
              </div>
              <div className="col-span-2">
                <StatCard label="Today Win Rate" value={`${data.todayStats?.winRate || 0}%`} sub={`${data.todayStats?.wins || 0}W / ${(data.todayStats?.trades || 0) - (data.todayStats?.wins || 0)}L`} color="text-purple-400" />
              </div>
              <div className="col-span-2">
                <StatCard
                  label="Avg Slippage"
                  value={data.avgSlippage !== null ? `${data.avgSlippage > 0 ? "+" : ""}${data.avgSlippage}%` : "N/A"}
                  sub="Live trades only"
                  color={Math.abs(data.avgSlippage || 0) > 0.2 ? "text-red-400" : "text-gray-300"}
                />
              </div>
              <div className="col-span-2">
                <StatCard label="Capital Deployed" value={`$${Number(stats.capitalInTrades || 0).toFixed(0)}`} sub={`$${Number(stats.availableCapital || 0).toFixed(0)} free`} color="text-cyan-400" />
              </div>
            </div>

            {/* Equity Curve */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <Activity className="w-4 h-4 text-blue-400" />
                <h2 className="text-sm font-semibold text-gray-200">Equity Curve — All-Time Cumulative P/L</h2>
              </div>
              {plHistory.length < 2 ? (
                <p className="text-gray-500 text-sm text-center py-8">Not enough closed trades yet</p>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={plHistory} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                    <XAxis dataKey="date" tick={{ fill: "#6b7280", fontSize: 10 }} interval="preserveStartEnd" />
                    <YAxis tick={{ fill: "#6b7280", fontSize: 10 }} tickFormatter={v => `$${v}`} width={60} />
                    <Tooltip
                      contentStyle={{ background: "#111827", border: "1px solid #374151", borderRadius: 8 }}
                      formatter={(v: number) => [`${v >= 0 ? "+" : ""}$${v.toFixed(2)}`, "Cumulative P/L"]}
                    />
                    <Line type="monotone" dataKey="pl" stroke="#3b82f6" strokeWidth={2} dot={false}
                      activeDot={{ r: 4, fill: "#3b82f6" }} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Win Rate Heatmaps */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* By Hour */}
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                <h2 className="text-sm font-semibold text-gray-200 mb-4">Win Rate by Hour (UTC)</h2>
                <div className="grid grid-cols-12 gap-1">
                  {winByHour.slice(0, 24).map((h) => (
                    <div key={h.hour} className="flex flex-col items-center gap-1">
                      <WinRateCell wr={h.total >= 3 ? h.winRate : null} />
                      <span className="text-[9px] text-gray-600">{h.hour}</span>
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-3 mt-3 text-[10px] text-gray-500">
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-600 inline-block" />65%+</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-yellow-600 inline-block" />50–65%</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-orange-600 inline-block" />35–50%</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-700 inline-block" />&lt;35%</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-gray-800 opacity-30 inline-block" />{"<"}3 trades</span>
                </div>
              </div>

              {/* By Day */}
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                <h2 className="text-sm font-semibold text-gray-200 mb-4">Win Rate by Day of Week</h2>
                <div className="grid grid-cols-7 gap-2">
                  {winByDay.map((d) => (
                    <div key={d.day} className="flex flex-col items-center gap-1">
                      <WinRateCell wr={d.total >= 3 ? d.winRate : null} />
                      <span className="text-[10px] text-gray-500">{d.day}</span>
                      <span className="text-[9px] text-gray-600">{d.total}t</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Market Breakdown + Symbol P/L */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Market breakdown */}
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                <h2 className="text-sm font-semibold text-gray-200 mb-4">Performance by Market</h2>
                <div className="space-y-3">
                  {winByMarket.map((m) => (
                    <div key={m.market} className="flex items-center justify-between py-2 border-b border-gray-800 last:border-0">
                      <div>
                        <p className="text-sm font-medium capitalize text-white">{m.market}</p>
                        <p className="text-xs text-gray-500">{m.total} trades</p>
                      </div>
                      <div className="text-right">
                        <p className={`text-sm font-bold ${m.pl >= 0 ? "text-green-400" : "text-red-400"}`}>
                          {m.pl >= 0 ? "+" : ""}${m.pl.toFixed(2)}
                        </p>
                        <p className="text-xs text-gray-400">WR {m.winRate}%</p>
                      </div>
                    </div>
                  ))}
                  {winByMarket.length === 0 && <p className="text-gray-500 text-sm text-center py-4">No closed trades yet</p>}
                </div>
              </div>

              {/* Symbol P/L bar chart */}
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                <h2 className="text-sm font-semibold text-gray-200 mb-4">P/L by Symbol (Top 15)</h2>
                {plBySymbol.length < 1 ? (
                  <p className="text-gray-500 text-sm text-center py-8">No data yet</p>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={plBySymbol} margin={{ top: 4, right: 8, left: 0, bottom: 30 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                      <XAxis dataKey="symbol" tick={{ fill: "#6b7280", fontSize: 9 }} angle={-40} textAnchor="end" interval={0} />
                      <YAxis tick={{ fill: "#6b7280", fontSize: 10 }} tickFormatter={v => `$${v}`} width={55} />
                      <Tooltip
                        contentStyle={{ background: "#111827", border: "1px solid #374151", borderRadius: 8 }}
                        formatter={(v: number, _: any, p: any) => [`${v >= 0 ? "+" : ""}$${v.toFixed(2)} (WR ${p.payload.winRate}%)`, p.payload.symbol]}
                      />
                      <Bar dataKey="totalPL" radius={[3, 3, 0, 0]}>
                        {plBySymbol.map((entry, i) => (
                          <Cell key={i} fill={entry.totalPL >= 0 ? "#22c55e" : "#ef4444"} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Correlation Matrix */}
            {corr && corr.symbols.length >= 2 && (
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                <div className="flex items-center gap-2 mb-4">
                  <h2 className="text-sm font-semibold text-gray-200">Open Position Correlation Matrix</h2>
                  <span className="text-xs text-gray-500 bg-gray-800 px-2 py-0.5 rounded">30-day daily returns</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="text-xs border-collapse">
                    <thead>
                      <tr>
                        <th className="w-24 text-gray-500 font-normal text-left pr-3 pb-2"></th>
                        {corr.symbols.map(s => <th key={s} className="text-gray-400 font-medium text-center pb-2 px-2 w-20">{s.replace("/USDT", "")}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {corr.matrix.map((row, ri) => (
                        <tr key={ri}>
                          <td className="text-gray-400 font-medium pr-3 py-1">{corr.symbols[ri].replace("/USDT", "")}</td>
                          {row.map((v, ci) => {
                            const num = typeof v === "number" ? v : null;
                            const isId = ri === ci;
                            const bg = isId ? "bg-gray-700"
                              : num === null ? "bg-gray-800"
                              : num > 0.7 ? "bg-red-900"
                              : num > 0.4 ? "bg-orange-900"
                              : num < -0.4 ? "bg-blue-900"
                              : "bg-gray-800";
                            return (
                              <td key={ci} className={`text-center py-1.5 px-2 ${bg} rounded mx-0.5`}>
                                <span className={isId ? "text-gray-300" : num !== null && Math.abs(num) > 0.7 ? "text-white font-bold" : "text-gray-300"}>
                                  {isId ? "1.00" : num !== null ? num.toFixed(2) : "–"}
                                </span>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex items-center gap-4 mt-3 text-[10px] text-gray-500">
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-900 inline-block" /> High correlation (&gt;0.7) — risk concentrated</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-orange-900 inline-block" /> Moderate (0.4–0.7)</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-blue-900 inline-block" /> Negative (hedge)</span>
                </div>
              </div>
            )}

            {/* Symbol detail table */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <h2 className="text-sm font-semibold text-gray-200 mb-4">Full Symbol Breakdown</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-gray-500 border-b border-gray-800">
                      <th className="text-left pb-2 font-medium">Symbol</th>
                      <th className="text-right pb-2 font-medium">Trades</th>
                      <th className="text-right pb-2 font-medium">Win Rate</th>
                      <th className="text-right pb-2 font-medium">Total P/L</th>
                    </tr>
                  </thead>
                  <tbody>
                    {plBySymbol.map((s) => (
                      <tr key={s.symbol} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                        <td className="py-2 font-mono text-gray-200">{s.symbol}</td>
                        <td className="py-2 text-right text-gray-400">{s.trades}</td>
                        <td className="py-2 text-right">
                          <span className={`font-medium ${s.winRate >= 60 ? "text-green-400" : s.winRate >= 45 ? "text-yellow-400" : "text-red-400"}`}>
                            {s.winRate}%
                          </span>
                        </td>
                        <td className={`py-2 text-right font-bold ${s.totalPL >= 0 ? "text-green-400" : "text-red-400"}`}>
                          {s.totalPL >= 0 ? "+" : ""}${s.totalPL.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                    {plBySymbol.length === 0 && (
                      <tr><td colSpan={4} className="py-6 text-center text-gray-500">No closed trades yet</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Best / Worst */}
            {(data.bestTrade || data.worstTrade) && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {data.bestTrade && (
                  <div className="bg-green-900/20 border border-green-800/40 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <TrendingUp className="w-4 h-4 text-green-400" />
                      <span className="text-xs text-green-400 font-medium">Best Trade</span>
                    </div>
                    <p className="text-lg font-bold text-green-300">+${Number(data.bestTrade.profitLoss).toFixed(2)}</p>
                    <p className="text-xs text-gray-400">{data.bestTrade.symbol} {data.bestTrade.type} · {data.bestTrade.closedAt ? new Date(data.bestTrade.closedAt).toLocaleDateString() : ""}</p>
                  </div>
                )}
                {data.worstTrade && (
                  <div className="bg-red-900/20 border border-red-800/40 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <TrendingDown className="w-4 h-4 text-red-400" />
                      <span className="text-xs text-red-400 font-medium">Worst Trade</span>
                    </div>
                    <p className="text-lg font-bold text-red-300">${Number(data.worstTrade.profitLoss).toFixed(2)}</p>
                    <p className="text-xs text-gray-400">{data.worstTrade.symbol} {data.worstTrade.type} · {data.worstTrade.closedAt ? new Date(data.worstTrade.closedAt).toLocaleDateString() : ""}</p>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
