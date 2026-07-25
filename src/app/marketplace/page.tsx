"use client";

import { useGame } from "@/lib/game";
import { supabase } from "@/lib/supabase/client";
import { useState, useEffect } from "react";

export default function MarketplacePage() {
  const { character, refreshCharacter } = useGame();
  const [listings, setListings] = useState<any[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedItem, setSelectedItem] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [price, setPrice] = useState(10);
  const [loading, setLoading] = useState(false);

  useEffect(() => { fetchListings(); }, []);

  const fetchListings = async () => {
    const { data } = await supabase
      .from("marketplace_listings")
      .select("*, seller:characters(name), item:items(name)")
      .order("created_at", { ascending: false });
    setListings(data || []);
  };

  const createListing = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!character) return;
    setLoading(true);
    setShowCreate(false);
    setLoading(false);
    await fetchListings();
  };

  if (!character) return <div className="text-tribal-400 text-center mt-20">Create a character first.</div>;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <span className="text-3xl">💰</span>
        <div>
          <h1 className="text-2xl font-bold text-tribal-100">Marketplace</h1>
          <p className="text-tribal-500 text-sm">Trade with other players</p>
        </div>
      </div>

      <div className="card border-tribal-600/30">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-tribal-200">Listings</h2>
          <button onClick={() => setShowCreate(!showCreate)} className={`text-sm py-1.5 px-4 rounded-lg transition-colors ${showCreate ? "btn-secondary" : "btn-primary"}`}>
            {showCreate ? "Cancel" : "+ Create Listing"}
          </button>
        </div>

        {showCreate && (
          <form onSubmit={createListing} className="space-y-3 mb-4 p-4 bg-tribal-800/50 rounded-lg border border-tribal-700/30 animate-fade-in">
            <div>
              <label className="block text-sm font-medium text-tribal-300 mb-1.5">Item</label>
              <select value={selectedItem} onChange={(e) => setSelectedItem(e.target.value)} className="input w-full" required>
                <option value="">Select an item...</option>
                <option value="wood">🪵 Wood</option>
                <option value="stone">🪨 Stone</option>
                <option value="herbs">🌿 Herbs</option>
                <option value="hides">🧶 Hides</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-tribal-300 mb-1.5">Quantity</label>
                <input type="number" value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} className="input w-full" min={1} />
              </div>
              <div>
                <label className="block text-sm font-medium text-tribal-300 mb-1.5">Price (each)</label>
                <input type="number" value={price} onChange={(e) => setPrice(Number(e.target.value))} className="input w-full" min={1} />
              </div>
            </div>
            <button type="submit" className="btn-primary w-full py-2.5" disabled={loading}>List Item</button>
          </form>
        )}

        {listings.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-4xl mb-2">🏪</div>
            <p className="text-tribal-500">No items listed for sale.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {listings.map((listing) => (
              <div key={listing.id} className="bg-tribal-800/50 p-4 rounded-lg border border-tribal-700/20 hover:border-tribal-500/30 transition-all">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">📦</span>
                    <div>
                      <span className="text-tribal-200 font-semibold">{listing.item?.name || "Unknown"}</span>
                      <span className="text-tribal-500 text-sm ml-2">x{listing.quantity}</span>
                      <p className="text-tribal-500 text-xs">by {listing.seller?.name || "Unknown"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-tribal-300 font-semibold">{listing.price} coins</span>
                    <button className="btn-secondary text-sm py-1.5 px-4">Buy</button>
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
