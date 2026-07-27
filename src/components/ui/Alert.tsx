import { AlertTriangle, CheckCircle, X, LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

type AlertVariant = "error" | "success";

interface AlertProps {
  variant: AlertVariant;
  children: ReactNode;
  onDismiss?: () => void;
  icon?: ReactNode | boolean;
}

const variantStyles: Record<AlertVariant, { bg: string; border: string; text: string; defaultIcon: LucideIcon }> = {
  error: {
    bg: "bg-[#2a1414]/40",
    border: "border-[#6e2424]/40",
    text: "text-[#d05050]",
    defaultIcon: AlertTriangle,
  },
  success: {
    bg: "bg-[#122a1b]/40",
    border: "border-[#2d6e44]/40",
    text: "text-[#5ab87c]",
    defaultIcon: CheckCircle,
  },
};

export function Alert({ variant, children, onDismiss, icon }: AlertProps) {
  const styles = variantStyles[variant];
  const DefaultIcon = styles.defaultIcon;

  return (
    <div className={`${styles.bg} border ${styles.border} rounded-lg p-3 text-sm ${styles.text} flex items-center justify-between`}>
      <div className="flex items-center gap-2">
        {icon === false ? null : icon && icon !== true ? icon : <DefaultIcon size={14} className="shrink-0" />}
        <span>{children}</span>
      </div>
      {onDismiss && (
        <button onClick={onDismiss} className="shrink-0 ml-2 opacity-60 hover:opacity-100 transition-opacity">
          <X size={14} />
        </button>
      )}
    </div>
  );
}
