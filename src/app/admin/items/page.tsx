"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Package, Plus, Pencil, Trash2, X, Save } from "lucide-react";

interface Item {
  id: string;
  name: string;
  type: string;
  tier: number;
  stats: Record<string, unknown>;
  recipe_id: string | null;
}

const itemTypes = ["weapon", "armor", "consumable", "tool", "resource", "pet"];

export default function AdminItemsPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", type: "weapon", tier: 1, stats: "{}" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    document.title = "Items — Admin";
    fetchItems();
  }, []);

  const fetchItems = useCallback(async () => {
    const { data } = await supabase.from("items").select("*").order("name");
    if (data) setItems(data as Item[]);
  }, []);

  const resetForm = () => {
    setForm({ name: "", type: "weapon", tier: 1, stats: "{}" });
    setShowCreate(false);
    setEditing(null);
  };

  const startEdit = (item: Item) => {
    setEditing(item.id);
    setShowCreate(false);
    setForm({
      name: item.name,
      type: item.type,
      tier: item.tier,
      stats: JSON.stringify(item.stats || {}, null, 2),
    });
  };

  const saveItem = async () => {
    setSaving(true);
    let parsedStats = {};
    try { parsedStats = JSON.parse(form.stats); } catch { /* keep default */ }

    if (editing) {
      await supabase.from("items").update({ name: form.name, type: form.type, tier: form.tier, stats: parsedStats }).eq("id", editing);
    } else {
      await supabase.from("items").insert({ name: form.name, type: form.type, tier: form.tier, stats: parsedStats });
    }
    resetForm();
    await fetchItems();
    setSaving(false);
  };

  const deleteItem = async (id: string) => {
    await supabase.from("items").delete().eq("id", id);
    await fetchItems();
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-tribal-100">Item Manager</h1>
          <p className="text-tribal-400 text-sm mt-0.5">{items.length} items in database</p>
        </div>
        <Button variant="primary" size="sm" icon={<Plus size={14} />} onClick={() => { resetForm(); setShowCreate(!showCreate); }}>
          {showCreate ? "Cancel" : "Create Item"}
        </Button>
      </div>

      {(showCreate || editing) && (
        <div className="bg-[#1a181e] border border-[#262328] rounded-xl p-5 space-y-4 animate-fade-in">
          <h2 className="text-xs font-bold text-tribal-300 uppercase tracking-widest">{editing ? "Edit Item" : "New Item"}</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-[10px] font-bold text-tribal-400 uppercase mb-1 block">Name</label>
              <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input" placeholder="Item name..." />
            </div>
            <div>
              <label className="text-[10px] font-bold text-tribal-400 uppercase mb-1 block">Type</label>
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="input">
                {itemTypes.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold text-tribal-400 uppercase mb-1 block">Tier</label>
              <input type="number" value={form.tier} onChange={(e) => setForm({ ...form, tier: Number(e.target.value) })} className="input" min={1} />
            </div>
          </div>
          <div>
            <label className="text-[10px] font-bold text-tribal-400 uppercase mb-1 block">Stats (JSON)</label>
            <textarea value={form.stats} onChange={(e) => setForm({ ...form, stats: e.target.value })} className="input font-mono text-xs" rows={4} placeholder='{"attack": 5}' />
          </div>
          <div className="flex gap-2">
            <Button variant="primary" size="sm" icon={<Save size={14} />} onClick={saveItem} loading={saving}>{editing ? "Update" : "Create"}</Button>
            <Button variant="secondary" size="sm" icon={<X size={14} />} onClick={resetForm}>Cancel</Button>
          </div>
        </div>
      )}

      <div className="bg-[#1a181e] border border-[#262328] rounded-xl overflow-x-auto">
        <table className="w-full text-sm min-w-[500px]">
          <thead>
            <tr className="border-b border-[#262328]">
              <th className="text-left text-[10px] font-bold text-tribal-400 uppercase tracking-wider p-3">Name</th>
              <th className="text-left text-[10px] font-bold text-tribal-400 uppercase tracking-wider p-3">Type</th>
              <th className="text-left text-[10px] font-bold text-tribal-400 uppercase tracking-wider p-3">Tier</th>
              <th className="text-right text-[10px] font-bold text-tribal-400 uppercase tracking-wider p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-b border-[#1e1c22] hover:bg-[#1e1c22] transition-colors">
                <td className="p-3 text-tribal-200 font-medium">{item.name}</td>
                <td className="p-3">
                  <span className="text-xs bg-[#1a181e] text-tribal-300 px-2 py-1 rounded-full border border-tribal-600/30">{item.type}</span>
                </td>
                <td className="p-3 text-tribal-300 tabular-nums">{item.tier}</td>
                <td className="p-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button variant="ghost" size="sm" icon={<Pencil size={12} />} onClick={() => startEdit(item)} />
                    <Button variant="ghost" size="sm" icon={<Trash2 size={12} />} onClick={() => deleteItem(item.id)} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {items.length === 0 && (
          <div className="text-center py-12">
            <Package size={32} className="text-tribal-700 mx-auto mb-2" />
            <p className="text-tribal-500">No items yet.</p>
          </div>
        )}
      </div>
    </div>
  );
}
