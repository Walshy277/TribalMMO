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
    if (!authLoading && !user) router.push("/auth/login");
  }, [user, authLoading]);

  if (authLoading || gameLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-tribal-400 text-lg animate-pulse">Loading...</div>
      </div>
    );
  }

  if (!user) return null;

  if (!character && !showCreate) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center animate-fade-in">
        <div className="card w-full max-w-md text-center border-tribal-600/30">
          <div className="text-6xl mb-4">🏕️</div>
          <h1 className="text-3xl font-bold text-tribal-100 mb-2">Welcome to TribalMMO</h1>
          <p className="text-tribal-400 mb-6">You need a character to begin your journey in Nervella.</p>
          <button onClick={() => setShowCreate(true)} className="btn-primary text-lg px-8 py-3">
            Create Character
          </button>
        </div>
      </div>
    );
  }

  if (!character && showCreate) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center animate-fade-in">
        <div className="card w-full max-w-lg border-tribal-600/30">
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
              <label className="block text-sm font-medium text-tribal-300 mb-2">Character Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="input w-full"
                placeholder="Enter your name..."
                required
                minLength={2}
                maxLength={24}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-tribal-300 mb-2">Background</label>
              <div className="space-y-2">
                {backgrounds.map((bg) => (
                  <label
                    key={bg.id}
                    className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all ${
                      background === bg.id
                        ? "bg-tribal-700/80 text-tribal-100 border border-tribal-500/50 shadow-lg shadow-tribal-900/50"
                        : "bg-tribal-800/60 text-tribal-400 hover:bg-tribal-700/50 border border-transparent"
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
                      <div className="text-sm opacity-75">{bg.desc}</div>
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
            <button type="submit" className="btn-primary w-full py-3 text-lg" disabled={creating}>
              {creating ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="animate-spin">⏳</span> Creating...
                </span>
              ) : (
                "Begin Your Journey"
              )}
            </button>
          </form>
        </div>
      </div>
    );
  }

  const staminaPercent = character ? (character.stamina / character.max_stamina) * 100 : 0;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold text-tribal-100">Dashboard</h1>
        <span className="text-tribal-500 text-sm">•</span>
        <span className="text-tribal-400 text-sm">{character?.name}</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Character Card */}
        <div className="card border-tribal-600/30 hover:border-tribal-500/40 transition-all">
          <div className="flex items-start justify-between mb-3">
            <div>
              <h2 className="text-lg font-semibold text-tribal-200">Character</h2>
              <p className="text-tribal-100 text-xl font-bold mt-1">{character?.name}</p>
              <p className="text-tribal-500 text-sm">{character?.background}</p>
            </div>
            <a href="/character" className="text-tribal-400 hover:text-tribal-200 text-sm transition-colors">
              View →
            </a>
          </div>
          <div className="mt-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-tribal-400 text-xs">Stamina</span>
              <span className="text-tribal-300 text-xs">{character?.stamina}/{character?.max_stamina}</span>
            </div>
            <div className="w-full bg-tribal-800/80 rounded-full h-2.5">
              <div
                className={`h-2.5 rounded-full transition-all duration-500 ${
                  staminaPercent > 50 ? "bg-gradient-to-r from-green-600 to-green-400" :
                  staminaPercent > 25 ? "bg-gradient-to-r from-yellow-600 to-yellow-400" :
                  "bg-gradient-to-r from-red-600 to-red-400"
                }`}
                style={{ width: `${staminaPercent}%` }}
              />
            </div>
          </div>
        </div>

        {/* Stats Card */}
        <div className="card border-tribal-600/30 hover:border-tribal-500/40 transition-all">
          <h2 className="text-lg font-semibold text-tribal-200 mb-3">Core Stats</h2>
          <div className="grid grid-cols-5 gap-2">
            {[
              { label: "STR", value: character?.strength, color: "text-red-400" },
              { label: "AGI", value: character?.agility, color: "text-green-400" },
              { label: "END", value: character?.endurance, color: "text-yellow-400" },
              { label: "FOC", value: character?.focus, color: "text-blue-400" },
              { label: "CUN", value: character?.cunning, color: "text-purple-400" },
            ].map((stat) => (
              <div key={stat.label} className="text-center bg-tribal-800/50 rounded-lg p-2">
                <div className="text-tribal-500 text-xs mb-1">{stat.label}</div>
                <div className={`text-xl font-bold ${stat.color}`}>{stat.value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Faction Card */}
        <div className="card border-tribal-600/30 hover:border-tribal-500/40 transition-all">
          <h2 className="text-lg font-semibold text-tribal-200 mb-2">Faction</h2>
          {character?.faction ? (
            <>
              <p className="text-tribal-100 text-xl font-bold">{character.faction.faction.name}</p>
              <p className="text-tribal-400 text-sm mt-1">
                Role: <span className="text-tribal-300 capitalize">{character.faction.role}</span>
              </p>
              <p className="text-tribal-400 text-sm">
                Philosophy: <span className="text-tribal-300">{character.faction.faction.philosophy}</span>
              </p>
            </>
          ) : (
            <>
              <p className="text-tribal-500 mb-3">No faction yet</p>
              <a href="/factions" className="btn-secondary text-sm inline-block">Join a Faction</a>
            </>
          )}
        </div>

        {/* Quick Links */}
        {[
          { href: "/exploration", icon: "🗺️", title: "Explore", desc: "Venture into the wilds of Nervella", color: "hover:border-green-500/40" },
          { href: "/combat", icon: "⚔️", title: "Combat", desc: "Fight wild creatures and rivals", color: "hover:border-red-500/40" },
          { href: "/actions", icon: "⚡", title: "Actions", desc: "Craft, train, and build", color: "hover:border-yellow-500/40" },
          { href: "/factions", icon: "🛡️", title: "Factions", desc: character?.faction ? "View your faction" : "Join or create a faction", color: "hover:border-blue-500/40" },
          { href: "/settlement", icon: "🏘️", title: "Settlement", desc: "Manage your settlement", color: "hover:border-orange-500/40" },
          { href: "/marketplace", icon: "💰", title: "Market", desc: "Trade with other players", color: "hover:border-purple-500/40" },
        ].map((link) => (
          <a
            key={link.href}
            href={link.href}
            className={`card border-tribal-600/30 ${link.color} transition-all group`}
          >
            <div className="flex items-start gap-3">
              <span className="text-3xl group-hover:scale-110 transition-transform">{link.icon}</span>
              <div>
                <h2 className="text-lg font-semibold text-tribal-200 group-hover:text-tribal-100 transition-colors">{link.title}</h2>
                <p className="text-tribal-400 text-sm">{link.desc}</p>
              </div>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
