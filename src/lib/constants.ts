import { Swords, Shield, Gem, CircleDot, Coins, PawPrint, Cat, Dog, Bird, Skull, Flame, Crown, TreePine, Mountain, Package, Hammer } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export const typeIcons: Record<string, LucideIcon> = {
  weapon: Swords,
  armor: Shield,
  accessory: Gem,
  collectible: Crown,
  materials: CircleDot,
  resources: Coins,
  pet: PawPrint,
};

export const rarityNames: Record<number, string> = {
  1: "Common",
  2: "Uncommon",
  3: "Rare",
  4: "Ultra Rare",
  5: "Epic",
  6: "Legendary",
  7: "Mythical",
};

export const rarityColors: Record<number, string> = {
  1: "#6e656c",
  2: "#4a9e6a",
  3: "#6a90a8",
  4: "#8a6aaa",
  5: "#c04e20",
  6: "#c9a84c",
  7: "#e85050",
};

export const MAX_SKILL_LEVEL = 99;
export const MAX_PLAYER_LEVEL = 495; // 99 * 5 skills

export function xpForLevel(targetLevel: number): number {
  if (targetLevel <= 1) return 0;
  let total = 0;
  for (let i = 1; i < targetLevel; i++) {
    total += Math.floor(i + 300 * Math.pow(2, i / 7));
  }
  return Math.floor(total / 4);
}

export const SKILL_NAMES = ["Gathering", "Crafting", "Combat", "Woodcutting", "Mining"] as const;
export type SkillName = (typeof SKILL_NAMES)[number];

export const skillIcons: Record<string, LucideIcon> = {
  Gathering: Package,
  Crafting: Hammer,
  Combat: Swords,
  Woodcutting: TreePine,
  Mining: Mountain,
};

export const petIcons: Record<string, LucideIcon> = {
  wolf: Dog,
  cat: Cat,
  hawk: Bird,
  snake: Skull,
  dog: Dog,
  dragon: Flame,
  boar: Skull,
  goat: Crown,
};
