import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { PATHS, profilePath } from "../lib/paths";
import { ZONES } from "../data/gameData";
import { setBio } from "../lib/socialApi";
import { isOnlineFromSeen } from "../lib/presence";
import {
  EQUIP_SLOTS,
  formatPlayTime,
  petBonusSummary,
  rarityLabel,
  RARITY_STYLE,
} from "../types";
import type { ItemRarity, PublicProfile } from "../types";
import { PageHeader } from "../components/ui/PageHeader";
import { Notice } from "../components/ui/Notice";
import { LoadingState } from "../components/ui/LoadingState";
import { EmptyState } from "../components/ui/EmptyState";
import { PresenceDot } from "../components/PresenceDot";

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-stone-800/60 bg-stone-900/60 p-3">
      <div className="text-[10px] font-semibold text-stone-500 uppercase tracking-widest">
        {label}
      </div>
      <div className="text-base font-bold text-stone-100 mt-1 truncate">{value}</div>
      {sub ? <div className="text-[10px] text-stone-600 mt-0.5">{sub}</div> : null}
    </div>
  );
}

export function PublicProfilePage() {
  const { name: rawName } = useParams<{ name: string }>();
  const name = rawName ? decodeURIComponent(rawName) : "";
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [bioDraft, setBioDraft] = useState("");
  const [savingBio, setSavingBio] = useState(false);
  const [bioError, setBioError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!name.trim()) {
      setError("No tribesman specified.");
      setProfile(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const { data, error: rpcError } = await supabase.rpc("get_public_profile", {
      p_name: name.trim(),
    });
    if (rpcError) {
      setError(rpcError.message);
      setProfile(null);
    } else {
      const loaded = data as PublicProfile;
      setProfile(loaded);
      setBioDraft(loaded.bio ?? "");
    }
    setLoading(false);
  }, [name]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return <LoadingState message="Seeking that tribesman…" />;
  }

  if (error || !profile) {
    return (
      <div className="space-y-4">
        <Link to={PATHS.home} className="text-[10px] text-stone-500 hover:text-amber-400">
          ← back to camp
        </Link>
        <EmptyState
          icon="👤"
          title="Not found"
          description={error ?? "No tribesman by that name walks these lands."}
        />
      </div>
    );
  }

  const zone = ZONES.find((z) => z.id === profile.zone);
  const joined = profile.joined_at
    ? new Date(profile.joined_at).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : "—";
  const pet = profile.active_pet;
  const online = profile.is_online ?? isOnlineFromSeen(profile.last_seen_at);

  const handleSaveBio = async () => {
    setSavingBio(true);
    setBioError(null);
    const err = await setBio(bioDraft.trim());
    if (err) setBioError(err);
    else await load();
    setSavingBio(false);
  };

  return (
    <div className="space-y-4">
      <div>
        <Link to={PATHS.home} className="text-[10px] text-stone-500 hover:text-amber-400">
          ← back to camp
        </Link>
        <PageHeader
          title={profile.display_name}
          subtitle={
            profile.is_self
              ? "Your public profile — how other tribesmen see you."
              : "A fellow tribesman of the wilds."
          }
        >
          {profile.is_self ? (
            <Notice tone="success">This is how others see your camp.</Notice>
          ) : null}
        </PageHeader>
      </div>

      <div className="flex items-center gap-3">
        <div className="w-14 h-14 rounded-full bg-amber-600/20 border border-amber-700/40 flex items-center justify-center text-amber-400 font-bold text-2xl shrink-0">
          {profile.display_name.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold text-stone-100 truncate">{profile.display_name}</span>
            {profile.clan ? (
              <Link
                to={PATHS.clan}
                className="text-[10px] font-semibold text-amber-500/80 hover:text-amber-400 bg-amber-950/30 border border-amber-800/40 rounded-full px-2 py-0.5 shrink-0 transition-colors"
              >
                [{profile.clan.tag}]
              </Link>
            ) : null}
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-stone-500 mt-0.5">
            <PresenceDot online={online} />
            <span className={online ? "text-emerald-400" : "text-stone-500"}>
              {online ? "Online" : "Away"}
            </span>
            <span className="text-stone-700">·</span>
            <span>
              Camped at {zone ? `${zone.icon} ${zone.name}` : "the wilds"}
              {zone ? ` · Tier ${zone.tier}` : ""}
            </span>
          </div>
          <div className="text-[10px] text-stone-600 mt-0.5">Joined {joined}</div>
        </div>
      </div>

      <div>
        <h3 className="text-[10px] font-semibold text-stone-500 uppercase tracking-widest mb-1.5">
          Bio
        </h3>
        {profile.is_self ? (
          <div className="space-y-1.5">
            {bioError ? <Notice tone="error">{bioError}</Notice> : null}
            <textarea
              value={bioDraft}
              onChange={(e) => setBioDraft(e.target.value)}
              maxLength={280}
              rows={3}
              placeholder="Tell the tribe a little about yourself…"
              className="w-full rounded-xl border border-stone-800/60 bg-stone-900/60 px-3 py-2 text-[11px] text-stone-200 placeholder:text-stone-600 resize-none focus:outline-none focus:ring-1 focus:ring-amber-600/60"
            />
            <button
              type="button"
              disabled={savingBio || bioDraft.trim() === (profile.bio ?? "").trim()}
              onClick={handleSaveBio}
              className="px-3 py-1.5 rounded-lg bg-amber-600/80 hover:bg-amber-500 text-white text-[11px] font-medium transition-colors disabled:opacity-50 cursor-pointer"
            >
              {savingBio ? "Saving…" : "Save bio"}
            </button>
          </div>
        ) : profile.bio ? (
          <p className="rounded-xl border border-stone-800/40 bg-stone-900/30 px-3 py-2 text-[11px] text-stone-400 leading-relaxed">
            {profile.bio}
          </p>
        ) : (
          <p className="text-[11px] text-stone-600 italic">No bio written yet.</p>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <StatCard
          label="Game time"
          value={formatPlayTime(profile.play_seconds ?? 0)}
          sub="time among the tribe"
        />
        <StatCard
          label="Net worth"
          value={`◆ ${(profile.networth ?? 0).toLocaleString()}`}
          sub="gold, goods & beasts"
        />
        <StatCard
          label="Steps walked"
          value={(profile.steps ?? 0).toLocaleString()}
          sub="across all wilds"
        />
        <StatCard
          label="Zone"
          value={zone ? zone.name : "Unknown"}
          sub={zone ? zone.icon : undefined}
        />
      </div>

      {pet ? (
        <div className="rounded-xl border border-amber-800/40 bg-amber-950/20 p-3 flex items-center gap-3">
          <span className="text-3xl" aria-hidden="true">
            {pet.icon}
          </span>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] font-semibold text-stone-500 uppercase tracking-widest mb-0.5">
              Companion
            </div>
            <div className="text-sm font-bold text-stone-200">
              {pet.name}{" "}
              <span className={`font-normal ${RARITY_STYLE[(pet.rarity as ItemRarity) ?? "common"] ?? ""}`}>
                · {rarityLabel(pet.rarity)}
              </span>
            </div>
            <div className="text-[10px] text-stone-500">{petBonusSummary(pet)}</div>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-stone-800/40 bg-stone-900/30 p-3 text-[11px] text-stone-600">
          No companion at their side.
        </div>
      )}

      <div>
        <h3 className="text-[10px] font-semibold text-stone-500 uppercase tracking-widest mb-1.5">
          Equipped
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {EQUIP_SLOTS.map((slot) => {
            const equipped = profile.equipment?.[slot.id];
            return (
              <div
                key={slot.id}
                className="rounded-xl border border-stone-800/30 bg-stone-900/30 p-2 flex flex-col items-center gap-1 text-center"
              >
                <span className="text-base" aria-hidden="true">
                  {slot.icon}
                </span>
                <span className="text-[10px] text-stone-500 uppercase tracking-wider">
                  {slot.label}
                </span>
                {equipped ? (
                  <>
                    <span className="text-[11px] text-stone-200 font-semibold truncate w-full">
                      {equipped.icon} {equipped.name}
                    </span>
                    <span
                      className={`text-[10px] ${RARITY_STYLE[(equipped.rarity as ItemRarity) ?? "common"] ?? "text-stone-500"}`}
                    >
                      {rarityLabel(equipped.rarity, equipped.rarity_pct)}
                    </span>
                  </>
                ) : (
                  <span className="text-[10px] text-stone-700">empty</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {profile.trophies && profile.trophies.length > 0 ? (
        <div>
          <h3 className="text-[10px] font-semibold text-stone-500 uppercase tracking-widest mb-1.5">
            Trophies
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {profile.trophies.map((t) => (
              <div
                key={t.item_id}
                className="rounded-xl border border-amber-800/30 bg-amber-950/10 p-2 flex items-center gap-2"
                title={t.description ?? t.name}
              >
                <span className="text-xl" aria-hidden="true">
                  {t.icon}
                </span>
                <div className="min-w-0">
                  <div className="text-[11px] text-stone-200 font-semibold truncate">{t.name}</div>
                  <div
                    className={`text-[10px] ${RARITY_STYLE[(t.rarity as ItemRarity) ?? "common"] ?? ""}`}
                  >
                    {rarityLabel(t.rarity, t.rarity_pct)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {profile.is_self && profile.display_name ? (
        <p className="text-[10px] text-stone-600 text-center">
          Share your profile:{" "}
          <span className="text-stone-400 font-mono">{profilePath(profile.display_name)}</span>
        </p>
      ) : null}
    </div>
  );
}
