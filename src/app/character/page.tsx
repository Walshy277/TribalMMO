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
    return <div className="text-tribal-400 text-center mt-20">Loading...</div>;
  }

  if (!character) {
    return (
      <div className="text-tribal-400 text-center mt-20">
        <p>No character found.</p>
        <a href="/" className="btn-primary mt-4 inline-block">Go to Dashboard</a>
      </div>
    );
  }

  const skills = character.skills || [];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-tribal-100">{character.name}</h1>
      <p className="text-tribal-400">{character.background}</p>

      <div className="card">
        <h2 className="text-lg font-semibold text-tribal-200 mb-4">Core Stats</h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[
            { label: "Strength", value: character.strength },
            { label: "Agility", value: character.agility },
            { label: "Endurance", value: character.endurance },
            { label: "Focus", value: character.focus },
            { label: "Cunning", value: character.cunning },
          ].map((stat) => (
            <div key={stat.label} className="text-center bg-tribal-800 p-3 rounded">
              <div className="text-tribal-300 text-sm">{stat.label}</div>
              <div className="text-2xl font-bold text-tribal-100">{stat.value}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <h2 className="text-lg font-semibold text-tribal-200 mb-4">Stamina</h2>
        <div className="w-full bg-tribal-800 rounded-full h-4">
          <div
            className="bg-tribal-500 h-4 rounded-full transition-all"
            style={{ width: `${(character.stamina / character.max_stamina) * 100}%` }}
          />
        </div>
        <p className="text-tribal-400 text-sm mt-2">
          {character.stamina} / {character.max_stamina}
        </p>
      </div>

      <div className="card">
        <h2 className="text-lg font-semibold text-tribal-200 mb-4">Skills</h2>
        <div className="space-y-3">
          {skills.map((skill: any) => (
            <div key={skill.id} className="bg-tribal-800 p-3 rounded">
              <div className="flex items-center justify-between">
                <span className="text-tribal-200 font-semibold">{skill.name}</span>
                <span className="text-tribal-400 text-sm">Tier {skill.tier}</span>
              </div>
              <div className="w-full bg-tribal-700 rounded-full h-2 mt-2">
                <div
                  className="bg-tribal-500 h-2 rounded-full"
                  style={{ width: `${Math.min(100, (skill.experience / (skill.tier * 100)) * 100)}%` }}
                />
              </div>
              <p className="text-tribal-500 text-xs mt-1">{skill.experience} XP</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
