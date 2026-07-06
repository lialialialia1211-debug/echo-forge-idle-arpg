# Iron Vortex Auto Top ARPG

Browser-first auto battler prototype that combines POE-like build math with an original dark metal battle top arena. The first playable slice now focuses on a 2D top-down combat disk: choose a top frame, drive core, and arena circuit, then watch the player top auto-fight generated enemy tops with distinct skill effects.

## Current Slice

- Vite + React + TypeScript application shell.
- Pure engine modules for modifier stacking, combat, defense, loot, offline rewards, and deterministic RNG.
- Pure top arena modules for POE-like damage packets, conversion, gain-as-extra, increased/reduced, more/less, hit chance, crit EV, guard mitigation, resistance, and penetration.
- Original battle top data for Top Frames, Drive Cores, Arena Circuits, enemy waves, drops, and combat events.
- Live 2D Canvas arena with auto-spawning monsters, player/enemy top movement, collisions, skill triggers, impact sparks, ember trails, storm arcs, drops, and responsive HUD.
- React control layer for Start/Pause, Reset, speed tabs, frame selection, drive core selection, circuit selection, telemetry, combat log, and drops.
- Workbench UI for Loadout, Inventory, Skills, Forge, Route, and Talents.
- Seven real top equipment slots: Core, Attack Ring, Weight Disk, Tip, Launcher, Seal, and Circuit Chip.
- Drop-to-inventory flow with part comparison, equip, lock, salvage, and wallet materials.
- Skill rune compatibility and talent allocation that feed back into runtime stats.
- Static data for three classes, six skills, twelve support modules, six areas, item bases, and starter affixes.
- Seeded item instance generation with rarity, prefix/suffix rolling, affix tiers, and provenance.
- Prototype inventory, equipment slots, and equip comparison deltas.
- Route strategy projections with risk/reward/readiness/offline estimates and keyed arena runs.
- Loot policy presets, auto-salvage evaluation, retention reasons, and inventory overflow recovery.
- Endgame master data, allocation rules, projections, and bonuses for map sustain, forge control, and rival hunts.
- Timed farming tick with retained inventory, capacity overflow, lock protection, salvage, and starter currencies.
- Account-shaped local save schema with Zod validation and migrations through schema version 8.
- Vitest coverage for core formulas, top damage, top arena runtime, RNG, item generation/scoring, farming, save schema, loot policy, route strategy, and endgame masters.

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
- [POE System Rethink Battle Top Plan](docs/07_poe_system_rethink_battle_top_plan_zh.md)
- [Top ARPG System Contract](docs/08_top_arpg_system_contract_zh.md)
- [Current Code Mapping](docs/09_current_code_mapping_zh.md)
- [UI Operation Design Audit](docs/10_ui_operation_design_audit_zh.md)
- [基礎數值](docs/11_基礎數值_zh.md)
- [Update Log](docs/12_update_log_zh.md)
- [Docs Index](docs/README.md)

## Architecture Rules

- Keep `src/game/engine` pure. It must not import React, DOM APIs, browser storage, or UI code.
- Keep game constants in `src/game/data` so balance can change without rewriting formulas.
- Keep saves server-compatible from the start: stable IDs, schema versions, and explicit migrations.
- UI should display and operate on engine state, not become the source of truth.

## Next Milestone

1. Keep reducing home/workbench decision noise so one screen presents one obvious next action.
2. Continue extracting large UI sections out of `CombatArena.tsx` while preserving engine/data boundaries.
3. Improve loot policy readability with clearer keep/salvage previews and offline-hour estimates.
4. Expand endgame master explanations before adding more nodes or rewards.
5. Add more Drive Core visuals and chase drops only after the existing Route/Loot/Endgame loops are easy to read and QA.
