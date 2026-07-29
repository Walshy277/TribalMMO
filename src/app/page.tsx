import { Link } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { useGame } from "@/lib/game";
import { Button } from "@/components/ui/Button";
import { Header } from "@/components/layout/Header";
import { Navigation } from "@/components/layout/Navigation";
import CharacterPage from "@/app/(game)/character/page";
import {
  Flame,
  TreePine,
  Mountain,
  Hammer,
  Users,
  ArrowRight,
  Swords,
  TrendingUp,
  Landmark,
  Handshake,
  Package,
} from "lucide-react";

const socialFeatures = [
  {
    icon: Users,
    title: "Clans",
    desc: "Found a clan with friends. Set your own rules, choose a philosophy, and build a name that other players will remember.",
    color: "#3b82f6",
  },
  {
    icon: Landmark,
    title: "Settlements",
    desc: "Build and upgrade a shared home base together. Longhouses, workshops, watchtowers — every building benefits the whole clan.",
    color: "#60a5fa",
  },
  {
    icon: Handshake,
    title: "Exploration",
    desc: "Venture into unknown territories. Discover hidden treasures, encounter wild creatures, and uncover the mysteries of the world.",
    color: "#2563eb",
  },
  {
    icon: TrendingUp,
    title: "Player Economy",
    desc: "A living marketplace where every item is player-crafted. Set your own prices, supply demand, and grow rich through trade.",
    color: "#3b82f6",
  },
];

const skills = [
  { icon: Package, label: "Gathering", color: "#3b82f6" },
  { icon: Hammer, label: "Crafting", color: "#60a5fa" },
  { icon: Swords, label: "Combat", color: "#d45a28" },
  { icon: TreePine, label: "Woodcutting", color: "#2563eb" },
  { icon: Mountain, label: "Mining", color: "#a09a88" },
];

const coreStats = [
  { label: "Strength", desc: "Physical power — infinitely scaling", color: "#d45a28" },
  { label: "Defence", desc: "Resilience against attacks", color: "#60a5fa" },
  { label: "Speed", desc: "Agility and evasion", color: "#3b82f6" },
  { label: "Vitality", desc: "Health and endurance", color: "#2563eb" },
];

export default function LandingPage() {
  const { user, loading: authLoading } = useAuth();
  const { character, loading: gameLoading } = useGame();

  if (!authLoading && !gameLoading && user && character) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <div className="flex flex-1 overflow-hidden">
          <Navigation />
          <main className="flex-1 p-4 md:p-6 overflow-y-auto">
            <CharacterPage />
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <nav className="fixed top-0 w-full z-50 bg-[rgba(18,18,18,0.85)] border-b border-[rgba(59,130,246,0.08)] backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-slate-400 flex items-center justify-center rounded-sm shadow-[0_0_12px_rgba(59,130,246,0.2)]">
              <Flame size={17} className="text-[#0f172a]" />
            </div>
            <span className="text-base font-bold text-slate-200 tracking-wide font-heading">
              Tribal<span className="text-slate-400">MMO</span>
            </span>
          </div>
          <div className="flex items-center gap-3">
            {!authLoading && user ? (
              <Link to="/profile">
                <Button variant="primary" size="sm">
                  Play
                </Button>
              </Link>
            ) : (
              <Link to="/login">
                <Button variant="primary" size="sm">
                  Play Now
                </Button>
              </Link>
            )}
          </div>
        </div>
      </nav>

      <section className="relative pt-32 pb-20 px-6 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-[rgba(59,130,246,0.03)] to-transparent pointer-events-none" />
        <div className="max-w-4xl mx-auto text-center relative">
          <div className="w-20 h-20 mx-auto rounded-sm bg-slate-400 flex items-center justify-center mb-8 shadow-[0_4px_24px_rgba(59,130,246,0.3)]">
            <Flame size={40} className="text-[#0f172a]" />
          </div>
          <h1 className="text-5xl md:text-6xl font-bold text-slate-100 mb-6 font-heading">
            A World Shaped<br />By Its Players
          </h1>
          <p className="text-xl text-slate-300 mb-4 max-w-2xl mx-auto leading-relaxed">
            No download. No install. A persistent tribal-era RPG where progression is infinite, choices are permanent, and the world evolves through player actions.
          </p>
          <div className="inline-flex items-center gap-2 bg-[rgba(59,130,246,0.06)] border border-[rgba(59,130,246,0.12)] rounded-full px-4 py-1.5 mb-10">
            <div className="w-2 h-2 rounded-full bg-slate-400 animate-pulse" />
            <span className="text-slate-400 text-sm font-medium">Free to play — browser-based</span>
          </div>
          <div className="flex items-center justify-center gap-4">
            <Link to="/login">
              <Button variant="primary" size="lg" icon={<ArrowRight size={18} />}>
                Start Playing
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <section className="py-20 px-6 border-t border-[rgba(59,130,246,0.08)]">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl font-bold text-slate-200 text-center mb-12 font-heading">
            How It Works
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                step: "1",
                title: "Create Your Character",
                desc: "Choose a name and begin training. Your four core stats — Strength, Defence, Speed, Vitality — scale infinitely.",
              },
              {
                step: "2",
                title: "Join a Clan",
                desc: "Find like-minded players, pool resources, and build a settlement together. Every clan has its own culture and goals.",
              },
              {
                step: "3",
                title: "Shape the World",
                desc: "Explore, craft, trade, and fight. The world of TribalMMO evolves entirely through its players.",
              },
            ].map((item) => (
              <div key={item.step} className="text-center">
                <div className="w-12 h-12 mx-auto rounded-full bg-[rgba(59,130,246,0.08)] border border-[rgba(59,130,246,0.15)] flex items-center justify-center mb-4">
                  <span className="text-slate-400 font-bold text-lg font-heading">{item.step}</span>
                </div>
                <h3 className="text-slate-200 font-semibold mb-2">{item.title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed max-w-xs mx-auto">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 px-6 border-t border-[rgba(59,130,246,0.08)]">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-slate-200 text-center mb-3 font-heading">
            Four Core Stats
          </h2>
          <p className="text-slate-400 text-center mb-10 max-w-lg mx-auto">
            Infinitely scaling — train to grow stronger forever. No cap, no endgame.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {coreStats.map((stat) => (
              <div
                key={stat.label}
                className="text-center forge-card"
              >
                <div className="w-3 h-3 rounded-full mx-auto mb-3" style={{ background: stat.color }} />
                <h3 className="text-slate-200 font-semibold mb-1">{stat.label}</h3>
                <p className="text-slate-400 text-xs leading-relaxed">{stat.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 px-6 border-t border-[rgba(59,130,246,0.08)]">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-slate-200 text-center mb-3 font-heading">
            Skills & Progression
          </h2>
          <p className="text-slate-400 text-center mb-10 max-w-lg mx-auto">
            Five skills, each level 1–100. Master them to unlock recipes, efficiencies, and combat techniques.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            {skills.map((s) => {
              const Icon = s.icon;
              return (
                <div
                  key={s.label}
                  className="flex items-center gap-3 forge-card"
                >
                  <div
                    className="w-9 h-9 rounded flex items-center justify-center"
                    style={{ background: s.color + "16" }}
                  >
                    <Icon size={18} style={{ color: s.color }} />
                  </div>
                  <span className="text-slate-300 text-sm font-medium">{s.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="py-20 px-6 border-t border-[rgba(59,130,246,0.08)]">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl font-bold text-slate-200 text-center mb-3 font-heading">
            Built for Community
          </h2>
          <p className="text-slate-400 text-center mb-12 max-w-xl mx-auto">
            The best part of TribalMMO isn&apos;t the skills or the loot — it&apos;s the people.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {socialFeatures.map((f) => {
              const Icon = f.icon;
              return (
                <div
                  key={f.title}
                  className="p-5 forge-card forge-card-hover"
                >
                  <div
                    className="w-10 h-10 rounded flex items-center justify-center mb-3"
                    style={{ background: f.color + "16" }}
                  >
                    <Icon size={20} style={{ color: f.color }} />
                  </div>
                  <h3 className="text-slate-200 font-semibold mb-1">{f.title}</h3>
                  <p className="text-slate-400 text-sm leading-relaxed">{f.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="py-20 px-6 border-t border-[rgba(59,130,246,0.08)]">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-slate-200 text-center mb-8 font-heading">
            About the World
          </h2>
          <div className="space-y-4 text-slate-300 leading-relaxed">
            <p>
              TribalMMO is set in a persistent world inspired by early tribal civilizations.
              You arrive as a settler with nothing — no special status, no hand-holding.
              Everything you build, trade, and conquer is earned through your actions and the people you align with.
            </p>
            <p>
              The world is static but persistent. Spirit phenomena create rare supernatural events
              that temporarily empower players or settlements. These moments create spikes of opportunity
              and encourage exploration and clan coordination.
            </p>
            <p>
              Every action costs energy, which regenerates over time. But the real progression
              isn&apos;t just your stats — it&apos;s the reputation you build, the alliances you form,
              and the legacy your clan leaves on the world.
            </p>
          </div>
        </div>
      </section>

      <section className="py-20 px-6 border-t border-[rgba(59,130,246,0.08)]">
        <div className="max-w-xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-slate-200 mb-4 font-heading">
            Ready to Begin?
          </h2>
          <p className="text-slate-400 mb-8">
            Create your character and step into the world.
            Your clan is waiting.
          </p>
          <Link to="/login">
            <Button variant="primary" size="lg" icon={<ArrowRight size={18} />}>
              Start Your Journey
            </Button>
          </Link>
        </div>
      </section>

      <footer className="py-8 px-6 border-t border-[rgba(59,130,246,0.08)]">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Flame size={14} className="text-slate-400" />
            <span className="text-slate-500 text-sm font-heading">TribalMMO</span>
          </div>
          <span className="text-slate-600 text-xs">Beta v0.1</span>
        </div>
      </footer>
    </div>
  );
}
