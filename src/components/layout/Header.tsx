"use client";

import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/Button";
import { LogOut, Flame } from "lucide-react";

export function Header() {
  const { user, signOut } = useAuth();

  return (
    <header className="bg-tribal-950 border-b border-tribal-800/60 px-4 py-3 flex items-center justify-between shrink-0">
      <a href="/" className="flex items-center gap-2.5 group">
        <Flame size={24} className="text-tribal-400 group-hover:text-tribal-300 transition-colors" />
        <span className="text-lg font-bold text-tribal-100 tracking-tight">TribalMMO</span>
      </a>
      <nav className="flex items-center gap-3">
        {user && (
          <Button variant="ghost" size="sm" icon={<LogOut size={16} />} onClick={signOut}>
            Logout
          </Button>
        )}
      </nav>
    </header>
  );
}
