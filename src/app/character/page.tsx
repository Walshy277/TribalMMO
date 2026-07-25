"use client";

import { useGame } from "@/lib/game";
import { useAuth } from "@/lib/auth";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function CharacterPage() {
  const { user, loading: authLoading } = useAuth();
  const { character, loading: gameLoading } = useGame();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && !user) router.push("/auth/login");
  }, [user, authLoading]);

  if (authLoading || gameLoading) {
    return <div className="min-h-[60vh] flex items-center justify-center text-tribal-400 animate-pulse">Loading...</div>;
  }

  if (!character) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <div className="text-5xl mb-3">👤</div>
          <p className="text-tribal-400 mb-4">No character found.</p>
          <a href="/" className="btn-primary inline-block py-2 px-6">Go to Dashboard</a>
        </div>
      </div>
    );
  }

  const skills = character.skills || [];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <span className="text-3xl">👤</span>
        <div>
          <h1 className="text-2xl font-bold text-tribal-100">{character.name}</h1>
          <p className="text-tribal-500 text-sm">{character.background}</p>
        </div>
      </div>

      {/* Core Stats */}
      <div className="card border-tribal-600/30">
        <h2 className="text-lg font-semibold text-tribal-200 mb-4">Core Stats</h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: "Strength", value: character.strength, icon: "💪", color: "text-red-400", bg: "from-red-900/20" },
            { label: "Agility", value: character.agility, icon: "🏃", color: "text-green-400", bg: "from-green-900/20" },
            { label: "Endurance", value: character.endurance, icon: "🛡️", color: "text-yellow-400", bg: "from-yellow-900/20" },
            { label: "Focus", value: character.focus, icon: "🎯", color: "text-blue-400", bg: "from-blue-900/20" },
            { label: "Cunning", value: character.cunning, icon: "🦊", color: "text-purple-400", bg: "from-purple-900/20" },
          ].map((stat) => (
            <div key={stat.label} className={`text-center bg-gradient-to-b ${stat.bg} to-tribal-800/50 p-4 rounded-lg border border-tribal-700/20`}>
              <div className="text-2xl mb-1">{stat.icon}</div>
              <div className="text-tribal-500 text-xs">{stat.label}</div>
              <div className={`text-3xl font-bold ${stat.color} mt-1`}>{stat.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Stamina */}
      <div className="card border-tribal-600/30">
        <h2 className="text-lg font-semibold text-tribal-200 mb-3">Stamina</h2>
        <div className="flex items-center justify-between mb-2">
          <span className="text-tribal-400 text-sm">Energy</span>
          <span className="text-tribal-100 font-bold">{character.stamina} / {character.max_stamina}</span>
        </div>
        <div className="w-full bg-tribal-800 rounded-full h-4">
          <div
            className="bg-gradient-to-r from-green-600 to-green-400 h-4 rounded-full transition-all duration-500"
            style={{ width: `${(character.stamina / character.max_stamina) * 100}%` }}
          />
        </div>
      </div>

      {/* Skills */}
      <div className="card border-tribal-600/30">
        <h2 className="text-lg font-semibold text-tribal-200 mb-4">Skills</h2>
        <div className="space-y-3">
          {skills.map((skill: any) => {
            const maxXP = skill.tier * 100;
            const progress = Math.min(100, (skill.experience / maxXP) * 100);
            const skillIcons: Record<string, string> = {
              Gathering: "🪓", Crafting: "🔨", Combat: "⚔️", Survival: "🏕️", Diplomacy: "🤝",
            };
            return (
              <div key={skill.id} className="bg-tribal-800/50 p-4 rounded-lg border border-tribal-700/20">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{skillIcons[skill.name] || "📚"}</span>
                    <span className="text-tribal-200 font-semibold">{skill.name}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="bg-tribal-800 px-3 py-1 rounded-full text-tribal-300 text-sm">Tier {skill.tier}</span>
                    <span className="text-tribal-100 font-bold">{skill.experience} XP</span>
                  </div>
                </div>
                <div className="w-full bg-tribal-700/50 rounded-full h-2">
                  <div
                    className="bg-gradient-to-r from-tribal-600 to-tribal-400 h-2 rounded-full transition-all"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <p className="text-tribal-600 text-xs mt-1">{skill.experience} / {maxXP} XP to next tier</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
