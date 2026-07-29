import { useGame } from "@/lib/game";
import { supabase } from "@/lib/supabase/client";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { StaminaBar } from "@/components/ui/StaminaBar";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Alert } from "@/components/ui/Alert";
import { xpForLevel, MAX_SKILL_LEVEL } from "@/lib/constants";
import { Heart, Zap, PawPrint, AlertTriangle, Crosshair } from "lucide-react";

interface TameResult {
  success: boolean;
  xp_gained: number;
  pet_name: string | null;
  pet_type: string | null;
  stamina_cost: number;
  message: string;
}

export default function TamingPage() {
  const { character, refreshCharacter } = useGame();
  const [taming, setTaming] = useState(false);
  const [lastResult, setLastResult] = useState<TameResult | null>(null);
  const [error, setError] = useState("");
  const [sessionCount, setSessionCount] = useState(0);

  useEffect(() => {
    document.title = "Taming — TribalMMO";
  }, []);

  if (!character) {
    return <div className="text-slate-400 text-center mt-20">Create a character first.</div>;
  }

  const tamingSkill = character.skills?.find((s) => s.name === "Taming");
  const currentLevel = tamingSkill?.level || 1;
  const xp = tamingSkill?.experience || 0;
  const xpForCurrent = xpForLevel(currentLevel);
  const xpForNext = xpForLevel(Math.min(currentLevel + 1, MAX_SKILL_LEVEL));
  const xpIntoLevel = xp - xpForCurrent;
  const xpGap = xpForNext - xpForCurrent;
  const xpPercent = xpGap > 0 ? Math.min((xpIntoLevel / xpGap) * 100, 100) : 100;
  const staminaCost = 10;

  const doTame = async () => {
    if (taming) return;
    setTaming(true);
    setError("");
    setLastResult(null);

    const { data, error: rpcError } = await supabase.rpc("tame", {
      p_character_id: character.id,
    });

    if (rpcError) {
      setError(rpcError.message);
      setTaming(false);
      return;
    }

    const result = data as unknown as TameResult;
    setLastResult(result);
    setSessionCount((s) => s + 1);
    await refreshCharacter();
    setTaming(false);
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <SectionHeader
        title="Taming"
        subtitle="Befriend wild creatures as loyal pets"
        right={sessionCount > 0 ? (
          <div className="text-slate-500 text-xs bg-slate-900/60 px-3 py-1.5 rounded border border-slate-800/30">
            {sessionCount} tame{sessionCount !== 1 ? "s" : ""}
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
          background: lastResult.success ? "rgba(26,20,40,0.3)" : "rgba(42,18,18,0.3)",
          borderColor: lastResult.success ? "rgba(138,106,170,0.2)" : "rgba(110,36,36,0.2)",
        }}>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-bold font-heading" style={{ color: lastResult.success ? "#8a6aaa" : "#b83a3a" }}>
              {lastResult.success ? "Tamed!" : "Failed"}
            </h2>
            <button onClick={() => setLastResult(null)} className="text-slate-600 hover:text-slate-400 text-xs">dismiss</button>
          </div>
          <div className="flex flex-wrap gap-3">
            <div className="flex items-center gap-2 px-3 py-2 rounded bg-slate-900/40 border border-slate-800/30">
              <Zap size={14} className="text-slate-400" />
              <span className="text-slate-300 text-sm font-semibold">+{lastResult.xp_gained} Taming XP</span>
            </div>
            {lastResult.success && lastResult.pet_name && (
              <div className="flex items-center gap-2 px-3 py-2 rounded bg-slate-900/40 border border-slate-800/30">
                <PawPrint size={14} className="text-[#8a6aaa]" />
                <span className="text-[#8a6aaa] text-sm font-semibold">{lastResult.pet_name} ({lastResult.pet_type})</span>
              </div>
            )}
          </div>
          {!lastResult.success && (
            <p className="text-slate-500 text-xs mt-2">{lastResult.message}</p>
          )}
        </div>
      )}

      <div className="forge-card">
        <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Taming Skill</h2>
        <div className="flex items-center justify-between mb-2">
          <span className="text-slate-200 font-bold text-xl">Level {currentLevel} / {MAX_SKILL_LEVEL}</span>
          <span className="text-slate-400 text-sm">{xp.toLocaleString()} XP</span>
        </div>
        <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden border border-slate-800/20">
          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${xpPercent}%`, background: "#8a6aaa80" }} />
        </div>
        <p className="text-slate-500 text-xs mt-1">
          {currentLevel < MAX_SKILL_LEVEL ? `${xpIntoLevel.toLocaleString()} / ${(xpForNext - xpForCurrent).toLocaleString()} XP to next level` : "Max level reached"}
        </p>
      </div>

      <Button
        variant="primary"
        size="lg"
        className="w-full"
        icon={<Heart size={18} />}
        onClick={doTame}
        disabled={taming || character.computed_stamina < staminaCost}
        loading={taming}
      >
        {character.computed_stamina < staminaCost
          ? `Not Enough Stamina (need ${staminaCost})`
          : `Search for Creatures (-${staminaCost} stamina)`}
      </Button>
      <p className="text-slate-600 text-xs text-center -mt-3">
        Costs {staminaCost} stamina per attempt &middot; Higher hunting level unlocks rarer pets
      </p>

      <div className="forge-card">
        <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Skill Synergies</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <div className="flex items-center gap-2 p-2 rounded bg-slate-900/40 border border-slate-800/20">
            <Crosshair size={14} className="text-[#b83a3a]" />
            <div>
              <div className="text-slate-300 text-xs font-semibold">Hunting (per 10 levels)</div>
              <div className="text-slate-600 text-[10px]">Unlocks rarer pet types</div>
            </div>
          </div>
          <div className="flex items-center gap-2 p-2 rounded bg-slate-900/40 border border-slate-800/20">
            <Heart size={14} className="text-slate-400" />
            <div>
              <div className="text-slate-300 text-xs font-semibold">Equipment Vitality</div>
              <div className="text-slate-600 text-[10px]">Improves taming success chance</div>
            </div>
          </div>
        </div>
      </div>

      <div className="forge-card">
        <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Available Pets</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {[
            { name: "Cat", type: "cat", bonus: "+2 SPD, +1 VIT", lvl: 1 },
            { name: "Dog", type: "dog", bonus: "+1 STR, +2 VIT", lvl: 1 },
            { name: "Hawk", type: "hawk", bonus: "+3 SPD", lvl: 10 },
            { name: "Wolf", type: "wolf", bonus: "+2 STR, +1 SPD", lvl: 25 },
            { name: "Boar", type: "boar", bonus: "+3 VIT, +1 DEF", lvl: 25 },
            { name: "Snake", type: "snake", bonus: "+2 STR, +1 SPD", lvl: 25 },
          ].map((pet) => (
            <div key={pet.type} className="text-center bg-slate-900/30 p-2 rounded border border-slate-800/20">
              <PawPrint size={14} className="mx-auto text-slate-500 mb-1" />
              <span className="text-slate-300 text-xs font-semibold block">{pet.name}</span>
              <span className="text-slate-500 text-[10px]">{pet.bonus}</span>
              <span className="text-slate-700 text-[10px] block mt-1">Taming {pet.lvl}+</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
