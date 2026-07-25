"use client";

import { useAuth } from "@/lib/auth";
import { useGame } from "@/lib/game";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const backgrounds = [
  { id: "hunter", name: "Hunter", desc: "Skilled in tracking and survival", icon: "🏹" },
  { id: "gatherer", name: "Gatherer", desc: "Adept at finding resources", icon: "🌿" },
  { id: "builder", name: "Shelter Builder", desc: "Expert in construction", icon: "🏗️" },
  { id: "herbalist", name: "Herbalist", desc: "Knowledge of plants and remedies", icon: "🍵" },
  { id: "storyteller", name: "Storyteller", desc: "Gifted in communication and lore", icon: "📖" },
];

export default function Dashboard() {
  const { user, loading: authLoading } = useAuth();
  const { character, loading: gameLoading, createCharacter } = useGame();
  const router = useRouter();
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [background, setBackground] = useState("hunter");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!authLoading && !user) router.push("/login");
  }, [user, authLoading]);

  if (authLoading || gameLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-tribal-500 text-lg">Loading...</div>
      </div>
    );
  }

  if (!user) return null;

  if (!character && !showCreate) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center animate-fade-in">
        <div className="card w-full max-w-md text-center">
          <div className="text-6xl mb-5">🏕️</div>
          <h1 className="text-3xl font-bold text-tribal-100 mb-3">Welcome to TribalMMO</h1>
          <p className="text-tribal-400 mb-8">You need a character to begin your journey in Nervella.</p>
          <button onClick={() => setShowCreate(true)} className="btn-primary text-base px-8 py-3">
            Create Character
          </button>
        </div>
      </div>
    );
  }

  if (!character && showCreate) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center animate-fade-in">
        <div className="card w-full max-w-lg">
          <div className="text-center mb-6">
            <div className="text-5xl mb-3">👤</div>
            <h1 className="text-2xl font-bold text-tribal-100">Create Your Character</h1>
            <p className="text-tribal-400 text-sm mt-1">Choose your identity in the tribe</p>
          </div>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setCreating(true);
              setError("");
              const result = await createCharacter(name, backgrounds.find((b) => b.id === background)?.name || background);
              if (result.error) {
                setError(result.error);
                setCreating(false);
              }
            }}
            className="space-y-5"
          >
            <div>
              <label className="block text-sm font-semibold text-tribal-300 mb-2">Character Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="input"
                placeholder="Enter your name..."
                required
                minLength={2}
                maxLength={24}
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-tribal-300 mb-2">Background</label>
              <div className="space-y-2">
                {backgrounds.map((bg) => (
                  <label
                    key={bg.id}
                    className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all border ${
                      background === bg.id
                        ? "bg-tribal-800 text-tribal-100 border-tribal-600/50"
                        : "bg-tribal-900/50 text-tribal-400 hover:bg-tribal-800/50 border-tribal-800/50 hover:border-tribal-700/50"
                    }`}
                  >
                    <input
                      type="radio"
                      name="background"
                      value={bg.id}
                      checked={background === bg.id}
                      onChange={(e) => setBackground(e.target.value)}
                      className="hidden"
                    />
                    <span className="text-2xl">{bg.icon}</span>
                    <div>
                      <div className="font-semibold">{bg.name}</div>
                      <div className="text-sm opacity-70">{bg.desc}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>
            {error && (
              <div className="bg-red-900/30 border border-red-700/50 rounded-lg p-3 text-red-300 text-sm">
                {error}
              </div>
            )}
            <button type="submit" className="btn-primary w-full py-3 text-base" disabled={creating}>
              {creating ? "Creating..." : "Begin Your Journey"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  const staminaPercent = character ? (character.stamina / character.max_stamina) * 100 : 0;

  return (
    <div className="space-y-6 animate-fade-in max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold text-tribal-100">Dashboard</h1>
        <p className="text-tribal-500 text-sm mt-0.5">{character?.name} &middot; {character?.background}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Character Card */}
        <div className="card hover:border-tribal-600/50 transition-colors">
          <div className="flex items-start justify-between mb-4">
            <h2 className="text-sm font-semibold text-tribal-400 uppercase tracking-wider">Character</h2>
            <a href="/character" className="text-tribal-500 hover:text-tribal-300 text-xs transition-colors">View →</a>
          </div>
          <p className="text-tribal-100 text-xl font-bold">{character?.name}</p>
          <p className="text-tribal-500 text-sm mb-4">{character?.background}</p>
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-tribal-500 text-xs">Stamina</span>
              <span className="text-tribal-300 text-xs font-medium">{character?.stamina}/{character?.max_stamina}</span>
            </div>
            <div className="w-full bg-tribal-800 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all duration-500 ${
                  staminaPercent > 50 ? "bg-green-500" :
                  staminaPercent > 25 ? "bg-yellow-500" :
                  "bg-red-500"
                }`}
                style={{ width: `${staminaPercent}%` }}
              />
            </div>
          </div>
        </div>

        {/* Stats Card */}
        <div className="card hover:border-tribal-600/50 transition-colors">
          <h2 className="text-sm font-semibold text-tribal-400 uppercase tracking-wider mb-4">Core Stats</h2>
          <div className="grid grid-cols-5 gap-2">
            {[
              { label: "STR", value: character?.strength, color: "text-red-400" },
              { label: "AGI", value: character?.agility, color: "text-green-400" },
              { label: "END", value: character?.endurance, color: "text-yellow-400" },
              { label: "FOC", value: character?.focus, color: "text-blue-400" },
              { label: "CUN", value: character?.cunning, color: "text-purple-400" },
            ].map((stat) => (
              <div key={stat.label} className="text-center bg-tribal-900/50 rounded-lg py-3">
                <div className="text-tribal-600 text-[10px] font-medium uppercase">{stat.label}</div>
                <div className={`text-xl font-bold mt-1 ${stat.color}`}>{stat.value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Faction Card */}
        <div className="card hover:border-tribal-600/50 transition-colors">
          <h2 className="text-sm font-semibold text-tribal-400 uppercase tracking-wider mb-3">Faction</h2>
          {character?.faction ? (
            <>
              <p className="text-tribal-100 text-xl font-bold">{character.faction.faction.name}</p>
              <div className="mt-2 space-y-1">
                <p className="text-tribal-400 text-sm">Role: <span className="text-tribal-200 capitalize">{character.faction.role}</span></p>
                <p className="text-tribal-400 text-sm">Philosophy: <span className="text-tribal-200">{character.faction.faction.philosophy}</span></p>
              </div>
            </>
          ) : (
            <>
              <p className="text-tribal-500 mb-4">No faction yet</p>
              <a href="/factions" className="btn-secondary text-sm inline-block">Join a Faction</a>
            </>
          )}
        </div>

        {/* Quick Links */}
        {[
          { href: "/exploration", icon: "🗺️", title: "Explore", desc: "Venture into the wilds of Nervella" },
          { href: "/combat", icon: "⚔️", title: "Combat", desc: "Fight wild creatures and rivals" },
          { href: "/actions", icon: "⚡", title: "Actions", desc: "Craft, train, and build" },
          { href: "/factions", icon: "🛡️", title: "Factions", desc: character?.faction ? "View your faction" : "Join or create a faction" },
          { href: "/settlement", icon: "🏘️", title: "Settlement", desc: "Manage your settlement" },
          { href: "/marketplace", icon: "💰", title: "Market", desc: "Trade with other players" },
        ].map((link) => (
          <a
            key={link.href}
            href={link.href}
            className="card hover:border-tribal-600/50 transition-colors group"
          >
            <div className="flex items-start gap-3">
              <span className="text-2xl mt-0.5">{link.icon}</span>
              <div>
                <h2 className="text-base font-semibold text-tribal-200 group-hover:text-tribal-100 transition-colors">{link.title}</h2>
                <p className="text-tribal-500 text-sm mt-0.5">{link.desc}</p>
              </div>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
