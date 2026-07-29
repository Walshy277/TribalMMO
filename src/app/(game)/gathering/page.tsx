import { useGame } from "@/lib/game";
import { supabase } from "@/lib/supabase/client";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { StaminaBar } from "@/components/ui/StaminaBar";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Alert } from "@/components/ui/Alert";
import { xpForLevel, MAX_SKILL_LEVEL } from "@/lib/constants";
import {
  Package, Zap, Sprout, AlertTriangle, CheckCircle, Lock, Sparkles, Gem, Bug, Leaf, Feather, Star
} from "lucide-react";
import { chance, rangeInt, pick } from "@/lib/rng";

interface GatherResult {
  skill: string;
  xp_gained: number;
  level: number;
  item_name: string | null;
  item_qty: number;
  stamina_cost: number;
  success: boolean;
  message: string;
}

interface BonusEvent {
  type: "double" | "extra" | "special" | "ambush";
  text: string;
  extraItem?: string;
  extraQty?: number;
}

const BONUS_EVENTS: BonusEvent[] = [
  { type: "double", text: "Lucky find! You double your haul!", extraQty: 0 },
  { type: "extra", text: "You spot a rare patch of herbs nearby!", extraItem: "Golden Herb", extraQty: 1 },
  { type: "extra", text: "A bird's nest yields something shiny!", extraItem: "Old Coin", extraQty: 2 },
  { type: "extra", text: "You uncover a hidden cache of supplies!", extraItem: "Bark Fiber", extraQty: 3 },
  { type: "special", text: "A glowing mushroom catches your eye!", extraItem: "Glowing Shroom", extraQty: 1 },
  { type: "special", text: "You find a patch of rare flowers!", extraItem: "Spirit Bloom", extraQty: 1 },
  { type: "ambush", text: "A startled viper strikes at you! You lose some stamina.", extraQty: 0 },
  { type: "extra", text: "The ground gives way to a small cache of flint!", extraItem: "Flint", extraQty: 2 },
  { type: "special", text: "You discover ancient bones in the soil!", extraItem: "Bone", extraQty: 2 },
  { type: "extra", text: "A friendly trader shares some supplies!", extraItem: "Wild Berries", extraQty: 3 },
];

const gatherResources = [
  { name: "Wild Herbs", minLevel: 1, desc: "Aromatic plants used in poultices and cooking", rarity: 1 },
  { name: "Wild Berries", minLevel: 1, desc: "Sweet and tart, a reliable food source", rarity: 1 },
  { name: "Bark Fiber", minLevel: 1, desc: "Flexible tree bark for cordage and weaving", rarity: 1 },
  { name: "Mushrooms", minLevel: 1, desc: "Earthy fungi, some rare and valuable", rarity: 1 },
  { name: "Clay", minLevel: 2, desc: "Malleable earth for pottery and bricks", rarity: 2 },
  { name: "Flint", minLevel: 2, desc: "Hard stone that sparks — essential for fire", rarity: 2 },
  { name: "Reeds", minLevel: 3, desc: "Tall marsh grass, used for thatching and baskets", rarity: 3 },
  { name: "Hides", minLevel: 3, desc: "Animal skins, can be cured into leather", rarity: 3 },
  { name: "Bone", minLevel: 4, desc: "Strong and durable, useful for tools and trinkets", rarity: 4 },
];

const PROC_CHANCE = 25;

export default function GatheringPage() {
  const { character, refreshCharacter } = useGame();
  const [gathering, setGathering] = useState(false);
  const [lastResult, setLastResult] = useState<GatherResult | null>(null);
  const [bonusEvent, setBonusEvent] = useState<BonusEvent | null>(null);
  const [error, setError] = useState("");
  const [sessionCount, setSessionCount] = useState(0);
  const [sessionProcCount, setSessionProcCount] = useState(0);

  useEffect(() => {
    document.title = "Gathering — TribalMMO";
  }, []);

  if (!character) {
    return <div className="text-slate-400 text-center mt-20">Create a character first.</div>;
  }

  const gatheringSkill = character.skills?.find((s) => s.name === "Gathering");
  const currentLevel = gatheringSkill?.level || 1;
  const xp = gatheringSkill?.experience || 0;
  const xpForCurrent = xpForLevel(currentLevel);
  const xpForNext = xpForLevel(Math.min(currentLevel + 1, MAX_SKILL_LEVEL));
  const xpIntoLevel = xp - xpForCurrent;
  const xpGap = xpForNext - xpForCurrent;
  const xpPercent = xpGap > 0 ? Math.min((xpIntoLevel / xpGap) * 100, 100) : 100;
  const staminaCost = 8;

  const gather = async () => {
    if (gathering) return;
    setGathering(true);
    setError("");
    setLastResult(null);
    setBonusEvent(null);

    const { data, error: rpcError } = await supabase.rpc("gather_resource", {
      p_character_id: character.id,
      p_action: "gathering",
    });

    if (rpcError) {
      setError(rpcError.message);
      setGathering(false);
      return;
    }

    const result = data as unknown as GatherResult;
    setLastResult(result);
    setSessionCount((s) => s + 1);

    if (result.success && chance(PROC_CHANCE + currentLevel)) {
      const event = pick(BONUS_EVENTS);
      setBonusEvent(event);
      setSessionProcCount((s) => s + 1);

      if (event.type === "double") {
        const { data: giveData } = await supabase.rpc("gather_resource", {
          p_character_id: character.id,
          p_action: "gathering",
        });
        if (giveData) {
          const extra = giveData as unknown as GatherResult;
          result.xp_gained += extra.xp_gained || 0;
          result.item_qty += extra.item_qty || 0;
        }
      } else if (event.extraItem && event.extraQty) {
        await supabase.rpc("give_item", {
          p_character_id: character.id,
          p_item_name: event.extraItem,
          p_quantity: event.extraQty,
        });
      } else if (event.type === "ambush") {
        const penalty = rangeInt(3, 8);
        await supabase.rpc("deduct_stamina", {
          p_character_id: character.id,
          p_amount: penalty,
        });
        event.text += ` (-${penalty} stamina)`;
      }
    }

    await refreshCharacter();
    setGathering(false);
  };

  const unlocked = gatherResources.filter((r) => r.minLevel <= currentLevel);
  const locked = gatherResources.filter((r) => r.minLevel > currentLevel);

  return (
    <div className="space-y-5 animate-fade-in">
      <SectionHeader
        title="Gathering"
        subtitle="Forage herbs, fruits, and wild resources"
        right={sessionCount > 0 ? (
          <div className="text-slate-500 text-xs bg-slate-900/60 px-3 py-1.5 rounded border border-slate-800/30">
            {sessionCount} session{sessionCount !== 1 ? "s" : ""}
            {sessionProcCount > 0 && <span className="ml-2 text-[#c9a84c]">{sessionProcCount} proc{sessionProcCount !== 1 ? "s" : ""}</span>}
          </div>
        ) : undefined}
      />

      <div className="card">
        <StaminaBar current={character.computed_stamina} max={character.max_stamina} size="md" />
      </div>

      {error && (
        <Alert variant="error" onDismiss={() => setError("")} icon={<AlertTriangle size={14} />}>
          {error}
        </Alert>
      )}

      {bonusEvent && (
        <div className="card animate-fade-in" style={{
          background: bonusEvent.type === "ambush" ? "rgba(42,18,18,0.4)" : "rgba(18,42,27,0.4)",
          borderColor: bonusEvent.type === "ambush" ? "rgba(110,36,36,0.3)" : "rgba(45,110,68,0.3)",
        }}>
          <div className="flex items-center gap-2">
            {bonusEvent.type === "ambush" ? (
              <AlertTriangle size={16} className="text-[#b83a3a]" />
            ) : (
              <Sparkles size={16} className="text-[#c9a84c]" />
            )}
            <span className="text-sm font-medium text-slate-200">{bonusEvent.text}</span>
          </div>
          {bonusEvent.extraItem && (
            <div className="flex items-center gap-2 mt-1">
              <Package size={12} className="text-slate-500" />
              <span className="text-xs text-[#4a9e6a]">+{bonusEvent.extraQty}x {bonusEvent.extraItem}</span>
            </div>
          )}
        </div>
      )}

      {lastResult && (
        <div className="card animate-fade-in" style={{
          background: lastResult.success ? "rgba(18,42,27,0.3)" : "rgba(42,18,18,0.3)",
          borderColor: lastResult.success ? "rgba(45,110,68,0.2)" : "rgba(110,36,36,0.2)",
        }}>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-bold font-heading" style={{ color: lastResult.success ? "#3b82f6" : "#b83a3a" }}>
              {lastResult.success ? (
                <><Sprout size={14} className="inline mr-1" /> Gathered!</>
              ) : (
                <><AlertTriangle size={14} className="inline mr-1" /> Failed!</>
              )}
            </h2>
            <button onClick={() => setLastResult(null)} className="text-slate-600 hover:text-slate-400 text-xs">dismiss</button>
          </div>
          <div className="flex flex-wrap gap-3">
            <div className="flex items-center gap-2 px-3 py-2 rounded bg-slate-900/40 border border-slate-800/30">
              <Zap size={14} className="text-slate-400" />
              <span className="text-slate-300 text-sm font-semibold">+{lastResult.xp_gained} {lastResult.skill} XP</span>
            </div>
            {lastResult.success && lastResult.item_name && (
              <div className="flex items-center gap-2 px-3 py-2 rounded bg-slate-900/40 border border-slate-800/30">
                <Package size={14} className="text-slate-400" />
                <span className="text-slate-200 text-sm font-semibold">+{lastResult.item_qty}x {lastResult.item_name}</span>
              </div>
            )}
          </div>
          {!lastResult.success && (
            <p className="text-slate-500 text-xs mt-2">{lastResult.message}</p>
          )}
        </div>
      )}

      <div className="forge-card">
        <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Gathering Skill</h2>
        <div className="flex items-center justify-between mb-2">
          <span className="text-slate-200 font-bold text-xl">Level {currentLevel} / {MAX_SKILL_LEVEL}</span>
          <span className="text-slate-400 text-sm">{xp.toLocaleString()} XP</span>
        </div>
        <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden border border-slate-800/20">
          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${xpPercent}%`, background: "#3b82f680" }} />
        </div>
        <p className="text-slate-500 text-xs mt-1">
          {currentLevel < MAX_SKILL_LEVEL ? `${xpIntoLevel.toLocaleString()} / ${(xpForNext - xpForCurrent).toLocaleString()} XP to next level` : "Max level reached"}
        </p>
      </div>

      <Button
        variant="primary"
        size="lg"
        className="w-full"
        icon={<Sprout size={18} />}
        onClick={gather}
        disabled={gathering || character.computed_stamina < staminaCost}
        loading={gathering}
      >
        {character.computed_stamina < staminaCost
          ? `Not Enough Stamina (need ${staminaCost})`
          : `Forage (-${staminaCost} stamina)${currentLevel > 0 ? ` (${PROC_CHANCE + currentLevel}% proc)` : ""}`}
      </Button>
      <p className="text-slate-600 text-xs text-center -mt-3">
        Costs {staminaCost} stamina per action &middot; Bonus events may trigger
      </p>

      <div className="forge-card">
        <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Wild Resources</h2>
        <div className="space-y-1.5">
          {gatherResources.map((res) => {
            const avail = currentLevel >= res.minLevel;
            return (
              <div key={res.name} className={`flex items-center gap-3 px-3 py-2.5 rounded transition-all ${
                avail ? "bg-slate-900/30 border border-slate-800/20" : "bg-slate-900/10 border border-slate-800/10 opacity-40"
              }`}>
                <div className="w-8 h-8 rounded flex items-center justify-center shrink-0" style={{ background: avail ? "rgba(59,130,246,0.1)" : "rgba(255,255,255,0.02)" }}>
                  {avail ? <Sprout size={16} className="text-slate-400" /> : <Lock size={14} className="text-slate-700" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-semibold ${avail ? "text-slate-200" : "text-slate-500"}`}>{res.name}</span>
                    <span className="text-slate-600 text-[10px] font-bold bg-slate-900/60 px-1.5 py-0.5 rounded border border-slate-800/20">Lvl {res.minLevel}</span>
                  </div>
                  <p className="text-slate-500 text-xs">{res.desc}</p>
                </div>
                {avail && <CheckCircle size={14} className="text-slate-400 shrink-0 opacity-60" />}
              </div>
            );
          })}
        </div>
      </div>

      <div className="forge-card">
        <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Bonus Events</h2>
        <p className="text-slate-600 text-xs mb-3">Each successful gather has a {PROC_CHANCE}+Level% chance to trigger a bonus event</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {[
            { type: "Double Gather", desc: "Instantly gather again for double haul!", icon: Star, color: "#c9a84c" },
            { type: "Extra Finds", desc: "Find bonus items alongside your gather", icon: Gem, color: "#4a9e6a" },
            { type: "Special Discovery", desc: "Uncover rare and unique items", icon: Sparkles, color: "#8a6aaa" },
            { type: "Wild Ambush", desc: "A creature surprises you — lose stamina!", icon: Bug, color: "#b83a3a" },
          ].map((e, i) => {
            const Icon = e.icon;
            return (
              <div key={i} className="flex items-start gap-2 p-2 rounded bg-slate-900/40 border border-slate-800/20">
                <Icon size={14} className="mt-0.5 shrink-0" style={{ color: e.color }} />
                <div>
                  <div className="text-slate-300 text-xs font-semibold">{e.type}</div>
                  <div className="text-slate-600 text-[10px]">{e.desc}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
