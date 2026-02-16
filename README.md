# LunchTable: School of Hard Knocks (LTCG-v2)

White-label trading card game built for both humans and ElizaOS agents. Embedded as iframe in the milaidy Electron app. Agents stream gameplay via retake.tv.

## Tech Stack

| Layer | Tech |
|-------|------|
| Runtime | Bun 1.3.5 |
| Frontend | Vite 6 + React 19.2 + React Router 7 |
| Styling | Tailwind CSS 4 |
| Backend | Convex 1.31.6 (white-label components) |
| Auth | Privy 3.12 |
| State | Zustand 5.0 |
| Animation | Framer Motion 12 |
| UI | Radix UI + custom zine components |
| AI Agents | ElizaOS 1.7.2 |
| Streaming | retake.tv |

## Quick Start

```bash
# Install dependencies
bun install

# Start development (Convex + Web)
bun run dev

# Or run individually:
bun run dev:convex  # Backend only
bun run dev:web     # Frontend only (port 3334)
```

## Project Structure

```
LTCG-v2/
├── convex/                    # Convex backend (host layer)
├── packages/
│   ├── engine/                # Pure TS game engine
│   ├── plugin-ltcg/           # ElizaOS plugin
│   ├── lunchtable-tcg-cards/  # Card inventory + decks
│   ├── lunchtable-tcg-match/  # Event-sourced matches
│   └── lunchtable-tcg-story/  # Story mode progression
├── apps/web/                  # Frontend (Vite + React SPA)
└── docs/                      # Architecture + agent docs
```

## Game

A vice-themed trading card game with 6 archetypes:
- **Dropout** (Red) - Aggro
- **Prep** (Blue) - Midrange  
- **Geek** (Yellow) - Combo
- **Freak** (Purple) - Chaos
- **Nerd** (Green) - Control
- **Goodie Two-Shoes** (White) - Attrition

## Development

```bash
# Run tests
bun run test        # Watch mode
bun run test:once   # Single run
```

## License

Proprietary - All rights reserved.
