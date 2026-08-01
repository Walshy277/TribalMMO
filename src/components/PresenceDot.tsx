export function PresenceDot({
  online,
  className = "",
}: {
  online: boolean;
  className?: string;
}) {
  return (
    <span
      className={`inline-block w-1.5 h-1.5 rounded-full shrink-0 ${
        online ? "bg-emerald-400" : "bg-stone-600"
      } ${className}`}
      title={online ? "Online" : "Offline"}
      aria-label={online ? "Online" : "Offline"}
    />
  );
}
