import { InputHTMLAttributes, forwardRef, ReactNode } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, hint, className = "", ...props }, ref) => {
    return (
      <div>
        {label && (
          <label className="block text-sm font-semibold text-tribal-300 mb-2">{label}</label>
        )}
        <input ref={ref} className={`input ${className}`} {...props} />
        {hint && (
          <p className="text-tribal-600 text-xs mt-1.5">{hint}</p>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";
