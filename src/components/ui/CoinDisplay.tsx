import { Coins } from "lucide-react";

interface CoinDisplayProps {
  amount: number;
  size?: "sm" | "md";
}

export function CoinDisplay({ amount, size = "md" }: CoinDisplayProps) {
  return (
    <div className={`flex items-center gap-2 text-tribal-100 bg-tribal-900/60 px-4 py-2 rounded-lg border border-tribal-800/30 ${size === "sm" ? "text-sm" : ""}`}>
      <Coins size={size === "sm" ? 14 : 16} className="text-tribal-400" />
      <span className="font-bold tabular-nums">{amount.toLocaleString()}</span>
      <span className="text-tribal-500 text-sm">gold</span>
    </div>
  );
}
