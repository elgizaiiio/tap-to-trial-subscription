import { TrendingDown, TrendingUp, Wallet } from "lucide-react";

type Asset = { id: string; amount: number; usd: number | null; change24h: number | null };
const NAMES: Record<string, string> = { bitcoin: "Bitcoin", ethereum: "Ethereum", solana: "Solana", binancecoin: "BNB", tether: "USDT", "usd-coin": "USDC", "the-open-network": "TON", tron: "TRON", "tether-tron": "USDT (Tron)", "polygon-ecosystem-token": "Polygon", arbitrum: "Arbitrum", "avalanche-2": "Avalanche" };
const usd = (n: number) => `$${n.toLocaleString(undefined, { maximumFractionDigits: 2, minimumFractionDigits: 2 })}`;

/** Wallet balance in chat: total, 24h gain/loss and each held coin. */
export function WalletBalanceCard({ data, ar }: { data: Record<string, any>; ar: boolean }) {
  const total = Number(data.totalUsd) || 0;
  const change = Number(data.changeUsd24h) || 0;
  const up = change >= 0;
  const pct = total - change ? (change / (total - change)) * 100 : 0;
  const assets: Asset[] = Array.isArray(data.assets) ? data.assets : [];
  return (
    <div className="wcard">
      <div className="wcard-head"><span className="wcard-icon"><Wallet size={16} /></span><span>{ar ? "محفظتك" : "Your wallet"}</span></div>
      <div className="wcard-total">{usd(total)}</div>
      {total > 0 && <div className="wcard-change" data-up={up}>{up ? <TrendingUp size={14} /> : <TrendingDown size={14} />}{up ? "+" : "-"}{usd(Math.abs(change))} ({pct.toFixed(2)}%) <span>{ar ? "آخر ٢٤ ساعة" : "24h"}</span></div>}
      {assets.length ? <div className="wcard-list">{assets.map((a) => (
        <div key={a.id} className="wcard-row">
          <span className="wcard-name">{NAMES[a.id] || a.id}</span>
          <span className="wcard-amt">{a.amount.toLocaleString(undefined, { maximumFractionDigits: 6 })}</span>
          <span className="wcard-usd">{a.usd === null ? "—" : usd(a.usd)}{a.change24h !== null && <small data-up={a.change24h >= 0}>{a.change24h >= 0 ? "+" : ""}{a.change24h.toFixed(1)}%</small>}</span>
        </div>))}</div>
        : <p className="wcard-empty">{ar ? "المحفظة فاضية دلوقتي. اشحنها من صفحة المحفظة." : "Your wallet is empty. Add funds from the Wallet page."}</p>}
    </div>
  );
}
