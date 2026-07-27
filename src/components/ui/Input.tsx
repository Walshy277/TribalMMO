import { InputHTMLAttributes, forwardRef } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, hint, className = "", ...props }, ref) => {
    return (
      <div>
        {label && (
          <label className="block text-[11px] font-bold text-[#9a7d56] mb-1.5 uppercase tracking-[0.12em]" style={{ fontFamily: "Crimson Pro, Georgia, serif" }}>{label}</label>
        )}
        <input ref={ref} className={`input ${className}`} {...props} />
        {hint && (
          <p className="text-[#4d3a27] text-xs mt-1">{hint}</p>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";
