interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary";
  children: React.ReactNode;
}

export function Button({ variant = "primary", children, ...props }: ButtonProps) {
  const baseClass = variant === "primary" ? "btn-primary" : "btn-secondary";
  return (
    <button className={baseClass} {...props}>
      {children}
    </button>
  );
}
