"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useGame } from "@/lib/game";
import { supabase } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Gavel, Clock, Coins, Package, Plus, X, Search, Trophy, AlertTriangle, Check } from "lucide-react";
import { Alert } from "@/components/ui/Alert";

interface AuctionRow {
  id: string;
  seller_id: string;
  item_id: string;
  quantity: number;
  starting_price: number;
  current_bid: number;
  current_bidder_id: string | null;
  ends_at: string;
  created_at: string;
  claimed: boolean;
  seller: { name: string; id: string } | null;
  item: { name: string; type: string; tier: number } | null;
  current_bidder: { name: string } | null;
}

type Tab = "browse" | "my_selling" | "my_bidding";

const durations = [
  { label: "15 min", value: 15 * 60 },
  { label: "1 hour", value: 60 * 60 },
  { label: "4 hours", value: 4 * 60 * 60 },
  { label: "12 hours", value: 12 * 60 * 60 },
  { label: "24 hours", value: 24 * 60 * 60 },
];

export default function AuctionHousePage() {
  const { character, refreshCharacter, logTransaction } = useGame();
  const [auctions, setAuctions] = useState<AuctionRow[]>([]);
  const [tab, setTab] = useState<Tab>("browse");
  const [showCreate, setShowCreate] = useState(false);
  const [selectedInvItem, setSelectedInvItem] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [startingPrice, setStartingPrice] = useState(10);
  const [duration, setDuration] = useState(3600);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [bidAmounts, setBidAmounts] = useState<Record<string, number>>({});
  const [confirmBid, setConfirmBid] = useState<string | null>(null);
  const [, setTick] = useState(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    document.title = "Auction House — TribalMMO";
  }, []);

  useEffect(() => {
    fetchAuctions();
    tickRef.current = setInterval(() => setTick((t) => t + 1), 1000);
    return () => { if (tickRef.current) clearInterval(tickRef.current); };
  }, []);

  const fetchAuctions = async () => {
    const { data } = await supabase
      .from("auction_house")
      .select("*, seller:characters!seller_id(name, id), item:items(name, type, tier), current_bidder:characters!current_bidder_id(name)")
      .order("ends_at", { ascending: true }) as { data: AuctionRow[] | null };
    setAuctions(data || []);
  };

  const createAuction = async (e: React.FormEvent) => {
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

    if (startingPrice < 1) {
      setError("Starting price must be at least 1 coin.");
      setLoading(false);
      return;
    }

    const endsAt = new Date(Date.now() + duration * 1000).toISOString();

    const newQty = invItem.quantity - quantity;
    if (newQty <= 0) {
      await supabase.from("inventory").delete().eq("id", invItem.id);
    } else {
      await supabase.from("inventory").update({ quantity: newQty }).eq("id", invItem.id);
    }

    const { error: insertError } = await supabase.from("auction_house").insert({
      seller_id: character.id,
      item_id: invItem.item_id,
      quantity,
      starting_price: startingPrice,
      ends_at: endsAt,
    });

    if (insertError) {
      setError(insertError.message);
    }

    setShowCreate(false);
    setSelectedInvItem("");
    setQuantity(1);
    setStartingPrice(10);
    setLoading(false);
    await fetchAuctions();
    await refreshCharacter();
  };

  const placeBid = async (auction: AuctionRow) => {
    if (!character) return;
    const bidAmount = bidAmounts[auction.id] || auction.current_bid + 1;

    if (bidAmount <= auction.current_bid) {
      setError("Bid must be higher than current bid.");
      return;
    }

    if (bidAmount > character.coins) {
      setError("You don't have enough coins.");
      return;
    }

    if (auction.seller_id === character.id) {
      setError("You can't bid on your own auction.");
      return;
    }

    setLoading(true);
    setError("");

    if (auction.current_bidder_id && auction.current_bidder_id !== character.id) {
      const { error: refundError } = await supabase.rpc("refund_bidder", { p_bidder_id: auction.current_bidder_id, p_amount: auction.current_bid });
      if (refundError) { setError("Failed to refund previous bidder. Please try again."); setLoading(false); return; }
    }

    const { error: bidError } = await supabase.from("characters").update({ coins: character.coins - bidAmount }).eq("id", character.id);
    if (bidError) { setError("Failed to deduct coins. Please try again."); setLoading(false); return; }

    const { error: updateError } = await supabase.from("auction_house").update({
      current_bid: bidAmount,
      current_bidder_id: character.id,
    }).eq("id", auction.id);
    if (updateError) { setError("Failed to place bid. Please try again."); setLoading(false); return; }

    await logTransaction(character.id, "auction_bid", -bidAmount, `Bid on ${auction.item?.name || "item"}`, {
      item_name: auction.item?.name,
      auction_id: auction.id,
      bid_amount: bidAmount,
    });

    setLoading(false);
    setConfirmBid(null);
    setBidAmounts((prev) => ({ ...prev, [auction.id]: 0 }));
    await fetchAuctions();
    await refreshCharacter();
  };

  const claimAuction = async (auction: AuctionRow) => {
    if (!character) return;
    setLoading(true);

    const now = new Date();
    const endsAt = new Date(auction.ends_at);
    const hasEnded = now >= endsAt;

    if (!hasEnded && auction.seller_id !== character.id) {
      setLoading(false);
      return;
    }

    if (hasEnded && auction.current_bidder_id) {
      if (auction.current_bidder_id === character.id) {
        const existingInv = character.inventory.find((inv) => inv.item_id === auction.item_id);
        if (existingInv) {
          const { error } = await supabase.from("inventory").update({ quantity: existingInv.quantity + auction.quantity }).eq("id", existingInv.id);
          if (error) console.error("Failed to update inventory:", error);
        } else {
          const { error } = await supabase.from("inventory").insert({
            character_id: character.id,
            item_id: auction.item_id,
            quantity: auction.quantity,
          });
          if (error) console.error("Failed to add to inventory:", error);
        }

        const { error: payoutError } = await supabase.rpc("auction_payout", { p_seller_id: auction.seller_id, p_total_bid: auction.current_bid });
        if (payoutError) console.error("Failed to pay seller:", payoutError);
        await logTransaction(auction.seller_id, "auction_sale", auction.current_bid, `Auction sale: ${auction.item?.name || "item"}`, {
          item_name: auction.item?.name,
          buyer_id: character.id,
          total_bid: auction.current_bid,
        });
      } else if (auction.seller_id === character.id) {
        const refund = auction.current_bid;
        const { error: refundError } = await supabase.from("characters").update({ coins: character.coins + refund }).eq("id", character.id);
        if (refundError) console.error("Failed to refund seller:", refundError);
        await logTransaction(character.id, "auction_sale", refund, `Auction sold: ${auction.item?.name || "item"}`, {
          item_name: auction.item?.name,
          buyer_id: auction.current_bidder_id,
          total_bid: auction.current_bid,
        });
      }
    } else if (hasEnded && !auction.current_bidder_id) {
      if (auction.seller_id === character.id) {
        const existingInv = character.inventory.find((inv) => inv.item_id === auction.item_id);
        if (existingInv) {
          const { error } = await supabase.from("inventory").update({ quantity: existingInv.quantity + auction.quantity }).eq("id", existingInv.id);
          if (error) console.error("Failed to update inventory:", error);
        } else {
          const { error } = await supabase.from("inventory").insert({
            character_id: character.id,
            item_id: auction.item_id,
            quantity: auction.quantity,
          });
          if (error) console.error("Failed to add to inventory:", error);
        }
      }
    } else if (!hasEnded && auction.seller_id === character.id) {
      const existingInv = character.inventory.find((inv) => inv.item_id === auction.item_id);
      if (existingInv) {
        const { error } = await supabase.from("inventory").update({ quantity: existingInv.quantity + auction.quantity }).eq("id", existingInv.id);
        if (error) console.error("Failed to update inventory:", error);
      } else {
        const { error } = await supabase.from("inventory").insert({
          character_id: character.id,
          item_id: auction.item_id,
          quantity: auction.quantity,
        });
        if (error) console.error("Failed to add to inventory:", error);
      }

      if (auction.current_bidder_id) {
        const { error: refundError } = await supabase.from("characters").update({ coins: character.coins + auction.current_bid }).eq("id", auction.current_bidder_id);
        if (refundError) console.error("Failed to refund bidder:", refundError);
      }
    }

    await supabase.from("auction_house").delete().eq("id", auction.id);
    setLoading(false);
    await fetchAuctions();
    await refreshCharacter();
  };

  const getTimeRemaining = (endsAt: string) => {
    const now = Date.now();
    const end = new Date(endsAt).getTime();
    const diff = end - now;
    if (diff <= 0) return { text: "Ended", ended: true, urgent: true };
    const hours = Math.floor(diff / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);
    return {
      text: hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m ${seconds}s`,
      ended: false,
      urgent: diff < 300000,
    };
  };

  if (!character) return <div className="text-tribal-500 text-center mt-20">Create a character first.</div>;

  const sellableItems = character.inventory.filter((inv) => inv.item && !inv.equipped && inv.quantity > 0);
  const activeAuctions = auctions.filter((a) => new Date(a.ends_at).getTime() > Date.now() || a.seller_id === character.id || a.current_bidder_id === character.id);
  const mySelling = auctions.filter((a) => a.seller_id === character.id);
  const myBidding = auctions.filter((a) => a.current_bidder_id === character.id);

  const displayAuctions = tab === "my_selling" ? mySelling : tab === "my_bidding" ? myBidding : activeAuctions;
  const filteredAuctions = searchQuery
    ? displayAuctions.filter((a) => {
        const q = searchQuery.toLowerCase();
        return (a.item?.name?.toLowerCase().includes(q) || a.seller?.name?.toLowerCase().includes(q));
      })
    : displayAuctions;

  return (
    <div className="space-y-5 animate-fade-in max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-tribal-100">Auction House</h1>
          <p className="text-tribal-500 text-sm mt-0.5">Bid on rare items and sell your loot</p>
        </div>
        <div className="flex items-center gap-2 text-tribal-100 bg-tribal-900/60 px-4 py-2 rounded-lg border border-tribal-800/30">
          <Coins size={16} className="text-tribal-400" />
          <span className="font-bold tabular-nums">{character.coins}</span>
          <span className="text-tribal-500 text-sm">gold</span>
        </div>
      </div>

      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <div className="flex gap-1">
            {(["browse", "my_selling", "my_bidding"] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
                  tab === t
                    ? "bg-tribal-800/60 text-tribal-100 border border-tribal-600/30"
                    : "text-tribal-500 hover:text-tribal-300 border border-transparent"
                }`}
              >
                {t === "browse" ? "Browse" : t === "my_selling" ? `Selling (${mySelling.length})` : `Bidding (${myBidding.length})`}
              </button>
            ))}
          </div>
          <Button
            variant={showCreate ? "secondary" : "primary"}
            size="sm"
            icon={showCreate ? <X size={14} /> : <Gavel size={14} />}
            onClick={() => { setShowCreate(!showCreate); setError(""); }}
          >
            {showCreate ? "Cancel" : "Create Auction"}
          </Button>
        </div>

        {showCreate && (
          <form onSubmit={createAuction} className="space-y-3 mb-4 p-4 bg-tribal-900/30 rounded-lg border border-tribal-800/20 animate-fade-in">
            <div>
              <label className="block text-xs font-bold text-tribal-300 mb-2 uppercase tracking-wider">Item</label>
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
                <label className="block text-xs font-bold text-tribal-300 mb-2 uppercase tracking-wider">Starting Price</label>
                <input type="number" value={startingPrice} onChange={(e) => setStartingPrice(Math.max(1, Number(e.target.value)))} className="input" min={1} required />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-tribal-300 mb-2 uppercase tracking-wider">Duration</label>
              <div className="grid grid-cols-5 gap-2">
                {durations.map((d) => (
                  <button
                    key={d.value}
                    type="button"
                    onClick={() => setDuration(d.value)}
                    className={`px-2 py-2 rounded-lg text-xs font-bold transition-all border ${
                      duration === d.value
                        ? "bg-tribal-800/60 text-tribal-100 border-tribal-600/30"
                        : "bg-tribal-900/30 text-tribal-500 border-tribal-800/20 hover:border-tribal-700/30"
                    }`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>
            {error && (
              <Alert variant="error" onDismiss={() => setError("")}>{error}</Alert>
            )}
            <Button type="submit" variant="primary" className="w-full" loading={loading} disabled={sellableItems.length === 0}>
              {sellableItems.length === 0 ? "No items to auction" : "Create Auction"}
            </Button>
          </form>
        )}

        <div className="mb-4">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-tribal-600" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search auctions..."
              className="input pl-9 text-sm"
            />
          </div>
        </div>

        {error && !showCreate && (
          <Alert variant="error" onDismiss={() => setError("")}>{error}</Alert>
        )}

        {filteredAuctions.length === 0 ? (
          <div className="text-center py-8">
            <Gavel size={32} className="text-tribal-800 mx-auto mb-2" />
            <p className="text-tribal-600">
              {tab === "my_selling" ? "You have no auctions." :
               tab === "my_bidding" ? "You're not bidding on anything." :
               "No active auctions."}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredAuctions.map((auction) => {
              const timer = getTimeRemaining(auction.ends_at);
              const isOwn = auction.seller_id === character.id;
              const isHighBidder = auction.current_bidder_id === character.id;
              const minBid = auction.current_bid > 0 ? auction.current_bid + 1 : auction.starting_price;
              const canClaim = (timer.ended && (isOwn || isHighBidder)) || (!timer.ended && isOwn);
              const isConfirming = confirmBid === auction.id;

              return (
                <div key={auction.id} className={`bg-tribal-900/40 p-4 rounded-lg border transition-colors ${
                  timer.ended ? "border-tribal-800/10 opacity-75" :
                   timer.urgent ? "border-tribal-700/30" :
                  "border-tribal-800/20 hover:border-tribal-700/30"
                }`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <Package size={18} className={timer.ended ? "text-tribal-700" : "text-tribal-500"} />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-tribal-200 font-semibold text-sm">{auction.item?.name || "Unknown"}</span>
                          {auction.quantity > 1 && <span className="text-tribal-600 text-sm tabular-nums">x{auction.quantity}</span>}
                          {auction.item?.tier && auction.item.tier > 1 && (
                            <span className="text-tribal-700 text-xs bg-tribal-900/60 px-1.5 py-0.5 rounded">T{auction.item.tier}</span>
                          )}
                        </div>
                        <p className="text-tribal-700 text-xs">
                          by {auction.seller?.name || "Unknown"}{isOwn && " (you)"}
                          {auction.current_bidder && !isOwn && (
                            <span className={isHighBidder ? "text-[#3d8b5c] ml-1" : ""}>
                              {isHighBidder ? " — You're winning" : ` — ${auction.current_bidder.name} is winning`}
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className={`flex items-center gap-1 text-xs font-bold tabular-nums ${
                        timer.urgent && !timer.ended ? "text-tribal-300" :
                        timer.ended ? "text-tribal-600" : "text-tribal-400"
                      }`}>
                        <Clock size={12} />
                        {timer.text}
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div>
                        <div className="text-tribal-700 text-[10px] uppercase font-bold tracking-wider">Start Price</div>
                        <div className="text-tribal-400 text-sm font-semibold tabular-nums flex items-center gap-1">
                          <Coins size={12} /> {auction.starting_price}
                        </div>
                      </div>
                      <div>
                        <div className="text-tribal-700 text-[10px] uppercase font-bold tracking-wider">Current Bid</div>
                        <div className="text-tribal-100 text-sm font-bold tabular-nums flex items-center gap-1">
                          <Coins size={12} className="text-tribal-400" /> {auction.current_bid || "—"}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {canClaim ? (
                        <Button
                          variant={timer.ended && isHighBidder ? "success" : timer.ended && isOwn && !auction.current_bidder_id ? "success" : "secondary"}
                          size="sm"
                          icon={timer.ended && isHighBidder ? <Trophy size={14} /> : <Check size={14} />}
                          onClick={() => claimAuction(auction)}
                          loading={loading}
                        >
                          {timer.ended && isHighBidder ? "Claim Item" :
                           timer.ended && isOwn && !auction.current_bidder_id ? "Reclaim Item" :
                           timer.ended && isOwn ? "Claim Coins" :
                           "Cancel & Reclaim"}
                        </Button>
                      ) : !isOwn && !timer.ended ? (
                        isConfirming ? (
                          <div className="flex items-center gap-2 animate-fade-in">
                            <input
                              type="number"
                              value={bidAmounts[auction.id] || minBid}
                              onChange={(e) => setBidAmounts((prev) => ({ ...prev, [auction.id]: Math.max(minBid, Number(e.target.value)) }))}
                              className="input w-24 text-sm"
                              min={minBid}
                            />
                            <Button variant="primary" size="sm" onClick={() => placeBid(auction)} loading={loading}>
                              Bid
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => setConfirmBid(null)}>X</Button>
                          </div>
                        ) : (
                          <Button
                            variant="secondary"
                            size="sm"
                            icon={<Gavel size={14} />}
                            onClick={() => { setConfirmBid(auction.id); setBidAmounts((prev) => ({ ...prev, [auction.id]: minBid })); }}
                            disabled={character.coins < minBid}
                          >
                            {character.coins < minBid ? "Can't afford" : `Bid (${minBid}+)`}
                          </Button>
                        )
                      ) : !timer.ended && isOwn ? (
                        <Button variant="danger" size="sm" onClick={() => claimAuction(auction)} loading={loading}>
                          Cancel
                        </Button>
                      ) : null}
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
