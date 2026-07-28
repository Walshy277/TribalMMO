import { useEffect, useState } from "react";
import { useGame } from "@/lib/game";
import { supabase } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Coins, Package, Plus, X, ShoppingCart, Search, Trash2 } from "lucide-react";
import { Alert } from "@/components/ui/Alert";

interface Listing {
  id: string;
  seller_id: string;
  item_id: string;
  quantity: number;
  price: number;
  created_at: string;
  seller: { name: string; id: string } | null;
  item: { name: string; type: string; rarity: number } | null;
}

const TAX_RATE = 0.05;
const PAGE_SIZE = 20;

export default function MarketplacePage() {
  const { character, refreshCharacter, logTransaction } = useGame();
  const [listings, setListings] = useState<Listing[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedInvItem, setSelectedInvItem] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [price, setPrice] = useState(10);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"newest" | "price_asc" | "price_desc">("newest");
  const [filterType, setFilterType] = useState<string>("all");
  const [confirmBuy, setConfirmBuy] = useState<string | null>(null);

  useEffect(() => {
    document.title = "Marketplace — TribalMMO";
  }, []);

  useEffect(() => { fetchListings(); }, []);

  const fetchListings = async () => {
    const { data } = await supabase
      .from("marketplace_listings")
      .select("*, seller:characters!seller_id(name, id), item:items(name, type, rarity)")
      .order("created_at", { ascending: false }) as { data: Listing[] | null };
    setListings(data || []);
  };

  const createListing = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!character) return;
    setLoading(true);
    setError("");

    const invItem = character.inventory.find((inv) => inv.item?.name === selectedInvItem && !inv.equipped);
    if (!invItem || invItem.quantity < quantity) {
      setError("You don't have enough of this item.");
      setLoading(false);
      return;
    }

    if (price < 1) {
      setError("Price must be at least 1 gold.");
      setLoading(false);
      return;
    }

    const { error: rpcError } = await supabase.rpc("create_listing", {
      p_character_id: character.id,
      p_item_id: invItem.item_id,
      p_quantity: quantity,
      p_price: price,
    });

    if (rpcError) {
      setError(rpcError.message);
      setLoading(false);
      return;
    }

    setShowCreate(false);
    setSelectedInvItem("");
    setQuantity(1);
    setPrice(10);
    setLoading(false);
    await fetchListings();
    await refreshCharacter();
  };

  const cancelListing = async (listingId: string) => {
    const listing = listings.find((l) => l.id === listingId);
    if (!listing || listing.seller_id !== character?.id) return;

    setLoading(true);

    const { error: rpcError } = await supabase.rpc("cancel_listing", {
      p_character_id: character.id,
      p_listing_id: listingId,
    });

    if (rpcError) {
      setError(rpcError.message);
    }

    setLoading(false);
    await fetchListings();
    await refreshCharacter();
  };

  const buyListing = async (listing: Listing) => {
    if (!character || listing.seller_id === character.id) return;
    if (listing.price > character.gold) {
      setError("You don't have enough gold.");
      return;
    }

    setLoading(true);
    setError("");

    const { error: purchaseError } = await supabase.rpc("purchase_listing", {
      p_listing_id: listing.id,
      p_buyer_id: character.id,
      p_seller_id: listing.seller_id,
      p_price: listing.price,
    });
    if (purchaseError) { setError("Purchase failed. Please try again."); setLoading(false); return; }

    setLoading(false);
    setConfirmBuy(null);
    await fetchListings();
    await refreshCharacter();
  };

  const sellableItems = character?.inventory?.filter((inv) => inv.item && !inv.equipped && inv.quantity > 0) || [];
  const itemTypes = [...new Set(listings.map((l) => l.item?.type).filter(Boolean))];

  const filteredListings = listings
    .filter((l) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const itemName = l.item?.name?.toLowerCase() || "";
        const sellerName = l.seller?.name?.toLowerCase() || "";
        if (!itemName.includes(q) && !sellerName.includes(q)) return false;
      }
      if (filterType !== "all" && l.item?.type !== filterType) return false;
      return true;
    })
    .sort((a, b) => {
      if (sortBy === "price_asc") return a.price - b.price;
      if (sortBy === "price_desc") return b.price - a.price;
      return 0;
    });

  if (!character) return <div className="text-tribal-500 text-center mt-20">Create a character first.</div>;

  return (
    <div className="space-y-5 animate-fade-in max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-tribal-100">Marketplace</h1>
          <p className="text-tribal-500 text-sm mt-0.5">Trade with other players</p>
        </div>
        <div className="flex items-center gap-2 text-tribal-100 bg-tribal-900/60 px-4 py-2 rounded-lg border border-tribal-800/30">
          <Coins size={16} className="text-tribal-400" />
          <span className="font-bold tabular-nums">{character.gold}</span>
          <span className="text-tribal-500 text-sm">gold</span>
        </div>
      </div>

      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xs font-bold text-tribal-400 uppercase tracking-widest">Listings</h2>
          <Button
            variant={showCreate ? "secondary" : "primary"}
            size="sm"
            icon={showCreate ? <X size={14} /> : <Plus size={14} />}
            onClick={() => { setShowCreate(!showCreate); setError(""); }}
          >
            {showCreate ? "Cancel" : "Sell Item"}
          </Button>
        </div>

        {showCreate && (
          <form onSubmit={createListing} className="space-y-3 mb-4 p-4 bg-tribal-900/30 rounded-lg border border-tribal-800/20 animate-fade-in">
            <div>
              <label className="block text-xs font-bold text-tribal-300 mb-2 uppercase tracking-wider">Item from Inventory</label>
              <select value={selectedInvItem} onChange={(e) => setSelectedInvItem(e.target.value)} className="input" required>
                <option value="">Select an item...</option>
                {sellableItems.map((inv) => (
                  <option key={inv.id} value={inv.item!.name}>
                    {inv.item!.name} (x{inv.quantity})
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-tribal-300 mb-2 uppercase tracking-wider">Quantity</label>
                <input type="number" value={quantity} onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))} className="input" min={1} required />
              </div>
              <div>
                <label className="block text-xs font-bold text-tribal-300 mb-2 uppercase tracking-wider">Price (each)</label>
                <input type="number" value={price} onChange={(e) => setPrice(Math.max(1, Number(e.target.value)))} className="input" min={1} required />
              </div>
            </div>
            <p className="text-tribal-700 text-xs">5% tax on sale. You receive {Math.ceil(price * (1 - TAX_RATE))} gold per item.</p>
            {error && (
              <Alert variant="error" onDismiss={() => setError("")}>{error}</Alert>
            )}
            <Button type="submit" variant="primary" className="w-full" loading={loading} disabled={sellableItems.length === 0}>
              {sellableItems.length === 0 ? "No items to sell" : "Create Listing"}
            </Button>
          </form>
        )}

        <div className="flex flex-wrap gap-2 mb-4">
          <div className="relative flex-1 min-w-[150px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-tribal-600" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search items or sellers..."
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
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            className="input w-auto text-sm"
          >
            <option value="newest">Newest</option>
            <option value="price_asc">Price: Low-High</option>
            <option value="price_desc">Price: High-Low</option>
          </select>
        </div>

        {filteredListings.length === 0 ? (
          <div className="text-center py-8">
            <ShoppingCart size={32} className="text-tribal-800 mx-auto mb-2" />
            <p className="text-tribal-600">{listings.length === 0 ? "No items listed for sale." : "No listings match your filters."}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredListings.map((listing) => {
              const isOwn = listing.seller_id === character.id;
              const canAfford = character.gold >= listing.price;
              const isConfirming = confirmBuy === listing.id;

              return (
                <div key={listing.id} className="bg-tribal-900/40 p-4 rounded-lg border border-tribal-800/20 hover:border-tribal-700/30 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Package size={18} className="text-tribal-500 shrink-0" />
                      <div>
                        <span className="text-tribal-200 font-semibold text-sm">{listing.item?.name || "Unknown"}</span>
                        <span className="text-tribal-600 text-sm ml-2 tabular-nums">x{listing.quantity}</span>
                        {listing.item?.type && (
                          <span className="text-tribal-700 text-xs ml-2 capitalize">{listing.item.type}</span>
                        )}
                        <p className="text-tribal-700 text-xs">by {listing.seller?.name || "Unknown"}{isOwn && " (you)"}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-tribal-200 font-semibold text-sm flex items-center gap-1 tabular-nums">
                        <Coins size={14} className="text-tribal-400" /> {listing.price}
                      </span>
                      {isOwn ? (
                        <div className="flex items-center gap-2">
                          <span className="text-tribal-700 text-xs">Your listing</span>
                          <Button variant="ghost" size="sm" icon={<Trash2 size={12} />} onClick={() => cancelListing(listing.id)} loading={loading}>
                            Delist
                          </Button>
                        </div>
                      ) : isConfirming ? (
                        <div className="flex items-center gap-2 animate-fade-in">
                          <Button variant="danger" size="sm" onClick={() => buyListing(listing)} loading={loading}>
                            Confirm ({listing.price}g)
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => setConfirmBuy(null)}>
                            Cancel
                          </Button>
                        </div>
                      ) : (
                        <Button
                          variant={canAfford ? "secondary" : "ghost"}
                          size="sm"
                          onClick={() => setConfirmBuy(listing.id)}
                          disabled={!canAfford}
                        >
                          {canAfford ? "Buy" : "Can't afford"}
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
