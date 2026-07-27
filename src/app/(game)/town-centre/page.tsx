"use client";

import { useGame } from "@/lib/game";
import { supabase } from "@/lib/supabase/client";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { StaminaBar } from "@/components/ui/StaminaBar";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Alert } from "@/components/ui/Alert";
import {
  Store,
  Bed,
  Heart,
  AlertTriangle,
  Shield,
  Coins,
  TreePine,
  Hammer,
  Swords,
  Users,
} from "lucide-react";

const npcs = [
  {
    name: "Elder Rowan",
    role: "Village Leader",
    desc: "The wise elder who guides the tribe. He assigns daily tasks and keeps the peace.",
    icon: Users,
    color: "#c9a84c",
  },
  {
    name: "Forger Thane",
    role: "Blacksmith",
    desc: "A burly smith who can repair your gear and teach you the ways of metalwork.",
    icon: Hammer,
    color: "#b83a3a",
  },
  {
    name: "Scout Mira",
    role: "Guide",
    desc: "She knows every trail and creature in Nervella. Speak to her before heading out.",
    icon: TreePine,
    color: "#4a9e6a",
  },
  {
    name: "Captain Draven",
    role: "Guard Captain",
    desc: "Leads the village defence. He runs the training grounds and organises patrols.",
    icon: Swords,
    color: "#b83a3a",
  },
];

export default function TownCentrePage() {
  const { character, refreshCharacter } = useGame();
  const [resting, setResting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    document.title = "Town Centre — TribalMMO";
  }, []);

  if (!character) {
    return <div className="text-tribal-500 text-center mt-20">Create a character first.</div>;
  }

  const rest = async () => {
    if (resting) return;
    setResting(true);
    setError("");
    setSuccess("");

    const amount = Math.min(20, character.max_stamina - character.computed_stamina);
    if (amount <= 0) {
      setError("Your stamina is already full.");
      setResting(false);
      return;
    }

    const { error: rpcError } = await supabase.rpc("rest_character", {
      p_character_id: character.id,
      p_amount: amount,
    });

    if (rpcError) {
      setError(rpcError.message);
    } else {
      setSuccess(`Rested at the inn. Recovered ${amount} stamina.`);
      await refreshCharacter();
    }
    setResting(false);
  };

  return (
    <div className="space-y-5 animate-fade-in max-w-3xl">
      <SectionHeader
        title="Town Centre"
        subtitle="The beating heart of Nervella — rest, gather, and prepare"
      />

      <div className="card">
        <StaminaBar current={character.computed_stamina} max={character.max_stamina} size="md" />
      </div>

      {error && (
        <Alert variant="error" onDismiss={() => setError("")} icon={<AlertTriangle size={14} />}>
          {error}
        </Alert>
      )}

      {success && (
        <div className="card animate-fade-in" style={{ background: "rgba(18,42,27,0.3)", borderColor: "rgba(45,110,68,0.2)" }}>
          <div className="flex items-center gap-2">
            <Heart size={14} className="text-[#4a9e6a]" />
            <span className="text-[#6bc98a] text-sm font-semibold">{success}</span>
          </div>
          <button onClick={() => setSuccess("")} className="text-tribal-600 hover:text-tribal-400 text-xs mt-1">
            dismiss
          </button>
        </div>
      )}

      <div className="card">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: "rgba(106,144,168,0.12)" }}>
            <Bed size={20} className="text-[#6a90a8]" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-tribal-200" style={{ fontFamily: "Crimson Pro, Georgia, serif" }}>The Resting Hearth</h2>
            <p className="text-tribal-500 text-xs">Rest by the fire to recover stamina</p>
          </div>
        </div>
        <Button
          variant="primary"
          size="lg"
          className="w-full"
          icon={<Bed size={18} />}
          onClick={rest}
          disabled={resting || character.computed_stamina >= character.max_stamina}
          loading={resting}
        >
          {character.computed_stamina >= character.max_stamina
            ? "Stamina Full"
            : `Rest (${Math.min(20, character.max_stamina - character.computed_stamina)} stamina)`}
        </Button>
      </div>

      <div className="card">
        <h2 className="text-sm font-bold text-tribal-300 mb-3" style={{ fontFamily: "Crimson Pro, Georgia, serif" }}>
          Village NPCs
        </h2>
        <div className="space-y-2">
          {npcs.map((npc) => {
            const Icon = npc.icon;
            return (
              <div
                key={npc.name}
                className="flex items-center gap-3 px-3 py-3 rounded-lg bg-tribal-900/30 border border-tribal-800/20"
              >
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: npc.color + "12" }}
                >
                  <Icon size={18} style={{ color: npc.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-tribal-200 text-sm font-semibold">{npc.name}</span>
                    <span className="text-tribal-600 text-[10px] font-bold bg-tribal-900/60 px-1.5 py-0.5 rounded border border-tribal-800/20">
                      {npc.role}
                    </span>
                  </div>
                  <p className="text-tribal-500 text-xs mt-0.5">{npc.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="card">
        <h2 className="text-sm font-bold text-tribal-300 mb-3" style={{ fontFamily: "Crimson Pro, Georgia, serif" }}>
          Quick Links
        </h2>
        <div className="grid grid-cols-2 gap-2">
          {[
            { href: "/shops", label: "Shops", icon: Store, color: "#c9a84c" },
            { href: "/shrine", label: "Shrine", icon: Shield, color: "#8a6aaa" },
            { href: "/gathering", label: "Gather", icon: TreePine, color: "#4a9e6a" },
            { href: "/combat", label: "Combat", icon: Swords, color: "#b83a3a" },
          ].map((link) => {
            const Icon = link.icon;
            return (
              <a
                key={link.href}
                href={link.href}
                className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-tribal-900/30 border border-tribal-800/20 hover:bg-tribal-800/40 transition-colors"
              >
                <Icon size={16} style={{ color: link.color }} />
                <span className="text-tribal-300 text-sm font-medium">{link.label}</span>
              </a>
            );
          })}
        </div>
      </div>
    </div>
  );
}
