"use client";

import { useGame } from "@/lib/game";
import { supabase } from "@/lib/supabase/client";
import { useState, useEffect } from "react";

const buildingTypes = [
  { name: "Longhouse", description: "Faction headquarters. Required for territory control.", tier: 1, icon: "🏠" },
  { name: "Workshop", description: "+5% crafting speed for all members.", tier: 1, icon: "🔨" },
  { name: "Garden", description: "+5% herb yield for all members.", tier: 1, icon: "🌿" },
  { name: "Storage Pit", description: "+500 resource storage capacity.", tier: 1, icon: "📦" },
  { name: "Barracks", description: "+5% combat XP gain. Requires Tier II.", tier: 2, icon: "⚔️" },
  { name: "Watchtower", description: "Increases territory defense. Requires Tier II.", tier: 2, icon: "🗼" },
  { name: "Spirit Circle", description: "Enables rituals. Requires Tier II.", tier: 2, icon: "🔮" },
];

export default function SettlementPage() {
  const { character, refreshCharacter } = useGame();
  const [settlement, setSettlement] = useState<any>(null);
  const [buildings, setBuildings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchSettlement(); }, [character]);

  const fetchSettlement = async () => {
    if (!character?.faction) { setLoading(false); return; }
    const { data: sett } = await supabase.from("settlements").select("*").eq("faction_id", character.faction.faction_id).single();
    if (sett) {
      setSettlement(sett);
      const { data: blds } = await supabase.from("buildings").select("*").eq("settlement_id", sett.id);
      setBuildings(blds || []);
    }
    setLoading(false);
  };

  const buildStructure = async (buildingName: string) => {
    if (!character || !settlement) return;
    const completesAt = new Date(Date.now() + 300 * 1000).toISOString();
    await supabase.from("buildings").insert({ settlement_id: settlement.id, name: buildingName, tier: 1, build_time: 300, built_at: completesAt });
    await fetchSettlement();
  };

  if (!character) return <div className="text-tribal-500 text-center mt-20">Create a character first.</div>;
  if (loading) return <div className="text-tribal-500 text-center mt-20">Loading...</div>;

  if (!character.faction) {
    return (
      <div className="space-y-5 animate-fade-in max-w-3xl">
        <div>
          <h1 className="text-2xl font-bold text-tribal-100">Settlement</h1>
          <p className="text-tribal-500 text-sm mt-0.5">Build your tribe's home</p>
        </div>
        <div className="card text-center py-8">
          <div className="text-4xl mb-3">🏘️</div>
          <p className="text-tribal-400 mb-5">You need to join a faction to have a settlement.</p>
          <a href="/factions" className="btn-primary inline-block py-2 px-6">Join a Faction</a>
        </div>
      </div>
    );
  }

  const isChieftain = character.faction.role === "chieftain";

  return (
    <div className="space-y-5 animate-fade-in max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-tribal-100">Settlement</h1>
        <p className="text-tribal-500 text-sm mt-0.5">{character.faction.faction.name}</p>
      </div>

      {settlement ? (
        <>
          <div className="card">
            <div className="flex items-center gap-3">
              <span className="text-3xl">🏛️</span>
              <div>
                <h2 className="text-xl font-bold text-tribal-100">{settlement.name}</h2>
                <p className="text-tribal-400 text-sm">Tier {settlement.tier} Settlement</p>
              </div>
            </div>
          </div>

          <div className="card">
            <h2 className="text-sm font-semibold text-tribal-400 uppercase tracking-wider mb-4">Buildings</h2>
            {buildings.length === 0 ? (
              <div className="text-center py-6">
                <div className="text-4xl mb-2 opacity-50">🏗️</div>
                <p className="text-tribal-500">No buildings constructed yet.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {buildings.map((building) => {
                  const info = buildingTypes.find((bt) => bt.name === building.name);
                  return (
                    <div key={building.id} className="bg-tribal-900/50 p-4 rounded-lg border border-tribal-800/50">
                      <div className="flex items-center gap-3">
                        <span className="text-xl">{info?.icon || "🏠"}</span>
                        <div>
                          <div className="font-semibold text-tribal-200 text-sm">{building.name}</div>
                          <div className="text-tribal-500 text-xs">Tier {building.tier}</div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {isChieftain && (
            <div className="card">
              <h2 className="text-sm font-semibold text-tribal-400 uppercase tracking-wider mb-4">Build New Structure</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {buildingTypes
                  .filter((bt) => !buildings.find((b) => b.name === bt.name))
                  .map((bt) => (
                    <div key={bt.name} className="bg-tribal-900/50 p-4 rounded-lg border border-tribal-800/50 hover:border-tribal-700/50 transition-colors">
                      <div className="flex items-start gap-3">
                        <span className="text-2xl mt-0.5">{bt.icon}</span>
                        <div className="flex-1">
                          <div className="font-semibold text-tribal-200 text-sm">{bt.name}</div>
                          <div className="text-tribal-500 text-xs mt-0.5">{bt.description}</div>
                          <button onClick={() => buildStructure(bt.name)} className="btn-primary text-sm mt-3">
                            Build (5 min)
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="card text-center py-8">
          <div className="text-4xl mb-3">🏗️</div>
          <p className="text-tribal-400 mb-5">Your faction does not have a settlement yet.</p>
          {isChieftain && (
            <button
              onClick={async () => {
                await supabase.from("settlements").insert({ faction_id: character.faction!.faction_id, name: `${character.faction!.faction.name} Settlement` });
                await fetchSettlement();
              }}
              className="btn-primary py-3 px-6"
            >
              🏘️ Found Settlement
            </button>
          )}
        </div>
      )}
    </div>
  );
}
