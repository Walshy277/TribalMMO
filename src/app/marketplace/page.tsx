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

  useEffect(() => {
    fetchListings();
  }, []);

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
    // For now, just show the concept - real inventory integration would go here
    setShowCreate(false);
    setLoading(false);
    await fetchListings();
  };

  if (!character) {
    return <div className="text-tribal-400 text-center mt-20">Create a character first.</div>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-tribal-100">Marketplace</h1>

      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-tribal-200">Listings</h2>
          <button onClick={() => setShowCreate(!showCreate)} className="btn-primary text-sm">
            {showCreate ? "Cancel" : "Create Listing"}
          </button>
        </div>

        {showCreate && (
          <form onSubmit={createListing} className="space-y-3 mb-4 p-3 bg-tribal-800 rounded">
            <div>
              <label className="block text-sm text-tribal-300 mb-1">Item</label>
              <select
                value={selectedItem}
                onChange={(e) => setSelectedItem(e.target.value)}
                className="input w-full"
                required
              >
                <option value="">Select an item...</option>
                <option value="wood">Wood</option>
                <option value="stone">Stone</option>
                <option value="herbs">Herbs</option>
                <option value="hides">Hides</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-tribal-300 mb-1">Quantity</label>
                <input
                  type="number"
                  value={quantity}
                  onChange={(e) => setQuantity(Number(e.target.value))}
                  className="input w-full"
                  min={1}
                />
              </div>
              <div>
                <label className="block text-sm text-tribal-300 mb-1">Price (each)</label>
                <input
                  type="number"
                  value={price}
                  onChange={(e) => setPrice(Number(e.target.value))}
                  className="input w-full"
                  min={1}
                />
              </div>
            </div>
            <button type="submit" className="btn-primary" disabled={loading}>
              List Item
            </button>
          </form>
        )}

        {listings.length === 0 ? (
          <p className="text-tribal-400">No items listed for sale.</p>
        ) : (
          <div className="space-y-2">
            {listings.map((listing) => (
              <div key={listing.id} className="bg-tribal-800 p-3 rounded flex items-center justify-between">
                <div>
                  <span className="text-tribal-200 font-semibold">{listing.item?.name || "Unknown"}</span>
                  <span className="text-tribal-500 text-sm ml-2">x{listing.quantity}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-tribal-300">{listing.price} coins each</span>
                  <span className="text-tribal-500 text-sm">by {listing.seller?.name || "Unknown"}</span>
                  <button className="btn-secondary text-sm">Buy</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
