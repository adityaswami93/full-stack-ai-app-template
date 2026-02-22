"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import axios from "axios";
import Navbar from "@/app/components/Navbar";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

const TYPE_OPTIONS = [
  { value: "stock", label: "US Stock" },
  { value: "sgx", label: "SGX Stock" },
  { value: "crypto", label: "Crypto" },
  { value: "topic", label: "Topic" },
];

const SUGGESTIONS = {
  stock: ["AAPL", "TSLA", "NVDA", "MSFT", "GOOGL"],
  sgx: ["DBS", "OCBC", "UOB", "Singtel", "CapitaLand"],
  crypto: ["BTC", "ETH", "SOL"],
  topic: ["inflation", "Federal Reserve", "MAS policy", "oil prices", "China economy"],
};

export default function Watchlist() {
  const [user, setUser] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [symbol, setSymbol] = useState("");
  const [type, setType] = useState("stock");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) router.push("/login");
      else {
        setUser(session.user);
        fetchWatchlist(session.user.id);
      }
    });
  }, []);

  const fetchWatchlist = async (userId: string) => {
    const res = await axios.get(`${API_URL}/watchlist/${userId}`);
    setItems(res.data);
  };

  const addItem = async () => {
    if (!symbol.trim() || !user) return;
    setLoading(true);
    setError("");
    try {
      await axios.post(`${API_URL}/watchlist`, {
        user_id: user.id,
        symbol: symbol.toUpperCase(),
        type,
        label: symbol,
      });
      setSymbol("");
      await fetchWatchlist(user.id);
    } catch (e) {
      if (axios.isAxiosError(e) && e.response?.status === 409) {
        setError(`${symbol.toUpperCase()} is already in your watchlist`);
      } else {
        setError("Something went wrong. Please try again.");
      }
    }
    setLoading(false);
  };

  const removeItem = async (id: string) => {
    await axios.delete(`${API_URL}/watchlist/${id}`);
    setItems(items.filter((i) => i.id !== id));
  };

  const typeColor: Record<string, string> = {
    stock: "text-blue-400 border-blue-400/20 bg-blue-400/5",
    sgx: "text-purple-400 border-purple-400/20 bg-purple-400/5",
    crypto: "text-orange-400 border-orange-400/20 bg-orange-400/5",
    topic: "text-emerald-400 border-emerald-400/20 bg-emerald-400/5",
  };

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white dot-grid">
      <Navbar user={user} />

      <div className="max-w-2xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-semibold tracking-tight mb-2">Watchlist</h1>
        <p className="text-white/40 mb-10">
          Track stocks, crypto, and topics for your weekly digest.
        </p>

        {/* Add item */}
        <div className="bg-white/5 border border-white/10 rounded-xl p-5 mb-8">
          <p className="text-sm text-white/40 mb-3">Add to watchlist</p>
          <div className="flex gap-2 mb-3">
            {TYPE_OPTIONS.map((t) => (
              <button
                key={t.value}
                onClick={() => { setType(t.value); setSymbol(""); }}
                className={`text-xs px-3 py-1.5 rounded-lg border transition ${
                  type === t.value
                    ? "border-emerald-400/50 bg-emerald-400/10 text-emerald-400"
                    : "border-white/10 text-white/40 hover:text-white"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Suggestions */}
          <div className="flex flex-wrap gap-1.5 mb-3">
            {SUGGESTIONS[type as keyof typeof SUGGESTIONS].map((s) => (
              <button
                key={s}
                onClick={() => setSymbol(s)}
                className="text-xs text-white/30 hover:text-white/60 border border-white/10 hover:border-white/20 px-2 py-1 rounded transition"
              >
                {s}
              </button>
            ))}
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addItem()}
              placeholder={type === "topic" ? "e.g. inflation" : "e.g. AAPL"}
              className="flex-1 bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder:text-white/20 focus:outline-none focus:border-emerald-400/50 transition text-sm"
            />
            <button
              onClick={addItem}
              disabled={loading || !symbol.trim()}
              className="bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-black text-sm font-semibold px-4 py-2.5 rounded-lg transition"
            >
              Add
            </button>
          </div>
          {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
        </div>

        {/* Watchlist items */}
        {items.length === 0 ? (
          <p className="text-white/20 text-sm text-center py-8">
            Your watchlist is empty — add something above.
          </p>
        ) : (
          <div className="space-y-2">
            {items.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between border border-white/10 rounded-lg px-4 py-3 hover:border-white/20 transition"
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`text-xs px-2 py-0.5 rounded border ${typeColor[item.type]}`}
                  >
                    {item.type}
                  </span>
                  <span className="font-medium text-sm">{item.symbol}</span>
                </div>
                <button
                  onClick={() => removeItem(item.id)}
                  className="text-white/20 hover:text-red-400 transition text-lg leading-none"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}