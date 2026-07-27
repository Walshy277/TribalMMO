import { Swords, Shield, FlaskConical, Hammer, Package, PawPrint, Cat, Dog, Bird, Skull, Flame, Crown, TreePine, Mountain } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export const typeIcons: Record<string, LucideIcon> = {
  weapon: Swords,
  armor: Shield,
  consumable: FlaskConical,
  tool: Hammer,
  resource: Package,
  pet: PawPrint,
};

export const skillIcons: Record<string, LucideIcon> = {
  Woodcutting: TreePine,
  Mining: Mountain,
  Gathering: Package,
  Crafting: Hammer,
  Combat: Swords,
  Survival: Package,
  Diplomacy: Package,
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
