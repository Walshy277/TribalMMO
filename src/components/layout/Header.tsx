"use client";

import { useAuth } from "@/lib/auth";
import { useGame } from "@/lib/game";

export function Header() {
  const { user, signOut } = useAuth();
  const { character } = useGame();

  return (
    <header className="bg-tribal-900 border-b border-tribal-700 px-4 py-3">
      <div className="flex items-center justify-between">
        <a href="/" className="text-xl font-bold text-tribal-100">
          TribalMMO
        </a>
        <nav className="flex items-center gap-4">
          {user ? (
            <>
              {character && (
                <span className="text-tribal-300 text-sm hidden sm:inline">
                  {character.name}
                </span>
              )}
              <button onClick={signOut} className="btn-secondary text-sm">
                Logout
              </button>
            </>
          ) : (
            <a href="/auth/login" className="btn-primary text-sm">
              Login
            </a>
          )}
        </nav>
      </div>
    </header>
  );
}
