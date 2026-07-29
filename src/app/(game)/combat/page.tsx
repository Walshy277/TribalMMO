import { useEffect, useState } from "react";
import { useGame } from "@/lib/game";
import { supabase } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Swords, Shield, Heart, Dumbbell, Zap, Trophy, Footprints, Crosshair, Wind, Eye, Gem } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { computeEffectiveStats } from "@/lib/stats";
import { rollDice, chance, pick, rangeInt } from "@/lib/rng";

interface EnemyAbility {
  name: string;
  desc: string;
  chance: number;
  effect: "double_dmg" | "armor_break" | "heal" | "stun" | "berserk";
}

interface NpcData {
  id: string;
  name: string;
  description: string;
  level: number;
  hp: number;
  gold_min: number;
  gold_max: number;
  stats?: NpcStats;
  equipment?: NpcEquipment[];
}

interface NpcStats {
  strength: number;
  defence: number;
  speed: number;
  vitality: number;
  attack: number;
  defense: number;
  max_hp: number;
}

interface NpcEquipment {
  slot: string;
  item_name: string;
}

interface CombatState {
  active: boolean;
  npc: NpcData;
  npcStats: NpcStats;
  enemyHp: number;
  enemyMaxHp: number;
  playerHp: number;
  maxPlayerHp: number;
  stance: "aggressive" | "defensive" | "balanced";
  log: { text: string; type: "player" | "enemy" | "system" | "loot" | "critical" }[];
  result: "won" | "lost" | null;
  loot: { item: string; qty: number }[];
  totalDmgDealt: number;
  totalDmgTaken: number;
  turns: number;
}

const enemyAbilities: EnemyAbility[] = [
  { name: "Gore", desc: "A vicious tusking!", chance: 15, effect: "double_dmg" },
  { name: "Pack Tactics", desc: "Strikes from the flank!", chance: 20, effect: "armor_break" },
  { name: "Maul", desc: "Swipes with crushing force!", chance: 18, effect: "double_dmg" },
  { name: "Enrage", desc: "Fury doubles its strength!", chance: 10, effect: "berserk" },
  { name: "Quick Shot", desc: "Aimed at your weak spot!", chance: 22, effect: "armor_break" },
  { name: "Disengage", desc: "Attempts to heal!", chance: 8, effect: "heal" },
  { name: "Venom Strike", desc: "Poison seeps into your veins!", chance: 25, effect: "stun" },
  { name: "Slam", desc: "The ground shakes!", chance: 20, effect: "stun" },
  { name: "Hardened", desc: "Its rocky hide deflects blows!", chance: 12, effect: "armor_break" },
  { name: "Backstab", desc: "A devastating blow from the dark!", chance: 20, effect: "double_dmg" },
  { name: "Shadow Step", desc: "Fades into the night!", chance: 10, effect: "heal" },
  { name: "Inferno", desc: "A wave of searing flame!", chance: 18, effect: "double_dmg" },
  { name: "Heat Wave", desc: "The intensity overwhelms you!", chance: 15, effect: "armor_break" },
  { name: "Web Shot", desc: "Sticky webbing slows you down!", chance: 22, effect: "stun" },
  { name: "Guardian Strike", desc: "A calculated crushing blow!", chance: 20, effect: "double_dmg" },
  { name: "Fortify", desc: "Its defenses shift!", chance: 15, effect: "heal" },
  { name: "Stomp", desc: "The earth trembles!", chance: 10, effect: "stun" },
];

function getHitChance(attackerAcc: number, defenderEva: number, stance: string): number {
  let stanceMod = 0;
  if (stance === "aggressive") stanceMod = -10;
  else if (stance === "defensive") stanceMod = 15;
  return Math.min(95, Math.max(20, attackerAcc - defenderEva + stanceMod));
}

export default function CombatPage() {
  const { character, refreshCharacter } = useGame();
  const [npcs, setNpcs] = useState<(NpcData & { stats: NpcStats; equipment: NpcEquipment[] })[]>([]);
  const [combat, setCombat] = useState<CombatState | null>(null);
  const [loadingNpcs, setLoadingNpcs] = useState(true);

  useEffect(() => {
    document.title = "Combat — TribalMMO";
    fetchNpcs();
  }, []);

  const fetchNpcs = async () => {
    setLoadingNpcs(true);
    const { data: npcRows, error } = await supabase.from("npcs").select("*");
    if (error || !npcRows) { setLoadingNpcs(false); return; }

    const { data: equipData } = await supabase
      .from("npc_equipment")
      .select("npc_id, slot, item_id");

    const itemIds = [...new Set((equipData || []).map((e: any) => e.item_id))];
    const { data: itemMap } = await supabase
      .from("items")
      .select("id, name")
      .in("id", itemIds);
    const itemLookup = Object.fromEntries((itemMap || []).map((i: any) => [i.id, i.name]));

    const equipped = (equipData || []).map(
      (e: any) => ({ npc_id: e.npc_id, slot: e.slot, item_name: itemLookup[e.item_id] || "Unknown" })
    );

    const enriched = await Promise.all(
      (npcRows as NpcData[]).map(async (npc) => {
        const { data: stats } = await supabase.rpc("get_npc_effective_stats", { p_npc_id: npc.id });
        const eq = equipped
          .filter((e) => e.npc_id === npc.id)
          .map((e) => ({ slot: e.slot, item_name: e.item_name }));
        return { ...npc, stats: (stats as unknown as NpcStats) || { strength: 1, defence: 1, speed: 1, vitality: 1, attack: 1, defense: 1, max_hp: npc.hp }, equipment: eq };
      })
    );
    setNpcs(enriched);
    setLoadingNpcs(false);
  };

  if (!character) {
    return <div className="text-slate-500 text-center mt-20">Create a character first.</div>;
  }

  const effectiveStats = computeEffectiveStats(character, character.inventory, { philosophy: character.clan?.clan?.philosophy, buildings: character.clanBuildings }, character.pets);

  const pickAbility = (): EnemyAbility | null => {
    for (const ability of enemyAbilities) {
      if (chance(ability.chance)) return ability;
    }
    return null;
  };

  const startCombat = async (stance: "aggressive" | "defensive" | "balanced") => {
    const staminaCost = 10;
    if (character.computed_stamina < staminaCost) return;
    const { error } = await supabase.rpc("deduct_stamina", {
      p_character_id: character.id,
      p_amount: staminaCost,
    });
    if (error) return;
    await refreshCharacter();

    const validNpcs = npcs.filter((n) => n.level <= Math.max(1, Math.ceil(effectiveStats.attack / 3)));
    if (validNpcs.length === 0) return;
    const npc = pick(validNpcs);
    const playerHp = 20 + effectiveStats.vitality * 3;
    setCombat({
      active: true,
      npc,
      npcStats: npc.stats,
      enemyHp: npc.stats.max_hp,
      enemyMaxHp: npc.stats.max_hp,
      playerHp,
      maxPlayerHp: playerHp,
      stance,
      log: [{ text: `${npc.name} (lvl ${npc.level}) appears! (-${staminaCost} stamina)`, type: "system" }],
      result: null,
      loot: [],
      totalDmgDealt: 0,
      totalDmgTaken: 0,
      turns: 0,
    });
  };

  const playerAttack = () => {
    if (!combat || !combat.active) return;
    let stance = combat.stance;
    let newLog = [...combat.log];
    let playerHit = true;
    let playerCrit = false;
    let enemyDodged = false;
    let enemyHit = true;
    let enemyCrit = false;

    const hitChance = getHitChance(combat.npcStats.attack * 3, effectiveStats.speed, stance);
    enemyHit = chance(hitChance);
    if (!enemyHit) {
      newLog.push({ text: `You dodge the ${combat.npc.name}'s attack!`, type: "player" });
    }

    const acc = 55 + effectiveStats.speed * 1.5;
    const playerHitChance = getHitChance(acc, combat.npcStats.speed * 2, stance);
    playerHit = chance(playerHitChance);
    enemyDodged = !playerHit && chance(combat.npcStats.speed * 2);

    if (enemyDodged) {
      newLog.push({ text: `The ${combat.npc.name} dodges your attack!`, type: "enemy" });
    }

    let playerDmg = 0;
    let enemyDmg = 0;
    let newEnemyHp = combat.enemyHp;
    let newPlayerHp = combat.playerHp;

    if (playerHit && !enemyDodged) {
      const rawDmg = rollDice(1, 6, effectiveStats.attack - combat.npcStats.defense);
      playerCrit = rawDmg.critical || chance(Math.min(15, effectiveStats.attack * 0.5));
      const stanceDmgMod = stance === "aggressive" ? 1.3 : stance === "defensive" ? 0.7 : 1.0;
      playerDmg = Math.max(1, Math.floor(rawDmg.total * stanceDmgMod));
      if (playerCrit) {
        playerDmg = Math.floor(playerDmg * 2);
        newLog.push({ text: `CRITICAL HIT for ${playerDmg} damage!`, type: "critical" });
      } else {
        newLog.push({ text: `You strike for ${playerDmg} damage.`, type: "player" });
      }
      newEnemyHp -= playerDmg;
    }

    if (newEnemyHp <= 0) {
      newLog.push({ text: `You defeated the ${combat.npc.name}!`, type: "system" });
      setCombat({
        ...combat,
        enemyHp: 0,
        log: newLog,
        active: false,
        result: "won",
        totalDmgDealt: combat.totalDmgDealt + playerDmg,
        turns: combat.turns + 1,
      });
      return;
    }

    let updatedNpcStats = combat.npcStats;

    if (enemyHit) {
      const rawDmg = rollDice(1, 4, combat.npcStats.attack - Math.floor(effectiveStats.defense / 2));
      enemyCrit = rawDmg.critical || chance(10);
      const stanceDmgMod = stance === "defensive" ? 0.6 : stance === "aggressive" ? 1.2 : 1.0;

      const ability = pickAbility();
      if (ability) {
        let abilityDmg = Math.max(1, Math.floor(rawDmg.total * stanceDmgMod));
        if (ability.effect === "double_dmg") {
          abilityDmg = Math.floor(abilityDmg * 2);
          newLog.push({ text: `${combat.npc.name} uses ${ability.name}! ${ability.desc} (-${abilityDmg} HP)`, type: "enemy" });
        } else if (ability.effect === "armor_break") {
          abilityDmg = Math.floor(abilityDmg * 1.5);
          newLog.push({ text: `${combat.npc.name} uses ${ability.name}! ${ability.desc} (-${abilityDmg} HP)`, type: "enemy" });
        } else if (ability.effect === "heal") {
          const healAmt = rangeInt(3, 8);
          newEnemyHp = Math.min(combat.enemyMaxHp, newEnemyHp + healAmt);
          newLog.push({ text: `${combat.npc.name} uses ${ability.name}! ${ability.desc} (+${healAmt} HP)`, type: "enemy" });
          enemyDmg = 0;
        } else if (ability.effect === "stun") {
          abilityDmg = Math.max(1, Math.floor(rawDmg.total * stanceDmgMod));
          newLog.push({ text: `${combat.npc.name} uses ${ability.name}! ${ability.desc} (-${abilityDmg} HP)`, type: "enemy" });
        } else if (ability.effect === "berserk") {
          updatedNpcStats = { ...combat.npcStats, attack: Math.floor(combat.npcStats.attack * 1.5) };
          abilityDmg = Math.max(1, Math.floor(rawDmg.total * stanceDmgMod * 1.5));
          newLog.push({ text: `${combat.npc.name} goes BERSERK! (-${abilityDmg} HP)`, type: "enemy" });
        }
        enemyDmg = abilityDmg;
      } else {
        enemyDmg = Math.max(1, Math.floor(rawDmg.total * stanceDmgMod));
        if (enemyCrit) {
          enemyDmg = Math.floor(enemyDmg * 1.5);
          newLog.push({ text: `${combat.npc.name} lands a vicious hit for ${enemyDmg}!`, type: "critical" });
        } else {
          newLog.push({ text: `${combat.npc.name} strikes for ${enemyDmg}.`, type: "enemy" });
        }
      }

      newPlayerHp -= enemyDmg;
    }

    if (newPlayerHp <= 0) {
      setCombat({
        ...combat,
        npcStats: updatedNpcStats,
        enemyHp: newEnemyHp,
        playerHp: 0,
        log: [...newLog, { text: `You fall...`, type: "system" }],
        active: false,
        result: "lost",
        totalDmgDealt: combat.totalDmgDealt + playerDmg,
        totalDmgTaken: combat.totalDmgTaken + enemyDmg,
        turns: combat.turns + 1,
      });
      return;
    }

    setCombat({
      ...combat,
      npcStats: updatedNpcStats,
      enemyHp: newEnemyHp,
      playerHp: newPlayerHp,
      log: newLog,
      totalDmgDealt: combat.totalDmgDealt + playerDmg,
      totalDmgTaken: combat.totalDmgTaken + enemyDmg,
      turns: combat.turns + 1,
    });
  };

  const flee = () => {
    if (!combat) return;
    const success = chance(30 + effectiveStats.speed * 3);
    if (success) {
      setCombat({ ...combat, log: [...combat.log, { text: "You fled into the wilderness!", type: "system" }], active: false, result: null });
    } else {
      const rawDmg = rollDice(1, 4, combat.npcStats.attack - Math.floor(effectiveStats.defense / 2));
      const enemyDmg = Math.max(1, rawDmg.total);
      const newPlayerHp = Math.max(0, combat.playerHp - enemyDmg);
      setCombat({
        ...combat,
        playerHp: newPlayerHp,
        log: [...combat.log, { text: `Failed to flee! The ${combat.npc.name} hits you for ${enemyDmg}!`, type: "enemy" }],
        active: false,
        result: newPlayerHp <= 0 ? "lost" : null,
        totalDmgTaken: combat.totalDmgTaken + enemyDmg,
      });
    }
  };

  const endCombat = async () => {
    if (!combat || !character) return;
    if (combat.result === "won") {
      const { data: reward } = await supabase.rpc("reward_npc_kill", {
        p_character_id: character.id,
        p_npc_id: combat.npc.id,
      });
      if (reward) {
        const result = reward as { gold: number; loot: { item: string; qty: number }[] };
        setCombat({
          ...combat,
          loot: result.loot || [],
          log: [...combat.log, { text: `+${result.gold} gold${(result.loot || []).length > 0 ? ", " + (result.loot || []).map((l) => l.qty + "x " + l.item).join(", ") : ""}, ${combat.turns} turns`, type: "system" }],
        });
      }
      await refreshCharacter();
    } else if (combat.result === "lost") {
      const { error } = await supabase.rpc("resolve_combat_loss", {
        p_character_id: character.id,
        p_stamina_cost: 15,
      });
      if (!error) await refreshCharacter();
    }
    setTimeout(() => setCombat(null), 1500);
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Combat</h1>
        <p className="text-slate-500 text-sm mt-0.5">Test your strength against the wild</p>
      </div>

      {combat ? (
        <div className="space-y-4">
          <div className="card">
            <div className="grid grid-cols-2 gap-6">
              <div className="text-center">
                <div className="w-14 h-14 mx-auto rounded-full bg-[#122a1b] border border-[#2d6e44] flex items-center justify-center mb-2">
                  <Swords size={24} className="text-[#4a9e6a]" />
                </div>
                <div className="text-slate-600 text-[11px] uppercase font-bold tracking-wider">You</div>
                <div className="text-lg font-bold text-slate-100 mb-3">{character.name}</div>
                <div className="w-full bg-slate-900/80 rounded-full h-3">
                  <div className="bg-[#3d8b5c] h-3 rounded-full transition-all duration-300" style={{ width: (combat.playerHp / combat.maxPlayerHp) * 100 + "%" }} />
                </div>
                <div className="text-slate-500 text-xs mt-1.5 flex items-center justify-center gap-1 tabular-nums">
                  <Heart size={12} /> {combat.playerHp} / {combat.maxPlayerHp}
                </div>
                <div className="text-slate-600 text-[10px] mt-1 uppercase tracking-wider">{combat.stance} stance</div>
              </div>
              <div className="text-center">
                <div className="w-14 h-14 mx-auto rounded-full bg-[#2a1414] border border-[#6e2424] flex items-center justify-center mb-2">
                  <Swords size={24} className="text-[#b83a3a]" />
                </div>
                <div className="text-slate-600 text-[11px] uppercase font-bold tracking-wider">Enemy (lvl {combat.npc.level})</div>
                <div className="text-lg font-bold text-slate-100 mb-3">{combat.npc.name}</div>
                <div className="w-full bg-slate-900/80 rounded-full h-3">
                  <div className="bg-[#b83a3a] h-3 rounded-full transition-all duration-300" style={{ width: (combat.enemyHp / combat.enemyMaxHp) * 100 + "%" }} />
                </div>
                <div className="text-slate-500 text-xs mt-1.5 flex items-center justify-center gap-1 tabular-nums">
                  <Heart size={12} /> {combat.enemyHp} / {combat.enemyMaxHp}
                </div>
                <div className="text-slate-600 text-[10px] mt-1">ATK {combat.npcStats.attack} DEF {combat.npcStats.defense}</div>
                {combat.npc.equipment && combat.npc.equipment.length > 0 && (
                  <div className="flex justify-center gap-1 mt-1.5">
                    {combat.npc.equipment.map((eq, i) => (
                      <span key={i} className="text-[9px] text-slate-600 bg-slate-900/40 px-1.5 py-0.5 rounded border border-slate-800/30">
                        {eq.slot}: {eq.item_name}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="card max-h-64 overflow-y-auto">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 sticky top-0 bg-[#0a0e14] py-2">Battle Log ({combat.turns} turns)</h2>
            <div className="space-y-1">
              {combat.log.map((entry, i) => (
                <p key={i} className={
                  "text-sm py-1 " + (
                    entry.type === "player" ? "text-[#4a9e6a]" :
                    entry.type === "critical" ? "text-[#c9a84c] font-bold" :
                    entry.type === "enemy" ? "text-[#b83a3a]" :
                    entry.type === "loot" ? "text-[#8a6aaa]" :
                    "text-slate-500"
                  )
                }>
                  {entry.text}
                </p>
              ))}
            </div>
          </div>

          {combat.active ? (
            <div className="flex gap-2">
              <Button variant="danger" className="flex-1" size="lg" icon={<Swords size={18} />} onClick={playerAttack}>
                Attack
              </Button>
              <Button variant="secondary" size="sm" icon={<Eye size={14} />} onClick={() => setCombat({ ...combat, stance: "defensive" })} disabled={combat.stance === "defensive"}>
                Def
              </Button>
              <Button variant="secondary" size="sm" icon={<Crosshair size={14} />} onClick={() => setCombat({ ...combat, stance: "aggressive" })} disabled={combat.stance === "aggressive"}>
                Agg
              </Button>
              <Button variant="secondary" size="sm" icon={<Wind size={14} />} onClick={() => setCombat({ ...combat, stance: "balanced" })} disabled={combat.stance === "balanced"}>
                Bal
              </Button>
              <Button variant="secondary" className="flex-1" size="lg" icon={<Footprints size={18} />} onClick={flee}>
                Flee
              </Button>
            </div>
          ) : (
            <Button variant={combat.result === "won" ? "success" : "secondary"} className="w-full" size="lg" icon={combat.result === "won" ? <Trophy size={18} /> : <Footprints size={18} />} onClick={endCombat}>
              {combat.result === "won" ? `Collect Reward (${combat.turns} turns)` :
               combat.result === "lost" ? "Recover" : "Continue"}
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-5">
          <div className="card">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Your Combat Stats</h2>
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: "STR", base: character.strength, value: effectiveStats.strength, icon: Dumbbell, color: "text-[#b83a3a]" },
                { label: "DEF", base: character.defence, value: effectiveStats.defense, icon: Shield, color: "text-[#6a90a8]" },
                { label: "SPD", base: character.speed, value: effectiveStats.speed, icon: Zap, color: "text-[#4a9e6a]" },
                { label: "VIT", base: character.vitality, value: effectiveStats.vitality, icon: Heart, color: "text-slate-400" },
                { label: "ATK", value: effectiveStats.attack, icon: Swords, color: "text-[#b83a3a]" },
              ].map((stat: Record<string, unknown>) => {
                const Icon = stat.icon as LucideIcon;
                return (
                  <div key={stat.label as string} className="text-center bg-slate-900/40 rounded-lg p-4 border border-slate-800/20">
                    <Icon size={22} className={(stat.color as string) + " mx-auto mb-1"} />
                    <div className="text-slate-600 text-[11px] uppercase font-bold">{(stat.label as string)}</div>
                    <div className={"text-2xl font-bold mt-1 " + (stat.color as string)}>{stat.value as number}</div>
                    {"base" in stat && (stat.base as number) !== (stat.value as number) && (
                      <div className="text-slate-700 text-xs">({stat.base as number})</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="card">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Choose Your Stance</h2>
            <p className="text-slate-500 text-xs mb-3">Aggressive (+30% dmg, -10% dodge) | Defensive (-30% dmg taken, +15% dodge) | Balanced</p>
            <div className="flex gap-2">
              <Button variant="secondary" className="flex-1" size="sm" icon={<Crosshair size={14} />} onClick={() => startCombat("aggressive")} disabled={character.computed_stamina < 10}>
                Aggressive
              </Button>
              <Button variant="secondary" className="flex-1" size="sm" icon={<Shield size={14} />} onClick={() => startCombat("defensive")} disabled={character.computed_stamina < 10}>
                Defensive
              </Button>
              <Button variant="primary" className="flex-1" size="sm" icon={<Wind size={14} />} onClick={() => startCombat("balanced")} disabled={character.computed_stamina < 10}>
                Balanced
              </Button>
            </div>
          </div>

          <div className="card">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Enemies in the Wild</h2>
            {loadingNpcs ? (
              <p className="text-slate-500 text-sm text-center py-6">Loading enemies...</p>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {npcs.map((npc, i) => (
                  <div key={npc.id} className="bg-slate-900/40 rounded-lg p-3 text-center border border-slate-800/20 group hover:border-slate-700/40 transition-all cursor-default">
                    <Swords size={20} className="text-slate-500 mx-auto mb-1" />
                    <div className="text-slate-200 text-sm font-medium mt-1">{npc.name}</div>
                    <div className="text-slate-600 text-xs">Lvl {npc.level} &middot; HP {npc.stats.max_hp} &middot; ATK {npc.stats.attack}</div>
                    {npc.equipment.length > 0 && (
                      <div className="flex justify-center gap-1 mt-1 flex-wrap">
                        {npc.equipment.map((eq, ei) => (
                          <span key={ei} className="text-[8px] text-slate-700 bg-slate-800/30 px-1 py-0.5 rounded">
                            <Gem size={8} className="inline mr-0.5 -mt-0.5" />{eq.item_name}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="text-slate-700 text-[10px] mt-1 opacity-0 group-hover:opacity-100 transition-opacity">{npc.description}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card text-center py-6">
            <Swords size={36} className="text-slate-800 mx-auto mb-3" />
            <p className="text-slate-500 mb-5">Choose your stance and seek out enemies in the wilderness.</p>
          </div>
        </div>
      )}
    </div>
  );
}
