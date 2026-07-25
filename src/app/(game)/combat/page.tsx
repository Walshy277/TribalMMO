"use client";

import { useGame } from "@/lib/game";
import { useState } from "react";
import { supabase } from "@/lib/supabase/client";

const enemies = [
  { name: "Wild Boar", icon: "🐗", hp: 15, atk: 3, def: 1, xp: 10, flavor: "It charges with tusks bared!" },
  { name: "Angry Wolf", icon: "🐺", hp: 20, atk: 4, def: 2, xp: 15, flavor: "It snarls and circles you." },
  { name: "Forest Bear", icon: "🐻", hp: 35, atk: 6, def: 3, xp: 25, flavor: "A massive bear blocks your path." },
  { name: "Rival Scout", icon: "🗡️", hp: 18, atk: 5, def: 2, xp: 20, flavor: "A rival faction scout challenges you." },
  { name: "River Serpent", icon: "🐍", hp: 12, atk: 3, def: 1, xp: 12, flavor: "A serpent lunges from the water!" },
  { name: "Stone Golem", icon: "🗿", hp: 40, atk: 4, def: 5, xp: 30, flavor: "An ancient golem awakens." },
];

interface CombatState {
  active: boolean;
  enemy: typeof enemies[0];
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
                <div className="text-5xl mb-2">👤</div>
                <div className="text-tribal-500 text-xs uppercase">You</div>
                <div className="text-lg font-bold text-tribal-100 mb-3">{character.name}</div>
                <div className="w-full bg-tribal-800 rounded-full h-3">
                  <div
                    className="bg-green-500 h-3 rounded-full transition-all duration-300"
                    style={{ width: `${(combat.playerHp / combat.maxPlayerHp) * 100}%` }}
                  />
                </div>
                <div className="text-tribal-400 text-xs mt-1.5">{combat.playerHp} / {combat.maxPlayerHp} HP</div>
              </div>

              {/* Enemy */}
              <div className="text-center">
                <div className="text-5xl mb-2">{combat.enemy.icon}</div>
                <div className="text-tribal-500 text-xs uppercase">Enemy</div>
                <div className="text-lg font-bold text-tribal-100 mb-3">{combat.enemy.name}</div>
                <div className="w-full bg-tribal-800 rounded-full h-3">
                  <div
                    className="bg-red-500 h-3 rounded-full transition-all duration-300"
                    style={{ width: `${(combat.enemyHp / combat.enemy.hp) * 100}%` }}
                  />
                </div>
                <div className="text-tribal-400 text-xs mt-1.5">{combat.enemyHp} / {combat.enemy.hp} HP</div>
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
              <button onClick={playerAttack} className="flex-1 bg-red-700 hover:bg-red-600 text-white font-bold py-3 rounded-lg transition-colors text-base">
                ⚔️ Attack
              </button>
              <button onClick={flee} className="flex-1 btn-secondary py-3 text-base">
                🏃 Flee
              </button>
            </div>
          ) : (
            <button onClick={endCombat} className="btn-primary w-full py-3 text-base">
              {combat.result === "won" ? `🏆 Collect Reward (+${combat.enemy.xp} XP)` :
               combat.result === "lost" ? "💀 Recover" : "🗺️ Continue"}
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-5">
          {/* Stats */}
          <div className="card">
            <h2 className="text-sm font-semibold text-tribal-400 uppercase tracking-wider mb-4">Your Combat Stats</h2>
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: "Strength", value: character.strength, icon: "💪", color: "text-red-400" },
                { label: "Agility", value: character.agility, icon: "🏃", color: "text-green-400" },
                { label: "Endurance", value: character.endurance, icon: "🛡️", color: "text-yellow-400" },
              ].map((stat) => (
                <div key={stat.label} className="text-center bg-tribal-900/50 rounded-lg p-4">
                  <div className="text-2xl mb-1">{stat.icon}</div>
                  <div className="text-tribal-500 text-xs uppercase">{stat.label}</div>
                  <div className={`text-2xl font-bold mt-1 ${stat.color}`}>{stat.value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Enemy Preview */}
          <div className="card">
            <h2 className="text-sm font-semibold text-tribal-400 uppercase tracking-wider mb-4">Enemies in the Wild</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {enemies.map((enemy) => (
                <div key={enemy.name} className="bg-tribal-900/50 rounded-lg p-3 text-center">
                  <div className="text-2xl">{enemy.icon}</div>
                  <div className="text-tribal-200 text-sm font-medium mt-1">{enemy.name}</div>
                  <div className="text-tribal-500 text-xs">HP {enemy.hp} · ATK {enemy.atk}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Start Combat */}
          <div className="card text-center py-8">
            <div className="text-4xl mb-3">⚔️</div>
            <p className="text-tribal-400 mb-5">Seek out enemies in the wilderness to test your strength.</p>
            <button onClick={startCombat} className="btn-primary py-3 px-8 text-base">
              Search for Enemies
            </button>
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
