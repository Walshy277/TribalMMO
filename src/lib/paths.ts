export const PATHS = {
  login: "/login",
  home: "/home",
  work: "/work",
  train: "/train",
  skills: "/skills",
  craft: "/craft",
  explore: "/explore",
  village: "/village",
  villageSquare: "/village/square",
  villageMarket: "/village/market",
  villageArmory: "/village/market/armory",
  villageGeneral: "/village/market/general",
  villageFood: "/village/market/food",
  villagePets: "/village/pets",
  villagePost: "/village/post",
  villageFire: "/village/fire",
  villageNotices: "/village/notices",
  clan: "/clan",
  clans: "/clans",
  bag: "/bag",
  admin: "/admin",
  /** Public player profile — use profilePath(name) for links */
  profile: "/u/:name",
  // Legacy aliases (redirect targets keep these keys for old links)
  shop: "/shop",
  shopArmory: "/shop/armory",
  shopPets: "/shop/pets",
  shopFood: "/shop/food",
  shopGeneral: "/shop/general",
  shopPost: "/shop/post",
} as const;

/** Build a public profile URL for a display name. */
export function profilePath(name: string): string {
  return `/u/${encodeURIComponent(name.trim())}`;
}

/** Paths that should highlight the Work primary tab */
export const WORK_PREFIXES = [PATHS.work, PATHS.train, PATHS.skills, PATHS.craft] as const;

/** Paths that should highlight the Village primary tab */
export const VILLAGE_PREFIX = PATHS.village;

/** Paths that should highlight the Clan primary tab */
export const CLAN_PREFIXES = [PATHS.clan, PATHS.clans] as const;
