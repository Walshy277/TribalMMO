"use client";

import { useEffect, useState } from "react";
import { useGame } from "@/lib/game";
import { supabase } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { Shield, Swords, Globe, Compass, Users, Plus, Crown, UserMinus, ArrowUp, ArrowDown, AlertTriangle, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";

const philosophies: { id: string; name: string; bonuses: string[]; icon: LucideIcon; desc: string; playstyle: string }[] = [
  { 
    id: "warborn", 
    name: "Warborn", 
    bonuses: ["+10% combat damage", "+5% XP from combat", "Clan members deal bonus damage equal to clan size / 10"],
    icon: Swords, 
    desc: "Strength through battle. Warborn clans dominate in PvP and PvE combat.",
    playstyle: "Aggressive combat-focused. Best for players who love fighting."
  },
  { 
    id: "earthkeepers", 
    name: "Earthkeepers", 
    bonuses: ["+15% gathering yield", "+10% crafting speed", "Unlock rare herb recipes at Tier II"],
    icon: Globe, 
    desc: "Harmony with nature. Earthkeepers gather more, craft better, and heal faster.",
    playstyle: "Economy and crafting. Best for resource-focused players."
  },
  { 
    id: "pathfinders", 
    name: "Pathfinders", 
    bonuses: ["+20% exploration rewards", "Chance to find rare items while exploring", "+10% stamina regen speed"],
    icon: Compass, 
    desc: "Masters of exploration. Pathfinders discover more, travel farther, and find treasures others miss.",
    playstyle: "Exploration and discovery. Best for adventurous players."
  },
];

interface ClanMemberFull {
  id: string;
  clan_id: string;
  character_id: string;
  role: string;
  joined_at: string;
}

interface ClanMemberWithChar extends ClanMemberFull {
  character?: { name: string } | null;
}

interface ClanWithMembers {
  id: string;
  name: string;
  symbol: string;
  philosophy: string;
  founder_id: string;
  created_at: string;
  clan_members: ClanMemberWithChar[];
}

export default function ClansPage() {
  const { character, refreshCharacter } = useGame();
  const [clans, setClans] = useState<ClanWithMembers[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [clanName, setClanName] = useState("");
  const [philosophy, setPhilosophy] = useState("warborn");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [selectedClan, setSelectedClan] = useState<string | null>(null);

  useEffect(() => {
    document.title = "Clans — TribalMMO";
  }, []);

  useEffect(() => { fetchClans(); }, []);

  const fetchClans = async () => {
    const { data } = await supabase.from("clans").select("*, clan_members(*, character:characters(name))") as { data: ClanWithMembers[] | null };
    setClans(data || []);
  };

  const createClan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!character) return;

    const craftingSkill = character.skills?.find((s) => s.name === "Crafting");
    if (!craftingSkill || craftingSkill.tier < 2) {
      setError("You need Crafting Tier II to found a clan.");
      return;
    }

    setCreating(true);
    setError("");

    const { data: clan, error: clanError } = await supabase
      .from("clans")
      .insert({ name: clanName, symbol: "shield", philosophy, founder_id: character.id })
      .select()
      .single();

    if (clanError) { setError(clanError.message); setCreating(false); return; }

    await supabase.from("clan_members").insert({ clan_id: clan.id, character_id: character.id, role: "chieftain" });
    await refreshCharacter();
    await fetchClans();
    setShowCreate(false);
    setCreating(false);
  };

  const joinClan = async (clanId: string) => {
    if (!character) return;
    setActionLoading(true);
    setError("");

    const { error: joinError } = await supabase.from("clan_members").insert({ clan_id: clanId, character_id: character.id, role: "member" });
    if (joinError) setError(joinError.message);

    await refreshCharacter();
    await fetchClans();
    setActionLoading(false);
  };

  const leaveClan = async () => {
    if (!character?.clan) return;
    setActionLoading(true);
    setError("");

    if (character.clan.role === "chieftain") {
      const memberCount = character.clan.clan.clan_members?.length || 0;
      if (memberCount > 1) {
        setError("Transfer leadership or kick all members before leaving.");
        setActionLoading(false);
        return;
      }
    }

    const { error: leaveError } = await supabase
      .from("clan_members")
      .delete()
      .eq("clan_id", character.clan.clan_id)
      .eq("character_id", character.id);

    if (leaveError) setError(leaveError.message);

    if (character.clan.role === "chieftain") {
      const remainingMembers = character.clan.clan.clan_members?.filter((m) => m.character_id !== character.id) || [];
      if (remainingMembers.length === 0) {
        await supabase.from("clans").delete().eq("id", character.clan.clan_id);
      }
    }

    await refreshCharacter();
    await fetchClans();
    setConfirmLeave(false);
    setActionLoading(false);
  };

  const kickMember = async (memberId: string, characterId: string) => {
    if (!character?.clan || character.clan.role !== "chieftain") return;
    if (characterId === character.id) return;

    setActionLoading(true);
    await supabase.from("clan_members").delete().eq("id", memberId);
    await refreshCharacter();
    await fetchClans();
    setActionLoading(false);
  };

  const promoteMember = async (memberId: string, currentRole: string) => {
    if (!character?.clan || character.clan.role !== "chieftain") return;

    setActionLoading(true);
    const newRole = currentRole === "member" ? "officer" : "chieftain";

    if (newRole === "chieftain") {
      await supabase.from("clan_members").update({ role: "member" }).eq("id", character.clan.id);
    }

    await supabase.from("clan_members").update({ role: newRole }).eq("id", memberId);
    await refreshCharacter();
    await fetchClans();
    setActionLoading(false);
  };

  const demoteMember = async (memberId: string, currentRole: string) => {
    if (!character?.clan || character.clan.role !== "chieftain") return;

    setActionLoading(true);
    const newRole = currentRole === "chieftain" ? "officer" : "member";
    if (newRole === "officer") {
      setError("Cannot demote below officer. Transfer leadership instead.");
      setActionLoading(false);
      return;
    }
    await supabase.from("clan_members").update({ role: newRole }).eq("id", memberId);
    await refreshCharacter();
    await fetchClans();
    setActionLoading(false);
  };

  if (!character) return <div className="text-tribal-500 text-center mt-20">Create a character first.</div>;

  const myClan = character.clan;
  const isChieftain = myClan?.role === "chieftain";

  return (
    <div className="space-y-5 animate-fade-in max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-tribal-100">Clans</h1>
        <p className="text-tribal-500 text-sm mt-0.5">Form alliances, wage wars</p>
      </div>

      {error && (
        <Alert variant="error" onDismiss={() => setError("")}>{error}</Alert>
      )}

      {myClan ? (
        <div className="card">
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="text-tribal-600 text-[11px] uppercase font-bold tracking-wider mb-1">Your Clan</div>
              <h2 className="text-xl font-bold text-tribal-100">{myClan.clan.name}</h2>
              <div className="flex items-center gap-4 mt-2 text-sm flex-wrap">
                <span className="text-tribal-500 flex items-center gap-1">
                  <Shield size={14} /> <span className="text-tribal-200 capitalize">{myClan.role}</span>
                </span>
                <span className="text-tribal-800">&middot;</span>
                <span className="text-tribal-500 capitalize">{myClan.clan.philosophy}</span>
                {(() => {
                  const phil = philosophies.find((p) => p.id === myClan.clan.philosophy);
                  return phil ? (
                    <span className="text-tribal-700 text-xs">({phil.bonuses[0]})</span>
                  ) : null;
                })()}
              </div>
            </div>
            <div className="text-right">
              <div className="text-tribal-600 text-[11px] uppercase font-bold flex items-center gap-1 justify-end tracking-wider">
                <Users size={12} /> Members
              </div>
              <div className="text-tribal-100 text-xl font-bold tabular-nums">{myClan.clan.clan_members?.length || 0}</div>
            </div>
          </div>

          <div className="border-t border-tribal-800/20 pt-4 mt-2">
            <h3 className="text-xs font-bold text-tribal-400 uppercase tracking-widest mb-3">Members</h3>
            <div className="space-y-2">
              {(myClan.clan.clan_members || []).map((member) => {
                const isMe = member.character_id === character.id;
                return (
                  <div key={member.id} className="bg-tribal-900/30 p-3 rounded-lg border border-tribal-800/20 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                        member.role === "chieftain" ? "bg-tribal-800/50 text-tribal-300 border border-tribal-700/40" :
                        member.role === "officer" ? "bg-[#1a2a34] text-[#6a90a8] border border-[#3a5060]" :
                        "bg-tribal-700 text-tribal-300 border border-tribal-600/40"
                      }`}>
                        {member.character?.name?.[0] || "?"}
                      </div>
                      <div>
                        <span className="text-tribal-200 text-sm font-semibold">
                          {member.character?.name || "Unknown"}
                          {isMe && " (you)"}
                        </span>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className={`text-xs font-bold uppercase tracking-wider ${
                            member.role === "chieftain" ? "text-tribal-300" :
                            member.role === "officer" ? "text-[#6a90a8]" :
                            "text-tribal-600"
                          }`}>
                            {member.role === "chieftain" && <Crown size={10} className="inline mr-1" />}
                            {member.role}
                          </span>
                        </div>
                      </div>
                    </div>
                    {isChieftain && !isMe && (
                      <div className="flex items-center gap-1">
                        {member.role !== "chieftain" && (
                          <>
                            <Button variant="ghost" size="sm" icon={<ArrowUp size={12} />} onClick={() => promoteMember(member.id, member.role)} loading={actionLoading} title="Promote" />
                            {member.role !== "member" && (
                              <Button variant="ghost" size="sm" icon={<ArrowDown size={12} />} onClick={() => demoteMember(member.id, member.role)} loading={actionLoading} title="Demote" />
                            )}
                          </>
                        )}
                        <Button variant="ghost" size="sm" icon={<UserMinus size={12} />} onClick={() => kickMember(member.id, member.character_id)} loading={actionLoading} title="Kick" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="border-t border-tribal-800/20 pt-4 mt-4">
            {confirmLeave ? (
              <div className="bg-[#2a1414] p-4 rounded-lg border border-[#6e2424] animate-fade-in">
                <p className="text-[#d05050] text-sm mb-3">
                  {isChieftain && (myClan.clan.clan_members?.length || 0) > 1
                    ? "You must transfer leadership or remove all members before leaving."
                    : "Are you sure you want to leave this clan?"}
                </p>
                <div className="flex gap-2">
                  <Button variant="danger" size="sm" onClick={leaveClan} loading={actionLoading}
                    disabled={isChieftain && (myClan.clan.clan_members?.length || 0) > 1}>
                    Leave Clan
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setConfirmLeave(false)}>Cancel</Button>
                </div>
              </div>
            ) : (
              <Button variant="ghost" size="sm" icon={<UserMinus size={14} />} onClick={() => setConfirmLeave(true)}>
                Leave Clan
              </Button>
            )}
          </div>
        </div>
      ) : showCreate ? (
        <div className="card">
          <div className="text-center mb-5">
            <Shield size={36} className="text-tribal-400 mx-auto mb-2" />
            <h2 className="text-xl font-bold text-tribal-100">Found a Clan</h2>
            <p className="text-tribal-600 text-sm mt-1">Requires Crafting Tier II</p>
          </div>
          <form onSubmit={createClan} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-tribal-300 mb-2 uppercase tracking-wider">Clan Name</label>
              <input type="text" value={clanName} onChange={(e) => setClanName(e.target.value)}
                className="input" placeholder="Enter clan name..." required minLength={2} maxLength={30} />
            </div>
            <div>
              <label className="block text-xs font-bold text-tribal-300 mb-2 uppercase tracking-wider">Philosophy</label>
              <div className="space-y-2">
                {philosophies.map((p) => {
                  const Icon = p.icon;
                  return (
                    <label key={p.id} className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-all border ${
                      philosophy === p.id ? "bg-tribal-800/60 text-tribal-100 border-tribal-600/30" : "bg-tribal-900/30 text-tribal-400 hover:bg-tribal-800/30 border-tribal-800/20"
                    }`}>
                      <input type="radio" name="philosophy" value={p.id} checked={philosophy === p.id} onChange={(e) => setPhilosophy(e.target.value)} className="hidden" />
                      <Icon size={20} className="shrink-0 mt-0.5" />
                      <div>
                        <div className="font-semibold text-sm">{p.name}</div>
                        <ul className="text-xs opacity-70 mt-1 space-y-0.5">
                          {p.bonuses.map((bonus, i) => (
                            <li key={i}>{bonus}</li>
                          ))}
                        </ul>
                        <div className="text-xs opacity-50 mt-1">{p.desc}</div>
                        <div className="text-xs opacity-40 mt-1 italic">{p.playstyle}</div>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
            {craftingSkillCheck(character) ? null : (
              <div className="bg-tribal-900/30 border border-tribal-700/30 rounded-lg p-3 text-tribal-300 text-sm flex items-center gap-2">
                <AlertTriangle size={14} /> You need Crafting Tier II to found a clan.
              </div>
            )}
            <div className="flex gap-3">
              <Button type="submit" variant="primary" className="flex-1" size="lg" loading={creating}
                disabled={!craftingSkillCheck(character)}>
                Create Clan
              </Button>
              <Button type="button" variant="secondary" size="lg" onClick={() => setShowCreate(false)}>
                Cancel
              </Button>
            </div>
          </form>
        </div>
      ) : (
        <div className="card text-center py-8">
          <Shield size={36} className="text-tribal-800 mx-auto mb-3" />
          <p className="text-tribal-500 mb-5">You are not a member of any clan.</p>
          <Button variant="primary" size="lg" icon={<Plus size={18} />} onClick={() => setShowCreate(true)}>
            Create Clan
          </Button>
        </div>
      )}

      <div className="card">
        <h2 className="text-xs font-bold text-tribal-400 uppercase tracking-widest mb-4">All Clans</h2>
        {clans.length === 0 ? (
          <div className="text-center py-6">
            <Shield size={32} className="text-tribal-800 mx-auto mb-2" />
            <p className="text-tribal-600">No clans exist yet. Be the first!</p>
          </div>
        ) : (
          <div className="space-y-2">
            {clans.map((clan) => {
              const isExpanded = selectedClan === clan.id;
              const phil = philosophies.find((p) => p.id === clan.philosophy);
              const PhilIcon = phil?.icon || Shield;

              return (
                <div key={clan.id}>
                  <div
                    className={`bg-tribal-900/40 p-4 rounded-lg border transition-colors cursor-pointer ${
                      isExpanded ? "border-tribal-600/30" : "border-tribal-800/20 hover:border-tribal-700/30"
                    }`}
                    onClick={() => setSelectedClan(isExpanded ? null : clan.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <PhilIcon size={18} className="text-tribal-500" />
                        <div>
                          <span className="text-tribal-200 font-semibold text-sm">{clan.name}</span>
                          <p className="text-tribal-600 text-xs capitalize flex items-center gap-1">
                            {clan.philosophy}
                            {phil && <span className="text-tribal-700">({phil.bonuses[0]})</span>}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-tribal-500 text-sm flex items-center gap-1 tabular-nums">
                          <Users size={14} /> {clan.clan_members?.length || 0}
                        </span>
                        {!myClan && (
                          <Button variant="secondary" size="sm" onClick={(e) => { e.stopPropagation(); joinClan(clan.id); }} loading={actionLoading}>
                            Join
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                  {isExpanded && (
                    <div className="bg-tribal-900/20 rounded-b-lg border border-t-0 border-tribal-800/20 p-4 animate-fade-in">
                      <p className="text-tribal-500 text-xs mb-3">{phil?.desc || "A band of tribal survivors."}</p>
                      {phil && (
                        <div className="mb-3">
                          <h4 className="text-xs font-bold text-tribal-400 uppercase tracking-wider mb-1.5">Bonuses</h4>
                          <ul className="text-xs text-tribal-500 space-y-0.5">
                            {phil.bonuses.map((bonus, i) => (
                              <li key={i}>{bonus}</li>
                            ))}
                          </ul>
                          <p className="text-xs text-tribal-600 italic mt-1.5">{phil.playstyle}</p>
                        </div>
                      )}
                      <h4 className="text-xs font-bold text-tribal-400 uppercase tracking-wider mb-2">Members</h4>
                      <div className="space-y-1">
                        {(clan.clan_members || []).map((m) => (
                          <div key={m.id} className="flex items-center justify-between text-sm py-1">
                            <span className="text-tribal-300">{m.character?.name || "Unknown"}</span>
                            <span className={`text-xs font-bold uppercase ${
                              m.role === "chieftain" ? "text-tribal-300" :
                              m.role === "officer" ? "text-[#6a90a8]" :
                              "text-tribal-600"
                            }`}>
                              {m.role === "chieftain" && <Crown size={10} className="inline mr-1" />}
                              {m.role}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function craftingSkillCheck(character: { skills?: { name: string; tier: number }[] }): boolean {
  const craftingSkill = character.skills?.find((s) => s.name === "Crafting");
  return !!craftingSkill && craftingSkill.tier >= 2;
}
