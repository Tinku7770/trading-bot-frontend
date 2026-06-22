"use client";

import { TrendingUp, TrendingDown, Wallet, BarChart2 } from "lucide-react";

interface PortfolioOverviewProps {
  data: any;
}

export default function PortfolioOverview({ data }: PortfolioOverviewProps) {
  const totalValue = data.totalUsd || 0;
  const change24h = data.change24h || 0;
  const isPositive = change24h >= 0;
  const chainCount = data.chains?.length || 0;
  const tokenCount = data.tokens?.length || 0;

  const stats = [
    {
      label: "Total Value",
      value: `$${totalValue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      icon: Wallet,
      color: "text-blue-400",
      bg: "bg-blue-400/10",
    },
    {
      label: "24h Change",
      value: `${isPositive ? "+" : ""}${change24h.toFixed(2)}%`,
      icon: isPositive ? TrendingUp : TrendingDown,
      color: isPositive ? "text-green-400" : "text-red-400",
      bg: isPositive ? "bg-green-400/10" : "bg-red-400/10",
    },
    {
      label: "Chains",
      value: chainCount.toString(),
      icon: BarChart2,
      color: "text-purple-400",
      bg: "bg-purple-400/10",
    },
    {
      label: "Tokens",
      value: tokenCount.toString(),
      icon: BarChart2,
      color: "text-orange-400",
      bg: "bg-orange-400/10",
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat) => (
        <div key={stat.label} className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-gray-400">{stat.label}</span>
            <div className={`${stat.bg} p-2 rounded-lg`}>
              <stat.icon className={`w-4 h-4 ${stat.color}`} />
            </div>
          </div>
          <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
        </div>
      ))}
    </div>
  );
}
