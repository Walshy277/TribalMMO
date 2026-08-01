import { Outlet, Navigate, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { useAuth } from "../hooks/useAuth";
import { useGame } from "../hooks/useGame";
import { GameHeader } from "./GameHeader";
import { BottomNav } from "./BottomNav";
import { SideNav } from "./SideNav";
import { HudPanel } from "./HudPanel";
import { Journal } from "./Journal";
import { ActionResult } from "./ActionResult";
import { CharacterSetup } from "../pages/CharacterSetup";
import { GameProvider } from "../context/GameContext";
import { LoadingState } from "./ui/LoadingState";
import {
  PRIMARY_NAV,
  WORK_LINKS,
  VILLAGE_PLACES,
  MARKET_STALLS,
  navItemIsActive,
} from "../data/gameData";
import { PATHS } from "../lib/paths";

function titleForPath(pathname: string): string {
  const work = WORK_LINKS.find((w) => w.path === pathname);
  if (work) return work.label;

  const place = VILLAGE_PLACES.find((p) => p.path === pathname);
  if (place) return place.name;

  const stall = MARKET_STALLS.find((s) => s.path === pathname);
  if (stall) return stall.name;

  if (pathname === PATHS.clans) return "Clans";
  if (pathname === PATHS.villageNotices) return "Notice Board";

  const primary = PRIMARY_NAV.find((n) => navItemIsActive(pathname, n));
  if (primary) return primary.label;

  return "TribalMMO";
}

function GameLayout() {
  const { profile, profileLoading, profileError, lastResult, refreshProfile } = useGame();
  const location = useLocation();

  useEffect(() => {
    const label = titleForPath(location.pathname);
    document.title = label === "TribalMMO" ? "TribalMMO" : `${label} · TribalMMO`;
  }, [location.pathname]);

  if (profileLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-950">
        <LoadingState message="Gathering your camp..." />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-stone-950">
        <div className="w-full max-w-sm text-center space-y-3">
          <div className="text-3xl" aria-hidden="true">
            🔥
          </div>
          <h2 className="text-base font-bold text-stone-200">The campfire went out</h2>
          <p className="text-xs text-stone-500">
            We couldn't reach the village records.
            {profileError ? (
              <span className="block mt-1 text-red-400/80">{profileError}</span>
            ) : null}
          </p>
          <button
            type="button"
            onClick={() => refreshProfile()}
            className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-xs text-white font-medium transition-colors cursor-pointer"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (profile && !profile.display_name) {
    return <CharacterSetup />;
  }

  return (
    <div className="min-h-screen md:h-screen md:overflow-hidden md:flex bg-stone-950">
      <SideNav />

      <div className="flex-1 flex flex-col min-w-0">
        <GameHeader />
        <main className="flex-1 md:overflow-y-auto px-3 py-3 md:px-6">
          <div className="max-w-3xl mx-auto w-full">
            <Outlet />
          </div>
        </main>

        <div className="md:hidden px-3 pb-2">
          <div className="max-w-3xl mx-auto space-y-3">
            {lastResult && (
              <div>
                <h2 className="text-[10px] font-semibold text-stone-500 uppercase tracking-widest mb-1.5">
                  Last Action
                </h2>
                <ActionResult />
              </div>
            )}
            <div>
              <h2 className="text-[10px] font-semibold text-stone-500 uppercase tracking-widest mb-1.5">
                Journal
              </h2>
              <Journal />
            </div>
          </div>
        </div>

        <BottomNav />
      </div>

      <HudPanel />
    </div>
  );
}

export function Layout() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-950">
        <LoadingState message="Lighting the fire..." />
      </div>
    );
  }

  if (!user) {
    return <Navigate to={PATHS.login} replace />;
  }

  return (
    <GameProvider>
      <GameLayout />
    </GameProvider>
  );
}
