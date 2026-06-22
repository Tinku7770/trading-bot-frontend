import { NextRequest, NextResponse } from "next/server";
import axios from "axios";

export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get("address");

  if (!address) {
    return NextResponse.json({ error: "Wallet address required" }, { status: 400 });
  }

  const addr = address.toLowerCase().trim();

  try {
    // Ethplorer: free API, returns ETH + all ERC20 tokens with USD values in one call
    const response = await axios.get(
      `https://api.ethplorer.io/getAddressInfo/${addr}?apiKey=freekey`,
      { timeout: 15000 }
    );

    const data = response.data;
    if (data.error) {
      return NextResponse.json({ error: data.error.message || "Invalid address" }, { status: 400 });
    }

    const tokens: any[] = [];

    // ETH balance
    const ethBalance = data.ETH?.balance || 0;
    const ethPrice = data.ETH?.price?.rate || 0;
    const ethChange = data.ETH?.price?.diff || 0;

    if (ethBalance > 0.000001) {
      tokens.push({
        symbol: "ETH",
        name: "Ethereum",
        chain: "eth",
        price: ethPrice,
        amount: ethBalance,
        usdValue: ethBalance * ethPrice,
        change24h: ethChange,
        logoUrl: null,
      });
    }

    // ERC20 tokens
    const rawTokens = data.tokens || [];
    for (const t of rawTokens) {
      const info = t.tokenInfo;
      if (!info) continue;
      const decimals = parseInt(info.decimals) || 18;
      const amount = parseFloat(t.rawBalance || "0") / Math.pow(10, decimals);
      if (amount <= 0.000001) continue;

      const price = info.price?.rate || 0;
      const change24h = info.price?.diff || 0;

      tokens.push({
        symbol: info.symbol || "?",
        name: info.name || info.symbol || "Unknown",
        chain: "eth",
        price,
        amount,
        usdValue: amount * price,
        change24h,
        logoUrl: info.image ? `https://ethplorer.io${info.image}` : null,
      });
    }

    tokens.sort((a, b) => b.usdValue - a.usdValue);

    const totalUsd = tokens.reduce((sum, t) => sum + t.usdValue, 0);
    const change24h =
      totalUsd > 0
        ? tokens.reduce((sum, t) => sum + (t.change24h * t.usdValue) / totalUsd, 0)
        : 0;

    const chains = [...new Set(tokens.map((t) => t.chain))];

    return NextResponse.json({
      address,
      totalUsd,
      change24h,
      tokens,
      chains,
      fetchedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error("Portfolio fetch error:", err.message);
    return NextResponse.json(
      { error: `Failed to fetch portfolio: ${err.message}` },
      { status: 500 }
    );
  }
}
