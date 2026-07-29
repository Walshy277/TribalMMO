import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { useGame } from "@/lib/game";
import { Button } from "@/components/ui/Button";
import { LogOut, Flame, Coins, Bell, Trophy, Gem } from "lucide-react";
import { supabase } from "@/lib/supabase/client";

export function Header() {
  const { user, signOut } = useAuth();
  const { character, refreshCharacter } = useGame();
  const navigate = useNavigate();
  const [showNotifs, setShowNotifs] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  const unreadCount = (character?.notifications || []).filter((n) => !n.read).length;

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotifs(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const markRead = async (notifId: string, link?: string) => {
    await supabase.from("notifications").update({ read: true }).eq("id", notifId);
    if (link) navigate(link);
    await refreshCharacter();
    setShowNotifs(false);
  };

  const markAllRead = async () => {
    if (!character) return;
    await supabase.from("notifications").update({ read: true }).eq("character_id", character.id).eq("read", false);
    await refreshCharacter();
  };

  return (
    <header className="bg-[rgba(12,18,34,0.95)] border-b border-[rgba(59,130,246,0.08)] h-12 flex items-center justify-between shrink-0 sticky top-0 z-50 backdrop-blur-md px-4 md:px-5 shadow-[0_1px_0_rgba(255,255,255,0.02)_inset]">
      <Link to="/profile" className="flex items-center gap-2.5 group">
        <div className="w-7 h-7 bg-gradient-to-br from-slate-300 to-slate-400 flex items-center justify-center rounded-[5px] shadow-[0_0_12px_rgba(59,130,246,0.15)] group-hover:shadow-[0_0_16px_rgba(59,130,246,0.25)] transition-shadow duration-300">
          <Flame size={15} className="text-[#0c1222]" />
        </div>
        <span className="text-sm font-bold text-slate-200 tracking-wide font-heading">
          Tribal<span className="text-slate-500">MMO</span>
        </span>
      </Link>

      <div className="flex items-center gap-1.5">
        {(character?.achievements || []).length > 0 && (
          <Link to="/profile" className="flex items-center gap-1 text-slate-500 hover:text-slate-300 transition-colors px-1.5 py-1">
            <Trophy size={13} />
          </Link>
        )}
        {character && character.clan && (
          <Link to="/clans" className="flex items-center gap-1 text-slate-500 hover:text-slate-300 text-[11px] font-medium transition-colors px-1.5 py-1 rounded hover:bg-[rgba(59,130,246,0.04)]">
            <span className="text-slate-600 text-xs hidden sm:inline truncate max-w-[100px]">{character.clan.clan.name}</span>
          </Link>
        )}
        {user && character && (
          <>
            <div className="flex items-center gap-1.5 bg-[rgba(15,23,42,0.6)] border border-[rgba(100,116,139,0.12)] rounded-md px-2 py-1">
              <Coins size={12} className="text-amber-400" />
              <span className="text-xs font-bold tabular-nums text-slate-200">{character.gold}</span>
            </div>
            {character.treasure_coins > 0 && (
              <div className="flex items-center gap-1 text-[#818cf8] bg-[rgba(15,23,42,0.6)] border border-[rgba(129,140,248,0.12)] rounded-md px-2 py-1">
                <Gem size={11} />
                <span className="text-xs font-bold tabular-nums text-[#a5b4fc]">{character.treasure_coins}</span>
              </div>
            )}
          </>
        )}
        {user && (
          <div className="relative" ref={notifRef}>
            <button
              onClick={() => setShowNotifs(!showNotifs)}
              className="relative p-1.5 text-slate-500 hover:text-slate-300 transition-colors"
              aria-label="Notifications"
            >
              <Bell size={14} />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-blue-400 text-[#0c1222] text-[8px] font-bold rounded-full flex items-center justify-center shadow-[0_0_6px_rgba(59,130,246,0.4)]">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </button>

            {showNotifs && (
              <div className="absolute right-0 top-full mt-2 w-80 bg-[#162032] border border-[rgba(59,130,246,0.12)] rounded-lg shadow-xl shadow-black/50 animate-fade-in max-h-96 overflow-y-auto">
                <div className="flex items-center justify-between px-4 py-3 border-b border-[rgba(100,116,139,0.08)]">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.15em]">Notifications</span>
                  {unreadCount > 0 && (
                    <button onClick={markAllRead} className="text-slate-600 hover:text-slate-300 text-[10px] uppercase tracking-wider font-bold transition-colors">
                      Mark all read
                    </button>
                  )}
                </div>
                {(!character?.notifications || character.notifications.length === 0) ? (
                  <div className="px-4 py-8 text-center">
                    <Bell size={18} className="mx-auto text-slate-700 mb-2" />
                    <p className="text-slate-500 text-xs">No notifications yet.</p>
                    <p className="text-slate-700 text-[10px] mt-1">Activity from your settlement and the world will appear here.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-[rgba(100,116,139,0.06)]">
                    {(character.notifications || []).slice(0, 15).map((n) => (
                      <button
                        key={n.id}
                        onClick={() => markRead(n.id, n.link || undefined)}
                        className={`w-full text-left px-4 py-3 hover:bg-[rgba(59,130,246,0.03)] transition-colors flex items-start gap-2.5 ${
                          !n.read ? "bg-[rgba(59,130,246,0.04)]" : ""
                        }`}
                      >
                        <div className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${!n.read ? "bg-blue-400 shadow-[0_0_6px_rgba(59,130,246,0.4)]" : "bg-transparent"}`} />
                        <div className="flex-1 min-w-0">
                          <div className="text-slate-200 text-xs font-semibold">{n.title}</div>
                          {n.description && <div className="text-slate-500 text-[10px] mt-0.5 line-clamp-2">{n.description}</div>}
                          <div className="text-slate-700 text-[8px] mt-0.5 font-medium uppercase tracking-wider">
                            {new Date(n.created_at).toLocaleDateString()} {new Date(n.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
        {user && (
          <Button variant="ghost" size="sm" icon={<LogOut size={12} />} onClick={signOut}>
            <span className="hidden sm:inline">Logout</span>
          </Button>
        )}
      </div>
    </header>
  );
}
