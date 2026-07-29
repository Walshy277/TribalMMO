export function d(sides: number): number {
  return Math.floor(Math.random() * sides) + 1;
}

export function roll(formula: string): number {
  const match = formula.match(/^(\d*)d(\d+)([+-]\d+)?$/i);
  if (!match) return 0;
  const count = parseInt(match[1] || "1", 10);
  const sides = parseInt(match[2], 10);
  const mod = parseInt(match[3] || "0", 10);
  let total = 0;
  for (let i = 0; i < count; i++) total += d(sides);
  return total + mod;
}

export function weightedPick<T extends { weight: number }>(items: T[]): T {
  const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
  let roll = Math.random() * totalWeight;
  for (const item of items) {
    roll -= item.weight;
    if (roll <= 0) return item;
  }
  return items[items.length - 1];
}

export function percentile(): number {
  return Math.random() * 100;
}

export function chance(percent: number): boolean {
  return Math.random() * 100 < percent;
}

export function range(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

export function rangeInt(min: number, max: number): number {
  return Math.floor(range(min, max + 1));
}

export function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function pickN<T>(arr: T[], n: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}

export function shuffle<T>(arr: T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export interface QualityRoll {
  label: string;
  multiplier: number;
  color: string;
}

export const QUALITY_TIERS: QualityRoll[] = [
  { label: "Crude", multiplier: 0.5, color: "#6e656c" },
  { label: "Simple", multiplier: 0.75, color: "#8a7f8a" },
  { label: "Standard", multiplier: 1.0, color: "#a0d0a0" },
  { label: "Fine", multiplier: 1.25, color: "#6a90a8" },
  { label: "Superior", multiplier: 1.5, color: "#8a6aaa" },
  { label: "Masterwork", multiplier: 2.0, color: "#c9a84c" },
  { label: "Legendary", multiplier: 3.0, color: "#e85050" },
];

export function rollQuality(skillLevel: number): QualityRoll {
  const roll = Math.random() * 100;
  const bonus = Math.min(skillLevel / 2, 25);

  if (roll < 5 - bonus * 0.2) return QUALITY_TIERS[0];
  if (roll < 15 - bonus * 0.3) return QUALITY_TIERS[1];
  if (roll < 50 - bonus * 0.4) return QUALITY_TIERS[2];
  if (roll < 75 + bonus * 0.3) return QUALITY_TIERS[3];
  if (roll < 88 + bonus * 0.4) return QUALITY_TIERS[4];
  if (roll < 96 + bonus * 0.5) return QUALITY_TIERS[5];
  return QUALITY_TIERS[6];
}

export function rollStat(base: number, quality: QualityRoll): number {
  const variance = 0.9 + Math.random() * 0.2;
  return Math.max(1, Math.floor(base * quality.multiplier * variance));
}

export interface DiceRollResult {
  total: number;
  rolls: number[];
  sides: number;
  modifier: number;
  critical: boolean;
  fumble: boolean;
}

export function rollDice(count: number, sides: number, modifier = 0): DiceRollResult {
  const rolls: number[] = [];
  for (let i = 0; i < count; i++) rolls.push(d(sides));
  const total = rolls.reduce((a, b) => a + b, 0) + modifier;
  const critical = rolls.filter((r) => r === sides).length >= 2;
  const fumble = rolls.filter((r) => r === 1).length >= 2;
  return { total, rolls, sides, modifier, critical, fumble };
}
