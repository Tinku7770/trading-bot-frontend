"use client";

interface Token {
  symbol: string;
  name: string;
  chain: string;
  price: number;
  amount: number;
  usdValue: number;
  change24h: number;
  logoUrl?: string;
}

interface TokenListProps {
  tokens: Token[];
}

export default function TokenList({ tokens }: TokenListProps) {
  const sorted = [...tokens].sort((a, b) => b.usdValue - a.usdValue).slice(0, 15);

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <h2 className="text-sm font-semibold text-gray-300 mb-4">Token Holdings</h2>
      <div className="space-y-2">
        {sorted.length === 0 && (
          <p className="text-gray-500 text-sm text-center py-8">No tokens found</p>
        )}
        {sorted.map((token, i) => (
          <div
            key={`${token.symbol}-${token.chain}-${i}`}
            className="flex items-center justify-between py-2 border-b border-gray-800 last:border-0"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-xs font-bold text-gray-300">
                {token.symbol.slice(0, 2)}
              </div>
              <div>
                <p className="text-sm font-medium text-white">{token.symbol}</p>
                <p className="text-xs text-gray-500">{token.chain}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm font-medium text-white">
                ${token.usdValue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              <p className={`text-xs ${token.change24h >= 0 ? "text-green-400" : "text-red-400"}`}>
                {token.change24h >= 0 ? "+" : ""}{token.change24h.toFixed(2)}%
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
