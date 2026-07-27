"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Shield, Users, Trash2, UserMinus, ChevronDown, ChevronUp } from "lucide-react";

interface ClanWithMembers {
  id: string;
  name: string;
  symbol: string;
  philosophy: string;
  founder_id: string;
  created_at: string;
  clan_members: {
    id: string;
    character_id: string;
    role: string;
    character: { name: string } | null;
  }[];
}

export default function AdminClansPage() {
  const [clans, setClans] = useState<ClanWithMembers[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    document.title = "Clans — Admin";
    fetchClans();
  }, []);

  const fetchClans = useCallback(async () => {
    const { data } = await supabase
      .from("clans")
      .select("*, clan_members(*, character:characters(name))")
      .order("created_at", { ascending: false });
    if (data) setClans(data as unknown as ClanWithMembers[]);
  }, []);

  const removeMember = async (memberId: string) => {
    await supabase.from("clan_members").delete().eq("id", memberId);
    await fetchClans();
  };

  const disbandClan = async (clanId: string) => {
    if (!confirm("Are you sure you want to disband this clan?")) return;
    await supabase.from("clan_members").delete().eq("clan_id", clanId);
    await supabase.from("clans").delete().eq("id", clanId);
    setExpanded(null);
    await fetchClans();
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold text-tribal-100">Clan Oversight</h1>
        <p className="text-tribal-400 text-sm mt-0.5">{clans.length} clans total</p>
      </div>

      <div className="space-y-2">
        {clans.map((clan) => {
          const isOpen = expanded === clan.id;
          const memberCount = clan.clan_members?.length || 0;
          return (
            <div key={clan.id} className="bg-[#1a181e] border border-[#262328] rounded-xl overflow-hidden">
              <button
                className="w-full flex items-center justify-between p-4 text-left hover:bg-[#1e1c22] transition-colors"
                onClick={() => setExpanded(isOpen ? null : clan.id)}
              >
                <div className="flex items-center gap-4">
                  <Shield size={20} className="text-tribal-300" />
                  <div>
                    <div className="text-tribal-100 font-semibold">{clan.name}</div>
                    <div className="text-tribal-500 text-xs capitalize">{clan.philosophy} &middot; Founded {new Date(clan.created_at).toLocaleDateString()}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-tribal-400 text-sm flex items-center gap-1 tabular-nums">
                    <Users size={14} /> {memberCount}
                  </span>
                  {isOpen ? <ChevronUp size={18} className="text-tribal-400" /> : <ChevronDown size={18} className="text-tribal-400" />}
                </div>
              </button>

              {isOpen && (
                <div className="border-t border-[#262328] p-5 space-y-4 animate-fade-in">
                  <div>
                    <h3 className="text-xs font-bold text-tribal-300 uppercase tracking-widest mb-3">Members</h3>
                    {memberCount === 0 ? (
                      <p className="text-tribal-500 text-sm">No members.</p>
                    ) : (
                      <div className="space-y-1">
                        {clan.clan_members.map((member) => (
                          <div key={member.id} className="flex items-center justify-between bg-[#1e1c22] rounded-lg px-3 py-2">
                            <div className="flex items-center gap-2">
                              <span className="text-tribal-200 text-sm font-medium">{member.character?.name || "Unknown"}</span>
                              <span className="text-xs bg-[#1a181e] text-tribal-400 px-2 py-0.5 rounded-full">{member.role}</span>
                            </div>
                            <Button variant="ghost" size="sm" icon={<UserMinus size={12} />} onClick={() => removeMember(member.id)} />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <Button variant="danger" size="sm" icon={<Trash2 size={14} />} onClick={() => disbandClan(clan.id)}>
                    Disband Clan
                  </Button>
                </div>
              )}
            </div>
          );
        })}

        {clans.length === 0 && (
          <div className="text-center py-12">
            <Shield size={32} className="text-tribal-700 mx-auto mb-2" />
            <p className="text-tribal-500">No clans exist yet.</p>
          </div>
        )}
      </div>
    </div>
  );
}
