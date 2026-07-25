"use client";

import { useGame } from "@/lib/game";
import { useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Swords, Shield, Heart, Dumbbell, Zap, Trophy, Skull, Map, Target } from "lucide-react";
import type { LucideIcon } from "lucide-react";

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
  { name: "Wild Boar", icon: Skull, hp: 15, atk: 3, def: 1, xp: 10, flavor: "It charges with tusks bared!" },
  { name: "Angry Wolf", icon: Skull, hp: 20, atk: 4, def: 2, xp: 15, flavor: "It snarls and circles you." },
  { name: "Forest Bear", icon: Skull, hp: 35, atk: 6, def: 3, xp: 25, flavor: "A massive bear blocks your path." },
  { name: "Rival Scout", icon: Swords, hp: 18, atk: 5, def: 2, xp: 20, flavor: "A rival faction scout challenges you." },
  { name: "River Serpent", icon: Skull, hp: 12, atk: 3, def: 1, xp: 12, flavor: "A serpent lunges from the water!" },
  { name: "Stone Golem", icon: Skull, hp: 40, atk: 4, def: 5, xp: 30, flavor: "An ancient golem awakens." },
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

export default function CombatPage() {
  const { character, refreshCharacter } = useGame();
  const [combat, setCombat] = useState<CombatState | null>(null);

  if (!character) {
    return <div className="text-tribal-500 text-center mt-20">Create a character first.</div>;
  }

  const startCombat = () => {
    const enemy = enemies[Math.floor(Math.random() * enemies.length)];
    const playerHp = 20 + character.endurance * 3;
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

    const dmg = Math.max(1, character.strength + character.agility - combat.enemy.def + Math.floor(Math.random() * 3));
    const newEnemyHp = combat.enemyHp - dmg;
    const log = [...combat.log, { text: `You strike for ${dmg} damage!`, type: "player" as const }];

    if (newEnemyHp <= 0) {
      setCombat({ ...combat, enemyHp: 0, log: [...log, { text: `You defeated the ${combat.enemy.name}!`, type: "system" }], active: false, result: "won" });
      return;
    }

    const enemyDmg = Math.max(1, combat.enemy.atk - Math.floor(character.endurance / 2) + Math.floor(Math.random() * 2));
    const newPlayerHp = combat.playerHp - enemyDmg;

    if (newPlayerHp <= 0) {
      setCombat({ ...combat, enemyHp: newEnemyHp, playerHp: 0, log: [...log, { text: `The ${combat.enemy.name} strikes for ${enemyDmg}! You fall...`, type: "enemy" }], active: false, result: "lost" });
      return;
    }

    setCombat({ ...combat, enemyHp: newEnemyHp, playerHp: newPlayerHp, log: [...log, { text: `The ${combat.enemy.name} strikes for ${enemyDmg}!`, type: "enemy" }] });
  };

  const flee = () => {
    if (!combat) return;
    const success = Math.random() < 0.5 + (character.agility * 0.05);
    if (success) {
      setCombat({ ...combat, log: [...combat.log, { text: "You fled into the wilderness!", type: "system" }], active: false, result: null });
    } else {
      const enemyDmg = Math.max(1, combat.enemy.atk - Math.floor(character.endurance / 2));
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
      const skill = character.skills?.find((s: any) => s.name === "Combat");
      if (skill) {
        await supabase
          .from("skills")
          .update({ experience: skill.experience + combat.enemy.xp })
          .eq("id", skill.id);
      }
      await refreshCharacter();
    } else if (combat.result === "lost") {
      const newStamina = Math.max(0, character.stamina - 15);
      await supabase
        .from("characters")
        .update({ stamina: newStamina })
        .eq("id", character.id);
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
          {/* Combat Arena */}
          <div className="card">
            <div className="grid grid-cols-2 gap-6">
              {/* Player */}
              <div className="text-center">
                <div className="w-14 h-14 mx-auto rounded-full bg-tribal-800 border border-tribal-700/50 flex items-center justify-center mb-2">
                  <Swords size={24} className="text-green-400" />
                </div>
                <div className="text-tribal-500 text-xs uppercase">You</div>
                <div className="text-lg font-bold text-tribal-100 mb-3">{character.name}</div>
                <div className="w-full bg-tribal-800 rounded-full h-3">
                  <div
                    className="bg-green-500 h-3 rounded-full transition-all duration-300"
                    style={{ width: `${(combat.playerHp / combat.maxPlayerHp) * 100}%` }}
                  />
                </div>
                <div className="text-tribal-400 text-xs mt-1.5 flex items-center justify-center gap-1">
                  <Heart size={12} /> {combat.playerHp} / {combat.maxPlayerHp}
                </div>
              </div>

              {/* Enemy */}
              <div className="text-center">
                <div className="w-14 h-14 mx-auto rounded-full bg-red-950/50 border border-red-900/40 flex items-center justify-center mb-2">
                  <combat.enemy.icon size={24} className="text-red-400" />
                </div>
                <div className="text-tribal-500 text-xs uppercase">Enemy</div>
                <div className="text-lg font-bold text-tribal-100 mb-3">{combat.enemy.name}</div>
                <div className="w-full bg-tribal-800 rounded-full h-3">
                  <div
                    className="bg-red-500 h-3 rounded-full transition-all duration-300"
                    style={{ width: `${(combat.enemyHp / combat.enemy.hp) * 100}%` }}
                  />
                </div>
                <div className="text-tribal-400 text-xs mt-1.5 flex items-center justify-center gap-1">
                  <Heart size={12} /> {combat.enemyHp} / {combat.enemy.hp}
                </div>
              </div>
            </div>
          </div>

          {/* Combat Log */}
          <div className="card">
            <h2 className="text-sm font-semibold text-tribal-400 uppercase tracking-wider mb-2">Battle Log</h2>
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {combat.log.map((entry, i) => (
                <p
                  key={i}
                  className={`text-sm py-1 ${
                    entry.type === "player" ? "text-green-400" :
                    entry.type === "enemy" ? "text-red-400" :
                    "text-tribal-300"
                  }`}
                >
                  {entry.text}
                </p>
              ))}
            </div>
          </div>

          {/* Actions */}
          {combat.active ? (
            <div className="flex gap-3">
              <Button variant="danger" className="flex-1" size="lg" icon={<Swords size={18} />} onClick={playerAttack}>
                Attack
              </Button>
              <Button variant="secondary" className="flex-1" size="lg" icon={<Map size={18} />} onClick={flee}>
                Flee
              </Button>
            </div>
          ) : (
            <Button variant={combat.result === "won" ? "success" : "secondary"} className="w-full" size="lg" icon={combat.result === "won" ? <Trophy size={18} /> : <Map size={18} />} onClick={endCombat}>
              {combat.result === "won" ? `Collect Reward (+${combat.enemy.xp} XP)` :
               combat.result === "lost" ? "Recover" : "Continue"}
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-5">
          {/* Stats */}
          <div className="card">
            <h2 className="text-sm font-semibold text-tribal-400 uppercase tracking-wider mb-4">Your Combat Stats</h2>
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: "Strength", value: character.strength, icon: Dumbbell, color: "text-red-400" },
                { label: "Agility", value: character.agility, icon: Zap, color: "text-green-400" },
                { label: "Endurance", value: character.endurance, icon: Shield, color: "text-yellow-400" },
              ].map((stat) => {
                const Icon = stat.icon;
                return (
                  <div key={stat.label} className="text-center bg-tribal-900/50 rounded-lg p-4">
                    <Icon size={22} className={`mx-auto mb-1 ${stat.color}`} />
                    <div className="text-tribal-500 text-xs uppercase">{stat.label}</div>
                    <div className={`text-2xl font-bold mt-1 ${stat.color}`}>{stat.value}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Enemy Preview */}
          <div className="card">
            <h2 className="text-sm font-semibold text-tribal-400 uppercase tracking-wider mb-4">Enemies in the Wild</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {enemies.map((enemy, i) => {
                const Icon = enemy.icon;
                return (
                  <div key={i} className="bg-tribal-900/50 rounded-lg p-3 text-center">
                    <Icon size={20} className="text-tribal-400 mx-auto mb-1" />
                    <div className="text-tribal-200 text-sm font-medium mt-1">{enemy.name}</div>
                    <div className="text-tribal-500 text-xs">HP {enemy.hp} · ATK {enemy.atk}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Start Combat */}
          <div className="card text-center py-8">
            <Swords size={36} className="text-tribal-600 mx-auto mb-3" />
            <p className="text-tribal-400 mb-5">Seek out enemies in the wilderness to test your strength.</p>
            <Button variant="primary" size="lg" icon={<Swords size={18} />} onClick={startCombat}>
              Search for Enemies
            </Button>
          </div>

          {/* Combat Skill */}
          <div className="card">
            <h2 className="text-sm font-semibold text-tribal-400 uppercase tracking-wider mb-2">Combat Skill</h2>
            {character.skills?.find((s: any) => s.name === "Combat") ? (
              <div className="flex items-center justify-between">
                <span className="text-tribal-300">Tier {character.skills.find((s: any) => s.name === "Combat")?.tier}</span>
                <span className="text-tribal-100 font-bold">{character.skills.find((s: any) => s.name === "Combat")?.experience} XP</span>
              </div>
            ) : (
              <p className="text-tribal-500">No combat skill</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
