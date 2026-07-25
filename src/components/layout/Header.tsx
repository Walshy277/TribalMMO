"use client";

import { useAuth } from "@/lib/auth";

export function Header() {
  const { user, signOut } = useAuth();

  return (
    <header className="bg-tribal-950 border-b border-tribal-800/60 px-4 py-3 flex items-center justify-between shrink-0">
      <a href="/" className="flex items-center gap-2.5 group">
        <span className="text-2xl">🏕️</span>
        <span className="text-lg font-bold text-tribal-100 tracking-tight">TribalMMO</span>
      </a>
      <nav className="flex items-center gap-3">
        {user && (
          <button onClick={signOut} className="btn-secondary text-sm py-1.5 px-4">
            Logout
          </button>
        )}
      </nav>
    </header>
  );
}
