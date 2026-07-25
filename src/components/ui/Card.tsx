interface CardProps {
  title?: string;
  children: React.ReactNode;
}

export function Card({ title, children }: CardProps) {
  return (
    <div className="card">
      {title && (
        <h2 className="text-lg font-semibold text-tribal-200 mb-4">{title}</h2>
      )}
      {children}
    </div>
  );
}
