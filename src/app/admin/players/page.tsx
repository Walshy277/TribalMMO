import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import   {
  Users, Search, ChevronDown, ChevronUp, Dumbbell, Swords, Shield,
  Zap, Heart, Save, Package, Plus, Trash2,
} from "lucide-react";

interface AdminCharacter {
  id: string;
  name: string;
  user_id: string;
  background: string;
  strength: number;
  defence: number;
  speed: number;
  vitality: number;
  stamina: number;
  max_stamina: number;
  created_at: string;
  skills: { id: string; name: string; level: number; experience: number }[];
  inventory: { id: string; item_id: string; quantity: number; item: { name: string; type: string } | null }[];
}

export default function AdminPlayersPage() {
  const [characters, setCharacters] = useState<AdminCharacter[]>([]);
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [editStats, setEditStats] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);
  const [items, setItems] = useState<{ id: string; name: string; type: string }[]>([]);
  const [grantItemId, setGrantItemId] = useState("");
  const [grantQty, setGrantQty] = useState(1);

  useEffect(() => {
    document.title = "Players — Admin";
    fetchCharacters();
    fetchItems();
  }, []);

  const fetchCharacters = useCallback(async () => {
    const { data: chars } = await supabase
      .from("characters")
      .select("*, skills(*), inventory(*, item:items(name, type))")
      .order("created_at", { ascending: false });

    if (chars) setCharacters(chars as unknown as AdminCharacter[]);
  }, []);

  const fetchItems = async () => {
    const { data } = await supabase.from("items").select("id, name, type").order("name");
    if (data) setItems(data);
  };

  const filtered = characters.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.background.toLowerCase().includes(search.toLowerCase())
  );

  const toggleExpand = (id: string) => {
    if (expanded === id) {
      setExpanded(null);
      return;
    }
    setExpanded(id);
    const char = characters.find((c) => c.id === id);
    if (char) {
      setEditStats({
        strength: char.strength,
        defence: char.defence,
        speed: char.speed,
        vitality: char.vitality,
        stamina: char.stamina,
        max_stamina: char.max_stamina,
      });
    }
  };

  const saveStats = async (charId: string) => {
    setSaving(true);
    await supabase
      .from("characters")
      .update({
        strength: editStats.strength,
        defence: editStats.defence,
        speed: editStats.speed,
        vitality: editStats.vitality,
        stamina: editStats.stamina,
        max_stamina: editStats.max_stamina,
      })
      .eq("id", charId);
    await fetchCharacters();
    setSaving(false);
  };

  const updateSkillXP = async (skillId: string, xp: number) => {
    await supabase.from("skills").update({ experience: xp }).eq("id", skillId);
    await fetchCharacters();
  };

  const updateSkillLevel = async (skillId: string, level: number) => {
    await supabase.from("skills").update({ level }).eq("id", skillId);
    await fetchCharacters();
  };

  const grantItem = async (charId: string) => {
    if (!grantItemId) return;
    const existing = characters
      .find((c) => c.id === charId)
      ?.inventory.find((inv) => inv.item_id === grantItemId);

    if (existing) {
      await supabase
        .from("inventory")
        .update({ quantity: existing.quantity + grantQty })
        .eq("id", existing.id);
    } else {
      await supabase.from("inventory").insert({
        character_id: charId,
        item_id: grantItemId,
        quantity: grantQty,
      });
    }
    setGrantItemId("");
    setGrantQty(1);
    await fetchCharacters();
  };

  const removeInventoryItem = async (invId: string) => {
    await supabase.from("inventory").delete().eq("id", invId);
    await fetchCharacters();
  };

  const statConfig = [
    { key: "strength", label: "STR", icon: Dumbbell, color: "text-[#b83a3a]" },
    { key: "defence", label: "DEF", icon: Shield, color: "text-[#6a90a8]" },
    { key: "speed", label: "SPD", icon: Zap, color: "text-[#4a9e6a]" },
    { key: "vitality", label: "VIT", icon: Heart, color: "text-[#c9a84c]" },
  ];

  return (
    <div className="space-y-6 animate-fade-in max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold text-tribal-100">Player Manager</h1>
        <p className="text-tribal-400 text-sm mt-0.5">{characters.length} characters total</p>
      </div>

      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-tribal-500" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or background..."
          className="input pl-10"
        />
      </div>

      <div className="space-y-2">
        {filtered.map((char) => {
          const isOpen = expanded === char.id;
          return (
            <div key={char.id} className="bg-[#1a181e] border border-[#262328] rounded-xl overflow-hidden">
              <button
                className="w-full flex items-center justify-between p-4 text-left hover:bg-[#1e1c22] transition-colors"
                onClick={() => toggleExpand(char.id)}
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-[#c04e20] flex items-center justify-center text-sm font-bold text-tribal-900">
                    {char.name[0]}
                  </div>
                  <div>
                    <div className="text-tribal-100 font-semibold">{char.name}</div>
                    <div className="text-tribal-500 text-xs">{char.background} &middot; {char.skills.length} skills &middot; {char.inventory.length} items</div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="hidden md:flex items-center gap-2 text-xs">
                    {statConfig.map((s) => (
                      <span key={s.key} className={`${s.color} font-bold tabular-nums`}>
                        {s.label} {char[s.key as keyof AdminCharacter] as number}
                      </span>
                    ))}
                  </div>
                  {isOpen ? <ChevronUp size={18} className="text-tribal-400" /> : <ChevronDown size={18} className="text-tribal-400" />}
                </div>
              </button>

              {isOpen && (
                <div className="border-t border-[#262328] p-5 space-y-5 animate-fade-in">
                  <div>
                    <h3 className="text-xs font-bold text-tribal-300 uppercase tracking-widest mb-3">Stats</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {statConfig.map((s) => (
                        <div key={s.key}>
                          <label className="text-[10px] font-bold text-tribal-400 uppercase mb-1 block">{s.label}</label>
                          <input
                            type="number"
                            value={editStats[s.key] ?? 0}
                            onChange={(e) => setEditStats({ ...editStats, [s.key]: Number(e.target.value) })}
                            className="input text-center py-1.5"
                          />
                        </div>
                      ))}
                      <div>
                        <label className="text-[10px] font-bold text-tribal-400 uppercase mb-1 block">Stamina</label>
                        <input
                          type="number"
                          value={editStats.stamina ?? 0}
                          onChange={(e) => setEditStats({ ...editStats, stamina: Number(e.target.value) })}
                          className="input text-center py-1.5"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-tribal-400 uppercase mb-1 block">Max Stamina</label>
                        <input
                          type="number"
                          value={editStats.max_stamina ?? 0}
                          onChange={(e) => setEditStats({ ...editStats, max_stamina: Number(e.target.value) })}
                          className="input text-center py-1.5"
                        />
                      </div>
                    </div>
                    <Button variant="primary" size="sm" className="mt-3" icon={<Save size={14} />} onClick={() => saveStats(char.id)} loading={saving}>
                      Save Stats
                    </Button>
                  </div>

                  <div>
                    <h3 className="text-xs font-bold text-tribal-300 uppercase tracking-widest mb-3">Skills</h3>
                    <div className="space-y-2">
                      {char.skills.map((skill) => (
                        <div key={skill.id} className="flex items-center gap-3 bg-[#1e1c22] rounded-lg p-3">
                          <span className="text-tribal-200 font-medium text-sm w-24">{skill.name}</span>
                          <div className="flex items-center gap-2">
                              <label className="text-tribal-500 text-[10px] uppercase">Level</label>
                            <input
                              type="number"
                              value={skill.level}
                              onChange={(e) => updateSkillLevel(skill.id, Number(e.target.value))}
                              className="input w-16 text-center py-1 text-sm"
                              min={1}
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <label className="text-tribal-500 text-[10px] uppercase">XP</label>
                            <input
                              type="number"
                              value={skill.experience}
                              onChange={(e) => updateSkillXP(skill.id, Number(e.target.value))}
                              className="input w-24 text-center py-1 text-sm"
                              min={0}
                            />
                          </div>
                          <Button variant="ghost" size="sm" icon={<Zap size={12} />} onClick={() => updateSkillXP(skill.id, skill.experience + 50)}>
                            +50 XP
                          </Button>
                          <Button variant="ghost" size="sm" icon={<Zap size={12} />} onClick={() => updateSkillXP(skill.id, skill.experience + 500)}>
                            +500 XP
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-xs font-bold text-tribal-300 uppercase tracking-widest mb-3">Inventory</h3>
                    {char.inventory.length === 0 ? (
                      <p className="text-tribal-500 text-sm">Empty inventory.</p>
                    ) : (
                      <div className="space-y-1 mb-3">
                        {char.inventory.map((inv) => (
                          <div key={inv.id} className="flex items-center justify-between bg-[#1e1c22] rounded-lg px-3 py-2">
                            <span className="text-tribal-200 text-sm">{inv.item?.name || "Unknown"} <span className="text-tribal-500">x{inv.quantity}</span></span>
                            <Button variant="ghost" size="sm" icon={<Trash2 size={12} />} onClick={() => removeInventoryItem(inv.id)} />
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <select value={grantItemId} onChange={(e) => setGrantItemId(e.target.value)} className="input flex-1 py-1.5 text-sm">
                        <option value="">Select item...</option>
                        {items.map((item) => (
                          <option key={item.id} value={item.id}>{item.name} ({item.type})</option>
                        ))}
                      </select>
                      <input type="number" value={grantQty} onChange={(e) => setGrantQty(Number(e.target.value))} className="input w-20 text-center py-1.5 text-sm" min={1} />
                      <Button variant="secondary" size="sm" icon={<Plus size={14} />} onClick={() => grantItem(char.id)} disabled={!grantItemId}>
                        Grant
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="text-center py-12">
            <Users size={32} className="text-tribal-700 mx-auto mb-2" />
            <p className="text-tribal-500">No characters found.</p>
          </div>
        )}
      </div>
    </div>
  );
}
