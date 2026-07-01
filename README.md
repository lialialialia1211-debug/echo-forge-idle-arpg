# Iron Vortex Auto Top ARPG

Browser-first auto battler prototype that combines POE-like build math with an original dark metal battle top arena. The first playable slice now focuses on a 2D top-down combat disk: choose a top frame, drive core, and arena circuit, then watch the player top auto-fight generated enemy tops with distinct skill effects.

## Current Slice

- Vite + React + TypeScript application shell.
- Pure engine modules for modifier stacking, combat, defense, loot, offline rewards, and deterministic RNG.
- Pure top arena modules for POE-like damage packets, conversion, gain-as-extra, increased/reduced, more/less, hit chance, crit EV, guard mitigation, resistance, and penetration.
- Original battle top data for Top Frames, Drive Cores, Arena Circuits, enemy waves, drops, and combat events.
- Live 2D Canvas arena with auto-spawning monsters, player/enemy top movement, collisions, skill triggers, impact sparks, ember trails, storm arcs, drops, and responsive HUD.
- React control layer for Start/Pause, Reset, speed tabs, frame selection, drive core selection, circuit selection, telemetry, combat log, and drops.
- Workbench UI for Loadout, Inventory, Skills, and Talents.
- Seven real top equipment slots: Core, Attack Ring, Weight Disk, Tip, Launcher, Seal, and Circuit Chip.
- Drop-to-inventory flow with part comparison, equip, lock, salvage, and wallet materials.
- Skill rune compatibility and talent allocation that feed back into runtime stats.
- Static data for three classes, six skills, twelve support modules, six areas, item bases, and starter affixes.
- Seeded item instance generation with rarity, prefix/suffix rolling, affix tiers, and provenance.
- Prototype inventory, equipment slots, and equip comparison deltas.
- Timed farming tick with retained inventory, capacity overflow, lock protection, salvage, and starter currencies.
- Account-shaped local save schema with Zod validation.
- Legacy dense game dashboard systems are still in the codebase as reusable engine/prototype material, but the active app entry is the combat arena.
- Vitest coverage for core formulas, top damage, top arena runtime, RNG, item generation/scoring, farming, and save schema.

## Commands

```bash
pnpm install
pnpm test
pnpm build
pnpm dev
```

## Project Documents

- [Development Spec](docs/01_development_spec_zh.md)
- [Architecture](docs/02_architecture_zh.md)
- [Roadmap And Schedule](docs/03_roadmap_schedule_zh.md)
- [Playable Product Plan](docs/04_playable_product_plan_zh.md)
- [Dark Metal Top Arena Design](docs/05_dark_metal_top_arena_design_zh.md)
- [Current Implementation Status](docs/06_current_implementation_status_zh.md)
- [UI Operation Design Audit](docs/10_ui_operation_design_audit_zh.md)
- [Docs Index](docs/README.md)

## Architecture Rules

- Keep `src/game/engine` pure. It must not import React, DOM APIs, browser storage, or UI code.
- Keep game constants in `src/game/data` so balance can change without rewriting formulas.
- Keep saves server-compatible from the start: stable IDs, schema versions, and explicit migrations.
- UI should display and operate on engine state, not become the source of truth.

## Next Milestone

1. Persist top loadout, inventory, currencies, and arena progress through the account-shaped save schema.
2. Add arena progression with unlocks, boss gates, reward bias, and route clear history.
3. Add more Drive Core visuals: void pull, satellite orbit, heavy crash, chain fork, and burn groove hazards.
4. Expand the part affix pool and rarity rules.
5. Add crafting: upgrade rarity, reroll affixes, reroll values, lock lines, and material costs.
