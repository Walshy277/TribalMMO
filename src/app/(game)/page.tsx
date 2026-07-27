"use client";

import { useAuth } from "@/lib/auth";
import { useGame } from "@/lib/game";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { LoadingSkeleton } from "@/components/ui/LoadingSkeleton";
import { Flame, User, Sword, Leaf, Hammer, Wheat, BookOpen } from "lucide-react";

const backgrounds = [
  { id: "hunter", name: "Hunter", desc: "Skilled in tracking and survival", icon: Sword },
  { id: "gatherer", name: "Gatherer", desc: "Adept at finding resources", icon: Leaf },
  { id: "builder", name: "Shelter Builder", desc: "Expert in construction", icon: Hammer },
  { id: "herbalist", name: "Herbalist", desc: "Knowledge of plants and remedies", icon: Wheat },
  { id: "storyteller", name: "Storyteller", desc: "Gifted in communication and lore", icon: BookOpen },
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
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!authLoading && !gameLoading && character) {
      router.push("/character");
    }
  }, [character, authLoading, gameLoading, router]);

  if (authLoading || gameLoading) {
    return <LoadingSkeleton />;
  }

  if (!user) return null;

  if (character) return null;

  if (!showCreate) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center animate-fade-in">
        <div className="card w-full max-w-md text-center">
          <div className="w-16 h-16 mx-auto rounded-sm bg-[#c04e20] flex items-center justify-center mb-5">
            <Flame size={32} className="text-[#f5f0ea]" />
          </div>
          <h1 className="text-3xl font-bold text-tribal-100 mb-3" style={{ fontFamily: "Crimson Pro, Georgia, serif" }}>Welcome to TribalMMO</h1>
          <p className="text-tribal-500 mb-8">You need a character to begin your journey in Nervella.</p>
          <Button variant="primary" size="lg" onClick={() => setShowCreate(true)} icon={<User size={18} />}>
            Create Character
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[60vh] flex items-center justify-center animate-fade-in">
      <div className="card w-full max-w-lg">
        <div className="text-center mb-6">
          <div className="w-14 h-14 mx-auto rounded-sm bg-[#c04e20] flex items-center justify-center mb-3">
            <User size={28} className="text-[#f5f0ea]" />
          </div>
          <h1 className="text-2xl font-bold text-tribal-100" style={{ fontFamily: "Crimson Pro, Georgia, serif" }}>Create Your Character</h1>
          <p className="text-tribal-500 text-sm mt-1">Choose your identity in the tribe</p>
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
            <label className="block text-xs font-bold text-tribal-300 mb-2 uppercase tracking-wider">Character Name</label>
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
            <label className="block text-xs font-bold text-tribal-300 mb-2 uppercase tracking-wider">Background</label>
            <div className="space-y-2">
              {backgrounds.map((bg) => {
                const Icon = bg.icon;
                return (
                  <label
                    key={bg.id}
                    className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all border ${
                      background === bg.id
                        ? "bg-tribal-800/60 text-tribal-100 border-tribal-600/40"
                        : "bg-tribal-900/30 text-tribal-400 hover:bg-tribal-800/30 border-tribal-800/30 hover:border-tribal-700/30"
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
                    <Icon size={22} className="shrink-0" />
                    <div>
                      <div className="font-semibold">{bg.name}</div>
                      <div className="text-sm opacity-70">{bg.desc}</div>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
          {error && (
            <div className="bg-[#2a1414]/40 border border-[#6e2424]/40 rounded-lg p-3 text-[#d05050] text-sm">
              {error}
            </div>
          )}
          <Button type="submit" variant="primary" size="lg" className="w-full" loading={creating}>
            Begin Your Journey
          </Button>
        </form>
      </div>
    </div>
  );
}
