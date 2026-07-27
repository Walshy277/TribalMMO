import { ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  title?: string;
  className?: string;
}

export function Card({ children, title, className = "" }: CardProps) {
  return (
    <div className={`card ${className}`}>
      {title && (
        <h2 className="text-[11px] font-bold text-[#9a7d56] uppercase tracking-[0.15em] mb-4" style={{ fontFamily: "Crimson Pro, Georgia, serif" }}>{title}</h2>
      )}
      {children}
    </div>
  );
}
