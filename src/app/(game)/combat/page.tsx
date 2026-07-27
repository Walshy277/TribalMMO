"use client";

import { useEffect } from "react";
import { useGame, type CharacterWithSkills } from "@/lib/game";
import { useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Swords, Shield, Heart, Dumbbell, Zap, Trophy, Footprints } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { computeEffectiveStats } from "@/lib/stats";

interface EnemyDef {
  name: string;
  icon: LucideIcon;
  hp: number;
  atk: number;
  def: number;
  xp: number;
  flavor: string;
}

const enemies: EnemyDef[] = [
  { name: "Wild Boar", icon: Shield, hp: 15, atk: 3, def: 1, xp: 10, flavor: "It charges with tusks bared!" },
  { name: "Angry Wolf", icon: Shield, hp: 20, atk: 4, def: 2, xp: 15, flavor: "It snarls and circles you." },
  { name: "Forest Bear", icon: Shield, hp: 35, atk: 6, def: 3, xp: 25, flavor: "A massive bear blocks your path." },
  { name: "Rival Scout", icon: Swords, hp: 18, atk: 5, def: 2, xp: 20, flavor: "A rival clan scout challenges you." },
  { name: "River Serpent", icon: Shield, hp: 12, atk: 3, def: 1, xp: 12, flavor: "A serpent lunges from the water!" },
  { name: "Stone Golem", icon: Shield, hp: 40, atk: 4, def: 5, xp: 30, flavor: "An ancient golem awakens." },
];

interface CombatState {
  active: boolean;
  enemy: EnemyDef;
  enemyHp: number;
  playerHp: number;
  maxPlayerHp: number;
  log: { text: string; type: "player" | "enemy" | "system" }[];
  result: "won" | "lost" | null;
}

function CombatSkillDisplay({ character }: { character: CharacterWithSkills }) {
  const combatSkill = character.skills?.find((s) => s.name === "Combat");
  if (!combatSkill) return <p className="text-tribal-600">No combat skill</p>;

  return (
    <div>
      <div className="flex items-center justify-between">
        <span className="text-tribal-300 text-sm font-medium">Combat</span>
        <span className="text-tribal-500 text-sm">Tier {combatSkill.tier}</span>
      </div>
    </div>
  );
}

export default function CombatPage() {
  const { character, refreshCharacter } = useGame();
  const [combat, setCombat] = useState<CombatState | null>(null);

  useEffect(() => {
    document.title = "Combat — TribalMMO";
  }, []);

  if (!character) {
    return <div className="text-tribal-500 text-center mt-20">Create a character first.</div>;
  }

  const effectiveStats = computeEffectiveStats(character, character.inventory, character.clan?.clan, character.pets);

  const startCombat = () => {
    const enemy = enemies[Math.floor(Math.random() * enemies.length)];
    const playerHp = 20 + effectiveStats.endurance * 3;
    setCombat({
      active: true,
      enemy,
      enemyHp: enemy.hp,
      playerHp,
      maxPlayerHp: playerHp,
      log: [{ text: `${enemy.name} appears! ${enemy.flavor}`, type: "system" }],
      result: null,
    });
  };

  const playerAttack = () => {
    if (!combat || !combat.active) return;

    const dmg = Math.max(1, effectiveStats.attack - combat.enemy.def + Math.floor(Math.random() * 3));
    const newEnemyHp = combat.enemyHp - dmg;
    const log = [...combat.log, { text: `You strike for ${dmg} damage!`, type: "player" as const }];

    if (newEnemyHp <= 0) {
      setCombat({ ...combat, enemyHp: 0, log: [...log, { text: `You defeated the ${combat.enemy.name}!`, type: "system" }], active: false, result: "won" });
      return;
    }

    const enemyDmg = Math.max(1, combat.enemy.atk - Math.floor(effectiveStats.defense / 2) + Math.floor(Math.random() * 2));
    const newPlayerHp = combat.playerHp - enemyDmg;

    if (newPlayerHp <= 0) {
      setCombat({ ...combat, enemyHp: newEnemyHp, playerHp: 0, log: [...log, { text: `The ${combat.enemy.name} strikes for ${enemyDmg}! You fall...`, type: "enemy" }], active: false, result: "lost" });
      return;
    }

    setCombat({ ...combat, enemyHp: newEnemyHp, playerHp: newPlayerHp, log: [...log, { text: `The ${combat.enemy.name} strikes for ${enemyDmg}!`, type: "enemy" }] });
  };

  const flee = () => {
    if (!combat) return;
    const success = Math.random() < 0.5 + (effectiveStats.agility * 0.05);
    if (success) {
      setCombat({ ...combat, log: [...combat.log, { text: "You fled into the wilderness!", type: "system" }], active: false, result: null });
    } else {
      const enemyDmg = Math.max(1, combat.enemy.atk - Math.floor(effectiveStats.defense / 2));
      const newPlayerHp = Math.max(0, combat.playerHp - enemyDmg);
      setCombat({
        ...combat,
        playerHp: newPlayerHp,
        log: [...combat.log, { text: `Failed to flee! The ${combat.enemy.name} hits you for ${enemyDmg}!`, type: "enemy" }],
        active: false,
        result: newPlayerHp <= 0 ? "lost" : null,
      });
    }
  };

  const endCombat = async () => {
    if (!combat) return;

    if (combat.result === "won") {
      const skill = character.skills?.find((s) => s.name === "Combat");
      if (skill) {
        const { error } = await supabase
          .from("skills")
          .update({ experience: skill.experience + combat.enemy.xp })
          .eq("id", skill.id);
        if (error) console.error("Failed to update skill:", error);
      }
      await refreshCharacter();
    } else if (combat.result === "lost") {
      const newStamina = Math.max(0, character.computed_stamina - 15);
      const { error } = await supabase
        .from("characters")
        .update({ stamina: newStamina })
        .eq("id", character.id);
      if (error) console.error("Failed to update stamina:", error);
      await refreshCharacter();
    }

    setCombat(null);
  };

  return (
    <div className="space-y-5 animate-fade-in max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-tribal-100">Combat</h1>
        <p className="text-tribal-500 text-sm mt-0.5">Test your strength against the wild</p>
      </div>

      {combat ? (
        <div className="space-y-4">
          <div className="card">
            <div className="grid grid-cols-2 gap-6">
              <div className="text-center">
                <div className="w-14 h-14 mx-auto rounded-full bg-[#122a1b] border border-[#2d6e44] flex items-center justify-center mb-2">
                  <Swords size={24} className="text-[#4a9e6a]" />
                </div>
                <div className="text-tribal-600 text-[11px] uppercase font-bold tracking-wider">You</div>
                <div className="text-lg font-bold text-tribal-100 mb-3">{character.name}</div>
                <div className="w-full bg-tribal-900/80 rounded-full h-3">
                  <div
                    className="bg-[#3d8b5c] h-3 rounded-full transition-all duration-300"
                    style={{ width: `${(combat.playerHp / combat.maxPlayerHp) * 100}%` }}
                  />
                </div>
                <div className="text-tribal-500 text-xs mt-1.5 flex items-center justify-center gap-1 tabular-nums">
                  <Heart size={12} /> {combat.playerHp} / {combat.maxPlayerHp}
                </div>
              </div>

              <div className="text-center">
                <div className="w-14 h-14 mx-auto rounded-full bg-[#2a1414] border border-[#6e2424] flex items-center justify-center mb-2">
                  <combat.enemy.icon size={24} className="text-[#b83a3a]" />
                </div>
                <div className="text-tribal-600 text-[11px] uppercase font-bold tracking-wider">Enemy</div>
                <div className="text-lg font-bold text-tribal-100 mb-3">{combat.enemy.name}</div>
                <div className="w-full bg-tribal-900/80 rounded-full h-3">
                  <div
                    className="bg-[#b83a3a] h-3 rounded-full transition-all duration-300"
                    style={{ width: `${(combat.enemyHp / combat.enemy.hp) * 100}%` }}
                  />
                </div>
                <div className="text-tribal-500 text-xs mt-1.5 flex items-center justify-center gap-1 tabular-nums">
                  <Heart size={12} /> {combat.enemyHp} / {combat.enemy.hp}
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <h2 className="text-xs font-bold text-tribal-400 uppercase tracking-widest mb-2">Battle Log</h2>
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {combat.log.map((entry, i) => (
                <p
                  key={i}
                  className={`text-sm py-1 ${
                    entry.type === "player" ? "text-[#4a9e6a]" :
                    entry.type === "enemy" ? "text-[#b83a3a]" :
                    "text-tribal-300"
                  }`}
                >
                  {entry.text}
                </p>
              ))}
            </div>
          </div>

          {combat.active ? (
            <div className="flex gap-3">
              <Button variant="danger" className="flex-1" size="lg" icon={<Swords size={18} />} onClick={playerAttack}>
                Attack
              </Button>
              <Button variant="secondary" className="flex-1" size="lg" icon={<Footprints size={18} />} onClick={flee}>
                Flee
              </Button>
            </div>
          ) : (
            <Button variant={combat.result === "won" ? "success" : "secondary"} className="w-full" size="lg" icon={combat.result === "won" ? <Trophy size={18} /> : <Footprints size={18} />} onClick={endCombat}>
              {combat.result === "won" ? "Collect Reward" :
               combat.result === "lost" ? "Recover" : "Continue"}
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-5">
          <div className="card">
            <h2 className="text-xs font-bold text-tribal-400 uppercase tracking-widest mb-4">Your Combat Stats</h2>
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: "STR", base: character.strength, value: effectiveStats.strength, icon: Dumbbell, color: "text-[#b83a3a]" },
                { label: "AGI", base: character.agility, value: effectiveStats.agility, icon: Zap, color: "text-[#4a9e6a]" },
                { label: "END", base: character.endurance, value: effectiveStats.endurance, icon: Shield, color: "text-tribal-300" },
                { label: "ATK", value: effectiveStats.attack, icon: Swords, color: "text-[#b83a3a]" },
                { label: "DEF", value: effectiveStats.defense, icon: Shield, color: "text-tribal-300" },
              ].map((stat) => {
                const Icon = stat.icon;
                return (
                  <div key={stat.label} className="text-center bg-tribal-900/40 rounded-lg p-4 border border-tribal-800/20">
                    <Icon size={22} className={`mx-auto mb-1 ${stat.color}`} />
                    <div className="text-tribal-600 text-[11px] uppercase font-bold">{stat.label}</div>
                    <div className={`text-2xl font-bold mt-1 ${stat.color}`}>{stat.value}</div>
                    {"base" in stat && stat.base !== stat.value && (
                      <div className="text-tribal-700 text-xs">({stat.base})</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="card">
            <h2 className="text-xs font-bold text-tribal-400 uppercase tracking-widest mb-4">Enemies in the Wild</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {enemies.map((enemy, i) => {
                const Icon = enemy.icon;
                return (
                  <div key={i} className="bg-tribal-900/40 rounded-lg p-3 text-center border border-tribal-800/20">
                    <Icon size={20} className="text-tribal-500 mx-auto mb-1" />
                    <div className="text-tribal-200 text-sm font-medium mt-1">{enemy.name}</div>
                    <div className="text-tribal-600 text-xs">HP {enemy.hp} · ATK {enemy.atk}</div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="card text-center py-8">
            <Swords size={36} className="text-tribal-800 mx-auto mb-3" />
            <p className="text-tribal-500 mb-5">Seek out enemies in the wilderness to test your strength.</p>
            <Button variant="primary" size="lg" icon={<Swords size={18} />} onClick={startCombat}>
              Search for Enemies
            </Button>
          </div>

          <div className="card">
            <h2 className="text-xs font-bold text-tribal-400 uppercase tracking-widest mb-2">Combat Skill</h2>
            <CombatSkillDisplay character={character} />
          </div>
        </div>
      )}
    </div>
  );
}
