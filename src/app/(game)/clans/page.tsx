import { useEffect, useState } from "react";
import { useGame, type BuildingWithCost, type VaultContents, type VaultItem } from "@/lib/game";
import { supabase } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import {
  Shield, Swords, Globe, Compass, Users, Plus, Crown, UserMinus, ArrowUp, ArrowDown,
  ArrowUpRight, ArrowDownRight,
  Wheat, TreePine, Mountain, Heart, Sparkles, Building2, Scroll,
  Trophy, History, Settings, HandHeart, Eye, Gem
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Database } from "@/types/database";

const CLAN_COST_GOLD = 10;

type ClanEvent = Database["public"]["Tables"]["clan_events"]["Row"] & { character?: { name: string } | null };
type ClanWithSettlement = Database["public"]["Tables"]["clans"]["Row"] & {
  clan_members: (Database["public"]["Tables"]["clan_members"]["Row"] & { character?: { name: string } | null })[];
};

const philosophies: { id: string; name: string; bonuses: string[]; icon: LucideIcon; desc: string }[] = [
  { id: "warborn", name: "Warborn", bonuses: ["+2 STR, +1 ATK"], icon: Swords, desc: "Strength through battle." },
  { id: "earthkeepers", name: "Earthkeepers", bonuses: ["+2 VIT, +1 DEF"], icon: Globe, desc: "Harmony with nature." },
  { id: "pathfinders", name: "Pathfinders", bonuses: ["+2 SPD, +1 ATK"], icon: Compass, desc: "Masters of exploration." },
];

const buildingIcons: Record<string, LucideIcon> = {
  farm: Wheat, lumber_yard: TreePine, quarry: Mountain, forge: Swords,
  watchtower: Eye, treasury: Gem, barracks: Shield, library: Scroll,
};

const buildingLabels: Record<string, string> = {
  farm: "Farm", lumber_yard: "Lumber Yard", quarry: "Quarry", forge: "Forge",
  watchtower: "Watchtower", treasury: "Treasury", barracks: "Barracks", library: "Library",
};

const eventIcons: Record<string, LucideIcon> = {
  donation: HandHeart, combat: Swords, level_up: ArrowUp, member_joined: Users,
  project_progress: Building2, project_completed: Trophy, project_started: Building2,
  feast: Wheat, blessing: Sparkles,
};

function ResourceBar({ current, max, label, icon }: { current: number; max?: number; label: string; icon: React.ReactNode }) {
  const pct = max ? Math.min(100, (current / max) * 100) : undefined;
  return (
    <div className="bg-slate-900/30 px-3 py-2 rounded-lg border border-slate-800/20">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1.5 text-slate-400 text-xs">{icon} {label}</div>
        <span className="text-slate-200 text-sm font-bold tabular-nums">{current.toLocaleString()}{max ? ` / ${max}` : ""}</span>
      </div>
      {pct !== undefined && (
        <div className="w-full bg-slate-900/80 rounded-full h-1.5">
          <div className="h-1.5 rounded-full bg-slate-500 transition-all" style={{ width: `${pct}%` }} />
        </div>
      )}
    </div>
  );
}

function BuildingCard({ building, characterId, onContribute }: { building: BuildingWithCost; characterId: string; onContribute: () => void }) {
  const Icon = buildingIcons[building.building_type] || Building2;
  const label = buildingLabels[building.building_type] || building.building_type;
  const woodPct = building.cost.wood > 0 ? Math.min(100, (building.contributed_wood / building.cost.wood) * 100) : 0;
  const stonePct = building.cost.stone > 0 ? Math.min(100, (building.contributed_stone / building.cost.stone) * 100) : 0;
  const foodPct = building.cost.food > 0 ? Math.min(100, (building.contributed_food / building.cost.food) * 100) : 0;
  const overallPct = Math.round(
    ((building.contributed_wood + building.contributed_stone + building.contributed_food) /
    Math.max(1, building.cost.wood + building.cost.stone + building.cost.food)) * 100
  );

  const [contribWood, setContribWood] = useState(0);
  const [contribStone, setContribStone] = useState(0);
  const [contribFood, setContribFood] = useState(0);
  const [showContrib, setShowContrib] = useState(false);
  const [contributing, setContributing] = useState(false);

  const handleContribute = async () => {
    if (contribWood + contribStone + contribFood === 0) return;
    setContributing(true);
    const { error } = await supabase.rpc("contribute_to_building", {
      p_character_id: characterId,
      p_building_id: building.id,
      p_wood: contribWood,
      p_stone: contribStone,
      p_food: contribFood,
    });
    setContributing(false);
    if (!error) {
      setContribWood(0); setContribStone(0); setContribFood(0); setShowContrib(false);
      onContribute();
    }
  };

  return (
    <div className="bg-slate-900/30 p-4 rounded-lg border border-slate-800/20">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <Icon size={18} className="text-slate-400" />
          <span className="text-slate-200 font-semibold text-sm">{label}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-slate-500 text-xs font-bold">Lv.{building.level}</span>
          <span className="text-slate-600 text-xs">{overallPct}%</span>
        </div>
      </div>
      <div className="space-y-1.5 mb-3">
        <ProgressLine label="Wood" current={building.contributed_wood} total={building.cost.wood} pct={woodPct} />
        <ProgressLine label="Stone" current={building.contributed_stone} total={building.cost.stone} pct={stonePct} />
        <ProgressLine label="Food" current={building.contributed_food} total={building.cost.food} pct={foodPct} />
      </div>
      <div>
        {showContrib ? (
          <div className="space-y-2 bg-slate-900/40 p-3 rounded-lg border border-slate-800/20">
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: "Wood", state: contribWood, set: setContribWood },
                { label: "Stone", state: contribStone, set: setContribStone },
                { label: "Food", state: contribFood, set: setContribFood },
              ].map(({ label, state, set }) => (
                <div key={label}>
                  <label className="text-slate-600 text-[10px] uppercase block mb-1">{label}</label>
                  <input type="number" min={0} value={state || ""} onChange={(e) => set(Math.max(0, parseInt(e.target.value) || 0))}
                    className="input text-sm py-1.5" placeholder="0" />
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="primary" onClick={handleContribute} loading={contributing} disabled={contribWood + contribStone + contribFood === 0}>
                Contribute
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setShowContrib(false)}>Cancel</Button>
            </div>
          </div>
        ) : (
          <Button size="sm" variant="secondary" icon={<Plus size={12} />} onClick={() => setShowContrib(true)}>
            Contribute
          </Button>
        )}
      </div>
    </div>
  );
}

function ProgressLine({ label, current, total, pct }: { label: string; current: number; total: number; pct: number }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="text-slate-500 w-10">{label}</span>
      <span className="text-slate-700 tabular-nums w-20 text-right">{current.toLocaleString()} / {total.toLocaleString()}</span>
      <div className="flex-1 bg-slate-900/80 rounded-full h-1.5">
        <div className="h-1.5 rounded-full bg-slate-500 transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function ResourceInput({ label, value, set }: { label: string; value: number; set: (v: number) => void }) {
  return (
    <div>
      <label className="text-slate-600 text-[10px] uppercase block mb-1">{label}</label>
      <input type="number" min={0} value={value || ""} onChange={(e) => set(Math.max(0, parseInt(e.target.value) || 0))}
        className="input text-sm py-1.5" placeholder="0" />
    </div>
  );
}

export default function ClansPage() {
  const { character, refreshCharacter } = useGame();
  const [clans, setClans] = useState<ClanWithSettlement[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [clanName, setClanName] = useState("");
  const [philosophy, setPhilosophy] = useState("warborn");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [tab, setTab] = useState<"overview" | "buildings" | "vault" | "members" | "laws" | "events">("overview");

  const [donateFood, setDonateFood] = useState(0);
  const [donateWood, setDonateWood] = useState(0);
  const [donateStone, setDonateStone] = useState(0);
  const [donateGold, setDonateGold] = useState(0);
  const [showDonate, setShowDonate] = useState(false);

  const [vaultDepositAmount, setVaultDepositAmount] = useState(0);
  const [vaultWithdrawAmount, setVaultWithdrawAmount] = useState(0);
  const [vaultItemDeposit, setVaultItemDeposit] = useState("");
  const [vaultItemQty, setVaultItemQty] = useState(0);
  const [vaultItemWithdraw, setVaultItemWithdraw] = useState("");
  const [vaultItemWithdrawQty, setVaultItemWithdrawQty] = useState(0);

  const [taxRate, setTaxRate] = useState(0);
  const [donationPolicy, setDonationPolicy] = useState("optional");
  const [pvpPolicy, setPvpPolicy] = useState("peaceful");
  const [recruitmentPolicy, setRecruitmentPolicy] = useState("open");
  const [showLaws, setShowLaws] = useState(false);

  useEffect(() => { document.title = "Clans — TribalMMO"; }, []);
  useEffect(() => { fetchClans(); }, []);

  const fetchClans = async () => {
    const { data } = await supabase.from("clans").select("*, clan_members(*, character:characters(name))") as { data: ClanWithSettlement[] | null };
    setClans(data || []);
  };

  const createClan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!character) return;
    if (character.gold < CLAN_COST_GOLD) { setError(`You need ${CLAN_COST_GOLD} gold to found a clan.`); return; }
    setCreating(true); setError("");
    const { error: rpcError } = await supabase.rpc("create_clan_rpc", {
      p_character_id: character.id, p_name: clanName, p_philosophy: philosophy,
    });
    if (rpcError) { setError(rpcError.message); setCreating(false); return; }
    await refreshCharacter();
    await fetchClans();
    setShowCreate(false); setCreating(false);
  };

  const joinClan = async (clanId: string) => {
    if (!character) return;
    setActionLoading(true); setError("");
    const { error: joinError } = await supabase.rpc("join_clan", { p_character_id: character.id, p_clan_id: clanId });
    if (joinError) setError(joinError.message);
    await refreshCharacter(); await fetchClans(); setActionLoading(false);
  };

  const leaveClan = async () => {
    if (!character?.clan) return;
    setActionLoading(true); setError("");
    const { error: leaveError } = await supabase.rpc("leave_clan", { p_character_id: character.id });
    if (leaveError) setError(leaveError.message);
    await refreshCharacter(); await fetchClans(); setConfirmLeave(false); setActionLoading(false);
  };

  const kickMember = async (_memberId: string, characterId: string) => {
    if (!character?.clan || character.clan.role !== "chieftain") return;
    if (characterId === character.id) return;
    setActionLoading(true);
    await supabase.rpc("kick_clan_member", { p_chieftain_id: character.id, p_target_id: characterId });
    await refreshCharacter(); await fetchClans(); setActionLoading(false);
  };

  const promoteMember = async (memberId: string) => {
    if (!character?.clan || character.clan.role !== "chieftain") return;
    setActionLoading(true);
    const targetCharId = clans.flatMap((c) => c.clan_members || []).find((m) => m.id === memberId)?.character_id;
    if (targetCharId) {
      await supabase.rpc("promote_clan_member", { p_chieftain_id: character.id, p_target_id: targetCharId });
    }
    await refreshCharacter(); await fetchClans(); setActionLoading(false);
  };

  const demoteMember = async (memberId: string) => {
    if (!character?.clan || character.clan.role !== "chieftain") return;
    setActionLoading(true);
    const targetCharId = clans.flatMap((c) => c.clan_members || []).find((m) => m.id === memberId)?.character_id;
    if (targetCharId) {
      await supabase.rpc("demote_clan_member", { p_chieftain_id: character.id, p_target_id: targetCharId });
    }
    await refreshCharacter(); await fetchClans(); setActionLoading(false);
  };

  const handleDonate = async () => {
    if (!character?.clan) return;
    if (donateFood + donateWood + donateStone + donateGold === 0) return;
    await supabase.rpc("donate_to_clan", {
      p_character_id: character.id, p_food: donateFood, p_wood: donateWood, p_stone: donateStone, p_gold: donateGold,
    });
    await refreshCharacter();
    setDonateFood(0); setDonateWood(0); setDonateStone(0); setDonateGold(0); setShowDonate(false);
  };

  const handleUpdateLaws = async () => {
    if (!character?.clan) return;
    await supabase.from("clans").update({
      tax_rate: taxRate, donation_policy: donationPolicy,
      pvp_policy: pvpPolicy, recruitment_policy: recruitmentPolicy,
    }).eq("id", character.clan.clan_id);
    await refreshCharacter();
    setShowLaws(false);
  };

  if (!character) return <div className="text-slate-500 text-center mt-20">Create a character first.</div>;

  const myClan = character.clan;
  const isChieftain = myClan?.role === "chieftain";
  const isElder = myClan?.role === "elder";
  const canManage = isChieftain || isElder;
  const clanData = myClan?.clan as ClanWithSettlement | undefined;

  const activeEvents = (character.worldEvents || []).filter((e) => e.status === "active");

  if (!myClan) {
    return (
      <div className="space-y-5 animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Clans</h1>
          <p className="text-slate-500 text-sm mt-0.5">Form alliances, build settlements, shape the world</p>
        </div>
        {error && <Alert variant="error" onDismiss={() => setError("")}>{error}</Alert>}
        {showCreate ? (
          <div className="card">
            <div className="text-center mb-5">
              <Shield size={36} className="text-slate-400 mx-auto mb-2" />
              <h2 className="text-xl font-bold text-slate-100">Found a Clan</h2>
              <p className="text-slate-600 text-sm mt-1">Cost: {CLAN_COST_GOLD} gold</p>
            </div>
            <form onSubmit={createClan} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-2 uppercase tracking-wider">Clan Name</label>
                <input type="text" value={clanName} onChange={(e) => setClanName(e.target.value)} className="input" placeholder="Enter clan name..." required minLength={2} maxLength={30} />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-2 uppercase tracking-wider">Philosophy</label>
                <div className="space-y-2">
                  {philosophies.map((p) => {
                    const Icon = p.icon;
                    return (
                      <label key={p.id} className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-all border ${philosophy === p.id ? "bg-slate-800/60 text-slate-100 border-slate-600/30" : "bg-slate-900/30 text-slate-400 hover:bg-slate-800/30 border-slate-800/20"}`}>
                        <input type="radio" name="philosophy" value={p.id} checked={philosophy === p.id} onChange={(e) => setPhilosophy(e.target.value)} className="hidden" />
                        <Icon size={20} className="shrink-0 mt-0.5" />
                        <div>
                          <div className="font-semibold text-sm">{p.name}</div>
                          <div className="text-xs opacity-70 mt-1">{p.bonuses.join(", ")}</div>
                          <div className="text-xs opacity-50 mt-1">{p.desc}</div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
              <div className="flex gap-3">
                <Button type="submit" variant="primary" className="flex-1" size="lg" loading={creating} disabled={character.gold < CLAN_COST_GOLD}>Create Clan</Button>
                <Button type="button" variant="secondary" size="lg" onClick={() => setShowCreate(false)}>Cancel</Button>
              </div>
            </form>
          </div>
        ) : (
          <div className="card text-center py-8">
            <Shield size={36} className="text-slate-800 mx-auto mb-3" />
            <p className="text-slate-500 mb-2">You are not a member of any clan.</p>
            <p className="text-slate-600 text-xs mb-5">Clans are the heart of TribalMMO. Found one with friends to build a settlement and shape the world.</p>
            <Button variant="primary" size="lg" icon={<Plus size={18} />} onClick={() => setShowCreate(true)}>Create Clan ({CLAN_COST_GOLD} gold)</Button>
          </div>
        )}
        <div className="card">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">All Clans</h2>
          {clans.length === 0 ? (
            <div className="text-center py-6">
              <Shield size={32} className="text-slate-800 mx-auto mb-2" />
              <p className="text-slate-600">No clans exist yet. Be the first!</p>
            </div>
          ) : (
            <div className="space-y-2">
              {clans.map((clan) => {
                const phil = philosophies.find((p) => p.id === clan.philosophy);
                const PhilIcon = phil?.icon || Shield;
                const memberCount = clan.clan_members?.length || 0;
                return (
                  <div key={clan.id} className="bg-slate-900/40 p-4 rounded-lg border border-slate-800/20">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <PhilIcon size={18} className="text-slate-500" />
                        <div>
                          <span className="text-slate-200 font-semibold text-sm">{clan.name}</span>
                          <p className="text-slate-600 text-xs capitalize">{clan.philosophy} {phil && <span className="text-slate-700">({phil.bonuses[0]})</span>}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-slate-500 text-sm flex items-center gap-1 tabular-nums"><Users size={14} /> {memberCount}</span>
                        <Button variant="secondary" size="sm" onClick={() => joinClan(clan.id)} loading={actionLoading}>Join</Button>
                      </div>
                    </div>
                    {clan.food !== undefined && (
                      <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-slate-800/20">
                        <span className="text-slate-600 text-xs flex items-center gap-1"><Wheat size={10} /> {clan.food.toLocaleString()}</span>
                        <span className="text-slate-600 text-xs flex items-center gap-1"><TreePine size={10} /> {clan.wood.toLocaleString()}</span>
                        <span className="text-slate-600 text-xs flex items-center gap-1"><Mountain size={10} /> {clan.stone.toLocaleString()}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  const clan = clanData!;
  const members = clan.clan_members || [];
  const events = character.clanEvents || [];
  const buildings = character.clanBuildings || [];
  const vault = character.clanVault || { gold: 0, items: [] };

  const tabs = [
    { id: "overview" as const, label: "Overview", icon: Shield },
    { id: "buildings" as const, label: "Buildings", icon: Building2 },
    { id: "vault" as const, label: "Vault", icon: Gem },
    { id: "members" as const, label: "Members", icon: Users },
    { id: "laws" as const, label: "Laws", icon: Scroll },
    { id: "events" as const, label: "History", icon: History },
  ];

  return (
    <div className="space-y-5 animate-fade-in max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">{clan.name}</h1>
          <p className="text-slate-500 text-sm mt-0.5 capitalize">{clan.philosophy} settlement &middot; {clan.population} residents</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" icon={<HandHeart size={14} />} onClick={() => setShowDonate(true)}>Donate</Button>
          {isChieftain && (
            <Button variant="ghost" size="sm" icon={<Settings size={14} />} onClick={() => { setShowLaws(true); setTab("laws"); }}>Manage</Button>
          )}
        </div>
      </div>

      {error && <Alert variant="error" onDismiss={() => setError("")}>{error}</Alert>}

      {activeEvents.length > 0 && (
        <div className="card border-[#8a7a5a]/30 bg-slate-900/20">
          <div className="space-y-2">
            {activeEvents.map((ev) => (
              <div key={ev.id} className="flex items-start gap-2 text-sm">
                <Sparkles size={14} className="text-[#c4a86a] mt-0.5 shrink-0" />
                <div>
                  <span className="text-slate-200 font-semibold">{ev.name}</span>
                  <p className="text-slate-500 text-xs">{ev.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="bg-slate-900/30 px-4 py-3 rounded-lg border border-slate-800/20 flex items-center justify-between">
          <div>
            <span className="text-slate-500 text-xs">Clan Level</span>
            <p className="text-2xl font-bold text-slate-100">{clan.level || 1}</p>
          </div>
          <div className="text-right">
            <span className="text-slate-500 text-xs">XP</span>
            <p className="text-slate-400 font-semibold tabular-nums">{(clan.xp || 0).toLocaleString()}</p>
          </div>
        </div>
        <div className="bg-slate-900/30 px-4 py-3 rounded-lg border border-slate-800/20 flex items-center justify-between">
          <div>
            <span className="text-slate-500 text-xs">Vault Gold</span>
            <p className="text-2xl font-bold text-slate-100">{(vault.gold || 0).toLocaleString()}</p>
          </div>
          <div className="text-right">
            <span className="text-slate-500 text-xs">Vault Items</span>
            <p className="text-slate-400 font-semibold tabular-nums">{vault.items.length}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <ResourceBar current={clan.food} label="Food" icon={<Wheat size={12} />} />
        <ResourceBar current={clan.wood} label="Wood" icon={<TreePine size={12} />} />
        <ResourceBar current={clan.stone} label="Stone" icon={<Mountain size={12} />} />
        <ResourceBar current={clan.morale} max={100} label="Morale" icon={<Heart size={12} />} />
      </div>

      {showDonate && (
        <div className="card border-slate-600/30 bg-slate-900/30">
          <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3">Donate to Settlement</h3>
          <div className="grid grid-cols-4 gap-2 mb-3">
            <ResourceInput label="Food" value={donateFood} set={setDonateFood} />
            <ResourceInput label="Wood" value={donateWood} set={setDonateWood} />
            <ResourceInput label="Stone" value={donateStone} set={setDonateStone} />
            <ResourceInput label="Gold" value={donateGold} set={setDonateGold} />
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="primary" onClick={handleDonate} disabled={donateFood + donateWood + donateStone + donateGold === 0}>Donate</Button>
            <Button size="sm" variant="ghost" onClick={() => setShowDonate(false)}>Cancel</Button>
          </div>
        </div>
      )}

      <div className="flex gap-1 border-b border-slate-800/20 pb-px overflow-x-auto">
        {tabs.map((t) => {
          const Icon = t.icon;
          return (
            <button key={t.id} onClick={() => setTab(t.id)} className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold uppercase tracking-wider transition-colors whitespace-nowrap border-b-2 -mb-px ${
              tab === t.id ? "text-slate-200 border-slate-400" : "text-slate-600 border-transparent hover:text-slate-400"
            }`}>
              <Icon size={12} /> {t.label}
            </button>
          );
        })}
      </div>

      {tab === "overview" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Clan Buildings</h2>
            {buildings.length === 0 ? (
              <div className="card text-center py-6">
                <Building2 size={24} className="text-slate-800 mx-auto mb-2" />
                <p className="text-slate-600 text-xs">No buildings available.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {buildings.slice(0, 4).map((b) => {
                  const BIcon = buildingIcons[b.building_type] || Building2;
                  const blabel = buildingLabels[b.building_type] || b.building_type;
                  const overallPct = Math.round(
                    ((b.contributed_wood + b.contributed_stone + b.contributed_food) /
                    Math.max(1, b.cost.wood + b.cost.stone + b.cost.food)) * 100
                  );
                  return (
                    <div key={b.id} className="bg-slate-900/30 p-3 rounded-lg border border-slate-800/20 flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <BIcon size={16} className="text-slate-400" />
                        <span className="text-slate-200 text-sm font-semibold">{blabel}</span>
                        <span className="text-slate-500 text-xs">Lv.{b.level}</span>
                      </div>
                      <span className="text-slate-600 text-xs">{overallPct}% to next</span>
                    </div>
                  );
                })}
              </div>
            )}
            <Button variant="ghost" size="sm" icon={<Building2 size={12} />} className="mt-2" onClick={() => setTab("buildings")}>
              View All Buildings
            </Button>
          </div>
          <div>
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Recent Events</h2>
            <div className="card">
              {events.length === 0 ? (
                <p className="text-slate-600 text-xs text-center py-4">No recent events.</p>
              ) : (
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {events.slice(0, 10).map((ev) => {
                    const EIcon = eventIcons[ev.event_type] || History;
                    return (
                      <div key={ev.id} className="flex items-start gap-2 text-xs py-1.5 border-b border-slate-800/10 last:border-0">
                        <EIcon size={12} className="text-slate-500 mt-0.5 shrink-0" />
                        <span className="text-slate-400">{ev.description}</span>
                        <span className="text-slate-700 shrink-0 ml-auto">{new Date(ev.created_at).toLocaleDateString()}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {tab === "buildings" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Settlement Buildings</h2>
          </div>
          {buildings.length === 0 ? (
            <div className="card text-center py-8">
              <Building2 size={32} className="text-slate-800 mx-auto mb-2" />
              <p className="text-slate-600 text-sm">No buildings available.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {buildings.map((b) => (
                <BuildingCard key={b.id} building={b} characterId={character.id} onContribute={refreshCharacter} />
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "vault" && (
        <div className="space-y-4">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Clan Vault</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="card">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3">Gold Reserves</h3>
              <p className="text-2xl font-bold text-slate-100 mb-4">{vault.gold.toLocaleString()} <span className="text-sm text-slate-500 font-normal">gold</span></p>
              <div className="space-y-2">
                <div className="flex gap-2 items-end">
                  <div className="flex-1">
                    <label className="text-slate-600 text-[10px] uppercase block mb-1">Deposit</label>
                    <input type="number" min={0} value={vaultDepositAmount || ""} onChange={(e) => setVaultDepositAmount(Math.max(0, parseInt(e.target.value) || 0))}
                      className="input text-sm py-1.5 w-full" placeholder="0" />
                  </div>
                  <Button size="sm" variant="primary" icon={<ArrowDownRight size={12} />}
                    onClick={async () => {
                      if (vaultDepositAmount <= 0) return;
                      await supabase.rpc("vault_deposit_gold", { p_character_id: character.id, p_amount: vaultDepositAmount });
                      setVaultDepositAmount(0);
                      refreshCharacter();
                    }}
                    disabled={vaultDepositAmount <= 0}>Deposit</Button>
                </div>
                <div className="flex gap-2 items-end">
                  <div className="flex-1">
                    <label className="text-slate-600 text-[10px] uppercase block mb-1">Withdraw</label>
                    <input type="number" min={0} value={vaultWithdrawAmount || ""} onChange={(e) => setVaultWithdrawAmount(Math.max(0, parseInt(e.target.value) || 0))}
                      className="input text-sm py-1.5 w-full" placeholder="0" />
                  </div>
                  <Button size="sm" variant="secondary" icon={<ArrowUpRight size={12} />}
                    onClick={async () => {
                      if (vaultWithdrawAmount <= 0) return;
                      await supabase.rpc("vault_withdraw_gold", { p_character_id: character.id, p_amount: vaultWithdrawAmount });
                      setVaultWithdrawAmount(0);
                      refreshCharacter();
                    }}
                    disabled={vaultWithdrawAmount <= 0 || (!isChieftain && !isElder)}>Withdraw</Button>
                </div>
              </div>
            </div>

            <div className="card">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3">Stored Items</h3>
              {vault.items.length === 0 ? (
                <p className="text-slate-600 text-sm text-center py-4">No items in vault.</p>
              ) : (
                <div className="space-y-1 max-h-60 overflow-y-auto mb-3">
                  {vault.items.map((vi, i) => (
                    <div key={i} className="flex items-center justify-between text-xs py-1.5 border-b border-slate-800/10 last:border-0">
                      <span className="text-slate-300">{vi.item_name}</span>
                      <span className="text-slate-500">x{vi.quantity}</span>
                    </div>
                  ))}
                </div>
              )}
              <div className="space-y-2 border-t border-slate-800/20 pt-3">
                <div className="flex gap-2 items-end">
                  <div className="flex-1">
                    <label className="text-slate-600 text-[10px] uppercase block mb-1">Deposit Item</label>
                    <input type="text" value={vaultItemDeposit} onChange={(e) => setVaultItemDeposit(e.target.value)}
                      className="input text-sm py-1.5 w-full" placeholder="Item name" />
                  </div>
                  <div className="w-20">
                    <label className="text-slate-600 text-[10px] uppercase block mb-1">Qty</label>
                    <input type="number" min={1} value={vaultItemQty || ""} onChange={(e) => setVaultItemQty(Math.max(1, parseInt(e.target.value) || 0))}
                      className="input text-sm py-1.5 w-full" placeholder="1" />
                  </div>
                  <Button size="sm" variant="primary" icon={<ArrowDownRight size={12} />}
                    onClick={async () => {
                      if (!vaultItemDeposit || vaultItemQty <= 0) return;
                      await supabase.rpc("vault_deposit_item", { p_character_id: character.id, p_item_name: vaultItemDeposit, p_quantity: vaultItemQty });
                      setVaultItemDeposit(""); setVaultItemQty(0);
                      refreshCharacter();
                    }}
                    disabled={!vaultItemDeposit || vaultItemQty <= 0}>Deposit</Button>
                </div>
                <div className="flex gap-2 items-end">
                  <div className="flex-1">
                    <label className="text-slate-600 text-[10px] uppercase block mb-1">Withdraw Item</label>
                    <input type="text" value={vaultItemWithdraw} onChange={(e) => setVaultItemWithdraw(e.target.value)}
                      className="input text-sm py-1.5 w-full" placeholder="Item name" />
                  </div>
                  <div className="w-20">
                    <label className="text-slate-600 text-[10px] uppercase block mb-1">Qty</label>
                    <input type="number" min={1} value={vaultItemWithdrawQty || ""} onChange={(e) => setVaultItemWithdrawQty(Math.max(1, parseInt(e.target.value) || 0))}
                      className="input text-sm py-1.5 w-full" placeholder="1" />
                  </div>
                  <Button size="sm" variant="secondary" icon={<ArrowUpRight size={12} />}
                    onClick={async () => {
                      if (!vaultItemWithdraw || vaultItemWithdrawQty <= 0) return;
                      await supabase.rpc("vault_withdraw_item", { p_character_id: character.id, p_item_name: vaultItemWithdraw, p_quantity: vaultItemWithdrawQty });
                      setVaultItemWithdraw(""); setVaultItemWithdrawQty(0);
                      refreshCharacter();
                    }}
                    disabled={!vaultItemWithdraw || vaultItemWithdrawQty <= 0}>Withdraw</Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === "members" && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Members ({members.length})</h2>
          </div>
          <div className="space-y-2">
            {members.map((member) => {
              const isMe = member.character_id === character.id;
              return (
                <div key={member.id} className="bg-slate-900/30 p-3 rounded-lg border border-slate-800/20 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                      member.role === "chieftain" ? "bg-slate-800/50 text-slate-300 border border-slate-700/40" :
                      member.role === "elder" ? "bg-[#1a2a34] text-[#6a90a8] border border-[#3a5060]" :
                      "bg-slate-700 text-slate-300 border border-slate-600/40"
                    }`}>
                      {member.character?.name?.[0] || "?"}
                    </div>
                    <div>
                      <span className="text-slate-200 text-sm font-semibold">
                        {member.character?.name || "Unknown"}
                        {isMe && " (you)"}
                      </span>
                      <div className="flex items-center gap-1 mt-0.5">
                        <span className={`text-[10px] font-bold uppercase tracking-wider ${
                          member.role === "chieftain" ? "text-slate-300" :
                          member.role === "elder" ? "text-[#6a90a8]" :
                          "text-slate-600"
                        }`}>
                          {member.role === "chieftain" && <Crown size={10} className="inline mr-1" />}
                          {member.role}
                        </span>
                        {member.total_donated_wood + member.total_donated_stone + member.total_donated_food + member.total_donated_gold > 0 && (
                          <span className="text-slate-700 text-[10px] ml-2">
                            Donated: {member.total_donated_wood}W / {member.total_donated_stone}S / {member.total_donated_food}F / {member.total_donated_gold}G
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  {isChieftain && !isMe && (
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="sm" icon={<ArrowUp size={12} />} onClick={() => promoteMember(member.id)} loading={actionLoading} title="Promote" />
                      {member.role !== "member" && (
                        <Button variant="ghost" size="sm" icon={<ArrowDown size={12} />} onClick={() => demoteMember(member.id)} loading={actionLoading} title="Demote" />
                      )}
                      <Button variant="ghost" size="sm" icon={<UserMinus size={12} />} onClick={() => kickMember(member.id, member.character_id)} loading={actionLoading} title="Kick" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="border-t border-slate-800/20 pt-4 mt-4">
            {confirmLeave ? (
              <div className="bg-[#2a1414] p-4 rounded-lg border border-[#6e2424] animate-fade-in">
                <p className="text-[#d05050] text-sm mb-3">
                  {isChieftain && members.length > 1
                    ? "You must transfer leadership before leaving."
                    : "Are you sure you want to leave this clan?"}
                </p>
                <div className="flex gap-2">
                  <Button variant="danger" size="sm" onClick={leaveClan} loading={actionLoading}
                    disabled={isChieftain && members.length > 1}>Leave Clan</Button>
                  <Button variant="ghost" size="sm" onClick={() => setConfirmLeave(false)}>Cancel</Button>
                </div>
              </div>
            ) : (
              <Button variant="ghost" size="sm" icon={<UserMinus size={14} />} onClick={() => setConfirmLeave(true)}>Leave Clan</Button>
            )}
          </div>
        </div>
      )}

      {tab === "laws" && (
        <div className="card">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Clan Laws</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-2 uppercase tracking-wider">Tax Rate</label>
              <p className="text-slate-600 text-xs mb-2">0-25% of member gold earnings go to the settlement.</p>
              <div className="flex items-center gap-3">
                <input type="range" min={0} max={25} value={showLaws ? taxRate : clan.tax_rate}
                  onChange={(e) => setTaxRate(parseInt(e.target.value))}
                  className="flex-1 accent-slate-400" disabled={!canManage || !showLaws} />
                <span className="text-slate-200 font-bold text-sm w-8 text-right tabular-nums">{showLaws ? taxRate : clan.tax_rate}%</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-2 uppercase tracking-wider">Donation Requirement</label>
              <div className="flex gap-2">
                {["optional", "weekly", "mandatory"].map((opt) => (
                  <button key={opt} onClick={() => canManage && setDonationPolicy(opt)}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg border capitalize transition-colors ${
                      (showLaws ? donationPolicy : clan.donation_policy) === opt
                        ? "bg-slate-800/50 text-slate-200 border-slate-600/30"
                        : "bg-slate-900/30 text-slate-600 border-slate-800/20"
                    } ${(!canManage || !showLaws) ? "opacity-60" : ""}`}
                    disabled={!canManage || !showLaws}>
                    {opt}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-2 uppercase tracking-wider">PvP Policy</label>
              <div className="flex gap-2">
                {[{ id: "peaceful", label: "Peaceful" }, { id: "retaliate", label: "Retaliate" }, { id: "always_raid", label: "Always Raid" }].map((opt) => (
                  <button key={opt.id} onClick={() => canManage && setPvpPolicy(opt.id)}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-colors ${
                      (showLaws ? pvpPolicy : clan.pvp_policy) === opt.id
                        ? "bg-slate-800/50 text-slate-200 border-slate-600/30"
                        : "bg-slate-900/30 text-slate-600 border-slate-800/20"
                    } ${(!canManage || !showLaws) ? "opacity-60" : ""}`}
                    disabled={!canManage || !showLaws}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-2 uppercase tracking-wider">Recruitment</label>
              <div className="flex gap-2">
                {[{ id: "open", label: "Open" }, { id: "invite", label: "Invite Only" }, { id: "application", label: "Application" }].map((opt) => (
                  <button key={opt.id} onClick={() => canManage && setRecruitmentPolicy(opt.id)}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-colors ${
                      (showLaws ? recruitmentPolicy : clan.recruitment_policy) === opt.id
                        ? "bg-slate-800/50 text-slate-200 border-slate-600/30"
                        : "bg-slate-900/30 text-slate-600 border-slate-800/20"
                    } ${(!canManage || !showLaws) ? "opacity-60" : ""}`}
                    disabled={!canManage || !showLaws}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {canManage && (
              <div className="pt-2">
                {showLaws ? (
                  <div className="flex gap-2">
                    <Button variant="primary" size="sm" onClick={handleUpdateLaws}>Save Laws</Button>
                    <Button variant="ghost" size="sm" onClick={() => setShowLaws(false)}>Cancel</Button>
                  </div>
                ) : (
                  <Button variant="secondary" size="sm" icon={<Settings size={12} />} onClick={() => {
                    setShowLaws(true);
                    setTaxRate(clan.tax_rate);
                    setDonationPolicy(clan.donation_policy);
                    setPvpPolicy(clan.pvp_policy);
                    setRecruitmentPolicy(clan.recruitment_policy);
                  }}>Edit Laws</Button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === "events" && (
        <div className="card">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Settlement History</h2>
          {events.length === 0 ? (
            <p className="text-slate-600 text-sm text-center py-4">No events recorded yet.</p>
          ) : (
            <div className="space-y-1">
              {events.map((ev) => {
                const EIcon = eventIcons[ev.event_type] || History;
                return (
                  <div key={ev.id} className="flex items-start gap-2.5 py-2 border-b border-slate-800/10 last:border-0">
                    <EIcon size={14} className="text-slate-500 mt-0.5 shrink-0" />
                    <div className="flex-1">
                      <span className="text-slate-300 text-sm">{ev.description}</span>
                      <div className="text-slate-700 text-[10px] mt-0.5">
                        {new Date(ev.created_at).toLocaleString()}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {(character.achievements || []).length > 0 && (
        <div className="card">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">
            <Trophy size={12} className="inline mr-1" /> Your Reputation
          </h2>
          <div className="flex flex-wrap gap-2">
            {(character.achievements || []).map((ach) => (
              <div key={ach.id} className="bg-slate-900/30 px-3 py-1.5 rounded-lg border border-slate-800/20 flex items-center gap-1.5">
                <Trophy size={12} className="text-[#c4a86a]" />
                <span className="text-slate-200 text-xs font-semibold">{ach.title}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
