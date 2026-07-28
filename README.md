# TribalMMO

A persistent, tribal-era online RPG where players shape a shared world through exploration, crafting, combat, and clan society.

## Overview

TribalMMO is a text-driven, social RPG where progression is infinite, choices are permanent, and the world evolves entirely through player actions. There is no traditional endgame — the game lives through its clans, settlements, and social dynamics.

### Key Features

- **Infinite Core Stats** — Strength, Defence, Speed, and Vitality scale infinitely through training
- **Finite Skills** — Five skills (Gathering, Crafting, Combat, Woodcutting, Mining) level 1–100
- **Player-Run Clans** — Found and govern your own tribe with roles, laws, and settlements
- **Settlement Building** — Construct and upgrade buildings (Tier I–III) with your clan
- **Exploration** — Tap-forward movement with resource finds, wildlife encounters, ruins, and random RNG events
- **Turn-Based Combat** — Deterministic, text-driven encounters with wild creatures and rival clans
- **Pet Companions** — Passive stat bonuses from loyal animal companions
- **Player Economy** — Global auction house and clan marketplaces with adjustable taxes

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

- **Framework:** Next.js 16 (App Router, Turbopack)
- **Language:** TypeScript 6
- **Styling:** Tailwind CSS 4
- **Database:** Supabase (PostgreSQL + Row Level Security)
- **Icons:** Lucide React
- **Runtime:** React 19

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

4. Run the database migration in your Supabase SQL Editor:
   - Open `supabase/migrations/001_initial_schema.sql`
   - Execute it in the Supabase Dashboard SQL Editor

5. Start the dev server:
   ```bash
   npm run dev
   ```

6. Open [http://localhost:3000](http://localhost:3000)

## Project Structure

```
src/
  app/
    (auth)/          # Login and signup pages
    (game)/          # Main game pages (profile, combat, crafting, etc.)
  components/
    layout/          # Header and Navigation
    ui/              # Reusable Button, Card, Input, StaminaBar
  lib/
    auth.tsx         # Authentication context (Supabase Auth)
    game.tsx         # Game state context (character, skills, inventory)
    stats.ts         # Core stat computation (4 infinitely scaling stats)
    constants.ts     # Game constants (icons, rarities, skill data)
    supabase/        # Supabase client (browser) and admin (server)
  types/
    database.ts      # Supabase database type definitions
supabase/
  migrations/        # SQL schema migrations
```

## License

To be determined.
