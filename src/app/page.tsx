"use client";

import { useAuth } from "@/lib/auth";
import { useGame } from "@/lib/game";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useState } from "react";

const backgrounds = [
  "Hunter - Skilled in tracking and survival",
  "Gatherer - Adept at finding resources",
  "Shelter Builder - Expert in construction",
  "Herbalist - Knowledge of plants and remedies",
  "Storyteller - Gifted in communication and lore",
];

export default function Dashboard() {
  const { user, loading: authLoading } = useAuth();
  const { character, loading: gameLoading, createCharacter } = useGame();
  const router = useRouter();
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [background, setBackground] = useState(backgrounds[0]);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!authLoading && !user) router.push("/auth/login");
  }, [user, authLoading]);

  if (authLoading || gameLoading) {
    return <div className="text-tribal-400 text-center mt-20">Loading...</div>;
  }

  if (!user) return null;

  if (!character && !showCreate) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="card w-full max-w-md text-center">
          <h1 className="text-2xl font-bold text-tribal-100 mb-4">Welcome to TribalMMO</h1>
          <p className="text-tribal-400 mb-6">You need a character to begin your journey.</p>
          <button onClick={() => setShowCreate(true)} className="btn-primary">
            Create Character
          </button>
        </div>
      </div>
    );
  }

  if (!character && showCreate) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="card w-full max-w-md">
          <h1 className="text-2xl font-bold text-tribal-100 mb-6">Create Your Character</h1>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setCreating(true);
              setError("");
              const result = await createCharacter(name, background);
              if (result.error) {
                setError(result.error);
                setCreating(false);
              }
            }}
            className="space-y-4"
          >
            <div>
              <label className="block text-sm text-tribal-300 mb-1">Character Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="input w-full"
                required
                minLength={2}
                maxLength={24}
              />
            </div>
            <div>
              <label className="block text-sm text-tribal-300 mb-1">Background</label>
              <div className="space-y-2">
                {backgrounds.map((bg) => (
                  <label
                    key={bg}
                    className={`block p-3 rounded cursor-pointer transition-colors ${
                      background === bg
                        ? "bg-tribal-700 text-tribal-100"
                        : "bg-tribal-800 text-tribal-400 hover:bg-tribal-700"
                    }`}
                  >
                    <input
                      type="radio"
                      name="background"
                      value={bg}
                      checked={background === bg}
                      onChange={(e) => setBackground(e.target.value)}
                      className="hidden"
                    />
                    {bg}
                  </label>
                ))}
              </div>
            </div>
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <button type="submit" className="btn-primary w-full" disabled={creating}>
              {creating ? "Creating..." : "Begin Journey"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  const staminaPercent = character ? (character.stamina / character.max_stamina) * 100 : 0;
  const totalStats = character
    ? character.strength + character.agility + character.endurance + character.focus + character.cunning
    : 0;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-tribal-100">Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="card">
          <h2 className="text-lg font-semibold text-tribal-200 mb-2">Character</h2>
          <p className="text-tribal-100 text-xl font-bold">{character?.name}</p>
          <p className="text-tribal-400 text-sm mt-1">{character?.background}</p>
          <div className="mt-3">
            <div className="text-tribal-300 text-sm">Stamina</div>
            <div className="w-full bg-tribal-800 rounded-full h-3 mt-1">
              <div
                className="bg-tribal-500 h-3 rounded-full transition-all"
                style={{ width: `${staminaPercent}%` }}
              />
            </div>
            <p className="text-tribal-400 text-xs mt-1">
              {character?.stamina} / {character?.max_stamina}
            </p>
          </div>
        </div>

        <div className="card">
          <h2 className="text-lg font-semibold text-tribal-200 mb-2">Stats</h2>
          <div className="grid grid-cols-5 gap-2 text-center">
            {[
              { label: "STR", value: character?.strength },
              { label: "AGI", value: character?.agility },
              { label: "END", value: character?.endurance },
              { label: "FOC", value: character?.focus },
              { label: "CUN", value: character?.cunning },
            ].map((stat) => (
              <div key={stat.label}>
                <div className="text-tribal-400 text-xs">{stat.label}</div>
                <div className="text-tribal-100 font-bold">{stat.value}</div>
              </div>
            ))}
          </div>
          <p className="text-tribal-400 text-xs mt-2 text-center">Total: {totalStats}</p>
        </div>

        <div className="card">
          <h2 className="text-lg font-semibold text-tribal-200 mb-2">Faction</h2>
          {character?.faction ? (
            <>
              <p className="text-tribal-100 font-bold">{character.faction.faction.name}</p>
              <p className="text-tribal-400 text-sm mt-1">Role: {character.faction.role}</p>
            </>
          ) : (
            <p className="text-tribal-400">No faction</p>
          )}
        </div>

        <a href="/exploration" className="card hover:bg-tribal-800 transition-colors">
          <h2 className="text-lg font-semibold text-tribal-200 mb-2">Explore</h2>
          <p className="text-tribal-400">Venture into the wilds of Nervella</p>
        </a>

        <a href="/actions" className="card hover:bg-tribal-800 transition-colors">
          <h2 className="text-lg font-semibold text-tribal-200 mb-2">Actions</h2>
          <p className="text-tribal-400">Craft, train, and build</p>
        </a>

        <a href="/factions" className="card hover:bg-tribal-800 transition-colors">
          <h2 className="text-lg font-semibold text-tribal-200 mb-2">Factions</h2>
          <p className="text-tribal-400">
            {character?.faction ? "View your faction" : "Join or create a faction"}
          </p>
        </a>
      </div>
    </div>
  );
}
