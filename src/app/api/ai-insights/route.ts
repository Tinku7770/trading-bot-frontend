import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function POST(req: NextRequest) {
  try {
    const { question, portfolioData, walletAddress } = await req.json();

    if (!question) {
      return NextResponse.json({ error: "Missing question" }, { status: 400 });
    }

    // Build portfolio summary only if wallet data is available
    let portfolioSummary = "No wallet connected — answer as a general crypto trading advisor.";
    if (portfolioData && portfolioData.tokens?.length > 0) {
      const topTokens = portfolioData.tokens
        .slice(0, 10)
        .map((t: any) =>
          `- ${t.symbol} (${t.chain}): $${t.usdValue.toFixed(2)} | 24h: ${t.change24h >= 0 ? "+" : ""}${t.change24h.toFixed(2)}%`
        )
        .join("\n");

      portfolioSummary = `
Wallet: ${walletAddress}
Total Value: $${portfolioData.totalUsd.toFixed(2)}
24h Change: ${portfolioData.change24h >= 0 ? "+" : ""}${portfolioData.change24h.toFixed(2)}%
Chains: ${portfolioData.chains.join(", ")}
Number of tokens: ${portfolioData.tokens.length}

Top holdings:
${topTokens}
      `.trim();
    }

    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 800,
      system: `You are an expert crypto day trader and swing trader advisor. The user is an active trader — NOT a long-term investor. They never hold more than 1-2 days max.

When asked which coin to trade or what trade to make, always structure your response exactly like this:

**Coin:** [coin name & ticker — can be ANY major crypto, not limited to their portfolio]
**Direction:** LONG or SHORT
**Timeframe:** Day Trade (1-4 hours) or Swing Trade (1-2 days)
**Entry Zone:** [price range or "current market price"]
**Target:** [price target or % gain]
**Stop Loss:** [price or % below entry]
**Reasoning:** [2-3 sentences — momentum, trend, volatility, catalyst]
**Risk Level:** Low / Medium / High

Rules you must follow:
- Only recommend LONG or SHORT — never "hold", "buy and wait weeks", or long-term advice
- Timeframe is always 1-4 hours (day trade) or 1-2 days (swing trade) — never weeks or months
- You can recommend ANY widely traded coin (BTC, ETH, SOL, BNB, DOGE, etc.) not just what is in their portfolio
- Be direct and specific — give one clear trade call
- End with: ⚠️ AI analysis only — not financial advice. Always use your own risk management.`,
      messages: [
        {
          role: "user",
          content: `Portfolio data:
${portfolioSummary}

Question: ${question}`,
        },
      ],
    });

    const insight = message.content[0].type === "text" ? message.content[0].text : "No response";

    return NextResponse.json({ insight });
  } catch (err: any) {
    console.error("AI insights error:", err.message, err.status, err.error);
    return NextResponse.json({ error: `AI request failed: ${err.message}` }, { status: 500 });
  }
}
