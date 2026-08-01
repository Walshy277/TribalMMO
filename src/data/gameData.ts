import { PATHS } from "../lib/paths";

export interface NavItem {
  path: string;
  label: string;
  icon: string;
  desc: string;
  adminOnly?: boolean;
  /** Extra path prefixes that count as "active" for this nav item */
  matchPrefixes?: string[];
}

export interface NavCategory {
  id: string;
  label: string;
  items: NavItem[];
}

/**
 * Categorised primary chrome.
 * Self = you · Labour = solo grind · Tribe = shared world · Meta = tools
 */
export const NAV_CATEGORIES: NavCategory[] = [
  {
    id: "self",
    label: "Self",
    items: [
      { path: PATHS.home, label: "Camp", icon: "⛺", desc: "Your campfire" },
      { path: PATHS.bag, label: "Pack", icon: "🎒", desc: "Gear and goods" },
    ],
  },
  {
    id: "labour",
    label: "Labour",
    items: [
      {
        path: PATHS.work,
        label: "Work",
        icon: "⚒️",
        desc: "Train, skills, hearth",
        matchPrefixes: [PATHS.train, PATHS.skills, PATHS.craft],
      },
      { path: PATHS.explore, label: "Wilds", icon: "🗺️", desc: "Wander while you wait" },
    ],
  },
  {
    id: "tribe",
    label: "Tribe",
    items: [
      {
        path: PATHS.village,
        label: "Village",
        icon: "🏘️",
        desc: "Square, market, mail",
        matchPrefixes: [PATHS.village],
      },
      {
        path: PATHS.clan,
        label: "Clan",
        icon: "🏕️",
        desc: "Your people",
        matchPrefixes: [PATHS.clan, PATHS.clans],
      },
    ],
  },
  {
    id: "meta",
    label: "Meta",
    items: [
      { path: PATHS.admin, label: "Admin", icon: "🛡️", desc: "Manage players", adminOnly: true },
    ],
  },
];

/** Flat list derived from categories (Home shortcuts, titles, bottom tabs). */
export const PRIMARY_NAV: NavItem[] = NAV_CATEGORIES.flatMap((c) => c.items);

/** @deprecated use PRIMARY_NAV */
export const NAV_ITEMS = PRIMARY_NAV;

export function navItemIsActive(pathname: string, item: NavItem): boolean {
  if (pathname === item.path) return true;
  if (item.matchPrefixes?.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return true;
  }
  if (item.path !== PATHS.home && pathname.startsWith(item.path + "/")) return true;
  return false;
}

export interface WorkLink {
  path: string;
  label: string;
  icon: string;
  tagline: string;
  desc: string;
}

export const WORK_LINKS: WorkLink[] = [
  {
    path: PATHS.train,
    label: "Body",
    icon: "💪",
    tagline: "Training grounds",
    desc: "Invest energy into strength, defence, speed, and IQ.",
  },
  {
    path: PATHS.skills,
    label: "Skills",
    icon: "⚒️",
    tagline: "Labour of the land",
    desc: "Chop, mine, forage, hunt, fish, and farm.",
  },
  {
    path: PATHS.craft,
    label: "Hearth",
    icon: "🔥",
    tagline: "The forge fire",
    desc: "Refine materials and smith tools, weapons, and armor.",
  },
];

export interface VillagePlace {
  id: string;
  path: string;
  name: string;
  icon: string;
  tagline: string;
  desc: string;
  mailBadge?: boolean;
}

export const VILLAGE_PLACES: VillagePlace[] = [
  {
    id: "fire",
    path: PATHS.villageFire,
    name: "The First Great Fire",
    icon: "🔥",
    tagline: "World gathering",
    desc: "Pile 25,000 Logs with the tribe. Top donor earns a 1/1 trophy. ×2 regen when lit.",
  },
  {
    id: "square",
    path: PATHS.villageSquare,
    name: "Village Square",
    icon: "🪙",
    tagline: "Beg for coins",
    desc: "Hold out your bowl. Humility has its rewards.",
  },
  {
    id: "market",
    path: PATHS.villageMarket,
    name: "The Market",
    icon: "🏪",
    tagline: "Stalls & keepers",
    desc: "Armory, general goods, and the cookhouse.",
  },
  {
    id: "pets",
    path: PATHS.villagePets,
    name: "The Menagerie",
    icon: "🦊",
    tagline: "Pets & companions",
    desc: "Wild friends whose luck walks beside you.",
  },
  {
    id: "post",
    path: PATHS.villagePost,
    name: "Post Office",
    icon: "📮",
    tagline: "Mail & parcels",
    desc: "Letters, parcels, and word from afar.",
    mailBadge: true,
  },
  {
    id: "notices",
    path: PATHS.villageNotices,
    name: "Notice Board",
    icon: "📋",
    tagline: "Word around the fire",
    desc: "Milestones, world doings, and who's about.",
  },
];

export interface Zone {
  id: string;
  name: string;
  icon: string;
  tier: number;
  unlockSteps: number;
}

export const ZONES: Zone[] = [
  { id: "forest", name: "Forest", icon: "🌲", tier: 1, unlockSteps: 500 },
  { id: "plains", name: "Plains", icon: "🌾", tier: 1, unlockSteps: 1000 },
  { id: "riverbank", name: "Riverbank", icon: "🏞️", tier: 1, unlockSteps: 2500 },
  { id: "jagged_caves", name: "Jagged Caves", icon: "🕳️", tier: 2, unlockSteps: 5000 },
  { id: "deep_swamp", name: "Deep Swamp", icon: "🌿", tier: 2, unlockSteps: 10000 },
  { id: "ancient_ruins", name: "Ancient Ruins", icon: "🏛️", tier: 3, unlockSteps: 0 },
];

export const SHOP_SECTIONS: { label: string; types: string[] }[] = [
  { label: "Tools", types: ["tool"] },
  { label: "Weapons", types: ["weapon"] },
  { label: "Armor", types: ["armor"] },
  { label: "Consumables", types: ["consumable"] },
  { label: "Materials", types: ["material"] },
  { label: "Collectibles", types: ["collectible"] },
];

export interface Store {
  id: string;
  path: string;
  name: string;
  icon: string;
  keeper: string;
  tagline: string;
  desc: string;
  types: string[];
}

/** Buyable market stalls only (not post / pets). */
export const MARKET_STALLS: Store[] = [
  {
    id: "armory",
    path: PATHS.villageArmory,
    name: "The Armory",
    icon: "⚔️",
    keeper: "Brann the Smith",
    tagline: "Weapons & Armor",
    desc: "Steel, stone, and bone for those who fight.",
    types: ["weapon", "armor"],
  },
  {
    id: "general",
    path: PATHS.villageGeneral,
    name: "General Store",
    icon: "🏪",
    keeper: "Mara the Trader",
    tagline: "General Goods",
    desc: "Tools, curios, and everyday wares.",
    types: ["tool", "material", "collectible"],
  },
  {
    id: "food",
    path: PATHS.villageFood,
    name: "The Cookhouse",
    icon: "🍖",
    keeper: "Willa the Cook",
    tagline: "Food & Drink",
    desc: "Hot meals that put fire back in your step.",
    types: ["consumable"],
  },
];

/** @deprecated use MARKET_STALLS + VILLAGE_PLACES */
export const STORES: Store[] = [
  ...MARKET_STALLS,
  {
    id: "pets",
    path: PATHS.villagePets,
    name: "The Menagerie",
    icon: "🦊",
    keeper: "Hestia the Beastkeeper",
    tagline: "Pets & Companions",
    desc: "Wild friends whose luck walks beside you.",
    types: [],
  },
  {
    id: "post",
    path: PATHS.villagePost,
    name: "Post Office",
    icon: "📮",
    keeper: "Penny the Postmistress",
    tagline: "Mail & Parcels",
    desc: "Letters, parcels, and word from afar.",
    types: [],
  },
];
