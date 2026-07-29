import { useEffect } from "react";
import { useGame, type CharacterWithSkills } from "@/lib/game";
import { useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Swords, Shield, Heart, Dumbbell, Zap, Trophy, Footprints, Skull, Flame, Crosshair, Wind, Eye, Award } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { computeEffectiveStats } from "@/lib/stats";
import { xpForLevel, MAX_SKILL_LEVEL, rarityColors } from "@/lib/constants";
import { rollDice, chance, pick, rangeInt, weightedPick, type DiceRollResult } from "@/lib/rng";

interface EnemyAbility {
  name: string;
  desc: string;
  chance: number;
  effect: "double_dmg" | "armor_break" | "heal" | "stun" | "berserk";
}

interface EnemyDef {
  name: string;
  icon: LucideIcon;
  hp: number;
  hpVariance: number;
  atk: number;
  def: number;
  atkVariance: number;
  xp: number;
  gold: number;
  level: number;
  evasion: number;
  accuracy: number;
  lootTable: { item: string; weight: number; qty: number }[];
  flavor: string;
  abilities: EnemyAbility[];
  description: string;
}

const enemies: EnemyDef[] = [
  { name: "Wild Boar", icon: Shield, hp: 15, hpVariance: 5, atk: 3, def: 1, atkVariance: 2, xp: 10, gold: 3, level: 1, evasion: 5, accuracy: 75, lootTable: [{ item: "Raw Meat", weight: 60, qty: 1 }, { item: "Boar Hide", weight: 30, qty: 1 }, { item: "Boar Tusk", weight: 10, qty: 1 }], flavor: "It charges with tusks bared!", description: "A bristle-backed brute that charges first and thinks never.", abilities: [{ name: "Gore", desc: "A vicious tusking!", chance: 15, effect: "double_dmg" }] },
  { name: "Angry Wolf", icon: Shield, hp: 20, hpVariance: 4, atk: 4, def: 2, atkVariance: 3, xp: 15, gold: 5, level: 2, evasion: 12, accuracy: 80, lootTable: [{ item: "Wolf Pelt", weight: 50, qty: 1 }, { item: "Raw Meat", weight: 40, qty: 1 }, { item: "Wolf Fang", weight: 10, qty: 1 }], flavor: "It snarls and circles you.", description: "A lean predator that hunts in packs.", abilities: [{ name: "Pack Tactics", desc: "Strikes from the flank!", chance: 20, effect: "armor_break" }] },
  { name: "Forest Bear", icon: Shield, hp: 35, hpVariance: 8, atk: 6, def: 3, atkVariance: 3, xp: 25, gold: 10, level: 3, evasion: 3, accuracy: 70, lootTable: [{ item: "Thick Fur", weight: 60, qty: 1 }, { item: "Raw Meat", weight: 30, qty: 2 }, { item: "Bear Claw", weight: 10, qty: 1 }], flavor: "A massive bear blocks your path.", description: "A mountain of muscle and fury.", abilities: [{ name: "Maul", desc: "Swipes with crushing force!", chance: 18, effect: "double_dmg" }, { name: "Enrage", desc: "Fury doubles its strength!", chance: 10, effect: "berserk" }] },
  { name: "Rival Scout", icon: Swords, hp: 18, hpVariance: 3, atk: 5, def: 2, atkVariance: 4, xp: 20, gold: 8, level: 2, evasion: 15, accuracy: 85, lootTable: [{ item: "Old Coin", weight: 50, qty: 2 }, { item: "Rations", weight: 30, qty: 1 }, { item: "Map Fragment", weight: 20, qty: 1 }], flavor: "A rival clan scout challenges you.", description: "Quick and cunning, this scout knows how to survive.", abilities: [{ name: "Quick Shot", desc: "Aimed at your weak spot!", chance: 22, effect: "armor_break" }, { name: "Disengage", desc: "Attempts to heal!", chance: 8, effect: "heal" }] },
  { name: "River Serpent", icon: Shield, hp: 12, hpVariance: 6, atk: 3, def: 1, atkVariance: 5, xp: 12, gold: 4, level: 1, evasion: 18, accuracy: 65, lootTable: [{ item: "Serpent Scales", weight: 50, qty: 1 }, { item: "River Stone", weight: 35, qty: 2 }, { item: "Serpent Fang", weight: 15, qty: 1 }], flavor: "A serpent lunges from the water!", description: "A coiled predator that strikes from murky depths.", abilities: [{ name: "Venom Strike", desc: "Poison seeps into your veins!", chance: 25, effect: "stun" }] },
  { name: "Stone Golem", icon: Shield, hp: 40, hpVariance: 10, atk: 4, def: 5, atkVariance: 2, xp: 30, gold: 15, level: 4, evasion: 1, accuracy: 65, lootTable: [{ item: "Stone Shard", weight: 60, qty: 2 }, { item: "Crystal Fragment", weight: 25, qty: 1 }, { item: "Golem Core", weight: 15, qty: 1 }], flavor: "An ancient golem awakens.", description: "A lumbering construct of living rock, slow but unyielding.", abilities: [{ name: "Slam", desc: "The ground shakes!", chance: 20, effect: "stun" }, { name: "Hardened", desc: "Its rocky hide deflects blows!", chance: 12, effect: "armor_break" }] },
  { name: "Shadow Stalker", icon: Skull, hp: 22, hpVariance: 5, atk: 7, def: 1, atkVariance: 4, xp: 28, gold: 12, level: 3, evasion: 22, accuracy: 80, lootTable: [{ item: "Shadow Essence", weight: 35, qty: 1 }, { item: "Dark Silk", weight: 40, qty: 1 }, { item: "Strange Pouch", weight: 25, qty: 1 }], flavor: "A figure melts out of the darkness.", description: "A phantom-like assassin that strikes from the shadows.", abilities: [{ name: "Backstab", desc: "A devastating blow from the dark!", chance: 20, effect: "double_dmg" }, { name: "Shadow Step", desc: "Fades into the night!", chance: 10, effect: "heal" }] },
  { name: "Fire Elemental", icon: Flame, hp: 25, hpVariance: 5, atk: 8, def: 2, atkVariance: 5, xp: 35, gold: 18, level: 4, evasion: 8, accuracy: 75, lootTable: [{ item: "Ember Shard", weight: 50, qty: 1 }, { item: "Fire Essence", weight: 30, qty: 1 }, { item: "Cinder Ore", weight: 20, qty: 1 }], flavor: "The air shimmers with heat as it approaches.", description: "A being of pure flame, crackling with destructive energy.", abilities: [{ name: "Inferno", desc: "A wave of searing flame!", chance: 18, effect: "double_dmg" }, { name: "Heat Wave", desc: "The intensity overwhelms you!", chance: 15, effect: "armor_break" }] },
  { name: "Giant Spider", icon: Skull, hp: 16, hpVariance: 4, atk: 5, def: 2, atkVariance: 3, xp: 18, gold: 6, level: 2, evasion: 20, accuracy: 70, lootTable: [{ item: "Silk Web", weight: 55, qty: 1 }, { item: "Spider Venom", weight: 25, qty: 1 }, { item: "Chitin Fragment", weight: 20, qty: 1 }], flavor: "A giant spider drops from above!", description: "A many-legged nightmare that traps its prey.", abilities: [{ name: "Web Shot", desc: "Sticky webbing slows you down!", chance: 22, effect: "stun" }] },
  { name: "Ancient Warden", icon: Award, hp: 55, hpVariance: 10, atk: 6, def: 6, atkVariance: 3, xp: 45, gold: 25, level: 5, evasion: 5, accuracy: 70, lootTable: [{ item: "Ancient Relic", weight: 20, qty: 1 }, { item: "Warden Plate", weight: 30, qty: 1 }, { item: "Runic Stone", weight: 35, qty: 1 }, { item: "Gold Bar", weight: 15, qty: 1 }], flavor: "A towering guardian of the old world stirs.", description: "An ancient construct tasked with guarding forgotten halls.", abilities: [{ name: "Guardian Strike", desc: "A calculated crushing blow!", chance: 20, effect: "double_dmg" }, { name: "Fortify", desc: "Its defenses shift!", chance: 15, effect: "heal" }, { name: "Stomp", desc: "The earth trembles!", chance: 10, effect: "stun" }] },
];

interface CombatState {
  active: boolean;
  enemy: EnemyDef;
  enemyHp: number;
  enemyMaxHp: number;
  enemyAtk: number;
  enemyDef: number;
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

function CombatSkillDisplay({ character }: { character: CharacterWithSkills }) {
  const combatSkill = character.skills?.find((s) => s.name === "Combat");
  if (!combatSkill) return <p className="text-slate-600">No combat skill</p>;
  const currentLevel = combatSkill.level;
  const xp = combatSkill.experience || 0;
  const xpForCurrent = xpForLevel(currentLevel);
  const xpForNext = xpForLevel(Math.min(currentLevel + 1, MAX_SKILL_LEVEL));
  const xpIntoLevel = xp - xpForCurrent;
  const xpGap = xpForNext - xpForCurrent;
  const xpPercent = xpGap > 0 ? Math.min((xpIntoLevel / xpGap) * 100, 100) : 100;
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-slate-300 text-sm font-medium">Combat</span>
        <span className="text-slate-500 text-sm">Level {currentLevel} / {MAX_SKILL_LEVEL}</span>
      </div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-slate-500 text-xs tabular-nums">{xpIntoLevel.toLocaleString()} / {xpGap.toLocaleString()} XP</span>
      </div>
      <div className="w-full bg-slate-900/60 rounded-full h-2">
        <div className="bg-[#4a9e6a] h-2 rounded-full transition-all duration-300" style={{ width: xpPercent + "%" }} />
      </div>
    </div>
  );
}

function getHitChance(attackerAcc: number, defenderEva: number, stance: string): number {
  let stanceMod = 0;
  if (stance === "aggressive") stanceMod = -10;
  else if (stance === "defensive") stanceMod = 15;
  return Math.min(95, Math.max(20, attackerAcc - defenderEva + stanceMod));
}

export default function CombatPage() {
  const { character, refreshCharacter } = useGame();
  const [combat, setCombat] = useState<CombatState | null>(null);
  const [enemyPool, setEnemyPool] = useState<EnemyDef[]>(() => {
    return enemies.filter((e) => e.level <= 5);
  });

  useEffect(() => {
    document.title = "Combat — TribalMMO";
  }, []);

  if (!character) {
    return <div className="text-slate-500 text-center mt-20">Create a character first.</div>;
  }

  const effectiveStats = computeEffectiveStats(character, character.inventory, character.clan?.clan, character.pets);

  const startCombat = async (stance: "aggressive" | "defensive" | "balanced") => {
    const staminaCost = 10;
    if (character.computed_stamina < staminaCost) return;
    const { error } = await supabase.rpc("deduct_stamina", {
      p_character_id: character.id,
      p_amount: staminaCost,
    });
    if (error) return;
    await refreshCharacter();
    const enemy = pick(enemies.filter((e) => e.level <= Math.max(1, Math.ceil(effectiveStats.attack / 3))));
    const hpRoll = enemy.hp + rangeInt(-enemy.hpVariance, enemy.hpVariance);
    const atkRoll = enemy.atk + rangeInt(-enemy.atkVariance, enemy.atkVariance);
    const playerHp = 20 + effectiveStats.vitality * 3;
    setCombat({
      active: true,
      enemy,
      enemyHp: hpRoll,
      enemyMaxHp: hpRoll,
      enemyAtk: Math.max(1, atkRoll),
      enemyDef: enemy.def,
      playerHp,
      maxPlayerHp: playerHp,
      stance,
      log: [{ text: `${enemy.name} appears (lvl ${enemy.level})! (-${staminaCost} stamina)`, type: "system" }],
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

    const hitChance = getHitChance(combat.enemy.accuracy, effectiveStats.speed, stance);
    enemyHit = chance(hitChance);
    if (!enemyHit) {
      newLog.push({ text: `You dodge the ${combat.enemy.name}'s attack!`, type: "player" });
    }

    const acc = 55 + effectiveStats.speed * 1.5;
    const playerHitChance = getHitChance(acc, combat.enemy.evasion, stance);
    playerHit = chance(playerHitChance);
    enemyDodged = !playerHit && chance(combat.enemy.evasion);

    if (enemyDodged) {
      newLog.push({ text: `The ${combat.enemy.name} dodges your attack!`, type: "enemy" });
    }

    let playerDmg = 0;
    let enemyDmg = 0;
    let newEnemyHp = combat.enemyHp;
    let newPlayerHp = combat.playerHp;

    if (playerHit && !enemyDodged) {
      const rawDmg = rollDice(1, 6, effectiveStats.attack - combat.enemyDef);
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
      newLog.push({ text: `You defeated the ${combat.enemy.name}!`, type: "system" });
      const lootRolled = rollLoot(combat.enemy);
      if (lootRolled.length > 0) {
        newLog.push({ text: `Loot: ${lootRolled.map((l) => `${l.qty}x ${l.item}`).join(", ")}`, type: "loot" });
      }
      setCombat({
        ...combat,
        enemyHp: 0,
        log: newLog,
        active: false,
        result: "won",
        loot: lootRolled,
        totalDmgDealt: combat.totalDmgDealt + playerDmg,
        turns: combat.turns + 1,
      });
      return;
    }

    if (enemyHit) {
      const rawDmg = rollDice(1, 4, combat.enemyAtk - Math.floor(effectiveStats.defense / 2));
      enemyCrit = rawDmg.critical || chance(10);
      const stanceDmgMod = stance === "defensive" ? 0.6 : stance === "aggressive" ? 1.2 : 1.0;

      let abilityActivated = false;
      for (const ability of combat.enemy.abilities) {
        if (chance(ability.chance)) {
          let abilityDmg = Math.max(1, Math.floor(rawDmg.total * stanceDmgMod));
          if (ability.effect === "double_dmg") {
            abilityDmg = Math.floor(abilityDmg * 2);
            newLog.push({ text: `${combat.enemy.name} uses ${ability.name}! ${ability.desc} (-${abilityDmg} HP)`, type: "enemy" });
          } else if (ability.effect === "armor_break") {
            abilityDmg = Math.floor(abilityDmg * 1.5);
            newLog.push({ text: `${combat.enemy.name} uses ${ability.name}! ${ability.desc} (-${abilityDmg} HP)`, type: "enemy" });
          } else if (ability.effect === "heal") {
            const healAmt = rangeInt(3, 8);
            newEnemyHp = Math.min(combat.enemyMaxHp, newEnemyHp + healAmt);
            newLog.push({ text: `${combat.enemy.name} uses ${ability.name}! ${ability.desc} (+${healAmt} HP)`, type: "enemy" });
          } else if (ability.effect === "stun") {
            abilityDmg = Math.max(1, Math.floor(rawDmg.total * stanceDmgMod));
            newLog.push({ text: `${combat.enemy.name} uses ${ability.name}! ${ability.desc} (-${abilityDmg} HP)`, type: "enemy" });
          } else if (ability.effect === "berserk") {
            combat.enemyAtk = Math.floor(combat.enemyAtk * 1.5);
            abilityDmg = Math.max(1, Math.floor(rawDmg.total * stanceDmgMod * 1.5));
            newLog.push({ text: `${combat.enemy.name} goes BERSERK! (-${abilityDmg} HP)`, type: "enemy" });
          }
          enemyDmg = abilityDmg;
          abilityActivated = true;
          break;
        }
      }

      if (!abilityActivated) {
        enemyDmg = Math.max(1, Math.floor(rawDmg.total * stanceDmgMod));
        if (enemyCrit) {
          enemyDmg = Math.floor(enemyDmg * 1.5);
          newLog.push({ text: `${combat.enemy.name} lands a vicious hit for ${enemyDmg}!`, type: "critical" });
        } else {
          newLog.push({ text: `${combat.enemy.name} strikes for ${enemyDmg}.`, type: "enemy" });
        }
      }

      newPlayerHp -= enemyDmg;
    }

    if (newPlayerHp <= 0) {
      setCombat({
        ...combat,
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
      enemyHp: newEnemyHp,
      playerHp: newPlayerHp,
      log: newLog,
      totalDmgDealt: combat.totalDmgDealt + playerDmg,
      totalDmgTaken: combat.totalDmgTaken + enemyDmg,
      turns: combat.turns + 1,
    });
  };

  const rollLoot = (enemy: EnemyDef): { item: string; qty: number }[] => {
    const drops: { item: string; qty: number }[] = [];
    const rolls = 1 + (chance(25) ? 1 : 0);
    for (let i = 0; i < rolls; i++) {
      if (chance(65)) {
        const picked = weightedPick(enemy.lootTable.map((l) => ({ ...l, weight: l.weight })));
        if (picked) drops.push({ item: picked.item, qty: picked.qty + rangeInt(0, 1) });
      }
    }
    return drops;
  };

  const applyLoot = async () => {
    if (!combat || !character) return;
    for (const drop of combat.loot) {
      await supabase.rpc("give_item", {
        p_character_id: character.id,
        p_item_name: drop.item,
        p_quantity: drop.qty,
      });
    }
  };

  const flee = () => {
    if (!combat) return;
    const success = chance(30 + effectiveStats.speed * 3);
    if (success) {
      setCombat({ ...combat, log: [...combat.log, { text: "You fled into the wilderness!", type: "system" }], active: false, result: null });
    } else {
      const rawDmg = rollDice(1, 4, combat.enemyAtk - Math.floor(effectiveStats.defense / 2));
      const enemyDmg = Math.max(1, rawDmg.total);
      const newPlayerHp = Math.max(0, combat.playerHp - enemyDmg);
      setCombat({
        ...combat,
        playerHp: newPlayerHp,
        log: [...combat.log, { text: `Failed to flee! The ${combat.enemy.name} hits you for ${enemyDmg}!`, type: "enemy" }],
        active: false,
        result: newPlayerHp <= 0 ? "lost" : null,
        totalDmgTaken: combat.totalDmgTaken + enemyDmg,
      });
    }
  };

  const endCombat = async () => {
    if (!combat) return;
    if (combat.result === "won") {
      await applyLoot();
      const { data: reward, error } = await supabase.rpc("resolve_combat_win", {
        p_character_id: character.id,
        p_xp_reward: combat.enemy.xp + rangeInt(0, 5),
      });
      if (!error && reward) {
        const result = reward as { xp: number; gold: number };
        setCombat({
          ...combat,
          log: [...combat.log, { text: `+${result.xp} XP, +${result.gold} gold, ${combat.turns} turns`, type: "system" }],
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
                  <combat.enemy.icon size={24} className="text-[#b83a3a]" />
                </div>
                <div className="text-slate-600 text-[11px] uppercase font-bold tracking-wider">Enemy (lvl {combat.enemy.level})</div>
                <div className="text-lg font-bold text-slate-100 mb-3">{combat.enemy.name}</div>
                <div className="w-full bg-slate-900/80 rounded-full h-3">
                  <div className="bg-[#b83a3a] h-3 rounded-full transition-all duration-300" style={{ width: (combat.enemyHp / combat.enemyMaxHp) * 100 + "%" }} />
                </div>
                <div className="text-slate-500 text-xs mt-1.5 flex items-center justify-center gap-1 tabular-nums">
                  <Heart size={12} /> {combat.enemyHp} / {combat.enemyMaxHp}
                </div>
                <div className="text-slate-600 text-[10px] mt-1">ATK {combat.enemyAtk} DEF {combat.enemyDef}</div>
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
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {enemies.map((enemy, i) => {
                const Icon = enemy.icon;
                return (
                  <div key={i} className="bg-slate-900/40 rounded-lg p-3 text-center border border-slate-800/20 group hover:border-slate-700/40 transition-all cursor-default">
                    <Icon size={20} className="text-slate-500 mx-auto mb-1" />
                    <div className="text-slate-200 text-sm font-medium mt-1">{enemy.name}</div>
                    <div className="text-slate-600 text-xs">Lvl {enemy.level} &middot; HP {enemy.hp} &middot; ATK {enemy.atk}</div>
                    <div className="text-slate-700 text-[10px] mt-1 opacity-0 group-hover:opacity-100 transition-opacity">{enemy.description}</div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="card text-center py-6">
            <Swords size={36} className="text-slate-800 mx-auto mb-3" />
            <p className="text-slate-500 mb-5">Choose your stance and seek out enemies in the wilderness.</p>
          </div>

          <div className="card">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Combat Skill</h2>
            <CombatSkillDisplay character={character} />
          </div>
        </div>
      )}
    </div>
  );
}
