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
        <h2 className="text-sm font-semibold text-tribal-400 uppercase tracking-wider mb-4">{title}</h2>
      )}
      {children}
    </div>
  );
}
