import { useGame } from "@/lib/game";
import { supabase } from "@/lib/supabase/client";
import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/Button";
import { StaminaBar } from "@/components/ui/StaminaBar";
import {
  Map, TreePine, Wheat, Waves, Swords, LogOut, Skull, Sparkles, Flame, Compass,
  Footprints, BedDouble, Heart, CircleAlert, Gem, Cloud, Sun, Moon, CloudRain,
  CloudSnow, CloudLightning, Book, Scroll, Library, Search, Telescope,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { computeEffectiveStats } from "@/lib/stats";
import { pick, rangeInt, chance, weightedPick, rollDice } from "@/lib/rng";

const weatherTypes = [
  { name: "Clear Skies", icon: Sun, color: "text-slate-300", effect: "none" },
  { name: "Overcast", icon: Cloud, color: "text-slate-500", effect: "none" },
  { name: "Light Rain", icon: CloudRain, color: "text-[#6a90a8]", effect: "slippery" },
  { name: "Heavy Rain", icon: CloudRain, color: "text-[#4a7a9a]", effect: "muddy" },
  { name: "Fog", icon: Cloud, color: "text-slate-400", effect: "low_visibility" },
  { name: "Moonlit Night", icon: Moon, color: "text-[#8a6aaa]", effect: "enhanced_discovery" },
  { name: "Scorching Sun", icon: Sun, color: "text-[#c9a84c]", effect: "exhausting" },
  { name: "Snow", icon: CloudSnow, color: "text-slate-300", effect: "freezing" },
  { name: "Thunderstorm", icon: CloudLightning, color: "text-[#b83a3a]", effect: "dangerous" },
];

const zoneIcons: Record<string, { icon: LucideIcon; color: string; description: string }> = {
  "Dark Forest": { icon: TreePine, color: "text-[#4a9e6a]", description: "Dense ancient woodland, teeming with life" },
  "Open Plains": { icon: Wheat, color: "text-slate-300", description: "Vast golden grasslands under open sky" },
  "Riverbank": { icon: Waves, color: "text-[#6a90a8]", description: "Where freshwater meets the land" },
  "Jagged Caves": { icon: Skull, color: "text-slate-400", description: "Dark limestone caverns beneath the earth" },
  "Ancient Ruins": { icon: Sparkles, color: "text-[#8a6aaa]", description: "Crumbling remnants of a forgotten civilization" },
  "Deep Swamp": { icon: CircleAlert, color: "text-[#6a5a3a]", description: "Murky wetlands where few dare to tread" },
  "Sacred Grove": { icon: Library, color: "text-[#4a9e6a]", description: "A serene clearing blessed by ancient spirits" },
  "Crystal Caverns": { icon: Gem, color: "text-[#8a6aaa]", description: "Glittering caves of pure crystal" },
};

const eventTypeIcons: Record<string, { icon: LucideIcon; color: string }> = {
  resource: { icon: TreePine, color: "text-[#4a9e6a]" },
  encounter: { icon: Swords, color: "text-[#b83a3a]" },
  treasure: { icon: Gem, color: "text-slate-400" },
  trap: { icon: Skull, color: "text-[#b83a3a]" },
  flavor: { icon: Compass, color: "text-slate-400" },
  merchant: { icon: Flame, color: "text-slate-400" },
  discovery: { icon: Search, color: "text-[#c9a84c]" },
  lore: { icon: Scroll, color: "text-[#8a6aaa]" },
  weather_event: { icon: Cloud, color: "text-[#6a90a8]" },
  rest: { icon: BedDouble, color: "text-[#4a9e6a]" },
};

type LogEntry = { text: string; icon: LucideIcon; color: string; eventType: string };

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

interface WeatherState {
  name: string;
  icon: LucideIcon;
  color: string;
  effect: string;
}

const explorationEnemies = [
  { name: "Wild Boar", hp: 15, atk: 3, def: 1, xp: 10 },
  { name: "Rival Scout", hp: 18, atk: 5, def: 2, xp: 20 },
  { name: "Dangerous Beast", hp: 25, atk: 6, def: 3, xp: 25 },
  { name: "Shadow Lurker", hp: 20, atk: 7, def: 1, xp: 28 },
  { name: "Swamp Horror", hp: 30, atk: 5, def: 4, xp: 30 },
];

const zoneSpecificLore: Record<string, string[]> = {
  "Dark Forest": ["A moss-covered stone bears ancient runes.", "You find a hunter's abandoned camp, still smoldering.", "A tree has grown around an old sword — it's been here for decades."],
  "Ancient Ruins": ["A faded mural depicts a great battle.", "You find a broken seal with an unfamiliar crest.", "A pedestal hums with residual energy."],
  "Deep Swamp": ["Bubbles rise from the murk — something stirs below.", "A wooden totem leans at an ominous angle.", "The skeleton of a massive creature lies half-buried."],
  "Jagged Caves": ["Fossils of strange creatures line the walls.", "A underground spring feeds a crystal-clear pool.", "Ancient charcoal drawings tell a story of a hunt."],
  "Sacred Grove": ["The spirits here feel unusually strong.", "A circle of stones radiates warmth.", "An old shrine, still tended by unseen hands."],
};

export default function ExplorationPage() {
  const { character, refreshCharacter } = useGame();
  const [currentZone, setCurrentZone] = useState("Dark Forest");
  const [log, setLog] = useState<LogEntry[]>([]);
  const [exploring, setExploring] = useState(false);
  const [combat, setCombat] = useState<ExplorationCombat | null>(null);
  const [error, setError] = useState("");
  const [weather, setWeather] = useState<WeatherState>(weatherTypes[0]);
  const [weatherTimer, setWeatherTimer] = useState(0);
  const [discoveries, setDiscoveries] = useState<string[]>([]);
  const [stepsInZone, setStepsInZone] = useState(0);

  useEffect(() => {
    document.title = "Exploration — TribalMMO";
  }, []);

  const addLog = useCallback((entry: LogEntry) => {
    setLog((prev) => [entry, ...prev].slice(0, 50));
  }, []);

  const changeWeather = useCallback(() => {
    const newWeather = pick(weatherTypes);
    setWeather(newWeather);
    setWeatherTimer(0);
    addLog({
      text: `Weather shifts: ${newWeather.name}`,
      icon: newWeather.icon,
      color: newWeather.color,
      eventType: "weather_event",
    });
  }, [addLog]);

  const explore = useCallback(async () => {
    if (!character || exploring || character.computed_stamina <= 0) return;
    setExploring(true);
    setError("");

    const { data, error: rpcError } = await supabase.rpc("explore_step", {
      p_character_id: character.id,
    });

    if (rpcError) {
      setError(rpcError.message);
      setExploring(false);
      return;
    }

    const result = data as {
      zone: string;
      event_type: string;
      event_text: string;
      xp_gained: number;
    };

    if (result.zone !== currentZone) {
      setStepsInZone(0);
      addLog({
        text: `You venture into ${result.zone}!`,
        icon: zoneIcons[result.zone]?.icon || Compass,
        color: zoneIcons[result.zone]?.color || "text-slate-400",
        eventType: "flavor",
      });
    }

    setCurrentZone(result.zone);
    setStepsInZone((s) => s + 1);
    setWeatherTimer((t) => t + 1);

    if (weatherTimer > 0 && weatherTimer % 5 === 0) {
      changeWeather();
    }

    const zoneData = zoneIcons[result.zone] || zoneIcons["Dark Forest"];
    const eventStyle = eventTypeIcons[result.event_type] || eventTypeIcons.flavor;

    let extraText = "";
    if (weather.effect === "slippery") extraText = " (slippery footing)";
    else if (weather.effect === "muddy") extraText = " (mud slows you down)";
    else if (weather.effect === "low_visibility") extraText = " (hard to see)";
    else if (weather.effect === "enhanced_discovery") extraText = " (moonlight reveals secrets)";
    else if (weather.effect === "exhausting") extraText = " (heat drains your energy)";
    else if (weather.effect === "freezing") extraText = " (bitter cold bites at you)";
    else if (weather.effect === "dangerous") extraText = " (lightning crackles above!)";

    addLog({
      text: `[${result.zone}]${extraText} ${result.event_text} (+${result.xp_gained} XP)`,
      icon: eventStyle.icon,
      color: eventStyle.color,
      eventType: result.event_type,
    });

    if (chance(15) && result.event_type !== "encounter" && result.event_type !== "trap") {
      const loreEntry = zoneSpecificLore[result.zone];
      if (loreEntry) {
        const lore = pick(loreEntry);
        addLog({
          text: `[Discovery] ${lore}`,
          icon: Scroll,
          color: "text-[#8a6aaa]",
          eventType: "lore",
        });
        if (!discoveries.includes(lore)) {
          setDiscoveries((d) => [...d, lore]);
        }
      }
    }

    if (chance(8) && result.event_type === "flavor") {
      const zone = result.zone;
      const discoveryItems: Record<string, string[]> = {
        "Dark Forest": ["Golden Mushroom", "Ancient Root"],
        "Ancient Ruins": ["Old Coin", "Runic Fragment"],
        "Riverbank": ["Pearl", "Polished Stone"],
        "Jagged Caves": ["Crystal Shard", "Geode"],
        "Deep Swamp": ["Swamp Bloom", "Bog Amber"],
        "Sacred Grove": ["Spirit Dust", "Blessed Petal"],
        "Crystal Caverns": ["Pure Crystal", "Glowing Shard"],
      };
      const items = discoveryItems[zone] || ["Strange Object"];
      const item = pick(items);
      const qty = rangeInt(1, 3);
      await supabase.rpc("give_item", {
        p_character_id: character.id,
        p_item_name: item,
        p_quantity: qty,
      });
      addLog({
        text: `[Discovery] You found ${qty}x ${item}!`,
        icon: Search,
        color: "text-[#c9a84c]",
        eventType: "discovery",
      });
    }

    if (result.event_type === "encounter") {
      const weatherMod = weather.effect === "dangerous" ? 1 : 0;
      const enemy = explorationEnemies[Math.floor(Math.random() * explorationEnemies.length)];
      const effectiveStats = computeEffectiveStats(character, character.inventory, { philosophy: character.clan?.clan?.philosophy, buildings: character.clanBuildings }, character.pets);
      const playerHp = 20 + effectiveStats.vitality * 3 + (weather.effect === "exhausting" ? -5 : 0);
      setCombat({
        active: true,
        enemyName: enemy.name,
        enemyHp: enemy.hp + weatherMod * 5,
        enemyMaxHp: enemy.hp + weatherMod * 5,
        enemyAtk: enemy.atk + (weather.effect === "dangerous" ? 2 : 0),
        enemyDef: enemy.def + (weather.effect === "muddy" ? 1 : 0),
        playerHp: Math.max(10, playerHp),
        maxPlayerHp: Math.max(10, playerHp),
        log: [{ text: `${enemy.name} appears!${weatherMod > 0 ? " (empowered by storm)" : ""}`, type: "system" }],
        result: null,
      });
    }

    await refreshCharacter();
    setExploring(false);
  }, [character, exploring, weather, weatherTimer, currentZone, refreshCharacter, addLog, changeWeather, discoveries]);

  const rest = async () => {
    if (!character) return;
    const weatherRestMod = weather.effect === "exhausting" ? 10 : 0;
    const restAmount = 20 + weatherRestMod;
    const { error: rpcError } = await supabase.rpc("rest_character", {
      p_character_id: character.id,
      p_amount: restAmount,
    });
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    addLog({
      text: `You rest by a tree and recover stamina. (+${restAmount})${weather.effect === "exhausting" ? " The shade helps." : ""}`,
      icon: BedDouble,
      color: "text-[#4a9e6a]",
      eventType: "rest",
    });
    await refreshCharacter();
  };

  const playerAttack = () => {
    if (!combat || !combat.active || !character) return;
    const effectiveStats = computeEffectiveStats(character, character.inventory, { philosophy: character.clan?.clan?.philosophy, buildings: character.clanBuildings }, character.pets);
    const weatherDmgMod = weather.effect === "low_visibility" ? -1 : 0;
    const dmg = Math.max(1, effectiveStats.attack - combat.enemyDef + rangeInt(0, 2) + weatherDmgMod);
    const newEnemyHp = combat.enemyHp - dmg;
    const newLog = [...combat.log, { text: `You strike for ${dmg} damage!${weatherDmgMod < 0 ? " (poor visibility)" : ""}`, type: "player" as const }];
    if (newEnemyHp <= 0) {
      setCombat({ ...combat, enemyHp: 0, log: [...newLog, { text: `You defeated the ${combat.enemyName}!`, type: "system" }], active: false, result: "won" });
      return;
    }
    const enemyDmg = Math.max(1, combat.enemyAtk - Math.floor(effectiveStats.defense / 2) + rangeInt(0, 2));
    const newPlayerHp = combat.playerHp - enemyDmg;
    if (newPlayerHp <= 0) {
      setCombat({ ...combat, enemyHp: newEnemyHp, playerHp: 0, log: [...newLog, { text: `The ${combat.enemyName} strikes for ${enemyDmg}! You fall...`, type: "enemy" }], active: false, result: "lost" });
      return;
    }
    setCombat({ ...combat, enemyHp: newEnemyHp, playerHp: newPlayerHp, log: [...newLog, { text: `The ${combat.enemyName} strikes for ${enemyDmg}!`, type: "enemy" }] });
  };

  const endCombat = async () => {
    if (!combat || !character) return;
    if (combat.result === "won") {
      const { data } = await supabase.rpc("resolve_combat_win", {
        p_character_id: character.id,
        p_xp_reward: 5 + rangeInt(0, 5),
      });
      if (data) {
        const result = data as { gold: number };
        addLog({ text: `Victory! +${result.gold} gold.`, icon: Flame, color: "text-slate-300", eventType: "flavor" });
      }
    } else if (combat.result === "lost") {
      const { error: rpcError } = await supabase.rpc("resolve_combat_loss", {
        p_character_id: character.id,
        p_stamina_cost: Math.max(1, 10 - character.defence),
      });
      if (!rpcError) {
        addLog({ text: `Defeat! You were driven back.`, icon: LogOut, color: "text-[#b83a3a]", eventType: "flavor" });
      }
    }
    await refreshCharacter();
    setCombat(null);
  };

  if (!character) {
    return <div className="text-slate-500 text-center mt-20">Create a character first.</div>;
  }

  const zoneData = zoneIcons[currentZone] || zoneIcons["Dark Forest"];
  const ZoneIcon = zoneData.icon;
  const WeatherIcon = weather.icon;

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Exploration</h1>
        <p className="text-slate-500 text-sm mt-0.5">Venture into the wilds — weather, discoveries, dangers await</p>
      </div>

      {error && (
        <div className="bg-[#2a1414] border border-[#6e2424] rounded-lg p-3 text-[#d05050] text-sm">{error}</div>
      )}

      {combat && (
        <div className="space-y-4 animate-fade-in">
          <div className="card">
            <div className="grid grid-cols-2 gap-6">
              <div className="text-center">
                <div className="w-14 h-14 mx-auto rounded-full bg-[#122a1b] border border-[#2d6e44] flex items-center justify-center mb-2">
                  <Swords size={24} className="text-[#4a9e6a]" />
                </div>
                <div className="text-slate-600 text-[11px] uppercase font-bold tracking-wider">You</div>
                <div className="text-lg font-bold text-slate-100 mb-3">{character.name}</div>
                <div className="w-full bg-slate-900/80 rounded-full h-3">
                  <div className="bg-[#3d8b5c] h-3 rounded-full transition-all duration-300" style={{ width: `${(combat.playerHp / combat.maxPlayerHp) * 100}%` }} />
                </div>
                <div className="text-slate-500 text-xs mt-1.5 flex items-center justify-center gap-1 tabular-nums">
                  <Heart size={12} /> {combat.playerHp} / {combat.maxPlayerHp}
                </div>
              </div>
              <div className="text-center">
                <div className="w-14 h-14 mx-auto rounded-full bg-[#2a1414] border border-[#6e2424] flex items-center justify-center mb-2">
                  <Skull size={24} className="text-[#b83a3a]" />
                </div>
                <div className="text-slate-600 text-[11px] uppercase font-bold tracking-wider">Enemy</div>
                <div className="text-lg font-bold text-slate-100 mb-3">{combat.enemyName}</div>
                <div className="w-full bg-slate-900/80 rounded-full h-3">
                  <div className="bg-[#b83a3a] h-3 rounded-full transition-all duration-300" style={{ width: `${(combat.enemyHp / combat.enemyMaxHp) * 100}%` }} />
                </div>
                <div className="text-slate-500 text-xs mt-1.5 flex items-center justify-center gap-1 tabular-nums">
                  <Heart size={12} /> {combat.enemyHp} / {combat.enemyMaxHp}
                </div>
              </div>
            </div>
          </div>
          <div className="card">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Battle Log</h2>
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {combat.log.map((entry, i) => (
                <p key={i} className={`text-sm py-1 ${entry.type === "player" ? "text-[#4a9e6a]" : entry.type === "enemy" ? "text-[#b83a3a]" : "text-slate-300"}`}>{entry.text}</p>
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
            <ZoneIcon size={24} className={zoneData.color} />
            <div>
              <div className="text-slate-600 text-[11px] uppercase font-bold tracking-wider">Current Zone</div>
              <div className={`text-lg font-bold ${zoneData.color}`}>{currentZone}</div>
              <div className="text-slate-700 text-[10px]">{zoneData.description}</div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-slate-600 text-[11px] uppercase font-bold tracking-wider">Steps</div>
              <div className="text-slate-100 text-lg font-bold flex items-center gap-1 justify-end tabular-nums">
                <Footprints size={16} className="text-slate-600" />
                {log.length}
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 mb-4 p-2 rounded-lg bg-slate-900/40 border border-slate-800/20">
          <WeatherIcon size={18} className={weather.color} />
          <span className={`text-sm ${weather.color}`}>{weather.name}</span>
          <span className="text-slate-700 text-xs ml-auto">{stepsInZone} steps in zone</span>
        </div>
        <div className="mb-5">
          <StaminaBar current={character.computed_stamina} max={character.max_stamina} size="sm" />
        </div>
        <div className="flex gap-3">
          <Button variant="primary" className="flex-1" size="lg" icon={<Map size={18} />} onClick={explore}
            disabled={exploring || character.computed_stamina <= 0 || !!combat} loading={exploring}>
            {character.computed_stamina <= 0 ? "No Stamina" : "Take a Step"}
          </Button>
          <Button variant="secondary" size="lg" icon={<BedDouble size={18} />} onClick={rest}
            disabled={!!combat || character.computed_stamina >= character.max_stamina}>
            Rest
          </Button>
        </div>
      </div>

      {discoveries.length > 0 && (
        <div className="card">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">
            <Book size={12} className="inline mr-1" /> Discoveries ({discoveries.length})
          </h2>
          <div className="space-y-1">
            {discoveries.map((d, i) => (
              <p key={i} className="text-slate-500 text-xs flex items-start gap-2">
                <Scroll size={10} className="text-[#8a6aaa] mt-0.5 shrink-0" />
                {d}
              </p>
            ))}
          </div>
        </div>
      )}

      <div className="card">
        <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Event Log</h2>
        {log.length === 0 ? (
          <div className="text-center py-8">
            <Compass size={32} className="text-slate-800 mx-auto mb-2" />
            <p className="text-slate-600">No events yet. Start exploring!</p>
          </div>
        ) : (
          <div className="space-y-1 max-h-72 overflow-y-auto">
            {log.map((entry, i) => {
              const Icon = entry.icon;
              return (
                <div key={i} className={`flex items-start gap-2.5 py-2 px-2.5 rounded-lg ${i === 0 ? "bg-slate-800/30" : ""}`}>
                  <Icon size={14} className={`mt-0.5 shrink-0 ${entry.color}`} />
                  <p className={`text-sm ${i === 0 ? entry.color + " font-medium" : "text-slate-500"}`}>{entry.text}</p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
