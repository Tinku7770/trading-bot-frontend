"use client";

import { useState } from "react";
import { Sparkles, Loader2, ChevronDown, ChevronUp } from "lucide-react";

interface AIInsightsProps {
  portfolioData: any;
  walletAddress: string;
}

const QUESTIONS = [
  "Which coin should I long or short right now for a day trade?",
  "Give me a swing trade setup for today (1-2 days hold max)",
  "Which coin has the best momentum for a short trade right now?",
  "What is the best long trade I can take in the next few hours?",
  "Give me a high probability trade setup for today",
];

export default function AIInsights({ portfolioData, walletAddress }: AIInsightsProps) {
  const [insight, setInsight] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeQuestion, setActiveQuestion] = useState("");
  const [customQuestion, setCustomQuestion] = useState("");
  const [showCustom, setShowCustom] = useState(false);

  const askAI = async (question: string) => {
    setLoading(true);
    setActiveQuestion(question);
    setInsight("");

    try {
      const res = await fetch("/api/ai-insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, portfolioData, walletAddress }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "AI request failed");
      setInsight(data.insight);
    } catch (err: any) {
      setInsight(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customQuestion.trim()) return;
    askAI(customQuestion.trim());
    setCustomQuestion("");
    setShowCustom(false);
  };

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-yellow-400" />
        <h2 className="text-sm font-semibold text-gray-300">AI Insights</h2>
      </div>

      {/* Quick questions */}
      <div className="flex flex-wrap gap-2">
        {QUESTIONS.map((q) => (
          <button
            key={q}
            onClick={() => askAI(q)}
            disabled={loading}
            className="text-xs bg-gray-800 hover:bg-gray-700 disabled:opacity-50 border border-gray-700 rounded-full px-3 py-1.5 text-gray-300 transition-colors"
          >
            {q}
          </button>
        ))}
        <button
          onClick={() => setShowCustom(!showCustom)}
          className="text-xs bg-blue-900/40 hover:bg-blue-900/60 border border-blue-700 rounded-full px-3 py-1.5 text-blue-300 transition-colors flex items-center gap-1"
        >
          Ask anything
          {showCustom ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>
      </div>

      {/* Custom question input */}
      {showCustom && (
        <form onSubmit={handleCustomSubmit} className="flex gap-2">
          <input
            type="text"
            value={customQuestion}
            onChange={(e) => setCustomQuestion(e.target.value)}
            placeholder="Ask anything about your portfolio..."
            className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
          />
          <button
            type="submit"
            disabled={!customQuestion.trim() || loading}
            className="bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors"
          >
            Ask
          </button>
        </form>
      )}

      {/* Response */}
      <div className="min-h-[120px] bg-gray-800/50 rounded-xl p-4">
        {loading && (
          <div className="flex items-center gap-2 text-gray-400 text-sm">
            <Loader2 className="w-4 h-4 animate-spin" />
            Analyzing your portfolio...
          </div>
        )}
        {!loading && !insight && (
          <p className="text-gray-500 text-sm">Click a question above to get AI insights about your portfolio.</p>
        )}
        {!loading && insight && (
          <div>
            <p className="text-xs text-yellow-400 font-medium mb-2">{activeQuestion}</p>
            <div className="text-sm text-gray-200 leading-relaxed whitespace-pre-wrap">
              {insight.split(/(\*\*[^*]+\*\*)/).map((part, i) =>
                part.startsWith("**") && part.endsWith("**") ? (
                  <span key={i} className="font-semibold text-white">{part.slice(2, -2)}</span>
                ) : (
                  <span key={i}>{part}</span>
                )
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
