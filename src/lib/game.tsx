import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth";
import { Database } from "@/types/database";

function withTimeout<T>(promise: PromiseLike<T>, ms: number): Promise<T> {
  return Promise.race([
    Promise.resolve(promise),
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error("Supabase query timed out")), ms)),
  ]);
}

const STAMINA_REGEN_INTERVAL_MS = 180000; // 3 minutes per 1 stamina

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
  level: number;
}

const MAX_LEVEL = 100;

export async function recalculateCharacterLevel(characterId: string, supabaseClient: typeof supabase) {
  const { data: skills } = await supabaseClient
    .from("skills")
    .select("level")
    .eq("character_id", characterId);

  if (!skills) return;

  const totalSkillLevels = skills.reduce((sum, s) => sum + (s.level || 1), 0);
  const newLevel = Math.min(totalSkillLevels, MAX_LEVEL);

  await supabaseClient
    .from("characters")
    .update({ level: newLevel })
    .eq("id", characterId);
}

interface GameContextType {
  character: CharacterWithSkills | null;
  loading: boolean;
  initialLoadDone: boolean;
  refreshCharacter: () => Promise<void>;
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

      // Compute level from total skill levels
      const computedLevel = Math.min(
        (skillsResult.data ?? []).reduce((sum, s) => sum + (s.level || 1), 0),
        100
      );

      // Persist level if changed
      if (computedLevel !== char.level) {
        await supabase
          .from("characters")
          .update({ level: computedLevel })
          .eq("id", char.id);
        char.level = computedLevel;
      }

      setCharacter({
        ...char,
        skills: skillsResult.data ?? [],
        pets: petsResult.data ?? [],
        inventory: inventory.map((inv) => ({ ...inv, item: items[inv.item_id] })),
        clan: clanResult.data ?? undefined,
        computed_stamina,
        next_stamina_at,
        level: computedLevel,
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

  return (
    <GameContext.Provider value={{ character, loading, initialLoadDone, refreshCharacter, logTransaction }}>
      {children}
    </GameContext.Provider>
  );
}

export function useGame() {
  const context = useContext(GameContext);
  if (!context) throw new Error("useGame must be used within GameProvider");
  return context;
}
