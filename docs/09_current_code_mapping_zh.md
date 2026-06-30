# 目前程式碼映射與落地切點

日期：2026-06-30  
狀態：Implementation Mapping v0.1

## 1. 可保留

- `src/game/engine/topDamage.ts`：已有 base、flat、increased/reduced、more/less、conversion、extra-as、hit chance、crit EV、guard、resistance、penetration。
- `src/game/engine/topAssembly.ts`：已有 frame、equipment、rune、talent 的 loadout 合併入口。
- `src/game/engine/arenaRuntime.ts`：已有自動生成、尋敵、碰撞、技能觸發、掉落事件的 runtime 骨架。
- `src/game/ui/arena/CombatArena.tsx`：可作為後續 UI 接線目標，但本階段不擴它。
- `src/game/engine/items.ts`：一般 ARPG 物品生成器可作為陀螺零件生成模式參考。

## 2. 需要抽離

`src/game/data/topParts.ts` 目前同時包含：

- Top Part bases。
- 詞綴模板。
- rarity 詞綴數。
- roll 邏輯。
- drop label 到 base 的映射。

這些應拆為：

```text
data/topParts.ts        -> 只保留 slot label、slot order、base data、UI 相容 wrapper
data/engravings.ts      -> Top Part prefix/suffix 詞綴資料
engine/topPartGeneration.ts -> seed、rarity、prefix/suffix、tier、provenance
```

## 3. 需要補強

### topTypes

要補：

- Top rolled affix。
- generatedBy provenance。
- Arena Key 型別。
- Boss Gate 型別。
- Drive cost/cooldown/hit/dot/minion/hazard profile。
- Tuning Rune excluded tags、support family、cost multiplier、instability、behavior。

### tuningRunes

目前 `isRuneCompatible` 是「任一 required tag 命中」。應改成：

```text
所有 required tags 必須命中
任一 excluded tag 命中則失敗
同 supportFamily 第一版不可重複
```

### save

目前 save schema 只保存舊 dashboard build。要擴為：

- top loadout
- top inventory
- top wallet
- arena keys
- boss gate progress
- selected arena

## 4. 本階段新增模組

```text
src/game/data/engravings.ts
src/game/data/arenaKeyAffixes.ts
src/game/data/bossGates.ts
src/game/engine/topPartGeneration.ts
src/game/engine/driveRuneValidation.ts
src/game/engine/topCrafting.ts
src/game/engine/bossGate.ts
src/game/engine/arenaKeys.ts
```

## 5. 本階段不碰

- 不重做 `CombatArena.tsx`。
- 不新增 Atlas/Circuit 大 UI。
- 不改 Canvas 事件流。
- 不新增美術資產。

## 6. 接 UI 時的入口

UI 後續應只呼叫這些 engine API：

- `generateTopPart`
- `createPartFromArenaDrop`
- `validateRuneLoadout`
- `salvageTopPart`
- `upgradeTopPartRarity`
- `rerollTopPartAffixes`
- `generateArenaKey`
- `projectBossGateAttempt`

