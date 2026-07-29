import { useEffect, useState } from "react";
import { useGame } from "@/lib/game";
import { supabase } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { Gift, Coins, Clock, CheckCircle, Star, Flame, Package, Shield, Gem } from "lucide-react";

interface DailyReward {
  day: number;
  gold: number;
  treasureCoins?: number;
  bonusItem?: string;
  bonusQuantity?: number;
  icon: typeof Coins;
  color: string;
}

const dailyRewards: DailyReward[] = [
  { day: 1, gold: 5, icon: Coins, color: "text-slate-300" },
  { day: 2, gold: 10, icon: Coins, color: "text-slate-300" },
  { day: 3, gold: 15, icon: Coins, color: "text-slate-300" },
  { day: 4, gold: 20, treasureCoins: 1, bonusItem: "Wild Herbs", bonusQuantity: 5, icon: Gem, color: "text-[#4a9e6a]" },
  { day: 5, gold: 25, icon: Coins, color: "text-slate-300" },
  { day: 6, gold: 30, icon: Coins, color: "text-slate-300" },
  { day: 7, gold: 50, treasureCoins: 3, bonusItem: "Stamina Potion", bonusQuantity: 2, icon: Gem, color: "text-[#8a6aaa]" },
];

export default function RewardsPage() {
  const { character, refreshCharacter } = useGame();
  const [streak, setStreak] = useState(0);
  const [claimedToday, setClaimedToday] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [nextClaimAt, setNextClaimAt] = useState<Date | null>(null);
  const [migrationMissing, setMigrationMissing] = useState(false);

  useEffect(() => {
    document.title = "Daily Rewards — TribalMMO";
    if (character) checkDailyReward();
  }, [character]);

  const checkDailyReward = async () => {
    if (!character) return;

    const { data, error } = await supabase
      .from("daily_rewards")
      .select("*")
      .eq("character_id", character.id)
      .single();

    if (error) {
      if (error.code === "42P01" || error.message?.includes("does not exist")) {
        setStreak(0);
        setClaimedToday(false);
        setMigrationMissing(true);
      }
      return;
    }
    setMigrationMissing(false);

    if (data) {
      setStreak(data.streak);
      const lastClaimed = new Date(data.last_claimed_at);
      const now = new Date();
      const hoursSince = (now.getTime() - lastClaimed.getTime()) / (1000 * 60 * 60);

      if (hoursSince < 24) {
        setClaimedToday(true);
        setNextClaimAt(new Date(lastClaimed.getTime() + 24 * 60 * 60 * 1000));
      } else if (hoursSince >= 48) {
        setStreak(1);
        setClaimedToday(false);
      } else {
        setClaimedToday(false);
      }
    }
  };

  const claimReward = async () => {
    if (!character || claimedToday || loading) return;
    setLoading(true);
    setSuccess("");

    const { data: result, error: rpcError } = await supabase.rpc("claim_daily_reward", {
      p_character_id: character.id,
    });

    if (rpcError) {
      if (rpcError.code === "42P01" || rpcError.message?.includes("does not exist")) {
        setError("Daily rewards not available yet — run migration 004 in Supabase SQL editor.");
      } else {
        setError(rpcError.message);
      }
      setLoading(false);
      return;
    }

    const reward = result as { day: number; gold: number; treasure_coins: number; bonus_item: string | null; bonus_qty: number | null; streak: number };

    setStreak(reward.streak);
    setClaimedToday(true);
    setNextClaimAt(new Date(Date.now() + 24 * 60 * 60 * 1000));
    setSuccess(`Claimed Day ${reward.day}: ${reward.gold} gold${reward.treasure_coins ? ` + ${reward.treasure_coins} Treasure Coin${reward.treasure_coins > 1 ? 's' : ''}` : ""}${reward.bonus_item ? ` + ${reward.bonus_qty}x ${reward.bonus_item}` : ""}!`);

    setLoading(false);
    await refreshCharacter();
  };

  if (!character) return <div className="text-slate-500 text-center mt-20">Create a character first.</div>;

  const currentDay = ((streak) % 7) + 1;
  const nextReward = dailyRewards.find((r) => r.day === currentDay);

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Daily Rewards</h1>
          <p className="text-slate-500 text-sm mt-0.5">Claim your daily login rewards</p>
        </div>
        <div className="flex items-center gap-2 text-slate-100 bg-slate-900/60 px-4 py-2 rounded-lg border border-slate-800/30">
          <Flame size={16} className="text-slate-300" />
          <span className="font-bold tabular-nums">{streak}</span>
          <span className="text-slate-500 text-sm">day streak</span>
        </div>
      </div>

      {error && (
        <Alert variant="error" onDismiss={() => setError("")}>{error}</Alert>
      )}

      {success && (
        <Alert variant="success" onDismiss={() => setSuccess("")}>{success}</Alert>
      )}

      {migrationMissing && (
        <div className="bg-slate-900/40 border border-slate-700/40 rounded-lg p-4 text-slate-300 text-sm">
          <p className="font-semibold mb-1">Daily rewards require migration 004</p>
          <p className="text-slate-300/70 text-xs">Run <code>004_economy_system.sql</code> in the Supabase SQL editor to enable streak tracking. Gold is still awarded.</p>
        </div>
      )}

      <div className="card">
        <div className="text-center mb-6">
          <Gift size={40} className="text-slate-500 mx-auto mb-3" />
          <h2 className="text-lg font-bold text-slate-100">Day {currentDay} Reward</h2>
          {nextReward && (
            <div className="mt-2 space-y-1">
              <p className="text-slate-300 font-semibold">{nextReward.gold} Gold</p>
              {nextReward.treasureCoins && (
                <p className="text-amber-400 text-sm flex items-center justify-center gap-1">
                  <Gem size={14} /> +{nextReward.treasureCoins} Treasure Coin{nextReward.treasureCoins > 1 ? 's' : ''}
                </p>
              )}
              {nextReward.bonusItem && (
                <p className="text-[#4a9e6a] text-sm">+ {nextReward.bonusQuantity}x {nextReward.bonusItem}</p>
              )}
            </div>
          )}
        </div>

        {claimedToday ? (
          <div className="text-center">
            <div className="flex items-center justify-center gap-2 text-slate-500 mb-3">
              <Clock size={16} />
              <span className="text-sm">Already claimed today</span>
            </div>
            {nextClaimAt && (
              <p className="text-slate-600 text-xs">
                Next reward at: {nextClaimAt.toLocaleString()}
              </p>
            )}
          </div>
        ) : (
          <Button
            variant="primary"
            size="lg"
            className="w-full"
            icon={<Gift size={18} />}
            onClick={claimReward}
            loading={loading}
          >
            Claim Day {currentDay} Reward
          </Button>
        )}
      </div>

      <div className="card">
        <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">7-Day Reward Cycle</h2>
        <div className="grid grid-cols-7 gap-2">
          {dailyRewards.map((reward) => {
            const isCurrentDay = reward.day === currentDay;
            const isPast = streak > 0 && ((streak % 7) + 1 > reward.day);
            const Icon = reward.icon;
            return (
              <div
                key={reward.day}
                className={`text-center p-3 rounded-lg border transition-all ${
                  isCurrentDay
                    ? "bg-slate-800/60 border-slate-400/40"
                    : isPast
                    ? "bg-slate-900/20 border-slate-800/10 opacity-50"
                    : "bg-slate-900/30 border-slate-800/20"
                }`}
              >
                <div className={`text-[10px] font-bold uppercase mb-1 ${isCurrentDay ? "text-slate-300" : "text-slate-600"}`}>
                  Day {reward.day}
                </div>
                <Icon size={18} className={`mx-auto my-1.5 ${reward.color} ${isPast ? "opacity-40" : ""}`} />
                <div className={`text-xs font-bold tabular-nums ${isPast ? "text-slate-700" : "text-slate-200"}`}>
                  {reward.gold}g
                </div>
                {reward.treasureCoins && (
                  <div className="text-[10px] text-amber-400 mt-0.5 flex items-center justify-center gap-0.5">
                    <Gem size={10} />+{reward.treasureCoins}
                  </div>
                )}
                {reward.bonusItem && (
                  <div className="text-[10px] text-[#4a9e6a] mt-0.5">
                    +{reward.bonusQuantity}
                  </div>
                )}
                {isPast && (
                  <CheckCircle size={10} className="text-[#3d8b5c]/50 mx-auto mt-1" />
                )}
              </div>
            );
          })}
        </div>
        <p className="text-slate-700 text-xs mt-3 text-center">
          Streak resets if you miss a day. Cycle repeats every 7 days with increasing rewards.
        </p>
      </div>
    </div>
  );
}
