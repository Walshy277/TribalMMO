import { Link } from "react-router-dom";
import { useGame } from "@/lib/game";
import { supabase } from "@/lib/supabase/client";
import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/Button";
import { StaminaBar } from "@/components/ui/StaminaBar";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Alert } from "@/components/ui/Alert";
import { pick, rangeInt, chance } from "@/lib/rng";
import { formatTimeUntil } from "@/lib/utils";
import {
  Store, Bed, AlertTriangle, TreePine, Hammer, Swords, Users, ShoppingCart,
  Sun, Moon, Cloud, Flame, Scroll, Footprints, Sparkles, ScrollText,
  Coins, Compass, Clock, Zap,
} from "lucide-react";

const timeOfDay = [
  { name: "Dawn", icon: Sun, color: "text-[#c9a84c]", desc: "The first light crests the treeline. Villagers stir." },
  { name: "Morning", icon: Sun, color: "text-slate-300", desc: "The village hums with activity. Smoke rises from forges." },
  { name: "Midday", icon: Sun, color: "text-[#c9a84c]", desc: "The sun hangs high. Heat shimmers above the paths." },
  { name: "Afternoon", icon: Sun, color: "text-slate-400", desc: "Shadows lengthen. Children chase each other through the market." },
  { name: "Evening", icon: Moon, color: "text-[#6a90a8]", desc: "Torches are lit. The smell of cooking fires fills the air." },
  { name: "Night", icon: Moon, color: "text-[#8a6aaa]", desc: "Stars wheel overhead. The village grows quiet." },
  { name: "Deep Night", icon: Moon, color: "text-[#6a5a8a]", desc: "Only the watch fires burn. Strange sounds echo from the dark." },
];

const villageFlavor = [
  "An elder sharpens a blade by the central fire.",
  "Two children argue over a handful of river stones.",
  "A trader unloads goods from a distant settlement.",
  "Dogs bark at the edge of the village boundary.",
  "The village drummer beats a slow rhythm — all is well.",
  "Someone is singing an old song near the longhouse.",
  "The wind carries the scent of pine and woodsmoke.",
  "A scout returns from the eastern path, mud-stained but smiling.",
  "The blacksmith's hammer rings out in a steady rhythm.",
  "A group of hunters compare their catches near the smokehouse.",
];

const grindFlavor = [
  { minLevel: 1, text: "Every swing of the axe makes you stronger. Keep at it." },
  { minLevel: 10, text: "Ten levels done. Ninety to go. The path is long." },
  { minLevel: 25, text: "A quarter of the way. Your hands grow calloused." },
  { minLevel: 50, text: "Halfway. You've earned every scar." },
  { minLevel: 75, text: "Three quarters. Few have come this far." },
  { minLevel: 99, text: "Mastery. But there is always more to learn." },
];

const worldEventNews = [
  "Traders report increased bear activity near the eastern road.",
  "A meteor streaked across the sky last night.",
  "Spirit phenomena reported near the Ancient Ruins.",
  "A new clan has been spotted settling in the northern valleys.",
  "Rumors of a hidden treasure cache in the Deep Swamp.",
  "The shrine keepers claim the spirits are restless.",
  "An old hermit was seen emerging from the Jagged Caves.",
  "Strange lights flicker above the Dark Forest at night.",
  "A merchant caravan was ambushed on the western trail.",
  "The Riverbank has flooded — new resources wash ashore.",
];

export default function TownCentrePage() {
  const { character, refreshCharacter } = useGame();
  const [resting, setResting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [villageMood] = useState(() => pick(villageFlavor));
  const [news] = useState(() => pick(worldEventNews));
  const [restCount, setRestCount] = useState(0);

  const hour = new Date().getHours();
  const tod = timeOfDay[Math.floor(hour / 3.5) % 7];
  const TodIcon = tod.icon;

  const totalSkillLevels = useMemo(() => {
    if (!character?.skills) return 0;
    return character.skills.reduce((sum, s) => sum + s.level, 0);
  }, [character]);

  const avgSkillLevel = character?.skills?.length
    ? Math.round(totalSkillLevels / character.skills.length)
    : 1;

  const grindMsg = useMemo(() => {
    const matches = grindFlavor.filter((g) => avgSkillLevel >= g.minLevel);
    return matches.length > 0 ? matches[matches.length - 1].text : grindFlavor[0].text;
  }, [avgSkillLevel]);

  useEffect(() => {
    document.title = "Town Centre — TribalMMO";
  }, []);

  if (!character) {
    return <div className="text-slate-500 text-center mt-20">Create a character first.</div>;
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
      setRestCount((c) => c + 1);
      const restFlavor = [
        "You sit by the hearth. The warmth seeps into your bones.",
        "You close your eyes and listen to the crackling fire.",
        "The innkeeper brings you a warm broth. Much needed.",
        "You rest your feet and watch the world go by.",
        "A cat curls up beside you as you rest.",
      ];
      setSuccess(`${pick(restFlavor)} (+${amount} stamina)`);
      await refreshCharacter();
    }
    setResting(false);
  };

  const staminaPct = character.max_stamina > 0
    ? Math.round((character.computed_stamina / character.max_stamina) * 100)
    : 0;

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-slate-100" style={{ fontFamily: "Crimson Pro, Georgia, serif" }}>Nervella Village</h1>
        <p className="text-slate-500 text-sm mt-0.5">The heart of the tribe — rest, gather news, and prepare</p>
      </div>

      {/* Time of Day + Village Atmosphere */}
      <div className="card" style={{ borderColor: tod.color + "30" }}>
        <div className="flex items-center gap-3 mb-3">
          <TodIcon size={20} className={tod.color} />
          <div>
            <div className="text-sm font-semibold text-slate-200">{tod.name}</div>
            <div className="text-xs text-slate-500">{tod.desc}</div>
          </div>
          <div className="ml-auto text-slate-700 text-xs tabular-nums">
            {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </div>
        </div>
        <div className="bg-slate-900/40 rounded-lg p-3 border border-slate-800/20">
          <p className="text-slate-400 text-sm italic">"{villageMood}"</p>
        </div>
      </div>

      {/* Village News */}
      <div className="card">
        <div className="flex items-center gap-2 mb-3">
          <ScrollText size={14} className="text-[#c9a84c]" />
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Village Drum</h2>
        </div>
        <p className="text-slate-300 text-sm">{news}</p>
        <p className="text-slate-600 text-xs mt-2 italic">{grindMsg}</p>
      </div>

      {/* Stamina + Rest */}
      <div className="card">
        <StaminaBar current={character.computed_stamina} max={character.max_stamina} size="md" />
        <div className="flex items-center justify-between mt-2">
          <p className="text-slate-500 text-xs">Stamina: {staminaPct}% &middot; {character.computed_stamina}/{character.max_stamina}</p>
          {character.next_stamina_at && (
            <p className="text-slate-600 text-xs flex items-center gap-1">
              <Clock size={10} /> Next in {formatTimeUntil(character.next_stamina_at)}
            </p>
          )}
        </div>
      </div>

      {error && (
        <Alert variant="error" onDismiss={() => setError("")} icon={<AlertTriangle size={14} />}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert variant="success" onDismiss={() => setSuccess("")}>{success}</Alert>
      )}

      {/* The Resting Hearth */}
      <div className="card">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: "rgba(106,144,168,0.12)" }}>
            <Bed size={20} className="text-[#6a90a8]" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-200" style={{ fontFamily: "Crimson Pro, Georgia, serif" }}>The Resting Hearth</h2>
            <p className="text-slate-500 text-xs">Rest by the fire to recover stamina (up to 20)</p>
          </div>
          {restCount > 0 && (
            <span className="text-slate-600 text-[10px] ml-auto">{restCount} rests today</span>
          )}
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
            : `Rest at the Hearth (+${Math.min(20, character.max_stamina - character.computed_stamina)})`}
        </Button>
      </div>

      {/* Village NPCs */}
      <div className="card">
        <h2 className="text-sm font-bold text-slate-300 mb-3" style={{ fontFamily: "Crimson Pro, Georgia, serif" }}>
          Village Folks
        </h2>
        <div className="space-y-2">
          {[
            { name: "Elder Rowan", role: "Village Leader", desc: "The wise elder who guides the tribe. He assigns tasks and keeps the peace.", icon: Users, color: "#3b82f6" },
            { name: "Forger Thane", role: "Blacksmith", desc: "A burly smith who can repair your gear and teach metalwork.", icon: Hammer, color: "#b83a3a" },
            { name: "Scout Mira", role: "Guide", desc: "She knows every trail and creature in Nervella.", icon: TreePine, color: "#4a9e6a" },
            { name: "Captain Draven", role: "Guard Captain", desc: "Leads the village defence and runs the training grounds.", icon: Swords, color: "#b83a3a" },
          ].map((npc) => {
            const Icon = npc.icon;
            return (
              <div key={npc.name} className="flex items-center gap-3 px-3 py-3 rounded-lg bg-slate-900/30 border border-slate-800/20 hover:bg-slate-800/40 transition-colors">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ background: npc.color + "12" }}>
                  <Icon size={18} style={{ color: npc.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-200 text-sm font-semibold">{npc.name}</span>
                    <span className="text-slate-600 text-[10px] font-bold bg-slate-900/60 px-1.5 py-0.5 rounded border border-slate-800/20">{npc.role}</span>
                  </div>
                  <p className="text-slate-500 text-xs mt-0.5">{npc.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Quick Links */}
      <div className="card">
        <h2 className="text-sm font-bold text-slate-300 mb-3" style={{ fontFamily: "Crimson Pro, Georgia, serif" }}>
          Village Paths
        </h2>
        <div className="grid grid-cols-3 gap-2">
          {[
            { href: "/shops", label: "Shops", icon: Store, color: "#3b82f6", desc: "Buy and sell goods" },
            { href: "/gathering", label: "Gather", icon: TreePine, color: "#4a9e6a", desc: "Forage the wilds" },
            { href: "/woodcutting", label: "Woodcut", icon: TreePine, color: "#4a9e6a", desc: "Chop trees" },
            { href: "/mining", label: "Mine", icon: Hammer, color: "#8a7a6a", desc: "Extract ores" },
            { href: "/combat", label: "Combat", icon: Swords, color: "#b83a3a", desc: "Fight enemies" },
            { href: "/marketplace", label: "Market", icon: ShoppingCart, color: "#4a9e6a", desc: "Trade with players" },
            { href: "/crafting", label: "Craft", icon: Hammer, color: "#60a5fa", desc: "Create equipment" },
            { href: "/train", label: "Train", icon: Zap, color: "#c9a84c", desc: "Hone your stats" },
            { href: "/exploration", label: "Explore", icon: Compass, color: "#8a6aaa", desc: "Venture into danger" },
          ].map((link) => {
            const Icon = link.icon;
            return (
              <Link key={link.href} to={link.href}
                className="flex flex-col items-center gap-1 px-2 py-2.5 rounded-lg bg-slate-900/30 border border-slate-800/20 hover:bg-slate-800/40 transition-colors group">
                <Icon size={16} style={{ color: link.color }} />
                <span className="text-slate-300 text-xs font-medium group-hover:text-slate-200 transition-colors">{link.label}</span>
                <span className="text-slate-700 text-[8px]">{link.desc}</span>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Character Snapshot */}
      {character && (
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-slate-500 text-xs">Seasoned adventurer &middot; {totalSkillLevels} total skill levels</span>
              <div className="text-slate-700 text-[10px] mt-0.5">
                Avg. skill level: {avgSkillLevel} &middot; {character.gold} gold &middot; {character.inventory?.length || 0} item stacks
              </div>
            </div>
            <Link to="/profile" className="text-slate-400 hover:text-slate-300 text-xs transition-colors flex items-center gap-1">
              Profile <Footprints size={10} />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
