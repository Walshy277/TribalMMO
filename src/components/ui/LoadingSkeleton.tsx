interface LoadingSkeletonProps {
  className?: string;
}

export function LoadingSkeleton({ className = "" }: LoadingSkeletonProps) {
  return (
    <div className={`min-h-[60vh] flex flex-col items-center justify-center gap-4 ${className}`}>
      <div className="flex gap-2">
        <div className="w-1.5 h-4 bg-slate-400 animate-bounce [animation-delay:-0.3s]" />
        <div className="w-1.5 h-4 bg-[#a8441c] animate-bounce [animation-delay:-0.15s]" />
        <div className="w-1.5 h-4 bg-[#8c3818] animate-bounce" />
      </div>
      <span className="text-slate-400 text-xs uppercase tracking-widest font-medium">
        Loading...
      </span>
    </div>
  );
}
