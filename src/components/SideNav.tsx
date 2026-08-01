import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useGame } from "../hooks/useGame";
import { NAV_CATEGORIES, navItemIsActive } from "../data/gameData";
import { PATHS } from "../lib/paths";

export function SideNav() {
  const { signOut } = useAuth();
  const { profile } = useGame();
  const location = useLocation();

  const categories = NAV_CATEGORIES.map((cat) => ({
    ...cat,
    items: cat.items.filter((n) => !n.adminOnly || profile?.is_admin),
  })).filter((cat) => cat.items.length > 0);

  return (
    <aside className="hidden md:flex md:flex-col w-52 lg:w-56 shrink-0 border-r border-stone-800 bg-stone-900/40">
      <Link to={PATHS.home} className="px-4 py-4 block hover:opacity-80 transition-opacity">
        <div className="text-amber-400 font-bold text-base tracking-tight">⛺ TribalMMO</div>
        <div className="text-[10px] text-stone-600 mt-0.5">A text-based tribal-era MMO</div>
      </Link>

      <nav className="flex-1 px-2 space-y-4 overflow-y-auto">
        {categories.map((cat) => (
          <div key={cat.id}>
            <div className="px-3 mb-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-stone-600">
              {cat.label}
            </div>
            <div className="space-y-0.5">
              {cat.items.map((item) => {
                const active = navItemIsActive(location.pathname, item);
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    aria-current={active ? "page" : undefined}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs transition-colors ${
                      active
                        ? "bg-amber-600/15 text-amber-400"
                        : "text-stone-400 hover:text-stone-200 hover:bg-stone-800/60"
                    }`}
                  >
                    <span className="text-base" aria-hidden="true">
                      {item.icon}
                    </span>
                    <div className="min-w-0">
                      <div className="font-semibold">{item.label}</div>
                      <div className="text-[10px] text-stone-600 truncate">{item.desc}</div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="p-2 border-t border-stone-800">
        <button
          type="button"
          onClick={() => signOut()}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-stone-500 hover:text-red-400 hover:bg-stone-800/60 transition-colors cursor-pointer"
        >
          <span className="text-sm" aria-hidden="true">
            🚪
          </span>{" "}
          Sign out
        </button>
      </div>
    </aside>
  );
}
