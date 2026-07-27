"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { useGame } from "@/lib/game";
import { Button } from "@/components/ui/Button";
import {
  Flame,
  TreePine,
  Mountain,
  Sword,
  Hammer,
  Sparkles,
  Map,
  Users,
  ArrowRight,
  Swords,
  Heart,
  Zap,
  Shield,
  MessageCircle,
  TrendingUp,
  Crown,
  Landmark,
  Handshake,
} from "lucide-react";

const socialFeatures = [
  {
    icon: Users,
    title: "Clans",
    desc: "Found a clan with friends. Set your own rules, choose a philosophy, and build a name that other players will remember.",
    color: "#8a6aaa",
  },
  {
    icon: Landmark,
    title: "Settlements",
    desc: "Build and upgrade a shared home base together. Longhouses, workshops, watchtowers — every building benefits the whole clan.",
    color: "#6a90a8",
  },
  {
    icon: Shield,
    title: "Territory",
    desc: "Claim hex tiles on the world map. Forests, plains, mountains — control land and gain resource advantages over rivals.",
    color: "#b83a3a",
  },
  {
    icon: Handshake,
    title: "Diplomacy",
    desc: "Form alliances, declare wars, negotiate trade deals, and share territory. The political landscape is shaped entirely by players.",
    color: "#c9a84c",
  },
  {
    icon: TrendingUp,
    title: "Player Economy",
    desc: "A living marketplace where every item is player-crafted. Set your own prices, supply demand, and grow rich through trade.",
    color: "#4a9e6a",
  },
  {
    icon: MessageCircle,
    title: "Community",
    desc: "Faction chat, world announcements, settlement boards. The social layer runs through everything you do.",
    color: "#c04e20",
  },
];

const skills = [
  { icon: TreePine, label: "Gathering", color: "#4a9e6a" },
  { icon: Hammer, label: "Crafting", color: "#6a90a8" },
  { icon: Swords, label: "Combat", color: "#b83a3a" },
  { icon: Map, label: "Exploration", color: "#c9a84c" },
  { icon: Sparkles, label: "Survival", color: "#8a6aaa" },
];

export default function LandingPage() {
  const { user, loading: authLoading } = useAuth();
  const { character, loading: gameLoading } = useGame();

  return (
    <div className="min-h-screen">
      {/* Nav */}
      <nav className="fixed top-0 w-full z-50 bg-[rgba(14,12,16,0.85)] border-b border-[rgba(38,35,40,0.3)] backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-gradient-to-br from-[#c04e20] to-[#a8441c] flex items-center justify-center rounded-md">
              <Flame size={17} className="text-[#f5f0ea]" />
            </div>
            <span className="text-base font-bold text-[#e6ddd2] tracking-wide uppercase" style={{ fontFamily: "Crimson Pro, Georgia, serif" }}>
              Tribal<span className="text-[#c04e20]">MMO</span>
            </span>
          </div>
          <div className="flex items-center gap-3">
            {!authLoading && !gameLoading && user && character ? (
              <Link href="/character">
                <Button variant="primary" size="sm">
                  Play
                </Button>
              </Link>
            ) : !authLoading && user ? (
              <Link href="/play">
                <Button variant="primary" size="sm">
                  Play
                </Button>
              </Link>
            ) : (
              <Link href="/play">
                <Button variant="primary" size="sm">
                  Play Now
                </Button>
              </Link>
            )}
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative pt-32 pb-20 px-6 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-[rgba(192,78,32,0.04)] to-transparent pointer-events-none" />
        <div className="max-w-4xl mx-auto text-center relative">
          <div className="w-20 h-20 mx-auto rounded-lg bg-gradient-to-br from-[#c04e20] to-[#a8441c] flex items-center justify-center mb-8 shadow-[0_4px_24px_rgba(192,78,32,0.3)]">
            <Flame size={40} className="text-[#f5f0ea]" />
          </div>
          <h1 className="text-5xl md:text-6xl font-bold text-[#e6ddd2] mb-6" style={{ fontFamily: "Crimson Pro, Georgia, serif" }}>
            The Social RPG<br />That Lives in Your Browser
          </h1>
          <p className="text-xl text-[#b39b7c] mb-4 max-w-2xl mx-auto leading-relaxed">
            No download. No install. Just create a character, join a clan, and step into a world shaped by the people who play it.
          </p>
          <div className="inline-flex items-center gap-2 bg-[rgba(201,168,76,0.08)] border border-[rgba(201,168,76,0.15)] rounded-full px-4 py-1.5 mb-10">
            <div className="w-2 h-2 rounded-full bg-[#c9a84c] animate-pulse" />
            <span className="text-[#c9a84c] text-sm font-medium">Free to play — browser-based</span>
          </div>
          <div className="flex items-center justify-center gap-4">
            <Link href="/play">
              <Button variant="primary" size="lg" icon={<ArrowRight size={18} />}>
                Start Playing
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 px-6 border-t border-[rgba(38,35,40,0.2)]">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl font-bold text-[#e6ddd2] text-center mb-12" style={{ fontFamily: "Crimson Pro, Georgia, serif" }}>
            How It Works
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                step: "1",
                title: "Create Your Character",
                desc: "Choose a name and background. Your journey starts in the Village Clearing — a small settlement surrounded by wilderness.",
              },
              {
                step: "2",
                title: "Join a Faction",
                desc: "Find like-minded players, pool resources, and build a settlement together. Every clan has its own culture and goals.",
              },
              {
                step: "3",
                title: "Shape the World",
                desc: "Claim territory, trade with other clans, form alliances, and leave your mark on the world of Nervella.",
              },
            ].map((item) => (
              <div key={item.step} className="text-center">
                <div className="w-12 h-12 mx-auto rounded-full bg-[rgba(192,78,32,0.1)] border border-[rgba(192,78,32,0.2)] flex items-center justify-center mb-4">
                  <span className="text-[#c04e20] font-bold text-lg" style={{ fontFamily: "Crimson Pro, Georgia, serif" }}>{item.step}</span>
                </div>
                <h3 className="text-[#e6ddd2] font-semibold mb-2">{item.title}</h3>
                <p className="text-[#8a7a6a] text-sm leading-relaxed max-w-xs mx-auto">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Social Features */}
      <section className="py-20 px-6 border-t border-[rgba(38,35,40,0.2)]">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl font-bold text-[#e6ddd2] text-center mb-3" style={{ fontFamily: "Crimson Pro, Georgia, serif" }}>
            Built for Community
          </h2>
          <p className="text-[#8a7a6a] text-center mb-12 max-w-xl mx-auto">
            The best part of TribalMMO isn&apos;t the skills or the loot — it&apos;s the people.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {socialFeatures.map((f) => {
              const Icon = f.icon;
              return (
                <div
                  key={f.title}
                  className="p-5 rounded-xl bg-[rgba(26,24,30,0.5)] border border-[rgba(38,35,40,0.3)] hover:border-[rgba(38,35,40,0.5)] transition-all"
                >
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center mb-3"
                    style={{ background: f.color + "12" }}
                  >
                    <Icon size={20} style={{ color: f.color }} />
                  </div>
                  <h3 className="text-[#e6ddd2] font-semibold mb-1">{f.title}</h3>
                  <p className="text-[#8a7a6a] text-sm leading-relaxed">{f.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Skills */}
      <section className="py-16 px-6 border-t border-[rgba(38,35,40,0.2)]">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-[#e6ddd2] text-center mb-3" style={{ fontFamily: "Crimson Pro, Georgia, serif" }}>
            Skills & Progression
          </h2>
          <p className="text-[#8a7a6a] text-center mb-10 max-w-lg mx-auto">
            Train five core skills, specialise at higher tiers, and contribute to your clan&apos;s success.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            {skills.map((s) => {
              const Icon = s.icon;
              return (
                <div
                  key={s.label}
                  className="flex items-center gap-3 bg-[rgba(26,24,30,0.5)] border border-[rgba(38,35,40,0.3)] rounded-xl px-5 py-3"
                >
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center"
                    style={{ background: s.color + "12" }}
                  >
                    <Icon size={18} style={{ color: s.color }} />
                  </div>
                  <span className="text-[#b39b7c] text-sm font-medium">{s.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* About */}
      <section className="py-20 px-6 border-t border-[rgba(38,35,40,0.2)]">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-[#e6ddd2] text-center mb-8" style={{ fontFamily: "Crimson Pro, Georgia, serif" }}>
            About the World
          </h2>
          <div className="space-y-4 text-[#b39b7c] leading-relaxed">
            <p>
              Nervella is a persistent fantasy continent of forests, plains, mountains, and ancient ruins.
              You arrive as a settler in a small village clearing — no special status, no hand-holding.
              Everything you build, trade, and conquer is earned through your actions and the people you align with.
            </p>
            <p>
              The world is divided into zones, each with its own resources, enemies, and challenges.
              Start in the <strong className="text-[#c9a84c]">Village Clearing</strong>,
              venture into the <strong className="text-[#c9a84c]">Whispering Woods</strong>,
              climb the <strong className="text-[#c9a84c]">Jagged Peaks</strong>,
              and eventually face the terrors of the <strong className="text-[#c9a84c]">Dragon&apos;s Maw</strong>.
            </p>
            <p>
              Every action costs stamina, which regenerates over time. But the real progression
              isn&apos;t just your stats — it&apos;s the reputation you build, the alliances you form,
              and the legacy your clan leaves on the world.
            </p>
          </div>
        </div>
      </section>

      {/* Beta Notice */}
      <section className="py-16 px-6 border-t border-[rgba(38,35,40,0.2)]">
        <div className="max-w-2xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-[rgba(201,168,76,0.06)] border border-[rgba(201,168,76,0.12)] rounded-xl px-6 py-4 mb-6">
            <Zap size={18} className="text-[#c9a84c]" />
            <span className="text-[#c9a84c] font-semibold text-sm">Currently in Beta</span>
          </div>
          <p className="text-[#8a7a6a] leading-relaxed mb-4">
            TribalMMO is actively being developed and updated regularly. New features, skills, zones,
            and balance changes are added frequently. Your feedback shapes the game — report bugs,
            suggest features, and help build the world with us.
          </p>
          <p className="text-[#6a5a4a] text-sm">
            Being a beta, progress may occasionally be reset as we rebalance the game.
            We&apos;ll always announce resets in advance.
          </p>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-6 border-t border-[rgba(38,35,40,0.2)]">
        <div className="max-w-xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-[#e6ddd2] mb-4" style={{ fontFamily: "Crimson Pro, Georgia, serif" }}>
            Ready to Begin?
          </h2>
          <p className="text-[#8a7a6a] mb-8">
            Create your character, choose your background, and step into Nervella.
            Your clan is waiting.
          </p>
          <Link href="/play">
            <Button variant="primary" size="lg" icon={<ArrowRight size={18} />}>
              Start Your Journey
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-6 border-t border-[rgba(38,35,40,0.2)]">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Flame size={14} className="text-[#c04e20]" />
            <span className="text-[#6a5a4a] text-sm" style={{ fontFamily: "Crimson Pro, Georgia, serif" }}>TribalMMO</span>
          </div>
          <span className="text-[#4a3a2a] text-xs">Beta v0.1</span>
        </div>
      </footer>
    </div>
  );
}
