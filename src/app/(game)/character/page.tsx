"use client";

import { useGame } from "@/lib/game";
import { useAuth } from "@/lib/auth";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { User, Swords, Shield, Crosshair, Brain, Dumbbell, Axe, Hammer, Tent, Handshake } from "lucide-react";
import type { LucideIcon } from "lucide-react";

const skillIcons: Record<string, LucideIcon> = {
  Gathering: Axe,
  Crafting: Hammer,
  Combat: Swords,
  Survival: Tent,
  Diplomacy: Handshake,
};

export default function CharacterPage() {
  const { user, loading: authLoading } = useAuth();
  const { character, loading: gameLoading } = useGame();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && !user) router.push("/login");
  }, [user, authLoading]);

  if (authLoading || gameLoading) {
    return <div className="min-h-[60vh] flex items-center justify-center text-tribal-500">Loading...</div>;
  }

  if (!character) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <User size={48} className="text-tribal-600 mx-auto mb-3" />
          <p className="text-tribal-400 mb-4">No character found.</p>
          <a href="/" className="btn-primary inline-block">Go to Dashboard</a>
        </div>
      </div>
    );
  }

  const skills = character.skills || [];

  return (
    <div className="space-y-6 animate-fade-in max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-tribal-100">{character.name}</h1>
        <p className="text-tribal-500 text-sm mt-0.5">{character.background}</p>
      </div>

      {/* Core Stats */}
      <div className="card">
        <h2 className="text-sm font-semibold text-tribal-400 uppercase tracking-wider mb-4">Core Stats</h2>
        <div className="grid grid-cols-5 gap-3">
          {[
            { label: "Strength", value: character.strength, icon: Dumbbell, color: "text-red-400" },
            { label: "Agility", value: character.agility, icon: Swords, color: "text-green-400" },
            { label: "Endurance", value: character.endurance, icon: Shield, color: "text-yellow-400" },
            { label: "Focus", value: character.focus, icon: Crosshair, color: "text-blue-400" },
            { label: "Cunning", value: character.cunning, icon: Brain, color: "text-purple-400" },
          ].map((stat) => {
            const Icon = stat.icon;
            return (
              <div key={stat.label} className="text-center bg-tribal-900/50 p-4 rounded-lg">
                <Icon size={20} className={`mx-auto mb-1 ${stat.color}`} />
                <div className="text-tribal-600 text-[10px] font-medium uppercase">{stat.label}</div>
                <div className={`text-2xl font-bold mt-1 ${stat.color}`}>{stat.value}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Stamina */}
      <div className="card">
        <h2 className="text-sm font-semibold text-tribal-400 uppercase tracking-wider mb-3">Stamina</h2>
        <div className="flex items-center justify-between mb-2">
          <span className="text-tribal-400 text-sm">Energy</span>
          <span className="text-tribal-100 font-bold">{character.stamina} / {character.max_stamina}</span>
        </div>
        <div className="w-full bg-tribal-800 rounded-full h-3">
          <div
            className="bg-green-500 h-3 rounded-full transition-all duration-500"
            style={{ width: `${(character.stamina / character.max_stamina) * 100}%` }}
          />
        </div>
      </div>

      {/* Skills */}
      <div className="card">
        <h2 className="text-sm font-semibold text-tribal-400 uppercase tracking-wider mb-4">Skills</h2>
        <div className="space-y-3">
          {skills.map((skill: any) => {
            const maxXP = skill.tier * 100;
            const progress = Math.min(100, (skill.experience / maxXP) * 100);
            const Icon = skillIcons[skill.name] || Hammer;
            return (
              <div key={skill.id} className="bg-tribal-900/50 p-4 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2.5">
                    <Icon size={18} className="text-tribal-400" />
                    <span className="text-tribal-200 font-semibold">{skill.name}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-tribal-500 text-sm">Tier {skill.tier}</span>
                    <span className="text-tribal-100 font-bold text-sm">{skill.experience} XP</span>
                  </div>
                </div>
                <div className="w-full bg-tribal-800 rounded-full h-2">
                  <div
                    className="bg-tribal-500 h-2 rounded-full transition-all"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <p className="text-tribal-600 text-xs mt-1.5">{skill.experience} / {maxXP} XP to next tier</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
