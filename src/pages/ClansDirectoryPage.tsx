import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useGame } from "../hooks/useGame";
import { joinClan, listClans } from "../lib/clanApi";
import type { ClanSummary } from "../types";
import { PATHS } from "../lib/paths";
import { PageHeader } from "../components/ui/PageHeader";
import { Notice } from "../components/ui/Notice";
import { EmptyState } from "../components/ui/EmptyState";
import { LoadingState } from "../components/ui/LoadingState";

export function ClansDirectoryPage() {
  const { profile, refreshProfile } = useGame();
  const [clans, setClans] = useState<ClanSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [joiningId, setJoiningId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await listClans();
    if (res.error) setError(res.error);
    setClans(res.data ?? []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleJoin = async (clanId: string) => {
    setJoiningId(clanId);
    setError(null);
    const err = await joinClan(clanId);
    if (err) {
      setError(err);
    } else {
      await refreshProfile();
      await load();
    }
    setJoiningId(null);
  };

  const canJoin = !profile?.clan_id;

  return (
    <div className="space-y-4">
      <div>
        <PageHeader
          title="Clans"
          subtitle="Tribes that have claimed a name in the village records."
        />
        {error ? <Notice tone="error">{error}</Notice> : null}
      </div>

      {clans === null ? (
        <LoadingState message="Consulting the village records…" className="min-h-0 py-10" />
      ) : clans.length === 0 ? (
        <EmptyState icon="🏕️" title="No clans yet" description="No tribes have been founded yet." />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {clans.map((c) => (
            <div
              key={c.id}
              className="rounded-xl border border-stone-700/50 bg-stone-900 p-3 space-y-2"
            >
              <Link
                to={PATHS.clan}
                className="flex items-center gap-3 hover:opacity-90 transition-opacity"
              >
                <span className="text-2xl" aria-hidden="true">
                  {c.banner}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold text-stone-200 truncate">
                    {c.name} <span className="text-amber-500/80">[{c.tag}]</span>
                  </div>
                  <div className="text-[10px] text-stone-500">
                    {c.member_count} member{c.member_count === 1 ? "" : "s"} ·{" "}
                    {c.recruitment === "open" ? "open recruitment" : "invite only"}
                  </div>
                  {c.chieftain_name ? (
                    <div className="text-[10px] text-stone-600 mt-0.5">
                      Led by {c.chieftain_name}
                    </div>
                  ) : null}
                </div>
              </Link>
              {canJoin && c.recruitment === "open" ? (
                <button
                  type="button"
                  disabled={joiningId === c.id}
                  onClick={() => handleJoin(c.id)}
                  className="w-full px-3 py-1.5 rounded-lg bg-amber-600/80 hover:bg-amber-500 text-white text-[11px] font-medium transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {joiningId === c.id ? "..." : "Join clan"}
                </button>
              ) : null}
            </div>
          ))}
        </div>
      )}

      <Link
        to={PATHS.clan}
        className="block text-[10px] text-stone-600 hover:text-amber-400 transition-colors"
      >
        ← Back to Clan
      </Link>
    </div>
  );
}
