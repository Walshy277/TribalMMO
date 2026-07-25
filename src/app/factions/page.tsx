"use client";

import { useGame } from "@/lib/game";
import { supabase } from "@/lib/supabase/client";
import { useState, useEffect } from "react";

const philosophies = [
  { id: "warborn", name: "Warborn", bonus: "+3% combat damage", icon: "⚔️", color: "border-red-600/40" },
  { id: "earthkeepers", name: "Earthkeepers", bonus: "+5% building speed", icon: "🌍", color: "border-green-600/40" },
  { id: "pathfinders", name: "Pathfinders", bonus: "+5% exploration yield", icon: "🧭", color: "border-blue-600/40" },
];

export default function FactionsPage() {
  const { character, refreshCharacter } = useGame();
  const [factions, setFactions] = useState<any[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [factionName, setFactionName] = useState("");
  const [philosophy, setPhilosophy] = useState("warborn");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { fetchFactions(); }, []);

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
      .insert({ name: factionName, symbol: "shield", philosophy, founder_id: character.id })
      .select()
      .single();

    if (factionError) { setError(factionError.message); setCreating(false); return; }

    await supabase.from("faction_members").insert({ faction_id: faction.id, character_id: character.id, role: "chieftain" });
    await refreshCharacter();
    await fetchFactions();
    setShowCreate(false);
    setCreating(false);
  };

  const joinFaction = async (factionId: string) => {
    if (!character) return;
    await supabase.from("faction_members").insert({ faction_id: factionId, character_id: character.id, role: "member" });
    await refreshCharacter();
    await fetchFactions();
  };

  if (!character) return <div className="text-tribal-400 text-center mt-20">Create a character first.</div>;

  const myFaction = character.faction;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <span className="text-3xl">🛡️</span>
        <div>
          <h1 className="text-2xl font-bold text-tribal-100">Factions</h1>
          <p className="text-tribal-500 text-sm">Form alliances, wage wars</p>
        </div>
      </div>

      {myFaction ? (
        <div className="card border-tribal-500/30 bg-gradient-to-r from-tribal-800/50 to-transparent">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-tribal-400 text-xs uppercase tracking-wider mb-1">Your Faction</div>
              <h2 className="text-xl font-bold text-tribal-100">{myFaction.faction.name}</h2>
              <div className="flex items-center gap-4 mt-2 text-sm">
                <span className="text-tribal-300">Role: <span className="text-tribal-100 capitalize">{myFaction.role}</span></span>
                <span className="text-tribal-500">•</span>
                <span className="text-tribal-300 capitalize">{myFaction.faction.philosophy}</span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-tribal-400 text-xs">Members</div>
              <div className="text-tribal-100 text-xl font-bold">{myFaction.faction.faction_members?.length || 0}</div>
            </div>
          </div>
        </div>
      ) : showCreate ? (
        <div className="card border-tribal-600/30">
          <div className="text-center mb-4">
            <div className="text-4xl mb-2">🏛️</div>
            <h2 className="text-xl font-bold text-tribal-100">Found a Faction</h2>
          </div>
          <form onSubmit={createFaction} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-tribal-300 mb-1.5">Faction Name</label>
              <input type="text" value={factionName} onChange={(e) => setFactionName(e.target.value)}
                className="input w-full" placeholder="Enter faction name..." required minLength={2} maxLength={30} />
            </div>
            <div>
              <label className="block text-sm font-medium text-tribal-300 mb-2">Philosophy</label>
              <div className="space-y-2">
                {philosophies.map((p) => (
                  <label key={p.id} className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all ${
                    philosophy === p.id ? `bg-tribal-700/80 text-tribal-100 border ${p.color}` : "bg-tribal-800/60 text-tribal-400 hover:bg-tribal-700/50 border border-transparent"
                  }`}>
                    <input type="radio" name="philosophy" value={p.id} checked={philosophy === p.id} onChange={(e) => setPhilosophy(e.target.value)} className="hidden" />
                    <span className="text-2xl">{p.icon}</span>
                    <div>
                      <div className="font-semibold">{p.name}</div>
                      <div className="text-sm opacity-75">{p.bonus}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>
            {error && <div className="bg-red-900/30 border border-red-700/50 rounded-lg p-3 text-red-300 text-sm">{error}</div>}
            <div className="flex gap-3">
              <button type="submit" className="btn-primary flex-1 py-3" disabled={creating}>
                {creating ? "Creating..." : "Create Faction"}
              </button>
              <button type="button" className="btn-secondary py-3" onClick={() => setShowCreate(false)}>Cancel</button>
            </div>
          </form>
        </div>
      ) : (
        <div className="card border-tribal-600/30 text-center">
          <div className="text-4xl mb-3">🏛️</div>
          <p className="text-tribal-400 mb-4">You are not a member of any faction.</p>
          <button onClick={() => setShowCreate(true)} className="btn-primary py-3 px-6">
            Create Faction
          </button>
        </div>
      )}

      <div className="card border-tribal-600/30">
        <h2 className="text-lg font-semibold text-tribal-200 mb-4">All Factions</h2>
        {factions.length === 0 ? (
          <div className="text-center py-6">
            <div className="text-4xl mb-2">🏛️</div>
            <p className="text-tribal-500">No factions exist yet. Be the first!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {factions.map((faction) => (
              <div key={faction.id} className="bg-tribal-800/50 p-4 rounded-lg border border-tribal-700/20 hover:border-tribal-500/30 transition-all">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">🛡️</span>
                    <div>
                      <span className="text-tribal-200 font-semibold">{faction.name}</span>
                      <p className="text-tribal-500 text-sm capitalize">{faction.philosophy}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-tribal-400 text-sm">{faction.faction_members?.length || 0} members</span>
                    {!myFaction && (
                      <button onClick={() => joinFaction(faction.id)} className="btn-secondary text-sm py-1.5 px-4">Join</button>
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
