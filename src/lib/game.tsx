import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth";
import { Database } from "@/types/database";
import { MAX_PLAYER_LEVEL } from "@/lib/constants";

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

type ClanEvent = Database["public"]["Tables"]["clan_events"]["Row"];
type ClanProject = Database["public"]["Tables"]["clan_projects"]["Row"];
type Notification = Database["public"]["Tables"]["notifications"]["Row"];
type WorldEvent = Database["public"]["Tables"]["world_events"]["Row"];
type Achievement = Database["public"]["Tables"]["achievements"]["Row"];

export interface CharacterWithSkills extends Character {
  skills: Skill[];
  inventory: (InventoryRow & { item: Item })[];
  clan?: ClanMemberWithClan;
  pets: Pet[];
  computed_stamina: number;
  next_stamina_at: string | null;
  level: number;
  clanProjects?: ClanProject[];
  clanEvents?: ClanEvent[];
  notifications?: Notification[];
  worldEvents?: WorldEvent[];
  achievements?: Achievement[];
}

export { MAX_PLAYER_LEVEL };

export async function recalculateCharacterLevel(characterId: string, supabaseClient: typeof supabase) {
  const { data: skills } = await supabaseClient
    .from("skills")
    .select("level")
    .eq("character_id", characterId);

  if (!skills) return;

  const totalSkillLevels = skills.reduce((sum, s) => sum + (s.level || 1), 0);

  await supabaseClient
    .from("characters")
    .update({ level: totalSkillLevels })
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
      let char = null;

      for (let attempt = 0; attempt < 6; attempt++) {
        if (attempt > 0) await new Promise((r) => setTimeout(r, 1000));
        const { data } = await withTimeout(
          supabase.from("characters").select("*").eq("user_id", user.id).maybeSingle(),
          8000
        );
        if (data) { char = data; break; }
      }

      if (!char) {
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

      let clanProjects: ClanProject[] = [];
      let clanEvents: ClanEvent[] = [];
      let notifications: Notification[] = [];
      let worldEvents: WorldEvent[] = [];
      let achievements: Achievement[] = [];

      if (clanResult.data) {
        const clanId = clanResult.data.clan_id;
        const [projectsRes, eventsRes, notifsRes, worldRes, achievRes] = await Promise.all([
          withTimeout(supabase.from("clan_projects").select("*").eq("clan_id", clanId).order("created_at", { ascending: false }).limit(5), 8000),
          withTimeout(supabase.from("clan_events").select("*").eq("clan_id", clanId).order("created_at", { ascending: false }).limit(20), 8000),
          withTimeout(supabase.from("notifications").select("*").eq("character_id", char.id).order("created_at", { ascending: false }).limit(20), 8000),
          withTimeout(supabase.from("world_events").select("*").eq("status", "active").limit(5), 8000),
          withTimeout(supabase.from("achievements").select("*").eq("character_id", char.id).limit(20), 8000),
        ]);
        clanProjects = (projectsRes.data ?? []) as ClanProject[];
        clanEvents = (eventsRes.data ?? []) as ClanEvent[];
        notifications = (notifsRes.data ?? []) as Notification[];
        worldEvents = (worldRes.data ?? []) as WorldEvent[];
        achievements = (achievRes.data ?? []) as Achievement[];
      }

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

      const computedLevel = Math.min(
        (skillsResult.data ?? []).reduce((sum, s) => sum + (s.level || 1), 0),
        MAX_PLAYER_LEVEL
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
        clanProjects,
        clanEvents,
        notifications,
        worldEvents,
        achievements,
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
