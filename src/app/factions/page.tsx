"use client";

import { useGame } from "@/lib/game";
import { supabase } from "@/lib/supabase/client";
import { useState, useEffect } from "react";

const philosophies = [
  { id: "warborn", name: "Warborn", bonus: "+3% combat damage" },
  { id: "earthkeepers", name: "Earthkeepers", bonus: "+5% building speed" },
  { id: "pathfinders", name: "Pathfinders", bonus: "+5% exploration yield" },
];

export default function FactionsPage() {
  const { character, refreshCharacter } = useGame();
  const [factions, setFactions] = useState<any[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [factionName, setFactionName] = useState("");
  const [philosophy, setPhilosophy] = useState("warborn");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchFactions();
  }, []);

  const fetchFactions = async () => {
    const { data } = await supabase.from("factions").select("*, faction_members(*)");
    setFactions(data || []);
  };

  const createFaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!character) return;

    const craftingSkill = character.skills?.find((s: any) => s.name === "Crafting");
    if (!craftingSkill || craftingSkill.tier < 2) {
      setError("You need Crafting Tier II to found a faction.");
      return;
    }

    setCreating(true);
    setError("");

    const { data: faction, error: factionError } = await supabase
      .from("factions")
      .insert({
        name: factionName,
        symbol: "shield",
        philosophy,
        founder_id: character.id,
      })
      .select()
      .single();

    if (factionError) {
      setError(factionError.message);
      setCreating(false);
      return;
    }

    await supabase.from("faction_members").insert({
      faction_id: faction.id,
      character_id: character.id,
      role: "chieftain",
    });

    await refreshCharacter();
    await fetchFactions();
    setShowCreate(false);
    setCreating(false);
  };

  const joinFaction = async (factionId: string) => {
    if (!character) return;

    await supabase.from("faction_members").insert({
      faction_id: factionId,
      character_id: character.id,
      role: "member",
    });

    await refreshCharacter();
    await fetchFactions();
  };

  if (!character) {
    return <div className="text-tribal-400 text-center mt-20">Create a character first.</div>;
  }

  const myFaction = character.faction;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-tribal-100">Factions</h1>

      {myFaction ? (
        <div className="card border-tribal-500">
          <h2 className="text-lg font-semibold text-tribal-200 mb-2">Your Faction</h2>
          <p className="text-tribal-100 text-xl font-bold">{myFaction.faction.name}</p>
          <p className="text-tribal-400 text-sm mt-1">
            Role: <span className="text-tribal-300 capitalize">{myFaction.role}</span>
          </p>
          <p className="text-tribal-400 text-sm">
            Philosophy: <span className="text-tribal-300">{myFaction.faction.philosophy}</span>
          </p>
          <p className="text-tribal-400 text-sm">
            Members: {myFaction.faction.faction_members?.length || 0}
          </p>
        </div>
      ) : showCreate ? (
        <div className="card">
          <h2 className="text-lg font-semibold text-tribal-200 mb-4">Create Faction</h2>
          <form onSubmit={createFaction} className="space-y-4">
            <div>
              <label className="block text-sm text-tribal-300 mb-1">Faction Name</label>
              <input
                type="text"
                value={factionName}
                onChange={(e) => setFactionName(e.target.value)}
                className="input w-full"
                required
                minLength={2}
                maxLength={30}
              />
            </div>
            <div>
              <label className="block text-sm text-tribal-300 mb-2">Philosophy</label>
              <div className="space-y-2">
                {philosophies.map((p) => (
                  <label
                    key={p.id}
                    className={`block p-3 rounded cursor-pointer transition-colors ${
                      philosophy === p.id
                        ? "bg-tribal-700 text-tribal-100"
                        : "bg-tribal-800 text-tribal-400 hover:bg-tribal-700"
                    }`}
                  >
                    <input
                      type="radio"
                      name="philosophy"
                      value={p.id}
                      checked={philosophy === p.id}
                      onChange={(e) => setPhilosophy(e.target.value)}
                      className="hidden"
                    />
                    <div className="font-semibold">{p.name}</div>
                    <div className="text-sm opacity-75">{p.bonus}</div>
                  </label>
                ))}
              </div>
            </div>
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <div className="flex gap-3">
              <button type="submit" className="btn-primary" disabled={creating}>
                {creating ? "Creating..." : "Create Faction"}
              </button>
              <button type="button" className="btn-secondary" onClick={() => setShowCreate(false)}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      ) : (
        <div className="card">
          <p className="text-tribal-400 mb-4">You are not a member of any faction.</p>
          <button onClick={() => setShowCreate(true)} className="btn-primary">
            Create Faction
          </button>
        </div>
      )}

      <div className="card">
        <h2 className="text-lg font-semibold text-tribal-200 mb-4">All Factions</h2>
        {factions.length === 0 ? (
          <p className="text-tribal-400">No factions exist yet. Be the first to create one!</p>
        ) : (
          <div className="space-y-3">
            {factions.map((faction) => (
              <div key={faction.id} className="bg-tribal-800 p-3 rounded">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-tribal-200 font-semibold">{faction.name}</span>
                    <span className="text-tribal-500 text-sm ml-2 capitalize">{faction.philosophy}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-tribal-400 text-sm">
                      {faction.faction_members?.length || 0} members
                    </span>
                    {!myFaction && (
                      <button
                        onClick={() => joinFaction(faction.id)}
                        className="btn-secondary text-sm"
                      >
                        Join
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
