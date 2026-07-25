"use client";

import { useGame } from "@/lib/game";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase/client";

const buildingTypes = [
  { name: "Longhouse", description: "Faction headquarters. Required for territory control.", tier: 1 },
  { name: "Workshop", description: "+5% crafting speed for all members.", tier: 1 },
  { name: "Garden", description: "+5% herb yield for all members.", tier: 1 },
  { name: "Storage Pit", description: "+500 resource storage capacity.", tier: 1 },
  { name: "Barracks", description: "+5% combat XP gain. Requires Tier II.", tier: 2 },
  { name: "Watchtower", description: "Increases territory defense. Requires Tier II.", tier: 2 },
  { name: "Spirit Circle", description: "Enables rituals. Requires Tier II.", tier: 2 },
];

export default function SettlementPage() {
  const { character, refreshCharacter } = useGame();
  const [settlement, setSettlement] = useState<any>(null);
  const [buildings, setBuildings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSettlement();
  }, [character]);

  const fetchSettlement = async () => {
    if (!character?.faction) {
      setLoading(false);
      return;
    }

    const { data: sett } = await supabase
      .from("settlements")
      .select("*")
      .eq("faction_id", character.faction.faction_id)
      .single();

    if (sett) {
      setSettlement(sett);
      const { data: blds } = await supabase
        .from("buildings")
        .select("*")
        .eq("settlement_id", sett.id);
      setBuildings(blds || []);
    }

    setLoading(false);
  };

  const buildStructure = async (buildingName: string) => {
    if (!character || !settlement) return;

    const now = new Date();
    const completesAt = new Date(now.getTime() + 300 * 1000).toISOString();

    await supabase.from("buildings").insert({
      settlement_id: settlement.id,
      name: buildingName,
      tier: 1,
      build_time: 300,
      built_at: completesAt,
    });

    await fetchSettlement();
  };

  if (!character) {
    return <div className="text-tribal-400 text-center mt-20">Create a character first.</div>;
  }

  if (loading) {
    return <div className="text-tribal-400 text-center mt-20">Loading...</div>;
  }

  if (!character.faction) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-tribal-100">Settlement</h1>
        <div className="card">
          <p className="text-tribal-400 mb-4">You need to join a faction to have a settlement.</p>
          <a href="/factions" className="btn-primary inline-block">
            Join a Faction
          </a>
        </div>
      </div>
    );
  }

  const isChieftain = character.faction.role === "chieftain";

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-tribal-100">Settlement</h1>

      {settlement ? (
        <>
          <div className="card">
            <h2 className="text-lg font-semibold text-tribal-200 mb-2">{settlement.name}</h2>
            <p className="text-tribal-400">Tier {settlement.tier} Settlement</p>
          </div>

          <div className="card">
            <h2 className="text-lg font-semibold text-tribal-200 mb-4">Buildings</h2>
            {buildings.length === 0 ? (
              <p className="text-tribal-400">No buildings constructed yet.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {buildings.map((building) => (
                  <div key={building.id} className="bg-tribal-800 p-3 rounded">
                    <div className="font-semibold text-tribal-200">{building.name}</div>
                    <div className="text-tribal-400 text-sm">Tier {building.tier}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {isChieftain && (
            <div className="card">
              <h2 className="text-lg font-semibold text-tribal-200 mb-4">Build New Structure</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {buildingTypes
                  .filter((bt) => !buildings.find((b) => b.name === bt.name))
                  .map((bt) => (
                    <div key={bt.name} className="bg-tribal-800 p-3 rounded">
                      <div className="font-semibold text-tribal-200">{bt.name}</div>
                      <div className="text-tribal-400 text-sm">{bt.description}</div>
                      <button
                        onClick={() => buildStructure(bt.name)}
                        className="btn-primary text-sm mt-2"
                      >
                        Build (5 min)
                      </button>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="card">
          <p className="text-tribal-400 mb-4">Your faction does not have a settlement yet.</p>
          {isChieftain && (
            <button
              onClick={async () => {
                await supabase.from("settlements").insert({
                  faction_id: character.faction!.faction_id,
                  name: `${character.faction!.faction.name} Settlement`,
                });
                await fetchSettlement();
              }}
              className="btn-primary"
            >
              Found Settlement
            </button>
          )}
        </div>
      )}
    </div>
  );
}
