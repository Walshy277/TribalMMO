import { useGame } from "@/lib/game";
import { supabase } from "@/lib/supabase/client";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { StaminaBar } from "@/components/ui/StaminaBar";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Alert } from "@/components/ui/Alert";
import { xpForLevel, MAX_SKILL_LEVEL } from "@/lib/constants";
import { Crosshair, Zap, Package, AlertTriangle, Swords } from "lucide-react";

interface HuntResult {
  success: boolean;
  xp_gained: number;
  item_name: string | null;
  item_qty: number;
  stamina_cost: number;
  message: string;
}

export default function HuntingPage() {
  const { character, refreshCharacter } = useGame();
  const [hunting, setHunting] = useState(false);
  const [lastResult, setLastResult] = useState<HuntResult | null>(null);
  const [error, setError] = useState("");
  const [sessionCount, setSessionCount] = useState(0);

  useEffect(() => {
    document.title = "Hunting — TribalMMO";
  }, []);

  if (!character) {
    return <div className="text-slate-400 text-center mt-20">Create a character first.</div>;
  }

  const huntingSkill = character.skills?.find((s) => s.name === "Hunting");
  const currentLevel = huntingSkill?.level || 1;
  const xp = huntingSkill?.experience || 0;
  const xpForCurrent = xpForLevel(currentLevel);
  const xpForNext = xpForLevel(Math.min(currentLevel + 1, MAX_SKILL_LEVEL));
  const xpIntoLevel = xp - xpForCurrent;
  const xpGap = xpForNext - xpForCurrent;
  const xpPercent = xpGap > 0 ? Math.min((xpIntoLevel / xpGap) * 100, 100) : 100;
  const staminaCost = 8;

  const doHunt = async () => {
    if (hunting) return;
    setHunting(true);
    setError("");
    setLastResult(null);

    const { data, error: rpcError } = await supabase.rpc("hunt", {
      p_character_id: character.id,
    });

    if (rpcError) {
      setError(rpcError.message);
      setHunting(false);
      return;
    }

    const result = data as unknown as HuntResult;
    setLastResult(result);
    setSessionCount((s) => s + 1);
    await refreshCharacter();
    setHunting(false);
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <SectionHeader
        title="Hunting"
        subtitle="Track and catch wild game for resources"
        right={sessionCount > 0 ? (
          <div className="text-slate-500 text-xs bg-slate-900/60 px-3 py-1.5 rounded border border-slate-800/30">
            {sessionCount} hunt{sessionCount !== 1 ? "s" : ""}
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

      {lastResult && (
        <div className="card animate-fade-in" style={{
          background: lastResult.success ? "rgba(18,42,27,0.3)" : "rgba(42,18,18,0.3)",
          borderColor: lastResult.success ? "rgba(45,110,68,0.2)" : "rgba(110,36,36,0.2)",
        }}>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-bold font-heading" style={{ color: lastResult.success ? "#3b82f6" : "#b83a3a" }}>
              {lastResult.success ? "Hunt Successful!" : "Unsuccessful"}
            </h2>
            <button onClick={() => setLastResult(null)} className="text-slate-600 hover:text-slate-400 text-xs">dismiss</button>
          </div>
          <div className="flex flex-wrap gap-3">
            <div className="flex items-center gap-2 px-3 py-2 rounded bg-slate-900/40 border border-slate-800/30">
              <Zap size={14} className="text-slate-400" />
              <span className="text-slate-300 text-sm font-semibold">+{lastResult.xp_gained} Hunting XP</span>
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
        <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Hunting Skill</h2>
        <div className="flex items-center justify-between mb-2">
          <span className="text-slate-200 font-bold text-xl">Level {currentLevel} / {MAX_SKILL_LEVEL}</span>
          <span className="text-slate-400 text-sm">{xp.toLocaleString()} XP</span>
        </div>
        <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden border border-slate-800/20">
          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${xpPercent}%`, background: "#b83a3a80" }} />
        </div>
        <p className="text-slate-500 text-xs mt-1">
          {currentLevel < MAX_SKILL_LEVEL ? `${xpIntoLevel.toLocaleString()} / ${(xpForNext - xpForCurrent).toLocaleString()} XP to next level` : "Max level reached"}
        </p>
      </div>

      <Button
        variant="primary"
        size="lg"
        className="w-full"
        icon={<Crosshair size={18} />}
        onClick={doHunt}
        disabled={hunting || character.computed_stamina < staminaCost}
        loading={hunting}
      >
        {character.computed_stamina < staminaCost
          ? `Not Enough Stamina (need ${staminaCost})`
          : `Set Traps (-${staminaCost} stamina)`}
      </Button>
      <p className="text-slate-600 text-xs text-center -mt-3">
        Costs {staminaCost} stamina per attempt &middot; Higher strength boosts yield
      </p>

      <div className="forge-card">
        <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Skill Synergies</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <div className="flex items-center gap-2 p-2 rounded bg-slate-900/40 border border-slate-800/20">
            <Swords size={14} className="text-[#b83a3a]" />
            <div>
              <div className="text-slate-300 text-xs font-semibold">Core Stats (STR)</div>
              <div className="text-slate-600 text-[10px]">Every 4 strength = +1 item per hunt</div>
            </div>
          </div>
          <div className="flex items-center gap-2 p-2 rounded bg-slate-900/40 border border-slate-800/20">
            <Package size={14} className="text-slate-400" />
            <div>
              <div className="text-slate-300 text-xs font-semibold">Equipment Strength</div>
              <div className="text-slate-600 text-[10px]">Every 4 strength = +1 item per hunt</div>
            </div>
          </div>
        </div>
      </div>

      <div className="forge-card">
        <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Possible Loot</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {["Raw Meat", "Rabbit Fur", "Boar Hide", "Feathers", "Bone", "Sinew"].map((item) => (
            <div key={item} className="text-center bg-slate-900/30 p-2 rounded border border-slate-800/20">
              <Package size={14} className="mx-auto text-slate-500 mb-1" />
              <span className="text-slate-400 text-xs">{item}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
