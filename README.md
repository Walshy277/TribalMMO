# TribalMMO

A persistent, browser-based tribal-era online RPG where players shape a shared world through exploration, crafting, combat, and clan society.

## Overview

TribalMMO is a text-driven, social RPG with infinite stat progression, player-run clans, settlement building, and a player-driven economy. There is no traditional endgame — the world evolves entirely through player actions.

### Key Features

- **Infinite Core Stats** — Strength, Defence, Speed, and Vitality scale infinitely through training
- **Finite Skills** — Five skills (Gathering, Crafting, Combat, Woodcutting, Mining) level 1–100
- **Player-Run Clans** — Found and govern your own tribe with roles, laws, settlements, and clan vaults
- **Settlement Building** — Construct and upgrade buildings (Tier I–III) with your clan
- **Exploration** — Tap-forward movement with resource finds, wildlife encounters, ruins, and random RNG events across multiple zones
- **Turn-Based Combat** — Deterministic, text-driven encounters with wild creatures and NPC raiders
- **Hunting & Taming** — Track and hunt wildlife; tame pets that grant passive stat bonuses
- **Begging System** — Solicit coins from other players in town
- **Shrine System** — Offer resources for stat blessings
- **Player Economy** — Global auction house, clan marketplaces, NPC shops with market-driven prices, and player-to-player trade
- **Item Collections** — Discover and complete item sets for special bonuses
- **Clans & Progression** — Clan levels, experience, and vault storage
- **NPC Equipment Loot** — Defeat NPCs to earn gear and equipment drops

## Design Documents

- [Full Game Design Concept](Concept.txt) — Complete vision for TribalMMO
- [MVP Specification](MVP.txt) — Minimum viable product scope and features

## Core Design Pillars

| Pillar | Description |
|--------|-------------|
| Infinite Progression | Core stats scale forever — there is no cap |
| Finite Skills | Skills cap at Level 100 — mastery is meaningful |
| Player-Driven World | Clans, settlements, and social dynamics define the landscape |
| Deterministic Combat | Turn-based, text-driven, skill-focused encounters |
| No Endgame | The world evolves entirely through player actions |

## Tech Stack

- **Build Tool:** Vite 8
- **Language:** TypeScript 6
- **UI Library:** React 19
- **Routing:** React Router 7
- **Styling:** Tailwind CSS 4
- **Database:** Supabase (PostgreSQL + Row Level Security)
- **Icons:** Lucide React

## Getting Started

### Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com) project

### Setup

1. Clone the repository:
   ```bash
   git clone <repo-url>
   cd TribalMMO
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Copy the environment file and fill in your Supabase credentials:
   ```bash
   cp .env.local.example .env.local
   ```

4. Run the database migrations in your Supabase SQL Editor:
   - All migrations in `supabase/migrations/` should be executed in order
   - Start with `001_initial_schema.sql`

5. Start the dev server:
   ```bash
   npm run dev
   ```

6. Open [http://localhost:5173](http://localhost:5173)

### Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start the Vite development server |
| `npm run build` | Type-check and build for production |
| `npm run preview` | Preview the production build locally |
| `npm run lint` | Run TypeScript type-checking only |

## Project Structure

```
src/
  app/
    (auth)/              # Login and signup pages
    (game)/
      actions/           # Timed action slots
      auction/           # Global auction house
      begging/           # Beg for coins from other players
      character/         # Player character profile & stats
      clans/             # Clan management, roles, vault
      combat/            # Turn-based combat encounters
      crafting/          # Item crafting with skill checks
      exploration/       # Zone exploration with RNG events
      gathering/         # Resource gathering (herbs, etc.)
      hunting/           # Hunt wildlife for resources
      inventory/         # Player inventory & equipment
      marketplace/       # Player-to-player marketplace
      mining/            # Mining resources
      play/              # Game dashboard / home
      rewards/           # Daily rewards & achievements
      shops/             # NPC shops with market-driven pricing
      shrine/            # Offer resources for stat blessings
      taming/            # Tame and manage pet companions
      town-centre/       # Town hub with player interactions
      train/             # Train core stats (STR, DEF, SPD, VIT)
      woodcutting/       # Woodcutting resource gathering
  components/
    layout/
      Header.tsx         # Top navigation bar
      Navigation.tsx     # Side/bottom navigation
    ui/
      Alert.tsx          # Notification/alerts component
      Button.tsx         # Reusable button component
      CoinDisplay.tsx    # Coin/gold display component
      EmptyState.tsx     # Empty state placeholder
      LoadingSkeleton.tsx # Loading skeleton component
      PageGuard.tsx      # Auth route guard component
      SearchInput.tsx    # Search input component
      SectionHeader.tsx  # Section header component
      StaminaBar.tsx     # Stamina display bar
  lib/
    admin.tsx            # Admin dashboard utilities
    auth.tsx             # Authentication context (Supabase Auth)
    constants.ts         # Game constants (icons, rarities, skills)
    game.tsx             # Game state context (character, skills, inventory)
    rng.ts               # Random number generation utilities
    stats.ts             # Core stat computation (infinite scaling)
    utils.ts             # General utility functions
    supabase/
      client.ts          # Supabase browser client
      admin.ts           # Supabase admin (server-side) client
  types/
    database.ts          # Supabase database type definitions
supabase/
  migrations/            # 34 SQL schema migrations
    ...
public/
  .htaccess              # Apache rewrite rules
  index.php              # PHP fallback for hosting
```

## Database Migrations

The `supabase/migrations/` directory contains all database schema changes, applied sequentially. Key migrations:

| Migration | Description |
|-----------|-------------|
| `001_initial_schema.sql` | Core tables: players, skills, inventory |
| `004_economy_system.sql` | Economy & gold system |
| `005_rename_factions_clans.sql` | Factions → clans rename |
| `009_enhanced_exploration.sql` | Exploration zones & events |
| `013_add_level_system.sql` | Player level system |
| `021_clan_settelments.sql` | Clan settlement buildings |
| `025_rs_xp_curve.sql` | RuneScape-style XP curve |
| `026_economy_redesign.sql` | Economy redesign & market values |
| `027_security_hardening.sql` | Security hardening & RLS |
| `031_gameplay_improvements.sql` | Gameplay improvements |
| `032_npc_equipment_loot.sql` | NPC equipment & loot tables |
| `033_item_collections.sql` | Item collection system |
| `034_clan_level_vault_buildings.sql` | Clan levels, vaults & buildings |

## Contributing

This project is in early development. Contributions and feedback are welcome.

## License

To be determined.
