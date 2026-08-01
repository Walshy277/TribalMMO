import { Link } from "react-router-dom";
import { useGame } from "../hooks/useGame";
import { useEnergy } from "../hooks/useEnergy";
import { Journal } from "./Journal";
import { ActionResult } from "./ActionResult";
import { TribalClock } from "./TribalClock";
import { SKILLS, EQUIP_SLOTS, petBonusSummary, rarityLabel } from "../types";
import { HealthBar } from "./HealthBar";
import { PlayerLink } from "./PlayerLink";
import { ClanChat } from "./ClanChat";
import { PATHS } from "../lib/paths";

export function HudPanel() {
  const { profile, lastResult } = useGame();
  const energy = useEnergy();
  if (!profile || !energy) return null;

  return (
    <aside className="hidden md:flex md:flex-col w-72 lg:w-80 shrink-0 border-l border-stone-800 bg-stone-900/40 overflow-y-auto">
      <div className="p-4 space-y-4">
        <TribalClock />

        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-amber-600/20 border border-amber-700/40 flex items-center justify-center text-amber-400 font-bold text-lg">
            {(profile.display_name ?? "?").charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <PlayerLink
              name={profile.display_name}
              className="text-sm font-bold text-stone-200 truncate hover:text-amber-300 transition-colors block"
            >
              {profile.display_name ?? "Wanderer"}
            </PlayerLink>
            <div className="text-[10px] text-stone-500">Tribesman · profile</div>
          </div>
        </div>

        {profile.clan_tag ? (
          <Link
            to={PATHS.clan}
            className="rounded-xl border border-amber-800/40 bg-amber-950/20 p-2.5 flex items-center gap-2 hover:border-amber-700/50 hover:bg-amber-950/30 transition-colors"
          >
            <span className="text-lg" aria-hidden="true">🏕️</span>
            <div className="min-w-0 flex-1">
              <div className="text-[10px] font-semibold text-stone-500 uppercase tracking-widest">
                Clan
              </div>
              <div className="text-xs font-bold text-amber-400 truncate">[{profile.clan_tag}]</div>
            </div>
            <span className="text-[10px] text-amber-500/80 shrink-0">view →</span>
          </Link>
        ) : null}

        <div className="rounded-xl border border-stone-800/60 bg-stone-900/60 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold text-stone-500 uppercase tracking-widest">
              Gold
            </span>
            <span className="text-amber-400 text-sm font-bold">
              ◆ {profile.gold.toLocaleString()}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold text-stone-500 uppercase tracking-widest">
              Energy
            </span>
            <span className="text-[10px] text-stone-400 font-mono">
              {Math.floor(energy.current)}/{energy.max}
            </span>
          </div>
          <div className="h-1.5 bg-stone-800 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-amber-600 to-amber-400 transition-all duration-500"
              style={{ width: `${energy.pct}%` }}
            />
          </div>
          <div className="text-[10px] text-stone-600">+{energy.regen}/{energy.tickMin}min</div>
        </div>

        {profile.pets.length > 0 &&
          (() => {
            const active = profile.pets.find((p) => p.is_active);
            if (!active) return null;
            return (
              <div className="rounded-xl border border-amber-800/40 bg-amber-950/20 p-3 flex items-center gap-2.5">
                <span className="text-xl">{active.icon}</span>
                <div className="min-w-0">
                  <div className="text-[10px] font-semibold text-stone-500 uppercase tracking-widest">
                    Companion
                  </div>
                  <div className="text-xs font-bold text-stone-200 truncate">{active.name}</div>
                  <div className="text-[10px] text-stone-500 truncate">
                    {petBonusSummary(active)}
                  </div>
                </div>
              </div>
            );
          })()}

        <div className="rounded-xl border border-stone-800/60 bg-stone-900/60 p-3">
          <HealthBar />
        </div>

        <div className="rounded-xl border border-stone-800/60 bg-stone-900/60 p-3 space-y-2">
          <div className="text-[10px] font-semibold text-stone-500 uppercase tracking-widest">
            Equipped
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {EQUIP_SLOTS.map((slot) => {
              const equipped = profile.equipment[slot.id];
              return (
                <div
                  key={slot.id}
                  title={
                    equipped
                      ? `${equipped.name} (${rarityLabel(equipped.rarity, equipped.rarity_pct)})`
                      : `${slot.label} slot`
                  }
                  className="rounded-lg bg-stone-800/40 border border-stone-800/40 p-1.5 flex flex-col items-center gap-0.5 text-center"
                >
                  <span className="text-sm">{slot.icon}</span>
                  <span className="text-[9px] text-stone-600 leading-none">{slot.label}</span>
                  {equipped ? (
                    <span className="text-[9px] text-stone-300 truncate w-full leading-none">
                      {equipped.icon} {equipped.name}
                    </span>
                  ) : (
                    <span className="text-[9px] text-stone-700 leading-none">—</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-xl border border-stone-800/60 bg-stone-900/60 p-3 space-y-2">
          <div className="text-[10px] font-semibold text-stone-500 uppercase tracking-widest">
            Skills
          </div>
          <div className="space-y-1.5">
            {SKILLS.map((skill) => {
              const info = profile.skills[skill.id];
              const pct =
                info.xp_next > 0 ? Math.min(100, (info.xp / info.xp_next) * 100) : 100;
              return (
                <div key={skill.id} className="flex items-center gap-2">
                  <span className="text-sm w-5 text-center shrink-0">{skill.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-stone-400 truncate">{skill.name}</span>
                      <span className="text-[10px] text-amber-500/80 font-mono shrink-0 ml-2">
                        Lv.{info.level}
                      </span>
                    </div>
                    <div className="mt-0.5 h-1 bg-stone-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-amber-600/70 rounded-full transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {lastResult && (
          <div>
            <div className="text-[10px] font-semibold text-stone-500 uppercase tracking-widest mb-1.5">
              Last Action
            </div>
            <ActionResult />
          </div>
        )}

        {profile.clan_id ? (
          <div>
            <div className="text-[10px] font-semibold text-stone-500 uppercase tracking-widest mb-1.5">
              Clan Chat
            </div>
            <ClanChat />
          </div>
        ) : null}

        <div className="pb-2">
          <div className="text-[10px] font-semibold text-stone-500 uppercase tracking-widest mb-1.5">
            Journal
          </div>
          <Journal />
        </div>
      </div>
    </aside>
  );
}
