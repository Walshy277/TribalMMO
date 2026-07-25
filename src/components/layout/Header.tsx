"use client";

import { useAuth } from "@/lib/auth";

export function Header() {
  const { user, signOut } = useAuth();

  return (
    <header className="bg-tribal-900/90 backdrop-blur-sm border-b border-tribal-700/50 px-4 py-3 sticky top-0 z-50">
      <div className="flex items-center justify-between">
        <a href="/" className="flex items-center gap-2 group">
          <span className="text-2xl group-hover:scale-110 transition-transform">🏕️</span>
          <span className="text-xl font-bold text-tribal-100">TribalMMO</span>
        </a>
        <nav className="flex items-center gap-4">
          {user ? (
            <button onClick={signOut} className="btn-secondary text-sm py-1.5">
              Logout
            </button>
          ) : (
            <a href="/auth/login" className="btn-primary text-sm py-1.5">
              Login
            </a>
          )}
        </nav>
      </div>
    </header>
  );
}
