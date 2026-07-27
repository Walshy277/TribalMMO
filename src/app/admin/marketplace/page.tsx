"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { ShoppingCart, Trash2, Coins } from "lucide-react";

interface Listing {
  id: string;
  seller_id: string;
  item_id: string;
  quantity: number;
  price: number;
  created_at: string;
  seller: { name: string } | null;
  item: { name: string; type: string } | null;
}

export default function AdminMarketplacePage() {
  const [listings, setListings] = useState<Listing[]>([]);

  useEffect(() => {
    document.title = "Marketplace — Admin";
    fetchListings();
  }, []);

  const fetchListings = useCallback(async () => {
    const { data } = await supabase
      .from("marketplace_listings")
      .select("*, seller:characters(name), item:items(name, type)")
      .order("created_at", { ascending: false });
    if (data) setListings(data as unknown as Listing[]);
  }, []);

  const removeListing = async (id: string) => {
    await supabase.from("marketplace_listings").delete().eq("id", id);
    await fetchListings();
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold text-tribal-100">Marketplace Oversight</h1>
        <p className="text-tribal-400 text-sm mt-0.5">{listings.length} active listings</p>
      </div>

      <div className="bg-[#1a181e] border border-[#262328] rounded-xl overflow-x-auto">
        <table className="w-full text-sm min-w-[600px]">
          <thead>
            <tr className="border-b border-[#262328]">
              <th className="text-left text-[10px] font-bold text-tribal-400 uppercase tracking-wider p-3">Item</th>
              <th className="text-left text-[10px] font-bold text-tribal-400 uppercase tracking-wider p-3">Seller</th>
              <th className="text-left text-[10px] font-bold text-tribal-400 uppercase tracking-wider p-3">Qty</th>
              <th className="text-left text-[10px] font-bold text-tribal-400 uppercase tracking-wider p-3">Price</th>
              <th className="text-left text-[10px] font-bold text-tribal-400 uppercase tracking-wider p-3">Listed</th>
              <th className="text-right text-[10px] font-bold text-tribal-400 uppercase tracking-wider p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {listings.map((listing) => (
              <tr key={listing.id} className="border-b border-[#1e1c22] hover:bg-[#1e1c22] transition-colors">
                <td className="p-3">
                  <span className="text-tribal-200 font-medium">{listing.item?.name || "Unknown"}</span>
                  <span className="text-xs text-tribal-500 ml-2">{listing.item?.type}</span>
                </td>
                <td className="p-3 text-tribal-300">{listing.seller?.name || "Unknown"}</td>
                <td className="p-3 text-tribal-300 tabular-nums">{listing.quantity}</td>
                <td className="p-3">
                  <span className="text-tribal-300 font-semibold flex items-center gap-1 tabular-nums">
                    <Coins size={12} /> {listing.price}
                  </span>
                </td>
                <td className="p-3 text-tribal-500 text-xs tabular-nums">
                  {new Date(listing.created_at).toLocaleDateString()}
                </td>
                <td className="p-3 text-right">
                  <Button variant="ghost" size="sm" icon={<Trash2 size={12} />} onClick={() => removeListing(listing.id)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {listings.length === 0 && (
          <div className="text-center py-12">
            <ShoppingCart size={32} className="text-tribal-700 mx-auto mb-2" />
            <p className="text-tribal-500">No active listings.</p>
          </div>
        )}
      </div>
    </div>
  );
}
