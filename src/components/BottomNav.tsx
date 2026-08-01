import { useLocation, useNavigate } from "react-router-dom";
import { useGame } from "../hooks/useGame";
import { PRIMARY_NAV, navItemIsActive } from "../data/gameData";

export function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { profile } = useGame();
  const items = PRIMARY_NAV.filter((n) => !n.adminOnly || profile?.is_admin);
  const primary = items.filter((n) => !n.adminOnly);
  const admin = items.find((n) => n.adminOnly);

  return (
    <nav
      className="md:hidden bg-stone-900 border-t border-stone-800 safe-pb"
      aria-label="Main"
    >
      <div className="max-w-lg mx-auto flex">
        {primary.map((tab) => {
          const active = navItemIsActive(location.pathname, tab);
          return (
            <button
              key={tab.path}
              type="button"
              onClick={() => navigate(tab.path)}
              aria-current={active ? "page" : undefined}
              className={`flex-1 flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-colors cursor-pointer min-w-0 ${
                active ? "text-amber-400" : "text-stone-600 hover:text-stone-400"
              }`}
            >
              <span className="text-base" aria-hidden="true">
                {tab.icon}
              </span>
              <span className="truncate w-full text-center">{tab.label}</span>
            </button>
          );
        })}
        {admin ? (
          <button
            type="button"
            onClick={() => navigate(admin.path)}
            aria-current={navItemIsActive(location.pathname, admin) ? "page" : undefined}
            aria-label={admin.label}
            className={`flex flex-col items-center gap-0.5 py-2 px-2 text-[10px] font-medium transition-colors cursor-pointer ${
              navItemIsActive(location.pathname, admin)
                ? "text-amber-400"
                : "text-stone-600 hover:text-stone-400"
            }`}
          >
            <span className="text-base" aria-hidden="true">
              {admin.icon}
            </span>
            <span className="sr-only">{admin.label}</span>
          </button>
        ) : null}
      </div>
    </nav>
  );
}
