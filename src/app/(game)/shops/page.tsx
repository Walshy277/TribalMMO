"use client";

import { useEffect, useState } from "react";
import { useGame, type CharacterWithSkills } from "@/lib/game";
import { supabase } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Store, Coins, Package, Search, ShoppingCart, Lock, TrendingDown } from "lucide-react";
import { typeIcons } from "@/lib/constants";
import { Alert } from "@/components/ui/Alert";
import type { Database } from "@/types/database";

type ShopItem = Database["public"]["Tables"]["shop_items"]["Row"];

const TABS = ["buy", "sell"] as const;

export default function ShopsPage() {
  const { character, refreshCharacter, logTransaction } = useGame();
  const [tab, setTab] = useState<"buy" | "sell">("buy");
  const [shopItems, setShopItems] = useState<ShopItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [buyQuantities, setBuyQuantities] = useState<Record<string, number>>({});
  const [sellQuantities, setSellQuantities] = useState<Record<string, number>>({});
  const [migrationMissing, setMigrationMissing] = useState(false);

  useEffect(() => {
    document.title = "Shops — TribalMMO";
    fetchShopItems();
  }, []);

  const fetchShopItems = async () => {
    const { data, error } = await supabase
      .from("shop_items")
      .select("*")
      .order("type")
      .order("buy_price") as { data: ShopItem[] | null; error: { code?: string; message?: string } | null };
    if (error && (error.code === "42P01" || error.message?.includes("does not exist"))) {
      setMigrationMissing(true);
    }
    setShopItems(data || []);
  };

  const buyFromShop = async (item: ShopItem) => {
    if (!character) return;
    const qty = buyQuantities[item.id] || 1;
    const totalCost = item.buy_price * qty;

    if (totalCost > character.coins) {
      setError("Not enough coins.");
      return;
    }

    setLoading(true);
    setError("");
    setSuccess("");

    // Deduct coins
    const { error: coinError } = await supabase.from("characters").update({ coins: character.coins - totalCost }).eq("id", character.id);
    if (coinError) { setError("Failed to deduct coins. Please try again."); setLoading(false); return; }

    // Add to inventory
    const existingInv = character.inventory.find((inv) => inv.item?.name === item.name);
    if (existingInv) {
      await supabase.from("inventory").update({ quantity: existingInv.quantity + qty }).eq("id", existingInv.id);
    } else {
      // Find or create the item in items table
      let { data: existingItem } = await supabase.from("items").select("id").eq("name", item.name).single();
      if (!existingItem) {
        const { data: newItem } = await supabase.from("items").insert({
          name: item.name,
          type: item.type,
          tier: item.tier,
          stats: item.stats,
        }).select("id").single();
        existingItem = newItem;
      }
      if (existingItem) {
        await supabase.from("inventory").insert({
          character_id: character.id,
          item_id: existingItem.id,
          quantity: qty,
        });
      }
    }

    await logTransaction(character.id, "shop_buy", -totalCost, `Bought ${qty}x ${item.name} from shop`, {
      item_name: item.name,
      quantity: qty,
      unit_price: item.buy_price,
    });

    setSuccess(`Bought ${qty}x ${item.name} for ${totalCost} coins.`);
    setBuyQuantities((prev) => ({ ...prev, [item.id]: 1 }));
    setLoading(false);
    await refreshCharacter();
  };

  const sellToShop = async (invItem: CharacterWithSkills["inventory"][0]) => {
    if (!character || !invItem.item) return;
    const shopItem = shopItems.find((si) => si.name === invItem.item!.name);
    if (!shopItem) {
      setError("This item cannot be sold to the shop.");
      return;
    }

    const qty = Math.min(sellQuantities[invItem.item_id] || 1, invItem.quantity);
    const totalValue = shopItem.sell_price * qty;

    setLoading(true);
    setError("");
    setSuccess("");

    // Add coins
    const { error: coinError } = await supabase.from("characters").update({ coins: character.coins + totalValue }).eq("id", character.id);
    if (coinError) { setError("Failed to add coins. Please try again."); setLoading(false); return; }

    // Remove from inventory
    const newQty = invItem.quantity - qty;
    if (newQty <= 0) {
      await supabase.from("inventory").delete().eq("id", invItem.id);
    } else {
      await supabase.from("inventory").update({ quantity: newQty }).eq("id", invItem.id);
    }

    await logTransaction(character.id, "shop_sell", totalValue, `Sold ${qty}x ${invItem.item.name} to shop`, {
      item_name: invItem.item.name,
      quantity: qty,
      unit_price: shopItem.sell_price,
    });

    setSuccess(`Sold ${qty}x ${invItem.item.name} for ${totalValue} coins.`);
    setSellQuantities((prev) => ({ ...prev, [invItem.item_id]: 1 }));
    setLoading(false);
    await refreshCharacter();
  };

  if (!character) return <div className="text-tribal-500 text-center mt-20">Create a character first.</div>;

  const itemTypes = [...new Set(shopItems.map((si) => si.type))];

  const filteredShopItems = shopItems
    .filter((item) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (!item.name.toLowerCase().includes(q) && !(item.description || "").toLowerCase().includes(q)) return false;
      }
      if (filterType !== "all" && item.type !== filterType) return false;
      return true;
    });

  const sellableItems = character.inventory.filter(
    (inv) => inv.item && !inv.equipped && inv.quantity > 0 && shopItems.some((si) => si.name === inv.item!.name)
  );

  return (
    <div className="space-y-5 animate-fade-in max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-tribal-100">General Store</h1>
          <p className="text-tribal-500 text-sm mt-0.5">Buy supplies and sell your resources</p>
        </div>
        <div className="flex items-center gap-2 text-tribal-100 bg-tribal-900/60 px-4 py-2 rounded-lg border border-tribal-800/30">
          <Coins size={16} className="text-tribal-400" />
          <span className="font-bold tabular-nums">{character.coins}</span>
          <span className="text-tribal-500 text-sm">gold</span>
        </div>
      </div>

      {error && (
        <Alert variant="error" onDismiss={() => setError("")}>{error}</Alert>
      )}
      {success && (
        <Alert variant="success" onDismiss={() => setSuccess("")}>{success}</Alert>
      )}
      {migrationMissing && (
        <div className="bg-tribal-900/40 border border-tribal-700/40 rounded-lg p-3 text-tribal-300 text-sm">
          Shop requires migration 004. Run <code>004_economy_system.sql</code> in the Supabase SQL editor.
        </div>
      )}

      <div className="flex gap-1">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => { setTab(t); setError(""); setSuccess(""); }}
            className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all border ${
              tab === t
                ? "bg-tribal-800/60 text-tribal-100 border-tribal-600/30"
                : "text-tribal-500 hover:text-tribal-300 border border-transparent"
            }`}
          >
            <span className="flex items-center gap-1.5">
              {t === "buy" ? <Store size={14} /> : <TrendingDown size={14} />}
              {t === "buy" ? "Buy" : "Sell"}
            </span>
          </button>
        ))}
      </div>

      {tab === "buy" ? (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <div className="relative flex-1 min-w-[150px]">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-tribal-600" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search shop..."
                className="input pl-9 text-sm"
              />
            </div>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="input w-auto text-sm"
            >
              <option value="all">All Types</option>
              {itemTypes.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          {filteredShopItems.length === 0 ? (
            <div className="text-center py-8">
              <Store size={32} className="text-tribal-800 mx-auto mb-2" />
              <p className="text-tribal-600">No items available.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredShopItems.map((item) => {
                const Icon = typeIcons[item.type] || Package;
                const qty = buyQuantities[item.id] || 1;
                const totalCost = item.buy_price * qty;
                const canAfford = character.coins >= totalCost;

                return (
                  <div key={item.id} className="bg-tribal-900/40 p-4 rounded-lg border border-tribal-800/20 hover:border-tribal-700/30 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-tribal-800/30 flex items-center justify-center shrink-0">
                          <Icon size={18} className="text-tribal-500" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-tribal-200 font-semibold text-sm">{item.name}</span>
                            {item.tier > 1 && (
                              <span className="text-tribal-700 text-xs bg-tribal-900/60 px-1.5 py-0.5 rounded">T{item.tier}</span>
                            )}
                          </div>
                          {item.description && (
                            <p className="text-tribal-600 text-xs mt-0.5">{item.description}</p>
                          )}
                          {item.stats && typeof item.stats === "object" && Object.keys(item.stats).length > 0 && (
                            <div className="flex flex-wrap gap-2 mt-1">
                              {Object.entries(item.stats as Record<string, number>).map(([key, val]) => (
                                <span key={key} className="text-[#4a9e6a] text-xs">+{val} {key.replace(/_/g, " ")}</span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-tribal-400 text-sm font-semibold flex items-center gap-1 tabular-nums">
                          <Coins size={14} /> {item.buy_price}
                        </span>
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            value={qty}
                            onChange={(e) => setBuyQuantities((prev) => ({ ...prev, [item.id]: Math.max(1, Number(e.target.value)) }))}
                            className="input w-16 text-sm text-center"
                            min={1}
                          />
                          <Button
                            variant={canAfford ? "primary" : "ghost"}
                            size="sm"
                            onClick={() => buyFromShop(item)}
                            loading={loading}
                            disabled={!canAfford}
                          >
                            {canAfford ? `Buy (${totalCost}c)` : "Can't afford"}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-tribal-500 text-sm">Sell your resources and items to the shop at fixed prices.</p>
          {sellableItems.length === 0 ? (
            <div className="text-center py-8">
              <Package size={32} className="text-tribal-800 mx-auto mb-2" />
              <p className="text-tribal-600">No items to sell.</p>
              <p className="text-tribal-700 text-sm mt-1">Gather resources or craft items to sell here.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {sellableItems.map((inv) => {
                const item = inv.item!;
                const shopItem = shopItems.find((si) => si.name === item.name);
                if (!shopItem) return null;
                const Icon = typeIcons[item.type] || Package;
                const qty = Math.min(sellQuantities[inv.item_id] || 1, inv.quantity);
                const totalValue = shopItem.sell_price * qty;

                return (
                  <div key={inv.id} className="bg-tribal-900/40 p-4 rounded-lg border border-tribal-800/20 hover:border-tribal-700/30 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Icon size={18} className="text-tribal-500" />
                        <div>
                          <span className="text-tribal-200 font-semibold text-sm">{item.name}</span>
                          <span className="text-tribal-600 text-sm ml-2 tabular-nums">x{inv.quantity}</span>
                          {item.tier > 1 && (
                            <span className="text-tribal-700 text-xs ml-2">Tier {item.tier}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-tribal-400 text-sm font-semibold flex items-center gap-1 tabular-nums">
                          <Coins size={14} /> {shopItem.sell_price} <span className="text-tribal-700 text-xs">each</span>
                        </span>
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            value={qty}
                            onChange={(e) => setSellQuantities((prev) => ({
                              ...prev,
                              [inv.item_id]: Math.max(1, Math.min(Number(e.target.value), inv.quantity)),
                            }))}
                            className="input w-16 text-sm text-center"
                            min={1}
                            max={inv.quantity}
                          />
                          <Button
                            variant="success"
                            size="sm"
                            onClick={() => sellToShop(inv)}
                            loading={loading}
                          >
                            Sell ({totalValue}c)
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
