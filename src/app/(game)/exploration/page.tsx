import { useGame } from "@/lib/game";
import { supabase } from "@/lib/supabase/client";
import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/Button";
import { StaminaBar } from "@/components/ui/StaminaBar";
import {
  Map,
  TreePine,
  Wheat,
  Waves,
  Swords,
  LogOut,
  TreeDeciduous,
  Mountain,
  Bug,
  Wind,
  Flower2,
  Bird,
  Flame,
  Leaf,
  Compass,
  Footprints,
  BedDouble,
  Coins,
  Gem,
  Skull,
  Sparkles,
  Heart,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { computeEffectiveStats } from "@/lib/stats";

const zones: { name: string; icon: LucideIcon; color: string }[] = [
  { name: "Forest", icon: TreePine, color: "text-[#4a9e6a]" },
  { name: "Plains", icon: Wheat, color: "text-tribal-300" },
  { name: "Riverbank", icon: Waves, color: "text-[#6a90a8]" },
];

// Exploration events with weighted RNG
interface ExplorationEvent {
  type: "resource" | "encounter" | "rng" | "spirit" | "flavor";
  icon: LucideIcon;
  text: string;
  color: string;
  weight: number;
  gold?: number;
  item?: { name: string; qty: number };
}

const explorationEvents: ExplorationEvent[] = [
  // Resources (common)
  { type: "resource", icon: TreeDeciduous, text: "You found some wood!", color: "text-tribal-300", weight: 15, item: { name: "Wood", qty: 2 } },
  { type: "resource", icon: Leaf, text: "You gathered a handful of herbs.", color: "text-[#4a9e6a]", weight: 12, item: { name: "Herbs", qty: 1 } },
  { type: "resource", icon: Mountain, text: "You discovered a stone deposit.", color: "text-tribal-300", weight: 15, item: { name: "Stone", qty: 2 } },
  { type: "resource", icon: Flower2, text: "You find a patch of medicinal herbs.", color: "text-[#aa5a7a]", weight: 10, item: { name: "Herbs", qty: 2 } },
  // Encounters (uncommon)
  { type: "encounter", icon: Bug, text: "A wild boar charges at you!", color: "text-[#b83a3a]", weight: 8 },
  { type: "encounter", icon: Swords, text: "A rival scout appears from the bushes!", color: "text-[#b83a3a]", weight: 6 },
  { type: "encounter", icon: Skull, text: "A dangerous creature lurks nearby!", color: "text-[#b83a3a]", weight: 4 },
  // RNG events (common - flavor + small rewards)
  { type: "rng", icon: Wind, text: "You tripped over a stone. Nothing serious.", color: "text-tribal-400", weight: 10 },
  { type: "rng", icon: Coins, text: "You found a gold coin on the ground!", color: "text-[#c9a84c]", weight: 8, gold: 1 },
  { type: "rng", icon: Coins, text: "A small pouch of gold coins hidden under a rock!", color: "text-[#c9a84c]", weight: 3, gold: 5 },
  { type: "rng", icon: Gem, text: "You found a shiny pebble. Could be worth something.", color: "text-[#6a90a8]", weight: 5, gold: 2 },
  { type: "rng", icon: Leaf, text: "You found a rare mushroom in the undergrowth.", color: "text-[#4a9e6a]", weight: 4, item: { name: "Herbs", qty: 3 } },
  { type: "rng", icon: TreeDeciduous, text: "You discovered a fallen tree with good lumber.", color: "text-tribal-300", weight: 5, item: { name: "Wood", qty: 4 } },
  { type: "rng", icon: Mountain, text: "You spotted a vein of ore in the cliff face.", color: "text-tribal-300", weight: 3, item: { name: "Stone", qty: 5 } },
  // Spirit phenomena (rare)
  { type: "spirit", icon: Sparkles, text: "A spirit orb floats before you, pulsing with energy...", color: "text-[#8a6aaa]", weight: 2, gold: 10 },
  { type: "spirit", icon: Flame, text: "Ancient flames dance in the air. You feel empowered.", color: "text-[#c04e20]", weight: 1, gold: 15 },
  // Flavor (common)
  { type: "flavor", icon: Wind, text: "The wind rustles through the ancient trees.", color: "text-tribal-400", weight: 10 },
  { type: "flavor", icon: Flame, text: "You hear distant drums echoing across the plains.", color: "text-tribal-300", weight: 8 },
  { type: "flavor", icon: Bird, text: "An eagle soars above you, circling lazily.", color: "text-tribal-300", weight: 8 },
  { type: "flavor", icon: Leaf, text: "The scent of wildflowers fills the air.", color: "text-[#4a9e6a]", weight: 7 },
];

function weightedRandom(events: ExplorationEvent[]): ExplorationEvent {
  const totalWeight = events.reduce((sum, e) => sum + e.weight, 0);
  let roll = Math.random() * totalWeight;
  for (const event of events) {
    roll -= event.weight;
    if (roll <= 0) return event;
  }
  return events[events.length - 1];
}

type LogEntry = { text: string; icon: LucideIcon; color: string };

interface ExplorationCombat {
  active: boolean;
  enemyName: string;
  enemyHp: number;
  enemyMaxHp: number;
  enemyAtk: number;
  enemyDef: number;
  playerHp: number;
  maxPlayerHp: number;
  log: { text: string; type: "player" | "enemy" | "system" }[];
  result: "won" | "lost" | null;
}

const explorationEnemies = [
  { name: "Wild Boar", hp: 15, atk: 3, def: 1, xp: 10 },
  { name: "Rival Scout", hp: 18, atk: 5, def: 2, xp: 20 },
  { name: "Dangerous Beast", hp: 25, atk: 6, def: 3, xp: 25 },
];

export default function ExplorationPage() {
  const { character, refreshCharacter } = useGame();
  const [currentZone, setCurrentZone] = useState(0);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [exploring, setExploring] = useState(false);
  const [encounter, setEncounter] = useState<string | null>(null);
  const [lastEvent, setLastEvent] = useState<ExplorationEvent | null>(null);
  const [combat, setCombat] = useState<ExplorationCombat | null>(null);

  useEffect(() => {
    document.title = "Exploration — TribalMMO";
  }, []);

  const addLog = useCallback((entry: LogEntry) => {
    setLog((prev) => [entry, ...prev].slice(0, 30));
  }, []);

  const explore = useCallback(async () => {
    if (!character || exploring || character.computed_stamina <= 0) return;

    setExploring(true);

    const zone = Math.floor(Math.random() * zones.length);
    setCurrentZone(zone);
    const event = weightedRandom(explorationEvents);
    setLastEvent(event);

    const newStamina = Math.max(0, character.computed_stamina - 5);
    const { error } = await supabase
      .from("characters")
      .update({ stamina: newStamina, stamina_updated_at: new Date().toISOString() })
      .eq("id", character.id);
    if (error) return;

    // Grant Combat XP for exploration
    const survivalSkill = character.skills?.find((s) => s.name === "Combat");
    if (survivalSkill) {
      const xpGain = 3;
      const newXp = survivalSkill.experience + xpGain;
      const maxXP = survivalSkill.level * 100;
      const newLevel = newXp >= maxXP && survivalSkill.level < 100 ? survivalSkill.level + 1 : survivalSkill.level;
      await supabase.from("skills").update({ experience: newXp, level: newLevel }).eq("id", survivalSkill.id);
    }

    // Grant items from resource/RNG events
    if (event.item) {
      const existingItem = await supabase.from("items").select("id").eq("name", event.item.name).single();
      let itemId = existingItem.data?.id;
      if (!itemId) {
        const { data: newItem } = await supabase.from("items").insert({ name: event.item.name, type: "materials", rarity: 1 }).select("id").single();
        itemId = newItem?.id;
      }
      if (itemId) {
        const existingInv = await supabase.from("inventory").select("id, quantity").eq("character_id", character.id).eq("item_id", itemId).single();
        if (existingInv.data) {
          await supabase.from("inventory").update({ quantity: existingInv.data.quantity + event.item.qty }).eq("id", existingInv.data.id);
        } else {
          await supabase.from("inventory").insert({ character_id: character.id, item_id: itemId, quantity: event.item.qty });
        }
      }
    }

    // Grant gold from RNG/spirit events
    if (event.gold && event.gold > 0) {
      await supabase.from("characters").update({ gold: character.gold + event.gold }).eq("id", character.id);
    }

    const zonePrefix = `[${zones[zone].name}]`;
    const goldText = event.gold ? ` (+${event.gold} gold)` : "";
    const itemText = event.item ? ` (+${event.item.qty}x ${event.item.name})` : "";
    addLog({ text: `${zonePrefix} ${event.text}${goldText}${itemText}`, icon: event.icon, color: event.color });

    if (event.type === "encounter") {
      const enemy = explorationEnemies[Math.floor(Math.random() * explorationEnemies.length)];
      const effectiveStats = computeEffectiveStats(character, character.inventory, character.clan?.clan, character.pets);
      const playerHp = 20 + effectiveStats.vitality * 3;
      setCombat({
        active: true,
        enemyName: enemy.name,
        enemyHp: enemy.hp,
        enemyMaxHp: enemy.hp,
        enemyAtk: enemy.atk,
        enemyDef: enemy.def,
        playerHp,
        maxPlayerHp: playerHp,
        log: [{ text: `${enemy.name} appears!`, type: "system" }],
        result: null,
      });
      setEncounter(event.text);
    }

    await refreshCharacter();
    setExploring(false);
  }, [character, exploring, refreshCharacter, addLog]);

  const rest = async () => {
    if (!character) return;
    const cost = 10;
    if (character.computed_stamina < cost) return;
    const newStamina = Math.min(character.max_stamina, character.computed_stamina - cost + 20);
    const { error } = await supabase
      .from("characters")
      .update({ stamina: newStamina, stamina_updated_at: new Date().toISOString() })
      .eq("id", character.id);
    if (error) return;
    addLog({ text: "You rest by a tree and recover stamina. (-10, +20)", icon: BedDouble, color: "text-[#4a9e6a]" });
    await refreshCharacter();
  };

  const playerAttack = () => {
    if (!combat || !combat.active || !character) return;
    const char = character;
    const effectiveStats = computeEffectiveStats(char, char.inventory, char.clan?.clan, char.pets);

    const dmg = Math.max(1, effectiveStats.attack - combat.enemyDef + Math.floor(Math.random() * 3));
    const newEnemyHp = combat.enemyHp - dmg;
    const newLog = [...combat.log, { text: `You strike for ${dmg} damage!`, type: "player" as const }];

    if (newEnemyHp <= 0) {
      setCombat({ ...combat, enemyHp: 0, log: [...newLog, { text: `You defeated the ${combat.enemyName}!`, type: "system" }], active: false, result: "won" });
      return;
    }

    const enemyDmg = Math.max(1, combat.enemyAtk - Math.floor(effectiveStats.defense / 2) + Math.floor(Math.random() * 2));
    const newPlayerHp = combat.playerHp - enemyDmg;

    if (newPlayerHp <= 0) {
      setCombat({ ...combat, enemyHp: newEnemyHp, playerHp: 0, log: [...newLog, { text: `The ${combat.enemyName} strikes for ${enemyDmg}! You fall...`, type: "enemy" }], active: false, result: "lost" });
      return;
    }

    setCombat({ ...combat, enemyHp: newEnemyHp, playerHp: newPlayerHp, log: [...newLog, { text: `The ${combat.enemyName} strikes for ${enemyDmg}!`, type: "enemy" }] });
  };

  const endCombat = async () => {
    if (!combat || !character) return;
    const char = character;

    if (combat.result === "won") {
      const combatSkill = char.skills?.find((s) => s.name === "Combat");
      if (combatSkill) {
        const xpGain = 10 + Math.floor(Math.random() * 10);
        const newXp = combatSkill.experience + xpGain;
        const maxXP = combatSkill.level * 100;
        const newLevel = newXp >= maxXP && combatSkill.level < 100 ? combatSkill.level + 1 : combatSkill.level;
        await supabase.from("skills").update({ experience: newXp, level: newLevel }).eq("id", combatSkill.id);
        addLog({ text: `Victory! You defeated the enemy. +${xpGain} Combat XP.`, icon: Flame, color: "text-tribal-300" });
      }
    } else if (combat.result === "lost") {
      const dmg = Math.max(1, 10 - char.defence);
      const newStamina = Math.max(0, char.computed_stamina - dmg);
      await supabase.from("characters").update({ stamina: newStamina, stamina_updated_at: new Date().toISOString() }).eq("id", char.id);
      addLog({ text: `Defeat! You were driven back. -${dmg} Stamina`, icon: LogOut, color: "text-[#b83a3a]" });
    }

    await refreshCharacter();
    setCombat(null);
  };

  if (!character) {
    return <div className="text-tribal-500 text-center mt-20">Create a character first.</div>;
  }

  const zone = zones[currentZone];
  const ZoneIcon = zone.icon;

  return (
    <div className="space-y-5 animate-fade-in max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-tribal-100">Exploration</h1>
        <p className="text-tribal-500 text-sm mt-0.5">Venture into the wilds — discover resources, encounter creatures, find treasure</p>
      </div>

      {combat && (
        <div className="space-y-4 animate-fade-in">
          <div className="card">
            <div className="grid grid-cols-2 gap-6">
              <div className="text-center">
                <div className="w-14 h-14 mx-auto rounded-full bg-[#122a1b] border border-[#2d6e44] flex items-center justify-center mb-2">
                  <Swords size={24} className="text-[#4a9e6a]" />
                </div>
                <div className="text-tribal-600 text-[11px] uppercase font-bold tracking-wider">You</div>
                <div className="text-lg font-bold text-tribal-100 mb-3">{character.name}</div>
                <div className="w-full bg-tribal-900/80 rounded-full h-3">
                  <div className="bg-[#3d8b5c] h-3 rounded-full transition-all duration-300" style={{ width: `${(combat.playerHp / combat.maxPlayerHp) * 100}%` }} />
                </div>
                <div className="text-tribal-500 text-xs mt-1.5 flex items-center justify-center gap-1 tabular-nums">
                  <Heart size={12} /> {combat.playerHp} / {combat.maxPlayerHp}
                </div>
              </div>
              <div className="text-center">
                <div className="w-14 h-14 mx-auto rounded-full bg-[#2a1414] border border-[#6e2424] flex items-center justify-center mb-2">
                  <Skull size={24} className="text-[#b83a3a]" />
                </div>
                <div className="text-tribal-600 text-[11px] uppercase font-bold tracking-wider">Enemy</div>
                <div className="text-lg font-bold text-tribal-100 mb-3">{combat.enemyName}</div>
                <div className="w-full bg-tribal-900/80 rounded-full h-3">
                  <div className="bg-[#b83a3a] h-3 rounded-full transition-all duration-300" style={{ width: `${(combat.enemyHp / combat.enemyMaxHp) * 100}%` }} />
                </div>
                <div className="text-tribal-500 text-xs mt-1.5 flex items-center justify-center gap-1 tabular-nums">
                  <Heart size={12} /> {combat.enemyHp} / {combat.enemyMaxHp}
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <h2 className="text-xs font-bold text-tribal-400 uppercase tracking-widest mb-2">Battle Log</h2>
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {combat.log.map((entry, i) => (
                <p key={i} className={`text-sm py-1 ${entry.type === "player" ? "text-[#4a9e6a]" : entry.type === "enemy" ? "text-[#b83a3a]" : "text-tribal-300"}`}>
                  {entry.text}
                </p>
              ))}
            </div>
          </div>

          {combat.active ? (
            <div className="flex gap-3">
              <Button variant="danger" className="flex-1" size="lg" icon={<Swords size={18} />} onClick={playerAttack}>Attack</Button>
              <Button variant="secondary" className="flex-1" size="lg" icon={<LogOut size={18} />} onClick={endCombat}>Flee</Button>
            </div>
          ) : (
            <Button variant={combat.result === "won" ? "success" : "secondary"} className="w-full" size="lg" onClick={endCombat}>
              {combat.result === "won" ? "Victory!" : "Recover"}
            </Button>
          )}
        </div>
      )}

      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <ZoneIcon size={24} className={zone.color} />
            <div>
              <div className="text-tribal-600 text-[11px] uppercase font-bold tracking-wider">Current Zone</div>
              <div className={`text-lg font-bold ${zone.color}`}>{zone.name}</div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-tribal-600 text-[11px] uppercase font-bold tracking-wider">Steps</div>
            <div className="text-tribal-100 text-lg font-bold flex items-center gap-1 justify-end tabular-nums">
              <Footprints size={16} className="text-tribal-600" />
              {log.length}
            </div>
          </div>
        </div>

        <div className="mb-5">
          <StaminaBar current={character.computed_stamina} max={character.max_stamina} size="sm" />
        </div>

        <div className="flex gap-3">
          <Button
            variant="primary"
            className="flex-1"
            size="lg"
            icon={<Map size={18} />}
            onClick={explore}
            disabled={exploring || character.computed_stamina <= 0 || !!combat}
            loading={exploring}
          >
            {character.computed_stamina <= 0 ? "No Stamina" : "Take a Step"}
          </Button>
          <Button
            variant="secondary"
            size="lg"
            icon={<BedDouble size={18} />}
            onClick={rest}
            disabled={!!combat || character.computed_stamina >= character.max_stamina}
          >
            Rest
          </Button>
        </div>
      </div>

      {lastEvent && (
        <div className="card animate-fade-in">
          <div className="flex items-center gap-3">
            <lastEvent.icon size={20} className={lastEvent.color} />
            <p className={`font-medium ${lastEvent.color}`}>{lastEvent.text}</p>
          </div>
        </div>
      )}

      <div className="card">
        <h2 className="text-xs font-bold text-tribal-400 uppercase tracking-widest mb-3">Event Log</h2>
        {log.length === 0 ? (
          <div className="text-center py-8">
            <Compass size={32} className="text-tribal-800 mx-auto mb-2" />
            <p className="text-tribal-600">No events yet. Start exploring!</p>
          </div>
        ) : (
          <div className="space-y-1 max-h-72 overflow-y-auto">
            {log.map((entry, i) => {
              const Icon = entry.icon;
              return (
                <div
                  key={i}
                  className={`flex items-start gap-2.5 py-2 px-2.5 rounded-lg ${i === 0 ? "bg-tribal-800/30" : ""}`}
                >
                  <Icon size={14} className={`mt-0.5 shrink-0 ${entry.color}`} />
                  <p className={`text-sm ${i === 0 ? entry.color + " font-medium" : "text-tribal-500"}`}>
                    {entry.text}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
