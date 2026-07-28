import { useEffect, useState } from "react";
import { useGame } from "@/lib/game";
import { supabase } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { StaminaBar } from "@/components/ui/StaminaBar";
import { Mountain, Clock, AlertTriangle } from "lucide-react";

const miningNodes = [
  { id: "copper_vein", name: "Copper Vein", xp: 8, staminaCost: 8, requiredLevel: 1, description: "Common copper deposits near the surface" },
  { id: "iron_vein", name: "Iron Vein", xp: 15, staminaCost: 12, requiredLevel: 2, description: "Solid iron ore for tools and weapons" },
  { id: "coal_vein", name: "Coal Vein", xp: 12, staminaCost: 10, requiredLevel: 2, description: "Essential fuel for smelting" },
  { id: "silver_vein", name: "Silver Vein", xp: 30, staminaCost: 15, requiredLevel: 3, description: "Precious silver for jewelry" },
  { id: "gold_vein", name: "Gold Vein", xp: 50, staminaCost: 20, requiredLevel: 4, description: "Rare gold deposits deep underground" },
];

export default function MiningPage() {
  const { character, refreshCharacter } = useGame();
  const [gathering, setGathering] = useState(false);
  const [lastResult, setLastResult] = useState<{ success: boolean; message: string; xp_gained: number; item_name: string | null; item_qty: number } | null>(null);

  useEffect(() => {
    document.title = "Mining — TribalMMO";
  }, []);

  if (!character) {
    return <div className="text-tribal-500 text-center mt-20">Create a character first.</div>;
  }

  const miningSkill = character.skills?.find((s) => s.name === "Mining");
  const currentLevel = miningSkill?.level || 1;
  const xp = miningSkill?.experience || 0;

  const mineOre = async (node: typeof miningNodes[0]) => {
    if (!miningSkill || gathering) return;
    if (character.computed_stamina < node.staminaCost) return;
    if (currentLevel < node.requiredLevel) return;

    setGathering(true);
    setLastResult(null);

    const { data, error } = await supabase.rpc("gather_resource", {
      p_character_id: character.id,
      p_action: "mining",
    });

    if (error) {
      setLastResult({ success: false, message: error.message, xp_gained: 0, item_name: null, item_qty: 0 });
      setGathering(false);
      return;
    }

    const result = data as { success: boolean; message: string; xp_gained: number; item_name: string | null; item_qty: number; stamina_cost: number };
    setLastResult(result);
    await refreshCharacter();
    setGathering(false);
  };

  const availableNodes = miningNodes.filter((n) => n.requiredLevel <= currentLevel);
  const lockedNodes = miningNodes.filter((n) => n.requiredLevel > currentLevel);

  return (
    <div className="space-y-5 animate-fade-in max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-tribal-100">Mining</h1>
        <p className="text-tribal-500 text-sm mt-0.5">Mine ores for resources and gold</p>
      </div>

      <div className="card">
        <h2 className="text-xs font-bold text-tribal-400 uppercase tracking-widest mb-3">Mining Skill</h2>
        <div className="flex items-center justify-between">
          <span className="text-tribal-100 font-bold text-xl">Level {currentLevel}</span>
          <span className="text-tribal-500 text-sm">XP: {xp} / {currentLevel * 100}</span>
        </div>
        <p className="text-tribal-600 text-xs mt-2">
          {currentLevel < 100 ? "Mine ores to improve your skill" : "Max level reached"}
        </p>
      </div>

      <StaminaBar current={character.computed_stamina} max={character.max_stamina} size="md" />

      {lastResult && (
        <div className="card animate-fade-in" style={{ background: lastResult.success ? "rgba(18,42,27,0.3)" : "rgba(42,18,18,0.3)", borderColor: lastResult.success ? "rgba(45,110,68,0.2)" : "rgba(110,36,36,0.2)" }}>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-bold" style={{ color: lastResult.success ? "#4a9e6a" : "#b83a3a", fontFamily: "Crimson Pro, Georgia, serif" }}>
              {lastResult.success ? "Mined!" : "Failed!"}
            </h2>
            <button onClick={() => setLastResult(null)} className="text-tribal-600 hover:text-tribal-400 text-xs">dismiss</button>
          </div>
          {lastResult.success && lastResult.item_name && (
            <p className="text-[#6bc98a] text-sm font-semibold">+{lastResult.item_qty}x {lastResult.item_name} (+{lastResult.xp_gained} XP)</p>
          )}
          {!lastResult.success && (
            <p className="text-tribal-500 text-xs">{lastResult.message}</p>
          )}
        </div>
      )}

      <div className="card">
        <h2 className="text-xs font-bold text-tribal-400 uppercase tracking-widest mb-4">Ore Deposits</h2>
        <div className="space-y-2">
          {availableNodes.map((node) => {
            const canGather = character.computed_stamina >= node.staminaCost;
            return (
              <div key={node.id} className="bg-tribal-900/30 p-4 rounded-lg border border-tribal-800/20 hover:border-tribal-700/30 transition-all">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Mountain size={18} className={canGather ? "text-tribal-500" : "text-tribal-700"} />
                    <div>
                      <span className="text-tribal-200 font-semibold text-sm">{node.name}</span>
                      <p className="text-tribal-600 text-xs">{node.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[#4a9e6a] text-xs font-semibold">+{node.xp}xp</span>
                    <span className="text-tribal-700 text-xs flex items-center gap-1 tabular-nums">
                      <Clock size={10} /> {node.staminaCost} stam
                    </span>
                    {!canGather && <AlertTriangle size={14} className="text-tribal-400/70" />}
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-tribal-800/20">
                  <Button
                    variant={canGather ? "primary" : "secondary"}
                    size="sm"
                    icon={<Mountain size={14} />}
                    onClick={() => mineOre(node)}
                    loading={gathering}
                    disabled={!canGather}
                  >
                    {canGather ? `Mine (-${node.staminaCost} stamina)` : "Not enough stamina"}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {lockedNodes.length > 0 && (
        <div className="card">
          <h2 className="text-xs font-bold text-tribal-400 uppercase tracking-widest mb-4">Locked Deposits</h2>
          <div className="space-y-2">
            {lockedNodes.map((node) => (
              <div key={node.id} className="bg-tribal-900/20 p-4 rounded-lg border border-tribal-800/10 opacity-50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Mountain size={18} className="text-tribal-700 shrink-0" />
                    <div>
                      <span className="text-tribal-400 font-semibold text-sm">{node.name}</span>
                      <p className="text-tribal-700 text-xs">{node.description}</p>
                    </div>
                  </div>
                  <span className="text-tribal-700 text-xs bg-tribal-900/40 px-2 py-1 rounded border border-tribal-800/10">
                    Level {node.requiredLevel}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
