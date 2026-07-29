interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}

export function SectionHeader({ title, subtitle, right }: SectionHeaderProps) {
  return (
    <div className="flex items-end justify-between gap-4 pb-3 border-b border-[rgba(100,116,139,0.1)]">
      <div>
        <div className="flex items-center gap-3">
          <h1
            className="text-2xl font-bold text-slate-100 tracking-wide"
            style={{ fontFamily: "Crimson Pro, Georgia, serif" }}
          >
            {title}
          </h1>
          <div className="accent-bar" />
        </div>
        {subtitle && (
          <p className="text-[#7d6240] text-sm mt-1 italic tracking-wide">
            {subtitle}
          </p>
        )}
      </div>
      {right && <div className="shrink-0">{right}</div>}
    </div>
  );
}
