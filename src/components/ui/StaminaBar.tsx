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

function getStaminaGlow(percent: number): string {
  if (percent > 60) return "shadow-[0_0_8px_rgba(74,158,106,0.3)]";
  if (percent > 30) return "shadow-[0_0_8px_rgba(184,146,58,0.3)]";
  return "shadow-[0_0_8px_rgba(140,46,46,0.3)]";
}

export function StaminaBar({ current, max, showLabel = true, size = "sm" }: StaminaBarProps) {
  const percent = max > 0 ? (current / max) * 100 : 0;
  const h = size === "sm" ? "h-1.5" : "h-2.5";

  return (
    <div>
      {showLabel && (
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[#7d6240] text-[10px] font-bold uppercase tracking-[0.15em]" style={{ fontFamily: "Crimson Pro, Georgia, serif" }}>Stamina</span>
          <span className="text-[#cfc1ae] text-xs font-bold tabular-nums">{current} / {max}</span>
        </div>
      )}
      <div className={`w-full bg-[rgba(26,24,30,0.8)] ${h} overflow-hidden rounded-full border border-[rgba(59,130,246,0.15)]`}>
        <div
          className={`${getStaminaColor(percent)} ${getStaminaGlow(percent)} ${h} transition-all duration-700 ease-out rounded-full`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
