interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export function Input({ label, ...props }: InputProps) {
  return (
    <div className="space-y-1">
      {label && (
        <label className="block text-sm text-tribal-300">{label}</label>
      )}
      <input className="input w-full" {...props} />
    </div>
  );
}
