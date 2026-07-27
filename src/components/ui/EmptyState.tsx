import type { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon: LucideIcon;
  message: string;
  hint?: string;
}

export function EmptyState({ icon: Icon, message, hint }: EmptyStateProps) {
  return (
    <div className="text-center py-8">
      <Icon size={32} className="text-tribal-800 mx-auto mb-2" />
      <p className="text-tribal-600">{message}</p>
      {hint && <p className="text-tribal-700 text-sm mt-1">{hint}</p>}
    </div>
  );
}
