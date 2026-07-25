"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth";
import { Database } from "@/types/database";

type Character = Database["public"]["Tables"]["characters"]["Row"];
type Skill = Database["public"]["Tables"]["skills"]["Row"];
type Inventory = Database["public"]["Tables"]["inventory"]["Row"];
type Item = Database["public"]["Tables"]["items"]["Row"];
type Faction = Database["public"]["Tables"]["factions"]["Row"];
type FactionMember = Database["public"]["Tables"]["faction_members"]["Row"];
type Pet = Database["public"]["Tables"]["pets"]["Row"];
type Action = Database["public"]["Tables"]["actions"]["Row"];

interface CharacterWithSkills extends Character {
  skills: Skill[];
  inventory: (Inventory & { item: Item })[];
  faction?: FactionMember & { faction: Faction & { faction_members?: any[] } };
  pets: Pet[];
}

interface GameContextType {
  character: CharacterWithSkills | null;
  loading: boolean;
  refreshCharacter: () => Promise<void>;
  createCharacter: (name: string, background: string) => Promise<{ error?: string }>;
}

const GameContext = createContext<GameContextType | undefined>(undefined);

export function GameProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [character, setCharacter] = useState<CharacterWithSkills | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchCharacter = async () => {
    if (!user) {
      setCharacter(null);
      setLoading(false);
      return;
    }

    const { data: char } = await supabase
      .from("characters")
      .select("*, skills(*), inventory(*, item:*items(*)), pets(*)")
      .eq("user_id", user.id)
      .single() as any;

    if (char) {
      const { data: member } = await supabase
        .from("faction_members")
        .select("*, faction:factions(*, faction_members(*))")
        .eq("character_id", char.id)
        .single() as any;

      setCharacter({ ...char, faction: member ?? undefined });
    } else {
      setCharacter(null);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchCharacter();
  }, [user]);

  const refreshCharacter = async () => {
    setLoading(true);
    await fetchCharacter();
  };

  const createCharacter = async (name: string, background: string) => {
    if (!user) return { error: "Not authenticated" };

    const { error } = await supabase.from("characters").insert({
      user_id: user.id,
      name,
      background,
    });

    if (error) return { error: error.message };

    const skills = ["Gathering", "Crafting", "Combat", "Survival", "Diplomacy"];
    const { data: char } = await supabase
      .from("characters")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (char) {
      await supabase.from("skills").insert(
        skills.map((name) => ({ character_id: char.id, name }))
      );
    }

    await refreshCharacter();
    return {};
  };

  return (
    <GameContext.Provider value={{ character, loading, refreshCharacter, createCharacter }}>
      {children}
    </GameContext.Provider>
  );
}

export function useGame() {
  const context = useContext(GameContext);
  if (!context) throw new Error("useGame must be used within GameProvider");
  return context;
}
