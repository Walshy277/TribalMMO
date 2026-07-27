# TribalMMO

A persistent online tribal-era RPG where players form factions, build settlements, and shape the world through exploration, crafting, combat, diplomacy, and territory control.

## Overview

TribalMMO is a text-driven, social MMO set in a prehistoric fantasy continent called Nervella. Progression is finite, choices are permanent, and the endgame is political and social, not numerical.

### Key Features

- **Player-Run Factions** — Found and govern your own tribe with customizable laws and philosophies
- **Settlement Building** — Construct and upgrade buildings to enhance your faction's capabilities
- **Territory Control** — Claim hex territories across the map for strategic advantages
- **Exploration** — Tap-forward movement through forests, plains, mountains, and ancient ruins
- **Crafting & Gathering** — Timed actions with multiple professions and specializations
- **Turn-Based Combat** — Deterministic, text-driven encounters against wild creatures and rival factions
- **Spirit System** — Interact with environmental forces through rituals and offerings
- **Pets** — Optional companions providing passive buffs

## Design Documents

- [Full Game Design Concept](Concept.txt) — Complete vision for TribalMMO
- [MVP Specification](MVP.txt) — Minimum viable product scope and features

## Core Design Pillars

| Pillar | Description |
|--------|-------------|
| Finite Progression | Stats and skills cap at Tier III — no infinite grinding |
| Player-Driven World | Factions, settlements, and territory define the landscape |
| Social & Political Endgame | Alliances, diplomacy, and territory wars drive late-game |
| Optional Monetization | Cosmetic-focused with settlement skins, pet skins, and seasonal passes |

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
    (game)/          # Main game pages (dashboard, combat, crafting, etc.)
  components/
    layout/          # Header and Navigation
    ui/              # Reusable Button, Card, Input, StaminaBar
  lib/
    auth.tsx         # Authentication context (Supabase Auth)
    game.tsx         # Game state context (character, skills, inventory)
    supabase/        # Supabase client (browser) and admin (server)
  types/
    database.ts      # Supabase database type definitions
supabase/
  migrations/        # SQL schema migrations
```

## License

To be determined.
