import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchNotices, fetchOnlinePlayers } from "../lib/socialApi";
import type { NoticeItem, OnlinePlayer } from "../types";
import { PATHS } from "../lib/paths";
import { PageHeader } from "../components/ui/PageHeader";
import { Notice } from "../components/ui/Notice";
import { EmptyState } from "../components/ui/EmptyState";
import { LoadingState } from "../components/ui/LoadingState";
import { PlayerLink } from "../components/PlayerLink";
import { PresenceDot } from "../components/PresenceDot";

const KIND_ICON: Record<NoticeItem["kind"], string> = {
  milestone: "🏆",
  world: "🔥",
  clan: "🏕️",
  system: "📋",
};

export function NoticeBoardPage() {
  const [notices, setNotices] = useState<NoticeItem[] | null>(null);
  const [online, setOnline] = useState<OnlinePlayer[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [noticeRes, onlineRes] = await Promise.all([fetchNotices(), fetchOnlinePlayers()]);
    if (noticeRes.error) setError(noticeRes.error);
    setNotices(noticeRes.data ?? []);
    setOnline(onlineRes.data ?? []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-4">
      <div>
        <Link to={PATHS.village} className="text-[10px] text-stone-500 hover:text-amber-400">
          ← back to the village
        </Link>
        <PageHeader
          title="Notice Board"
          subtitle="Word of milestones, world doings, and the tribe's comings and goings."
        />
        {error ? <Notice tone="error">{error}</Notice> : null}
      </div>

      <div>
        <h3 className="text-[10px] font-semibold text-stone-500 uppercase tracking-widest mb-1.5">
          Online now
        </h3>
        {online === null ? (
          <LoadingState message="Counting heads around the fire…" className="min-h-0 py-6" />
        ) : online.length === 0 ? (
          <p className="text-[11px] text-stone-600">No one about right now.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {online.map((p) => (
              <div
                key={p.id}
                className="flex items-center gap-1.5 rounded-xl border border-stone-800/40 bg-stone-900/40 px-2.5 py-1.5"
              >
                <PresenceDot online />
                <PlayerLink
                  name={p.display_name}
                  className="text-[11px] text-amber-400/90 hover:text-amber-300 transition-colors"
                />
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <h3 className="text-[10px] font-semibold text-stone-500 uppercase tracking-widest mb-1.5">
          Notices
        </h3>
        {notices === null ? (
          <LoadingState message="Reading the board…" className="min-h-0 py-8" />
        ) : notices.length === 0 ? (
          <EmptyState icon="📋" title="Nothing posted" description="The board is bare for now." />
        ) : (
          <div className="space-y-2">
            {notices.map((n) => (
              <div key={n.id} className="rounded-xl border border-stone-800/60 bg-stone-900/60 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs font-semibold text-stone-200">
                    {KIND_ICON[n.kind] ?? "📋"} {n.title}
                  </div>
                  <span className="text-[10px] text-stone-600 shrink-0">
                    {new Date(n.created_at).toLocaleString()}
                  </span>
                </div>
                <p className="text-[11px] text-stone-400 mt-1.5 leading-relaxed">
                  {n.actor_name ? (
                    <>
                      <PlayerLink
                        name={n.actor_name}
                        className="text-amber-400/90 hover:text-amber-300 font-medium transition-colors"
                      />{" "}
                      —{" "}
                    </>
                  ) : null}
                  {n.body}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
