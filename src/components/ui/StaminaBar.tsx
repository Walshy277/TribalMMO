interface StaminaBarProps {
  current: number;
  max: number;
  showLabel?: boolean;
  size?: "sm" | "md";
}

function getStaminaColor(percent: number): string {
  if (percent > 60) return "bg-[#4a9e6a]";
  if (percent > 30) return "bg-[#b8923a]";
  return "bg-[#8c2e2e]";
}

export function StaminaBar({ current, max, showLabel = true, size = "sm" }: StaminaBarProps) {
  const percent = max > 0 ? (current / max) * 100 : 0;
  const h = size === "sm" ? "h-1.5" : "h-2.5";

  return (
    <div>
      {showLabel && (
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[#6e656c] text-[10px] font-bold uppercase tracking-[0.15em]" style={{ fontFamily: "Crimson Pro, Georgia, serif" }}>Stamina</span>
          <span className="text-[#cfc1ae] text-xs font-bold tabular-nums">{current} / {max}</span>
        </div>
      )}
      <div className={`w-full bg-[#1a181e] ${h} overflow-hidden border border-[#262328]`}>
        <div
          className={`${getStaminaColor(percent)} ${h} transition-all duration-700 ease-out`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
