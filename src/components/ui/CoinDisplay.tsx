import { Coins } from "lucide-react";

interface CoinDisplayProps {
  amount: number;
  size?: "sm" | "md";
}

export function CoinDisplay({ amount, size = "md" }: CoinDisplayProps) {
  return (
    <div className={`flex items-center gap-2 text-slate-100 bg-slate-900/60 px-4 py-2 rounded-lg border border-slate-800/30 ${size === "sm" ? "text-sm" : ""}`}>
      <Coins size={size === "sm" ? 14 : 16} className="text-slate-400" />
      <span className="font-bold tabular-nums">{amount.toLocaleString()}</span>
      <span className="text-slate-500 text-sm">gold</span>
    </div>
  );
}
