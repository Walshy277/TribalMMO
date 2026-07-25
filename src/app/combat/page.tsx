"use client";

import { useGame } from "@/lib/game";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase/client";

const enemies = [
  { name: "Wild Boar", hp: 15, atk: 3, def: 1, xp: 10 },
  { name: "Angry Wolf", hp: 20, atk: 4, def: 2, xp: 15 },
  { name: "Forest Bear", hp: 35, atk: 6, def: 3, xp: 25 },
  { name: "Rival Scout", hp: 18, atk: 5, def: 2, xp: 20 },
  { name: "River Serpent", hp: 12, atk: 3, def: 1, xp: 12 },
];

interface CombatState {
  active: boolean;
  enemy: typeof enemies[0];
  enemyHp: number;
  playerHp: number;
  maxPlayerHp: number;
  log: string[];
  result: "won" | "lost" | null;
}

export default function CombatPage() {
  const { character, refreshCharacter } = useGame();
  const [combat, setCombat] = useState<CombatState | null>(null);

  if (!character) {
    return <div className="text-tribal-400 text-center mt-20">Create a character first.</div>;
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
      log: [`A ${enemy.name} appears!`],
      result: null,
    });
  };

  const playerAttack = () => {
    if (!combat || !combat.active) return;

    const dmg = Math.max(1, character.strength + character.agility - combat.enemy.def + Math.floor(Math.random() * 3));
    const newEnemyHp = combat.enemyHp - dmg;

    const log = [...combat.log, `You strike for ${dmg} damage!`];

    if (newEnemyHp <= 0) {
      setCombat({ ...combat, enemyHp: 0, log: [...log, `You defeated the ${combat.enemy.name}!`], active: false, result: "won" });
      return;
    }

    // Enemy attacks
    const enemyDmg = Math.max(1, combat.enemy.atk - Math.floor(character.endurance / 2) + Math.floor(Math.random() * 2));
    const newPlayerHp = combat.playerHp - enemyDmg;

    if (newPlayerHp <= 0) {
      setCombat({ ...combat, enemyHp: newEnemyHp, playerHp: 0, log: [...log, `The ${combat.enemy.name} defeats you!`], active: false, result: "lost" });
      return;
    }

    setCombat({ ...combat, enemyHp: newEnemyHp, playerHp: newPlayerHp, log: [...log, `The ${combat.enemy.name} strikes for ${enemyDmg} damage!`] });
  };

  const flee = () => {
    if (!combat) return;
    const success = Math.random() < 0.5 + (character.agility * 0.05);
    if (success) {
      setCombat({ ...combat, log: [...combat.log, "You fled successfully!"], active: false, result: null });
    } else {
      const enemyDmg = Math.max(1, combat.enemy.atk - Math.floor(character.endurance / 2));
      const newPlayerHp = combat.playerHp - enemyDmg;
      setCombat({
        ...combat,
        playerHp: Math.max(0, newPlayerHp),
        log: [...combat.log, `Failed to flee! The ${combat.enemy.name} hits you for ${enemyDmg}!`],
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
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-tribal-100">Combat</h1>

      {combat ? (
        <div className="space-y-4">
          <div className="card">
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center">
                <div className="text-tribal-300 text-sm">You</div>
                <div className="text-lg font-bold text-tribal-100">{character.name}</div>
                <div className="w-full bg-tribal-800 rounded-full h-3 mt-2">
                  <div
                    className="bg-green-500 h-3 rounded-full"
                    style={{ width: `${(combat.playerHp / combat.maxPlayerHp) * 100}%` }}
                  />
                </div>
                <div className="text-tribal-400 text-xs mt-1">
                  {combat.playerHp} / {combat.maxPlayerHp}
                </div>
              </div>
              <div className="text-center">
                <div className="text-tribal-300 text-sm">Enemy</div>
                <div className="text-lg font-bold text-tribal-100">{combat.enemy.name}</div>
                <div className="w-full bg-tribal-800 rounded-full h-3 mt-2">
                  <div
                    className="bg-red-500 h-3 rounded-full"
                    style={{ width: `${(combat.enemyHp / combat.enemy.hp) * 100}%` }}
                  />
                </div>
                <div className="text-tribal-400 text-xs mt-1">
                  {combat.enemyHp} / {combat.enemy.hp}
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <h2 className="text-lg font-semibold text-tribal-200 mb-2">Combat Log</h2>
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {combat.log.map((entry, i) => (
                <p key={i} className="text-tribal-400 text-sm">{entry}</p>
              ))}
            </div>
          </div>

          {combat.active ? (
            <div className="flex gap-3">
              <button onClick={playerAttack} className="btn-primary">Attack</button>
              <button onClick={flee} className="btn-secondary">Flee</button>
            </div>
          ) : (
            <button onClick={endCombat} className="btn-primary">
              {combat.result === "won" ? `Collect Reward (+${combat.enemy.xp} XP)` : combat.result === "lost" ? "Recover" : "Continue"}
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="card">
            <h2 className="text-lg font-semibold text-tribal-200 mb-2">Combat Stats</h2>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-tribal-300 text-sm">Strength</div>
                <div className="text-xl font-bold text-tribal-100">{character.strength}</div>
              </div>
              <div>
                <div className="text-tribal-300 text-sm">Agility</div>
                <div className="text-xl font-bold text-tribal-100">{character.agility}</div>
              </div>
              <div>
                <div className="text-tribal-300 text-sm">Endurance</div>
                <div className="text-xl font-bold text-tribal-100">{character.endurance}</div>
              </div>
            </div>
          </div>

          <div className="card">
            <p className="text-tribal-400 mb-4">Seek out enemies in the wilderness to test your strength.</p>
            <button onClick={startCombat} className="btn-primary">
              Search for Enemies
            </button>
          </div>

          <div className="card">
            <h2 className="text-lg font-semibold text-tribal-200 mb-2">Combat Skill</h2>
            {character.skills?.find((s: any) => s.name === "Combat") ? (
              <div className="flex justify-between">
                <span className="text-tribal-300">Tier {character.skills.find((s: any) => s.name === "Combat")?.tier}</span>
                <span className="text-tribal-100">{character.skills.find((s: any) => s.name === "Combat")?.experience} XP</span>
              </div>
            ) : (
              <p className="text-tribal-400">No combat skill</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
