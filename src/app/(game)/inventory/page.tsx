import { useEffect, useState } from "react";
import { useGame } from "@/lib/game";
import { supabase } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Swords, Shield, Package, PawPrint, Coins, FlaskConical, X, ArrowRightLeft, Trash2 } from "lucide-react";
import { typeIcons } from "@/lib/constants";
import { Alert } from "@/components/ui/Alert";

const slotTypes: Record<string, string> = { weapon: "weapon", armor: "armor", accessory: "accessory" };

interface ItemDetail {
  name: string;
  type: string;
  rarity: number;
  stats: Record<string, number>;
}

export default function InventoryPage() {
  const { character, refreshCharacter } = useGame();
  const [selectedItem, setSelectedItem] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    document.title = "Inventory — TribalMMO";
  }, []);

  if (!character) {
    return <div className="text-tribal-500 text-center mt-20">Create a character first.</div>;
  }

  const equippedWeapon = character.inventory.find((inv) => inv.equipped && inv.item?.type === "weapon");
  const equippedArmor = character.inventory.find((inv) => inv.equipped && inv.item?.type === "armor");
  const equippedAccessory = character.inventory.find((inv) => inv.equipped && inv.item?.type === "accessory");

  const unequippedItems = character.inventory.filter((inv) => !inv.equipped && inv.quantity > 0);
  const totalAttackBonus = equippedWeapon ? (equippedWeapon.item?.stats as Record<string, number>)?.attack || 0 : 0;
  const totalDefenseBonus = equippedArmor ? (equippedArmor.item?.stats as Record<string, number>)?.defense || 0 : 0;

  const equipItem = async (invId: string, itemType: string) => {
    if (!character) return;
    setLoading(true);
    setError("");
    setSuccess("");

    const slot = slotTypes[itemType];
    if (!slot) { setLoading(false); return; }

    try {
      const currentlyEquipped = character.inventory.find((inv) => inv.equipped && inv.item?.type === slot);
      if (currentlyEquipped) {
        const { error } = await supabase.from("inventory").update({ equipped: false }).eq("id", currentlyEquipped.id);
        if (error) throw error;
      }

      const { error } = await supabase.from("inventory").update({ equipped: true }).eq("id", invId);
      if (error) throw error;

      setSuccess("Item equipped.");
      await refreshCharacter();
      setSelectedItem(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to equip item.");
    }
    setLoading(false);
  };

  const unequipItem = async (invId: string) => {
    if (!character) return;
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const { error } = await supabase.from("inventory").update({ equipped: false }).eq("id", invId);
      if (error) throw error;
      setSuccess("Item unequipped.");
      await refreshCharacter();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to unequip item.");
    }
    setLoading(false);
  };

  const useConsumable = async (invId: string, item: ItemDetail) => {
    if (!character) return;
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const heal = item.stats?.heal || 0;
      if (heal > 0) {
        const newStamina = Math.min(character.max_stamina, (character.computed_stamina || character.stamina) + heal);
        const { error } = await supabase.from("characters").update({ stamina: newStamina, stamina_updated_at: new Date().toISOString() }).eq("id", character.id);
        if (error) throw error;
      }

      const invItem = character.inventory.find((inv) => inv.id === invId);
      if (invItem) {
        const newQty = invItem.quantity - 1;
        if (newQty <= 0) {
          const { error } = await supabase.from("inventory").delete().eq("id", invId);
          if (error) throw error;
        } else {
          const { error } = await supabase.from("inventory").update({ quantity: newQty }).eq("id", invId);
          if (error) throw error;
        }
      }

      setSuccess(heal > 0 ? `Used ${item.name}. Recovered ${heal} stamina.` : `Used ${item.name}.`);
      await refreshCharacter();
      setSelectedItem(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to use item.");
    }
    setLoading(false);
  };

  const dropItem = async (invId: string) => {
    if (!character) return;
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const { error } = await supabase.from("inventory").delete().eq("id", invId);
      if (error) throw error;
      setSuccess("Item dropped.");
      await refreshCharacter();
      setSelectedItem(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to drop item.");
    }
    setLoading(false);
  };

  const selectedInvItem = selectedItem ? character.inventory.find((inv) => inv.id === selectedItem) : null;

  const getStatDisplay = (item: ItemDetail) => {
    if (!item.stats || typeof item.stats !== "object") return null;
    return Object.entries(item.stats).map(([key, val]) => ({
      label: key.replace(/_/g, " "),
      value: val as number,
    }));
  };

  return (
    <div className="space-y-5 animate-fade-in max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-tribal-100">Inventory</h1>
          <p className="text-tribal-500 text-sm mt-0.5">Manage your equipment and items</p>
        </div>
        <div className="flex items-center gap-2 text-tribal-100 bg-tribal-900/60 px-4 py-2 rounded-lg border border-tribal-800/30">
          <Coins size={16} className="text-tribal-400" />
          <span className="font-bold tabular-nums">{character.gold}</span>
          <span className="text-tribal-500 text-sm">gold</span>
        </div>
      </div>

      {error && <Alert variant="error" onDismiss={() => setError("")}>{error}</Alert>}
      {success && <Alert variant="success" onDismiss={() => setSuccess("")}>{success}</Alert>}

      <div className="card">
        <h2 className="text-xs font-bold text-tribal-400 uppercase tracking-widest mb-4">Equipment</h2>
        <div className="grid grid-cols-3 gap-4">
          <div className={`bg-tribal-900/40 p-5 rounded-lg border text-center transition-colors ${
            equippedWeapon ? "border-[#2d6e44]/30 hover:border-[#2d6e44]/40" : "border-tribal-800/20"
          }`}>
            <Swords size={28} className={`mx-auto mb-2 ${equippedWeapon ? "text-[#4a9e6a]" : "text-tribal-600"}`} />
            <div className="text-tribal-600 text-[11px] uppercase font-bold tracking-wider">Weapon</div>
            {equippedWeapon ? (
              <>
                <div className="text-tribal-100 font-semibold mt-1">{equippedWeapon.item?.name}</div>
                <div className="text-[#4a9e6a] text-xs mt-1">ATK +{totalAttackBonus}</div>
                <Button variant="ghost" size="sm" className="mt-2" onClick={() => unequipItem(equippedWeapon.id)} loading={loading}>
                  Unequip
                </Button>
              </>
            ) : (
              <>
                <div className="text-tribal-100 font-semibold mt-1">Bare Hands</div>
                <div className="text-tribal-700 text-xs mt-1">ATK +0</div>
              </>
            )}
          </div>
          <div className={`bg-tribal-900/40 p-5 rounded-lg border text-center transition-colors ${
            equippedArmor ? "border-[#2d6e44]/30 hover:border-[#2d6e44]/40" : "border-tribal-800/20"
          }`}>
            <Shield size={28} className={`mx-auto mb-2 ${equippedArmor ? "text-[#4a9e6a]" : "text-tribal-600"}`} />
            <div className="text-tribal-600 text-[11px] uppercase font-bold tracking-wider">Armor</div>
            {equippedArmor ? (
              <>
                <div className="text-tribal-100 font-semibold mt-1">{equippedArmor.item?.name}</div>
                <div className="text-[#4a9e6a] text-xs mt-1">DEF +{totalDefenseBonus}</div>
                <Button variant="ghost" size="sm" className="mt-2" onClick={() => unequipItem(equippedArmor.id)} loading={loading}>
                  Unequip
                </Button>
              </>
            ) : (
              <>
                <div className="text-tribal-100 font-semibold mt-1">Cloth Wrap</div>
                <div className="text-tribal-700 text-xs mt-1">DEF +0</div>
              </>
            )}
          </div>
          <div className={`bg-tribal-900/40 p-5 rounded-lg border text-center transition-colors ${
            equippedAccessory ? "border-[#2d6e44]/30 hover:border-[#2d6e44]/40" : "border-tribal-800/20"
          }`}>
            <FlaskConical size={28} className={`mx-auto mb-2 ${equippedAccessory ? "text-[#4a9e6a]" : "text-tribal-600"}`} />
            <div className="text-tribal-600 text-[11px] uppercase font-bold tracking-wider">Accessory</div>
            {equippedAccessory ? (
              <>
                <div className="text-tribal-100 font-semibold mt-1">{equippedAccessory.item?.name}</div>
                <div className="text-[#4a9e6a] text-xs mt-1">
                  {(() => {
                    const stats = equippedAccessory.item?.stats as Record<string, number>;
                    if (!stats) return null;
                    return Object.entries(stats).map(([k, v]) => `${k.slice(0, 3).toUpperCase()} +${v}`).join(" ");
                  })()}
                </div>
                <Button variant="ghost" size="sm" className="mt-2" onClick={() => unequipItem(equippedAccessory.id)} loading={loading}>
                  Unequip
                </Button>
              </>
            ) : (
              <>
                <div className="text-tribal-100 font-semibold mt-1">Empty Slot</div>
                <div className="text-tribal-700 text-xs mt-1">No bonuses</div>
              </>
            )}
          </div>
        </div>
        {(totalAttackBonus > 0 || totalDefenseBonus > 0) && (
          <div className="mt-3 text-xs text-tribal-500 text-center">
            Equipment Bonuses: ATK +{totalAttackBonus} / DEF +{totalDefenseBonus}
          </div>
        )}
      </div>

      <div className="card">
        <h2 className="text-xs font-bold text-tribal-400 uppercase tracking-widest mb-4">Items</h2>
        {unequippedItems.length === 0 ? (
          <div className="text-center py-8">
            <Package size={32} className="text-tribal-800 mx-auto mb-2" />
            <p className="text-tribal-600">Your inventory is empty.</p>
            <p className="text-tribal-700 text-sm mt-1">Go gather or craft some items!</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {unequippedItems.map((inv) => {
              const item = inv.item;
              if (!item) return null;
              const Icon = typeIcons[item.type] || Package;
              const stats = getStatDisplay(item as ItemDetail);
              return (
                <div
                  key={inv.id}
                  className={`bg-tribal-900/40 p-3 rounded-lg border text-center hover:border-tribal-700/30 transition-colors cursor-pointer ${
                    selectedItem === inv.id ? "border-tribal-600/30 ring-1 ring-tribal-600/20" : "border-tribal-800/20"
                  }`}
                  onClick={() => setSelectedItem(selectedItem === inv.id ? null : inv.id)}
                >
                  <Icon size={20} className="text-tribal-500 mx-auto mb-1" />
                  <div className="text-tribal-200 text-sm font-medium">{item.name}</div>
                  <div className="text-tribal-600 text-xs tabular-nums">x{inv.quantity}</div>
                  {item.rarity > 1 && (
                    <div className="text-tribal-700 text-xs mt-0.5">Rarity {item.rarity}</div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {selectedInvItem && selectedInvItem.item && (
        <div className="card animate-fade-in">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              {(() => {
                const Icon = typeIcons[selectedInvItem.item!.type] || Package;
                return <Icon size={24} className="text-tribal-400" />;
              })()}
              <div>
                <h3 className="text-tribal-100 font-bold text-lg">{selectedInvItem.item!.name}</h3>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-tribal-500 text-xs capitalize">{selectedInvItem.item!.type}</span>
                  {selectedInvItem.item!.rarity > 1 && (
                    <span className="text-tribal-700 text-xs bg-tribal-900/60 px-1.5 py-0.5 rounded">Rarity {selectedInvItem.item!.rarity}</span>
                  )}
                  <span className="text-tribal-600 text-xs">x{selectedInvItem.quantity}</span>
                </div>
              </div>
            </div>
            <button onClick={() => setSelectedItem(null)} className="text-tribal-600 hover:text-tribal-300 transition-colors">
              <X size={16} />
            </button>
          </div>

          {(selectedInvItem.item!.stats && typeof selectedInvItem.item!.stats === "object" && Object.keys(selectedInvItem.item!.stats).length > 0) && (
            <div className="mb-4">
              <p className="text-xs font-bold text-tribal-400 uppercase tracking-wider mb-2">Stats</p>
              <div className="bg-tribal-900/30 rounded-lg p-3 space-y-1">
                {getStatDisplay(selectedInvItem.item as ItemDetail)?.map((s) => (
                  <div key={s.label} className="flex items-center justify-between text-sm">
                    <span className="text-tribal-300 capitalize">{s.label}</span>
                    <span className="text-[#4a9e6a] font-semibold">+{s.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-2">
            {slotTypes[selectedInvItem.item!.type] && (
              <Button variant="primary" size="sm" icon={<ArrowRightLeft size={14} />} onClick={() => equipItem(selectedInvItem.id, selectedInvItem.item!.type)} loading={loading}>
                Equip
              </Button>
            )}
            {selectedInvItem.item!.type === "resources" && (
              <Button variant="success" size="sm" icon={<FlaskConical size={14} />} onClick={() => useConsumable(selectedInvItem.id, selectedInvItem.item as ItemDetail)} loading={loading}>
                Use
              </Button>
            )}
            <Button variant="danger" size="sm" icon={<Trash2 size={14} />} onClick={() => dropItem(selectedInvItem.id)} loading={loading}>
              Drop
            </Button>
          </div>
        </div>
      )}

      <div className="card">
        <h2 className="text-xs font-bold text-tribal-400 uppercase tracking-widest mb-4">Pets</h2>
        {!character.pets || character.pets.length === 0 ? (
          <div className="text-center py-6">
            <PawPrint size={32} className="text-tribal-800 mx-auto mb-2" />
            <p className="text-tribal-600">No pets yet.</p>
            <p className="text-tribal-700 text-sm mt-1">Visit the marketplace to find a companion.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {character.pets.map((pet) => (
              <div key={pet.id} className="bg-tribal-900/40 p-3 rounded-lg flex items-center justify-between border border-tribal-800/20">
                <div className="flex items-center gap-3">
                  <PawPrint size={18} className={pet.equipped ? "text-[#4a9e6a]" : "text-tribal-500"} />
                  <div>
                    <span className="text-tribal-200 font-semibold">{pet.name}</span>
                    <span className="text-tribal-500 text-sm capitalize ml-2">{pet.type}</span>
                    {pet.equipped && (
                      <span className="text-[#4a9e6a] text-xs ml-2 font-bold uppercase">Equipped</span>
                    )}
                  </div>
                </div>
                <Button
                  variant={pet.equipped ? "ghost" : "secondary"}
                  size="sm"
                  loading={loading}
                  onClick={async () => {
                    setLoading(true);
                    if (pet.equipped) {
                      await supabase.from("pets").update({ equipped: false }).eq("id", pet.id);
                    } else {
                      await supabase.from("pets").update({ equipped: false }).eq("character_id", character.id);
                      await supabase.from("pets").update({ equipped: true }).eq("id", pet.id);
                    }
                    await refreshCharacter();
                    setLoading(false);
                  }}
                >
                  {pet.equipped ? "Unequip" : "Equip"}
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
