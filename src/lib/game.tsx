"use client";

import { createContext, useContext, useEffect, useState, useRef, ReactNode } from "react";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth";
import { Database } from "@/types/database";

function withTimeout<T>(promise: PromiseLike<T>, ms: number): Promise<T> {
  return Promise.race([
    Promise.resolve(promise),
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error("Supabase query timed out")), ms)),
  ]);
}

const STAMINA_REGEN_INTERVAL_MS = 300000; // 5 minutes per 1 stamina
const STAMINA_REGEN_TICK_MS = 1000; // UI tick every second

type Character = Database["public"]["Tables"]["characters"]["Row"];
type Skill = Database["public"]["Tables"]["skills"]["Row"];
type InventoryRow = Database["public"]["Tables"]["inventory"]["Row"];
type Item = Database["public"]["Tables"]["items"]["Row"];
type Clan = Database["public"]["Tables"]["clans"]["Row"];
type ClanMember = Database["public"]["Tables"]["clan_members"]["Row"];
type Pet = Database["public"]["Tables"]["pets"]["Row"];

type ClanMemberWithClan = ClanMember & {
  clan: Clan & { clan_members: (ClanMember & { character?: { name: string } | null })[] };
};

export interface CharacterWithSkills extends Character {
  skills: Skill[];
  inventory: (InventoryRow & { item: Item })[];
  clan?: ClanMemberWithClan;
  pets: Pet[];
  computed_stamina: number;
  next_stamina_at: string | null;
}

interface GameContextType {
  character: CharacterWithSkills | null;
  loading: boolean;
  initialLoadDone: boolean;
  refreshCharacter: () => Promise<void>;
  createCharacter: (name: string, background: string) => Promise<{ error?: string }>;
  logTransaction: (characterId: string, type: string, amount: number, description: string, metadata?: Record<string, unknown>) => Promise<void>;
}

const GameContext = createContext<GameContextType | undefined>(undefined);

function computeStamina(char: Character): { computed_stamina: number; next_stamina_at: string | null } {
  const maxStamina = char.max_stamina;
  const currentStamina = char.stamina;

  if (currentStamina >= maxStamina) {
    return { computed_stamina: maxStamina, next_stamina_at: null };
  }

  const lastUpdate = new Date(char.stamina_updated_at || char.created_at).getTime();
  const now = Date.now();
  const elapsed = now - lastUpdate;
  const regenCount = Math.floor(elapsed / STAMINA_REGEN_INTERVAL_MS);
  const newStamina = Math.min(maxStamina, currentStamina + regenCount);

  if (regenCount > 0) {
    const nextTick = lastUpdate + (regenCount + 1) * STAMINA_REGEN_INTERVAL_MS;
    return { computed_stamina: newStamina, next_stamina_at: new Date(nextTick).toISOString() };
  }

  const nextTick = lastUpdate + STAMINA_REGEN_INTERVAL_MS;
  return { computed_stamina: currentStamina, next_stamina_at: new Date(nextTick).toISOString() };
}

export function GameProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [character, setCharacter] = useState<CharacterWithSkills | null>(null);
  const [loading, setLoading] = useState(true);
  const [initialLoadDone, setInitialLoadDone] = useState(false);
  const [, setTick] = useState(0);

  // Regen tick for real-time stamina display
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), STAMINA_REGEN_TICK_MS);
    return () => clearInterval(interval);
  }, []);

  const fetchCharacter = async () => {
    if (!user) {
      setCharacter(null);
      setLoading(false);
      setInitialLoadDone(true);
      return;
    }

    try {
      const { data: char, error: charError } = await withTimeout(
        supabase
          .from("characters")
          .select("*")
          .eq("user_id", user.id)
          .single(),
        8000
      );

      if (charError || !char) {
        setCharacter(null);
        setLoading(false);
        setInitialLoadDone(true);
        return;
      }

      const [skillsResult, petsResult, inventoryResult, clanResult] = await Promise.all([
        withTimeout(supabase.from("skills").select("*").eq("character_id", char.id), 8000),
        withTimeout(supabase.from("pets").select("*").eq("character_id", char.id), 8000),
        withTimeout(supabase.from("inventory").select("*").eq("character_id", char.id), 8000),
        withTimeout(supabase.from("clan_members").select("*, clan:clans(*, clan_members(*))").eq("character_id", char.id).maybeSingle(), 8000),
      ]);

      const inventory = inventoryResult.data ?? [];
      const items: Record<string, Database["public"]["Tables"]["items"]["Row"]> = {};
      if (inventory.length > 0) {
        const itemIds = inventory.map((inv) => inv.item_id);
        const { data: itemList } = await withTimeout(
          supabase.from("items").select("*").in("id", itemIds),
          8000
        );
        if (itemList) {
          for (const item of itemList) {
            items[item.id] = item;
          }
        }
      }

      // Compute stamina regeneration
      const { computed_stamina, next_stamina_at } = computeStamina(char);

      // If stamina was regenerated, persist to DB
      if (computed_stamina !== char.stamina) {
        await supabase
          .from("characters")
          .update({
            stamina: computed_stamina,
            stamina_updated_at: new Date().toISOString(),
          })
          .eq("id", char.id);
        char.stamina = computed_stamina;
        char.stamina_updated_at = new Date().toISOString();
      }

      setCharacter({
        ...char,
        skills: skillsResult.data ?? [],
        pets: petsResult.data ?? [],
        inventory: inventory.map((inv) => ({ ...inv, item: items[inv.item_id] })),
        clan: clanResult.data ?? undefined,
        computed_stamina,
        next_stamina_at,
      } as CharacterWithSkills);
    } catch {
      setCharacter(null);
    } finally {
      setLoading(false);
      setInitialLoadDone(true);
    }
  };

  useEffect(() => {
    fetchCharacter();
  }, [user]);

  const refreshCharacter = async () => {
    await fetchCharacter();
  };

  const logTransaction = async (
    characterId: string,
    type: string,
    amount: number,
    description: string,
    metadata?: Record<string, unknown>
  ) => {
    await supabase.from("transactions").insert({
      character_id: characterId,
      type,
      amount,
      description,
      metadata: (metadata || {}) as Database["public"]["Tables"]["transactions"]["Row"]["metadata"],
    });
  };

  const createCharacter = async (name: string, background: string) => {
    if (!user) return { error: "Not authenticated" };

    const { error: insertError } = await supabase.from("characters").insert({
      user_id: user.id,
      name,
      background,
    });

    if (insertError) return { error: insertError.message };

    const { data: char } = await supabase
      .from("characters")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (char) {
      const skillNames = ["Gathering", "Crafting", "Combat", "Survival", "Diplomacy"];
      await supabase.from("skills").insert(
        skillNames.map((n) => ({ character_id: char.id, name: n }))
      );
    }

    await refreshCharacter();
    return {};
  };

  return (
    <GameContext.Provider value={{ character, loading, initialLoadDone, refreshCharacter, createCharacter, logTransaction }}>
      {children}
    </GameContext.Provider>
  );
}

export function useGame() {
  const context = useContext(GameContext);
  if (!context) throw new Error("useGame must be used within GameProvider");
  return context;
}
