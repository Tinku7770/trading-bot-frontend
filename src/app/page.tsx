"use client";

import { useState } from "react";
import PortfolioOverview from "@/components/PortfolioOverview";
import WalletInput from "@/components/WalletInput";
import AIInsights from "@/components/AIInsights";
import TokenList from "@/components/TokenList";

export default function Home() {
  const [walletAddress, setWalletAddress] = useState("");
  const [portfolioData, setPortfolioData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const fetchPortfolio = async (address: string) => {
    setLoading(true);
    setError("");
    setPortfolioData(null);

    try {
      const res = await fetch(`/api/portfolio?address=${address}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to fetch portfolio");
      setPortfolioData(data);
      setWalletAddress(address);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <div className="border-b border-gray-800 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white">Crypto AI Dashboard</h1>
            <p className="text-xs text-gray-400">Portfolio tracker with AI insights</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
            <span className="text-xs text-gray-400">Live</span>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8 space-y-8">
        {/* Wallet Input */}
        <WalletInput onSubmit={fetchPortfolio} loading={loading} />

        {/* Error */}
        {error && (
          <div className="bg-red-900/30 border border-red-700 rounded-xl p-4 text-red-300 text-sm">
            {error}
          </div>
        )}

        {/* AI Chat — always visible */}
        <AIInsights portfolioData={portfolioData} walletAddress={walletAddress} />

        {/* Portfolio Data */}
        {portfolioData && (
          <>
            <PortfolioOverview data={portfolioData} />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <TokenList tokens={portfolioData.tokens} />
            </div>
          </>
        )}

        {/* Empty state */}
        {!portfolioData && !loading && !error && (
          <div className="text-center py-24 text-gray-500">
            <div className="text-5xl mb-4">📊</div>
            <p className="text-lg font-medium text-gray-400">Enter a wallet address to get started</p>
            <p className="text-sm mt-2">Supports Ethereum, BSC, Polygon, Arbitrum, and more</p>
          </div>
        )}
      </div>
    </main>
  );
}
