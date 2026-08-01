export interface SkillInfo {
  level: number;
  xp: number;
  xp_next: number;
}

export interface SkillDef {
  id: SkillKey;
  name: string;
  icon: string;
  label: string;
  verb: string;
  desc: string;
  unlockLevel?: number;
}

export type SkillKey =
  | "woodcutting"
  | "mining"
  | "gathering"
  | "hunting"
  | "fishing"
  | "farming"
  | "taming";

export type Skills = Record<SkillKey, SkillInfo>;

export interface StatInfo {
  value: number;
}

export type StatKey = "strength" | "defence" | "speed" | "iq";

export type ClanRole = "chieftain" | "elder" | "member";
export type ClanRecruitment = "open" | "invite";

export type Stats = Record<StatKey, StatInfo>;

export interface StatDef {
  id: StatKey;
  name: string;
  icon: string;
  desc: string;
}

export const CORE_STATS: StatDef[] = [
  { id: "strength", name: "Strength", icon: "💪", desc: "Damage dealt in fights" },
  { id: "defence", name: "Defence", icon: "🛡️", desc: "Damage reduction when hit" },
  { id: "speed", name: "Speed", icon: "💨", desc: "Strike first and dodge chance" },
  { id: "iq", name: "IQ", icon: "🧠", desc: "Block chance and fewer misses" },
];

export const STAT_TRAIN_COST = 5;

export type ItemRarity = "common" | "uncommon" | "rare" | "epic" | "legendary";

export const RARITY_PCT: Record<ItemRarity, number> = {
  common: 60,
  uncommon: 25,
  rare: 10,
  epic: 4,
  legendary: 1,
};

export const RARITY_STYLE: Record<ItemRarity, string> = {
  common: "text-stone-400",
  uncommon: "text-emerald-400/90",
  rare: "text-sky-400/90",
  epic: "text-violet-400/90",
  legendary: "text-amber-400",
};

export function rarityLabel(rarity: string | undefined, pct?: number): string {
  const key = (rarity ?? "common").toLowerCase() as ItemRarity;
  const label = key.charAt(0).toUpperCase() + key.slice(1);
  const weight = pct ?? RARITY_PCT[key] ?? 60;
  return `${label} ${weight}%`;
}

export interface GameItem {
  item_id: number;
  name: string;
  icon: string;
  description: string;
  item_type: "tool" | "weapon" | "armor" | "material" | "consumable" | "collectible" | "trophy";
  rarity: ItemRarity | string;
  rarity_pct: number;
  power: number;
  price: number;
  skill?: SkillKey;
  quantity: number;
  durability?: number;
  max_durability?: number;
  quality?: number;
  is_unique?: boolean;
  is_gift?: boolean;
}

export type EquipSlot =
  | SkillKey
  | "weapon"
  | "armor";

export type Equipment = Partial<Record<EquipSlot, GameItem>>;

export interface EquipSlotDef {
  id: EquipSlot;
  name: string;
  icon: string;
  label: string;
  kind: "tool" | "weapon" | "armor";
}

export interface Energy {
  current: number;
  max: number;
  regen_per_min: number;
  regen_per_tick?: number;
  tick_minutes?: number;
}

export interface CharacterProfile {
  id: string;
  display_name: string | null;
  bio?: string | null;
  gold: number;
  energy: Energy;
  skills: Skills;
  stats: Stats;
  stat_mult?: number;
  equipment: Equipment;
  inventory: GameItem[];
  pets: Pet[];
  zone: string;
  zone_progress: Record<string, { steps: number; mastery: number }>;
  hp: number;
  max_hp: number;
  tutorial_step: number;
  unread_mail: number;
  is_admin: boolean;
  cooldown_until: string | null;
  begs_today?: number;
  begs_remaining?: number;
  play_seconds?: number;
  last_seen_at?: string | null;
  is_online?: boolean;
  joined_at?: string;
  networth?: number;
  clan_id?: string | null;
  clan_tag?: string | null;
  clan_role?: ClanRole | null;
}

/** Public-facing gear slot — no power / price. */
export interface PublicEquipItem {
  item_id: number;
  name: string;
  icon: string;
  item_type: GameItem["item_type"];
  rarity: ItemRarity | string;
  rarity_pct: number;
  skill?: SkillKey;
}

export interface PublicTrophy {
  item_id: number;
  name: string;
  icon: string;
  rarity: ItemRarity | string;
  rarity_pct: number;
  description: string | null;
}

export interface AdminSearchResult {
  id: string;
  display_name: string | null;
  gold: number;
  zone: string;
  is_admin: boolean;
}

export interface AdminCharacter extends Omit<CharacterProfile, "energy"> {
  energy: Energy;
}

export interface AdminAuditEntry {
  id: number;
  admin_name: string | null;
  action: string;
  detail: {
    field?: string;
    action?: string;
    stat?: string;
    skill?: string;
    item_id?: number;
    quantity?: number;
    before?: number | string;
    after?: number | string;
  };
  reverted_at: string | null;
  created_at: string;
}

export interface StatActionResult {
  stat: StatKey;
  value_gained: number;
  value: number;
  energy_used: number;
  cooldown_until: string | null;
}

export interface SkillActionResult {
  skill: SkillKey;
  xp_gained: number;
  gold_gained: number;
  items_gained: { item_id: number; name: string; icon: string; quantity: number }[];
  log: { type: string; message: string }[];
  energy_used: number;
  cooldown_until: string | null;
}

export interface LastActionResult extends SkillActionResult {
  prevLevel: number;
}

export interface ExploreResult {
  zone: string;
  event: string;
  message: string;
  xp_gained: number;
  gold_gained: number;
  items_gained: { item_id: number; name: string; icon: string; quantity: number }[];
  mastery: number;
  steps: number;
  unlocked_zone: string | null;
  energy_used: number;
  cooldown_until: string | null;
  encounter: ExploreEncounter | null;
}

export interface EncounterChoice {
  id: number;
  label: string;
  hint?: string | null;
}

export interface EncounterTarget {
  id?: string;
  name: string;
  level: number;
  zone: string;
}

export interface ExploreEncounter {
  id: number;
  kind: "npc" | "player";
  title: string;
  icon: string;
  description: string;
  choices: EncounterChoice[];
  target?: EncounterTarget | null;
}

export interface EncounterOutcome {
  encounter_id: number;
  kind: string;
  title: string;
  icon: string;
  message: string;
  gold_gained: number;
  items_gained: { item_id: number; name: string; icon: string; quantity: number }[];
  xp_gained: number;
  xp_skill: string | null;
  sxp_gained: number;
  sxp_stat: string | null;
  leveled: boolean;
  hp_damage: number;
  hp_gain: number;
  energy_gain: number;
  steps_gained: number;
  duel_won: boolean | null;
  opponent: string | null;
  log: { type: string; message: string }[];
  cooldown_until: string | null;
}

export interface ShopListing {
  item_id: number;
  name: string;
  icon: string;
  description: string;
  item_type: string;
  rarity: string;
  rarity_pct: number;
  price: number;
  quantity: number;
}

export type PetBonusType = "energy_regen" | "max_energy" | "gold" | "xp" | "hp";

export interface Pet {
  pet_id: number;
  name: string;
  icon: string;
  tier: number;
  rarity: string;
  price: number;
  description: string;
  bonus_type: PetBonusType;
  bonus_amount: number;
  bonuses?: Record<string, number> | null;
  gift_only?: boolean;
  is_active: boolean;
}

export type PublicPet = Pick<
  Pet,
  | "pet_id"
  | "name"
  | "icon"
  | "tier"
  | "rarity"
  | "description"
  | "bonus_type"
  | "bonus_amount"
  | "bonuses"
  | "is_active"
>;

/** Sanitized profile visible to other players (no core stats / skill levels). */
export interface PublicProfile {
  id: string;
  display_name: string;
  bio?: string | null;
  zone: string;
  joined_at: string;
  play_seconds: number;
  last_seen_at?: string | null;
  is_online?: boolean;
  networth: number;
  steps: number;
  equipment: Partial<Record<EquipSlot, PublicEquipItem>>;
  active_pet: PublicPet | null;
  trophies: PublicTrophy[];
  clan?: PublicClanBadge | null;
  is_self: boolean;
}

export interface PublicClanBadge {
  id: string;
  name: string;
  tag: string;
  role?: ClanRole;
}

export interface ClanMember {
  character_id: string;
  display_name: string;
  role: ClanRole;
  zone?: string;
  last_seen_at?: string | null;
  is_online?: boolean;
  joined_at?: string;
}

export interface Clan {
  id: string;
  name: string;
  tag: string;
  philosophy: string | null;
  banner: string;
  recruitment: ClanRecruitment;
  chieftain_id: string;
  created_at: string;
  vault_gold?: number;
  members: ClanMember[];
  my_role?: ClanRole | null;
}

export interface ClanSummary {
  id: string;
  name: string;
  tag: string;
  banner: string;
  recruitment: ClanRecruitment;
  member_count: number;
  chieftain_name: string | null;
}

export interface ClanVaultItem {
  item_id: number;
  name: string;
  icon: string;
  quantity: number;
  rarity?: string;
}

export interface ClanVault {
  gold: number;
  items: ClanVaultItem[];
}

export interface ClanEvent {
  id: number;
  kind: string;
  message: string;
  actor_id: string | null;
  actor_name?: string | null;
  meta?: Record<string, unknown>;
  created_at: string;
}

export interface ClanMessage {
  id: number;
  sender_id: string;
  sender_name: string;
  body: string;
  created_at: string;
}

export interface NoticeItem {
  id: number;
  kind: "milestone" | "world" | "clan" | "system";
  title: string;
  body: string;
  actor_id: string | null;
  actor_name: string | null;
  meta: Record<string, unknown>;
  created_at: string;
}

export interface OnlinePlayer {
  id: string;
  display_name: string;
  zone: string;
  last_seen_at: string;
}

export function formatPlayTime(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const days = Math.floor(s / 86400);
  const hours = Math.floor((s % 86400) / 3600);
  const mins = Math.floor((s % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  if (mins > 0) return `${mins}m`;
  return `${s}s`;
}

export interface MailItem {
  id: number;
  sender: string | null;
  sender_id?: string | null;
  subject: string;
  body: string | null;
  gold: number;
  item_id: number | null;
  item_icon: string | null;
  item_name: string | null;
  item_qty: number;
  claimed_at: string | null;
  created_at: string;
}

export interface TutorialStep {
  step: number;
  title: string;
  icon: string;
  flavor: string;
  objective: string;
  requirement: string;
  require_n: number;
  reward_gold: number;
  reward_item_id: number | null;
  reward_item_icon: string | null;
  reward_item_name: string | null;
  reward_item_qty: number;
}

export function petBonusText(bonus_type: PetBonusType, amount: number): string {
  switch (bonus_type) {
    case "energy_regen":
      return `+${amount} energy / 5min tick`;
    case "max_energy":
      return `+${amount} max energy`;
    case "gold":
      return `+${amount}% gold`;
    case "xp":
      return `+${amount}% skill XP`;
    case "hp":
      return `+${amount} max health`;
  }
}

export function petBonusSummary(pet: Pick<Pet, "bonus_type" | "bonus_amount" | "bonuses">): string {
  const bonuses = pet.bonuses;
  if (!bonuses || Object.keys(bonuses).length === 0) {
    return petBonusText(pet.bonus_type, pet.bonus_amount);
  }
  const parts: string[] = [];
  if (bonuses.stats) parts.push(`×${(1 + bonuses.stats / 100).toFixed(1).replace(/\.0$/, "")} core stats`);
  if (bonuses.xp) parts.push(`+${bonuses.xp}% XP`);
  if (bonuses.luck) parts.push(`×${(1 + bonuses.luck / 100).toFixed(1).replace(/\.0$/, "")} exploration luck`);
  if (bonuses.gold) parts.push(`+${bonuses.gold}% gold`);
  if (bonuses.hp) parts.push(`+${bonuses.hp} max health`);
  if (bonuses.max_energy) parts.push(`+${bonuses.max_energy} max energy`);
  if (bonuses.energy_regen) parts.push(`+${bonuses.energy_regen} energy / 5min tick`);
  return parts.join(" · ");
}

export interface RecipeIngredient {
  item_id: number;
  name: string;
  icon: string;
  quantity: number;
}

export type RecipeCategory = "refining" | "tools" | "weapons" | "armor" | "crafting";

export interface Recipe {
  recipe_id: number;
  item_id: number;
  name: string;
  icon: string;
  category: RecipeCategory;
  skill: SkillKey;
  level_required: number;
  result_quantity: number;
  energy_cost: number;
  xp_reward: number;
  description: string | null;
  item_type: GameItem["item_type"];
  rarity: string;
  rarity_pct: number;
  power: number;
  price: number;
  item_description: string | null;
  ingredients: RecipeIngredient[];
}

export interface CraftResult {
  recipe_id: number;
  item_id: number;
  name: string;
  icon: string;
  quantity: number;
  quality: number;
  quality_label: string;
  xp_gained: number;
  leveled: boolean;
  cooldown_until: string | null;
}

export function qualityLabel(quality: number): string {
  if (quality >= 105) return "Masterwork";
  if (quality >= 90) return "Fine";
  if (quality >= 75) return "Good";
  return "Standard";
}

export const RECIPE_CATEGORIES: { id: RecipeCategory; label: string; icon: string }[] = [
  { id: "refining", label: "Refining", icon: "🔥" },
  { id: "tools", label: "Tools", icon: "🪓" },
  { id: "weapons", label: "Weapons", icon: "⚔️" },
  { id: "armor", label: "Armor", icon: "🛡️" },
  { id: "crafting", label: "Crafting", icon: "🪵" },
];

export const SKILLS: SkillDef[] = [
  { id: "woodcutting", name: "Woodcutting", icon: "🪓", label: "Axe", verb: "Chop", desc: "Chop trees for wood", unlockLevel: 2 },
  { id: "mining", name: "Mining", icon: "⛏️", label: "Pick", verb: "Mine", desc: "Mine ore and stone" },
  { id: "gathering", name: "Gathering", icon: "🌿", label: "Sickle", verb: "Forage", desc: "Forage herbs and fibers" },
  { id: "hunting", name: "Hunting", icon: "🏹", label: "Bow", verb: "Hunt", desc: "Hunt wildlife for meat" },
  { id: "fishing", name: "Fishing", icon: "🎣", label: "Rod", verb: "Fish", desc: "Catch fish for food" },
  { id: "farming", name: "Farming", icon: "🌾", label: "Hoe", verb: "Farm", desc: "Grow and harvest farm foods" },
  { id: "taming", name: "Taming", icon: "🦊", label: "Bait", verb: "Tame", desc: "Tame wild pets" },
];

export const TOOL_REQUIRED: Set<SkillKey> = new Set([
  "woodcutting",
  "mining",
  "gathering",
  "hunting",
  "fishing",
  "farming",
]);

export const TOOL_EQUIP_SLOTS: EquipSlotDef[] = SKILLS.filter((s) => TOOL_REQUIRED.has(s.id)).map(
  (s) => ({
    id: s.id,
    name: s.name,
    icon: s.icon,
    label: s.label,
    kind: "tool" as const,
  }),
);

export const COMBAT_EQUIP_SLOTS: EquipSlotDef[] = [
  { id: "weapon", name: "Weapon", icon: "⚔️", label: "Weapon", kind: "weapon" },
  { id: "armor", name: "Armor", icon: "🛡️", label: "Armor", kind: "armor" },
];

/** Tool slots first, then weapon/armor — used by Pack and HUD. */
export const EQUIP_SLOTS: EquipSlotDef[] = [...TOOL_EQUIP_SLOTS, ...COMBAT_EQUIP_SLOTS];

export const AVAILABLE_SKILLS: ReadonlySet<SkillKey> = new Set([
  "woodcutting",
  "mining",
  "gathering",
  "hunting",
  "fishing",
  "farming",
]);

export function skillEnergyCost(toolPower: number): number {
  return Math.max(4, 8 - toolPower);
}

export function characterLevel(skills: Skills): number {
  return 1 + Object.values(skills).reduce((sum, s) => sum + (s?.level ?? 0), 0);
}

export function statTrainingGain(energy: number): number {
  return Math.floor(energy * 3);
}

export interface BegResult {
  gold_gained: number;
  begs_today: number;
  begs_remaining: number;
  log: { type: string; message: string }[];
  cooldown_until: string | null;
}

export interface WorldEvent {
  id: string;
  title: string;
  icon: string;
  description: string;
  item_id: number;
  item_name: string;
  item_icon: string;
  goal: number;
  progress: number;
  status: "active" | "completed";
  completed_at: string | null;
  buff_until: string | null;
  buff_active: boolean;
  regen_multiplier: number;
  my_donated: number;
  my_inventory: number;
  top_donor_name: string | null;
  top_donor_amount: number;
  top_donor_is_me: boolean;
  reward_sent: boolean;
  reward_trophy: string;
  reward_chest: string;
}

export interface WorldEventDonateResult {
  event_id: string;
  donated: number;
  item_id: number;
  item_name: string;
  item_icon: string;
  progress: number;
  goal: number;
  status: "active" | "completed";
  lit: boolean;
  buff_until: string | null;
  buff_active: boolean;
  my_donated: number;
}
