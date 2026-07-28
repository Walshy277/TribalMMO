import { useEffect, useState } from "react";
import { useGame } from "@/lib/game";
import { supabase } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { formatTimeAgo } from "@/lib/utils";
import { Sparkles, Package, Heart, Send, Clock, Star, AlertTriangle } from "lucide-react";

interface ShrineDonation {
  id: string;
  character_id: string;
  item_id: string;
  quantity: number;
  donated_at: string;
  character?: { name: string } | null;
  item?: { name: string } | null;
}

interface ShrinePrayer {
  id: string;
  character_id: string;
  message: string;
  blessing: string | null;
  prayed_at: string;
  character?: { name: string } | null;
}

const blessings = [
  "The spirits stir... a warmth fills your chest.",
  "Ancient forces recognize your devotion.",
  "The ground trembles beneath the shrine.",
  "A faint glow emanates from the offering.",
  "The wind carries whispers of approval.",
];

export default function ShrinePage() {
  const { character, refreshCharacter } = useGame();
  const [donations, setDonations] = useState<ShrineDonation[]>([]);
  const [prayers, setPrayers] = useState<ShrinePrayer[]>([]);
  const [selectedItem, setSelectedItem] = useState("");
  const [donateQty, setDonateQty] = useState(1);
  const [prayerMessage, setPrayerMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [lastBlessing, setLastBlessing] = useState<string | null>(null);
  const [tab, setTab] = useState<"donate" | "pray" | "offerings">("donate");

  useEffect(() => {
    document.title = "Shrine — TribalMMO";
    fetchShrineData();
  }, []);

  const fetchShrineData = async () => {
    const [donationsRes, prayersRes] = await Promise.all([
      supabase
        .from("shrine_donations")
        .select("*, character:characters(name), item:items(name)")
        .order("donated_at", { ascending: false })
        .limit(20),
      supabase
        .from("shrine_prayers")
        .select("*, character:characters(name)")
        .order("prayed_at", { ascending: false })
        .limit(20),
    ]);
    setDonations((donationsRes.data as unknown as ShrineDonation[]) || []);
    setPrayers((prayersRes.data as unknown as ShrinePrayer[]) || []);
  };

  const donateItem = async () => {
    if (!character || !selectedItem) return;
    setLoading(true);
    setError("");
    setSuccess("");

    const invItem = character.inventory.find(
      (inv) => inv.item?.name === selectedItem && !inv.equipped
    );
    if (!invItem || invItem.quantity < donateQty) {
      setError("You don't have enough of this item.");
      setLoading(false);
      return;
    }

    const { data: goldReward, error: rpcError } = await supabase.rpc("shrine_donate", {
      p_character_id: character.id,
      p_inventory_id: invItem.id,
      p_quantity: donateQty,
    });

    if (rpcError) { setError("Failed to donate. Please try again."); setLoading(false); return; }

    setSuccess(`The spirits accept your offering of ${donateQty}x ${selectedItem}. +${goldReward} gold bestowed.`);
    setSelectedItem("");
    setDonateQty(1);
    setLoading(false);
    await fetchShrineData();
    await refreshCharacter();
  };

  const prayAtShrine = async () => {
    if (!character || !prayerMessage.trim()) return;
    setLoading(true);
    setError("");
    setSuccess("");

    if (character.gold < 5) {
      setError("Praying at the shrine costs 5 gold.");
      setLoading(false);
      return;
    }

    const { data: result, error: rpcError } = await supabase.rpc("shrine_pray", {
      p_character_id: character.id,
      p_message: prayerMessage.trim(),
    });

    if (rpcError) { setError(rpcError.message); setLoading(false); return; }

    const prayerResult = result as { blessed: boolean; blessing: string | null };

    if (prayerResult?.blessed && prayerResult.blessing) {
      setLastBlessing(prayerResult.blessing);
      setSuccess("Your prayer is answered! " + prayerResult.blessing);
    } else {
      const flavor = blessings[Math.floor(Math.random() * blessings.length)];
      setSuccess(flavor + " The spirits note your devotion.");
    }

    setPrayerMessage("");
    setLoading(false);
    await fetchShrineData();
    await refreshCharacter();
  };

  if (!character) {
    return <div className="text-tribal-500 text-center mt-20">Create a character first.</div>;
  }

  const donateableItems = character.inventory.filter(
    (inv) => inv.item && !inv.equipped && inv.quantity > 0
  );

  const totalDonations = donations.length;
  const totalPrayers = prayers.length;

  return (
    <div className="space-y-5 animate-fade-in max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-tribal-100">Shrine</h1>
          <p className="text-tribal-500 text-sm mt-0.5">Honor the spirits of Nervella</p>
        </div>
        <div className="flex items-center gap-2 text-tribal-100 bg-tribal-900/60 px-4 py-2 rounded-lg border border-tribal-800/30">
          <Sparkles size={16} className="text-tribal-400" />
          <span className="font-bold tabular-nums">{totalDonations + totalPrayers}</span>
          <span className="text-tribal-500 text-sm">offerings</span>
        </div>
      </div>

      {error && (
        <Alert variant="error" onDismiss={() => setError("")} icon={<AlertTriangle size={14} />}>
          {error}
        </Alert>
      )}

      {success && (
        <div className="card border-[#6a5a8a]/30 bg-[#1a1428]/30 animate-fade-in">
          <div className="flex items-center gap-3">
            <Sparkles size={20} className="text-[#8a6aaa]" />
            <div>
              <p className="text-[#b89ad0] font-medium">{success}</p>
              {lastBlessing && (
                <p className="text-tribal-500 text-xs mt-1">Last blessing: {lastBlessing}</p>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="flex gap-1">
        {(["donate", "pray", "offerings"] as const).map((t) => (
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
              {t === "donate" ? <Package size={14} /> : t === "pray" ? <Heart size={14} /> : <Clock size={14} />}
              {t === "donate" ? "Donate Items" : t === "pray" ? "Pray" : "Recent Offerings"}
            </span>
          </button>
        ))}
      </div>

      {tab === "donate" && (
        <div className="space-y-4">
          <div className="card">
            <div className="text-center mb-5">
              <Sparkles size={36} className="text-[#6a5a8a] mx-auto mb-2" />
              <h2 className="text-lg font-bold text-tribal-100">Offer Items to the Shrine</h2>
              <p className="text-tribal-500 text-sm mt-1">
                The spirits accept material offerings. In return, they bestow gold upon the devoted.
              </p>
              <p className="text-tribal-600 text-xs mt-2">+5 gold per item donated</p>
            </div>

            {donateableItems.length === 0 ? (
              <div className="text-center py-6">
                <Package size={32} className="text-tribal-800 mx-auto mb-2" />
                <p className="text-tribal-600">No items to donate.</p>
                <p className="text-tribal-700 text-sm mt-1">Gather resources or craft items first.</p>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-tribal-300 mb-2 uppercase tracking-wider">Select Item</label>
                  <select
                    value={selectedItem}
                    onChange={(e) => { setSelectedItem(e.target.value); setDonateQty(1); }}
                    className="input"
                  >
                    <option value="">Choose an item to donate...</option>
                    {donateableItems.map((inv) => (
                      <option key={inv.id} value={inv.item!.name}>
                        {inv.item!.name} (x{inv.quantity})
                      </option>
                    ))}
                  </select>
                </div>
                {selectedItem && (
                  <div>
                    <label className="block text-xs font-bold text-tribal-300 mb-2 uppercase tracking-wider">Quantity</label>
                    <input
                      type="number"
                      value={donateQty}
                      onChange={(e) => setDonateQty(Math.max(1, Number(e.target.value)))}
                      className="input"
                      min={1}
                      max={donateableItems.find((inv) => inv.item?.name === selectedItem)?.quantity || 1}
                    />
                    <p className="text-tribal-600 text-xs mt-1">
                      You will receive {donateQty * 5} gold
                    </p>
                  </div>
                )}
                <Button
                  variant="primary"
                  className="w-full"
                  size="lg"
                  icon={<Package size={18} />}
                  onClick={donateItem}
                  loading={loading}
                  disabled={!selectedItem}
                >
                  Donate Offering
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === "pray" && (
        <div className="space-y-4">
          <div className="card">
            <div className="text-center mb-5">
              <Heart size={36} className="text-[#b83a3a] mx-auto mb-2" />
              <h2 className="text-lg font-bold text-tribal-100">Pray at the Shrine</h2>
              <p className="text-tribal-500 text-sm mt-1">
                Speak to the spirits. With devotion and a small offering of 5 gold, they may grant you a blessing.
              </p>
              <p className="text-tribal-600 text-xs mt-2">40% chance of receiving a stat blessing</p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-tribal-300 mb-2 uppercase tracking-wider">Your Prayer</label>
                <input
                  type="text"
                  value={prayerMessage}
                  onChange={(e) => setPrayerMessage(e.target.value)}
                  className="input"
                  placeholder="Speak your prayer to the spirits..."
                  maxLength={200}
                />
              </div>
              <p className="text-tribal-600 text-xs">Cost: 5 gold</p>
              <Button
                variant="primary"
                className="w-full"
                size="lg"
                icon={<Send size={18} />}
                onClick={prayAtShrine}
                loading={loading}
                disabled={!prayerMessage.trim() || character.gold < 5}
              >
                {character.gold < 5 ? "Not enough gold (need 5)" : "Send Prayer"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {tab === "offerings" && (
        <div className="space-y-4">
          {prayers.length > 0 && (
            <div className="card">
              <h2 className="text-xs font-bold text-tribal-400 uppercase tracking-widest mb-3">Recent Prayers</h2>
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {prayers.map((prayer) => (
                  <div key={prayer.id} className={`bg-tribal-900/40 p-3 rounded-lg border ${
                    prayer.blessing ? "border-[#6a5a8a]/30" : "border-tribal-800/20"
                  }`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-tribal-200 text-sm">"{prayer.message}"</p>
                        <p className="text-tribal-600 text-xs mt-1">— {prayer.character?.name || "Unknown"}</p>
                      </div>
                      <div className="text-tribal-600 text-xs shrink-0 flex items-center gap-1">
                        <Clock size={10} />
                        {formatTimeAgo(prayer.prayed_at)}
                      </div>
                    </div>
                    {prayer.blessing && (
                      <div className="mt-2 flex items-center gap-2 bg-[#1a1428]/40 rounded-lg px-3 py-2 border border-[#6a5a8a]/20">
                        <Star size={14} className="text-[#8a6aaa] shrink-0" />
                        <p className="text-[#b89ad0] text-xs font-medium">{prayer.blessing}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {donations.length > 0 && (
            <div className="card">
              <h2 className="text-xs font-bold text-tribal-400 uppercase tracking-widest mb-3">Recent Item Offerings</h2>
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {donations.map((donation) => (
                  <div key={donation.id} className="bg-tribal-900/40 p-3 rounded-lg border border-tribal-800/20 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Package size={16} className="text-tribal-500" />
                      <div>
                        <span className="text-tribal-200 text-sm font-medium">
                          {donation.character?.name || "Unknown"} offered{" "}
                          <span className="text-[#8a6aaa]">{donation.quantity}x {donation.item?.name || "Unknown"}</span>
                        </span>
                      </div>
                    </div>
                    <span className="text-tribal-600 text-xs shrink-0">{formatTimeAgo(donation.donated_at)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {prayers.length === 0 && donations.length === 0 && (
            <div className="card text-center py-8">
              <Sparkles size={32} className="text-tribal-800 mx-auto mb-2" />
              <p className="text-tribal-600">No offerings yet. Be the first to honor the spirits.</p>
            </div>
          )}
        </div>
      )}

      <div className="card bg-tribal-900/20 border-tribal-800/10">
        <div className="text-center">
          <p className="text-tribal-600 text-xs italic">
            &ldquo;The spirits remember those who give freely. They forget those who take without gratitude.&rdquo;
          </p>
        </div>
      </div>
    </div>
  );
}
