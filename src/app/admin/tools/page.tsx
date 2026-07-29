import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Wrench, Users, Zap, Trash2, RotateCcw } from "lucide-react";

interface AdminCharacter {
  id: string;
  name: string;
  stamina: number;
  max_stamina: number;
  user_id: string;
  actionCount?: number;
}

export default function AdminToolsPage() {
  const [characters, setCharacters] = useState<AdminCharacter[]>([]);
  const [search, setSearch] = useState("");
  const [result, setResult] = useState("");

  useEffect(() => {
    document.title = "Tools — Admin";
    fetchCharacters();
  }, []);

  const fetchCharacters = useCallback(async () => {
    const { data: chars } = await supabase
      .from("characters")
      .select("id, name, stamina, max_stamina, user_id");
    if (chars) setCharacters(chars);
  }, []);

  const filtered = characters.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  const resetStamina = async (charId: string) => {
    const char = characters.find((c) => c.id === charId);
    if (!char) return;
    await supabase.from("characters").update({ stamina: char.max_stamina }).eq("id", charId);
    setResult(`Reset stamina for ${char.name} to ${char.max_stamina}`);
    await fetchCharacters();
  };

  const resetAllStamina = async () => {
    if (!confirm("Reset stamina for ALL characters?")) return;
    const { data: chars } = await supabase.from("characters").select("id, max_stamina");
    if (chars) {
      for (const c of chars) {
        await supabase.from("characters").update({ stamina: c.max_stamina }).eq("id", c.id);
      }
    }
    setResult("Reset stamina for all characters.");
    await fetchCharacters();
  };

  const completeActions = async (charId: string) => {
    const char = characters.find((c) => c.id === charId);
    if (!char) return;
    await supabase.from("actions").delete().eq("character_id", charId);
    setResult(`Completed all pending actions for ${char.name}`);
    await fetchCharacters();
  };

  const deleteAllListings = async () => {
    if (!confirm("Remove ALL marketplace listings?")) return;
    await supabase.from("marketplace_listings").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    setResult("Removed all marketplace listings.");
  };

  const wipeActions = async () => {
    if (!confirm("Delete ALL pending actions across all characters?")) return;
    await supabase.from("actions").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    setResult("Deleted all pending actions.");
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Server Tools</h1>
        <p className="text-slate-400 text-sm mt-0.5">Administrative utilities</p>
      </div>

      {result && (
        <div className="bg-[#122a1b] border border-[#2d6e44] rounded-lg p-3 text-[#5ab87c] text-sm animate-fade-in">
          {result}
          <button className="ml-2 text-[#3d8b5c] hover:text-[#5ab87c]" onClick={() => setResult("")}>dismiss</button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-[#1a181e] border border-[#262328] rounded-xl p-5">
          <h2 className="text-xs font-bold text-slate-300 uppercase tracking-widest mb-4 flex items-center gap-2">
            <RotateCcw size={14} /> Bulk Actions
          </h2>
          <div className="space-y-2">
            <Button variant="secondary" className="w-full justify-start" size="sm" onClick={resetAllStamina}>
              Reset All Stamina
            </Button>
            <Button variant="secondary" className="w-full justify-start" size="sm" onClick={wipeActions}>
              Wipe All Pending Actions
            </Button>
            <Button variant="danger" className="w-full justify-start" size="sm" icon={<Trash2 size={14} />} onClick={deleteAllListings}>
              Remove All Marketplace Listings
            </Button>
          </div>
        </div>

        <div className="bg-[#1a181e] border border-[#262328] rounded-xl p-5">
          <h2 className="text-xs font-bold text-slate-300 uppercase tracking-widest mb-4 flex items-center gap-2">
            <Users size={14} /> Per-Character Tools
          </h2>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search characters..."
            className="input mb-3 text-sm"
          />
          <div className="space-y-1 max-h-80 overflow-y-auto">
            {filtered.map((char) => (
              <div key={char.id} className="flex items-center justify-between bg-[#1e1c22] rounded-lg px-3 py-2">
                <div>
                  <span className="text-slate-200 text-sm font-medium">{char.name}</span>
                  <span className="text-slate-500 text-xs ml-2 tabular-nums">STA {char.stamina}/{char.max_stamina}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" icon={<RotateCcw size={12} />} onClick={() => resetStamina(char.id)} title="Reset stamina" />
                  <Button variant="ghost" size="sm" icon={<Zap size={12} />} onClick={() => completeActions(char.id)} title="Complete all actions" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
