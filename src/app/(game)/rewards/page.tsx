"use client";

import { useEffect, useState } from "react";
import { useGame } from "@/lib/game";
import { supabase } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { Gift, Coins, Clock, CheckCircle, Star, Flame, Package, Shield, Zap } from "lucide-react";

interface DailyReward {
  day: number;
  gold: number;
  bonusItem?: string;
  bonusQuantity?: number;
  icon: typeof Coins;
  color: string;
}

const dailyRewards: DailyReward[] = [
  { day: 1, gold: 10, icon: Coins, color: "text-tribal-300" },
  { day: 2, gold: 15, icon: Coins, color: "text-tribal-300" },
  { day: 3, gold: 25, icon: Coins, color: "text-tribal-300" },
  { day: 4, gold: 30, bonusItem: "Herbs", bonusQuantity: 5, icon: Package, color: "text-[#4a9e6a]" },
  { day: 5, gold: 40, bonusItem: "Hides", bonusQuantity: 3, icon: Shield, color: "text-[#6a90a8]" },
  { day: 6, gold: 60, icon: Coins, color: "text-tribal-300" },
  { day: 7, gold: 100, bonusItem: "Stamina Potion", bonusQuantity: 2, icon: Star, color: "text-[#8a6aaa]" },
];

export default function RewardsPage() {
  const { character, refreshCharacter, logTransaction } = useGame();
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

    const nextDay = ((streak) % 7) + 1;
    const reward = dailyRewards.find((r) => r.day === nextDay) || dailyRewards[0];

    // Give gold
    const newGold = character.gold + reward.gold;
    await supabase.from("characters").update({ gold: newGold }).eq("id", character.id);
    await logTransaction(character.id, "daily_reward", reward.gold, `Day ${nextDay} daily reward`);

    // Give bonus item if applicable
    if (reward.bonusItem && reward.bonusQuantity) {
      let { data: item } = await supabase.from("items").select("id").eq("name", reward.bonusItem).single();
      if (!item) {
        const type = reward.bonusItem === "Stamina Potion" ? "consumable" : "resource";
        const stats = reward.bonusItem === "Stamina Potion" ? { heal: 25 } : {};
        const { data: newItem } = await supabase.from("items").insert({ name: reward.bonusItem, type, tier: 1, stats }).select("id").single();
        item = newItem;
      }
      if (item) {
        const existingInv = await supabase.from("inventory").select("id, quantity").eq("character_id", character.id).eq("item_id", item.id).single();
        if (existingInv.data) {
          await supabase.from("inventory").update({ quantity: existingInv.data.quantity + reward.bonusQuantity }).eq("id", existingInv.data.id);
        } else {
          await supabase.from("inventory").insert({ character_id: character.id, item_id: item.id, quantity: reward.bonusQuantity });
        }
      }
    }

    // Update or insert daily_rewards
    const newStreak = streak + 1;
    const now = new Date().toISOString();

    const { error: upsertError } = await supabase
      .from("daily_rewards")
      .upsert({
        character_id: character.id,
        last_claimed_at: now,
        streak: newStreak,
      }, { onConflict: "character_id" });

    if (upsertError) {
      if (upsertError.code === "42P01" || upsertError.message?.includes("does not exist")) {
        setError("Daily rewards not available yet — run migration 004 in Supabase SQL editor.");
        setLoading(false);
        return;
      }
    }

    setStreak(newStreak);
    setClaimedToday(true);
    setNextClaimAt(new Date(Date.now() + 24 * 60 * 60 * 1000));
    setSuccess(`Claimed Day ${nextDay}: ${reward.gold} gold${reward.bonusItem ? ` + ${reward.bonusQuantity}x ${reward.bonusItem}` : ""}!`);

    setLoading(false);
    await refreshCharacter();
  };

  if (!character) return <div className="text-tribal-500 text-center mt-20">Create a character first.</div>;

  const currentDay = ((streak) % 7) + 1;
  const nextReward = dailyRewards.find((r) => r.day === currentDay);

  return (
    <div className="space-y-5 animate-fade-in max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-tribal-100">Daily Rewards</h1>
          <p className="text-tribal-500 text-sm mt-0.5">Claim your daily login rewards</p>
        </div>
        <div className="flex items-center gap-2 text-tribal-100 bg-tribal-900/60 px-4 py-2 rounded-lg border border-tribal-800/30">
          <Flame size={16} className="text-tribal-300" />
          <span className="font-bold tabular-nums">{streak}</span>
          <span className="text-tribal-500 text-sm">day streak</span>
        </div>
      </div>

      {error && (
        <Alert variant="error" onDismiss={() => setError("")}>{error}</Alert>
      )}

      {success && (
        <Alert variant="success" onDismiss={() => setSuccess("")}>{success}</Alert>
      )}

      {migrationMissing && (
        <div className="bg-tribal-900/40 border border-tribal-700/40 rounded-lg p-4 text-tribal-300 text-sm">
          <p className="font-semibold mb-1">Daily rewards require migration 004</p>
          <p className="text-tribal-300/70 text-xs">Run <code>004_economy_system.sql</code> in the Supabase SQL editor to enable streak tracking. Gold is still awarded.</p>
        </div>
      )}

      <div className="card">
        <div className="text-center mb-6">
          <Gift size={40} className="text-tribal-500 mx-auto mb-3" />
          <h2 className="text-lg font-bold text-tribal-100">Day {currentDay} Reward</h2>
          {nextReward && (
            <div className="mt-2 space-y-1">
              <p className="text-tribal-300 font-semibold">{nextReward.gold} Gold</p>
              {nextReward.bonusItem && (
                <p className="text-[#4a9e6a] text-sm">+ {nextReward.bonusQuantity}x {nextReward.bonusItem}</p>
              )}
            </div>
          )}
        </div>

        {claimedToday ? (
          <div className="text-center">
            <div className="flex items-center justify-center gap-2 text-tribal-500 mb-3">
              <Clock size={16} />
              <span className="text-sm">Already claimed today</span>
            </div>
            {nextClaimAt && (
              <p className="text-tribal-600 text-xs">
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
        <h2 className="text-xs font-bold text-tribal-400 uppercase tracking-widest mb-4">7-Day Reward Cycle</h2>
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
                    ? "bg-tribal-800/60 border-tribal-400/40"
                    : isPast
                    ? "bg-tribal-900/20 border-tribal-800/10 opacity-50"
                    : "bg-tribal-900/30 border-tribal-800/20"
                }`}
              >
                <div className={`text-[10px] font-bold uppercase mb-1 ${isCurrentDay ? "text-tribal-300" : "text-tribal-600"}`}>
                  Day {reward.day}
                </div>
                <Icon size={18} className={`mx-auto my-1.5 ${reward.color} ${isPast ? "opacity-40" : ""}`} />
                <div className={`text-xs font-bold tabular-nums ${isPast ? "text-tribal-700" : "text-tribal-200"}`}>
                  {reward.gold}g
                </div>
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
        <p className="text-tribal-700 text-xs mt-3 text-center">
          Streak resets if you miss a day. Cycle repeats every 7 days with increasing rewards.
        </p>
      </div>
    </div>
  );
}
