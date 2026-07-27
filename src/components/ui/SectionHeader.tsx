interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}

export function SectionHeader({ title, subtitle, right }: SectionHeaderProps) {
  return (
    <div className="flex items-end justify-between gap-4 pb-3 border-b border-[rgba(54,41,28,0.2)]">
      <div>
        <h1
          className="text-2xl font-bold text-[#e6ddd2] tracking-wide"
          style={{ fontFamily: "Crimson Pro, Georgia, serif" }}
        >
          {title}
        </h1>
        {subtitle && <p className="text-[#7d6240] text-sm mt-0.5 italic">{subtitle}</p>}
      </div>
      {right && <div>{right}</div>}
    </div>
  );
}
