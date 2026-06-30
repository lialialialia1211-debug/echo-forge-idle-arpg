# 戰鬥陀螺 ARPG 系統契約

日期：2026-06-30  
狀態：Implementation Contract v0.1  
範圍：做到 UI 接線前的資料、engine、save 邊界。

## 1. 核心邊界

本專案的遊戲規則不得寫在 React component 裡。React/Canvas 只負責呈現、按鈕、面板與動畫。

資料流固定為：

```text
src/game/data
-> src/game/engine
-> src/game/save
-> src/game/ui
```

禁止方向：

```text
engine -> React
engine -> DOM
engine -> localStorage
data -> UI state
```

## 2. 主要名詞

| 名詞 | 意義 | POE-like 對應 |
| --- | --- | --- |
| Top Frame | 陀螺架構，提供起始屬性與玩法傾向 | Class |
| Doctrine | 中期專精，改變 build 規則 | Ascendancy |
| Drive Core | 自動觸發的主技能核心 | Skill Gem |
| Tuning Rune | 修改 Drive Core 行為的輔助模組 | Support Gem |
| Top Part | 可掉落、可打造、可裝備的零件 | Equipment |
| Engraving | Top Part 的 prefix/suffix 詞綴 | Item Affix |
| Forge Media | 打造材料與打造行為成本 | Currency |
| Boss Gate | progression 檢查點 | Boss / Quest Gate |
| Arena Key | 可打造、可消耗的終局入場物 | Map / Waystone |
| Circuit Network | 終局節點與解鎖狀態 | Atlas |
| Circuit Protocol | 改造刷圖規則的終局被動 | Atlas Passive |

## 3. 玩家進程

第一輪必須是：

```text
選 Top Frame
-> 得到 Drive Core
-> 插入 1-2 顆 Tuning Rune
-> 開始 Arena Circuit
-> 掉落 Top Part
-> 裝備 / 鎖定 / 拆解
-> 打造
-> Boss Gate 檢查
-> 掉落或打造 Arena Key
-> 進入小型 Circuit Network
```

Atlas 類 UI 不得早於 `Arena Key` 與 `Boss Gate`。

## 4. Top Combat Contract

戰鬥公式必須支援：

- `local` modifier：先作用於零件基底，例如 Attack Ring 的 local impact。
- `global` modifier：進入整體 build 後再計算。
- damage source：`collision`、`drive`、`trail`、`satellite`、`recoil`、`hazard`。
- hit 與 DoT 分離。
- DoT 不吃 hit chance 和 crit，除非特殊規則明確允許。
- Flux、cooldown、reservation 控制自動技能節奏。
- Guard 對大 hit 有衰減。
- Drift 影響命中。
- Grip 影響 Ring-Out。
- Ailment 必須有 chance、magnitude、duration。

第一版輸出：

```ts
type TopCombatProjection = {
  collisionDps: number;
  driveDps: number;
  dotDps: number;
  totalDps: number;
  effectiveHp: number;
  sustainScore: number;
  ringOutRisk: number;
  missingLayers: string[];
};
```

## 5. Top Part Generation Contract

Top Part 生成順序：

```text
drop source
-> slot
-> base
-> itemLevel
-> rarity
-> implicit
-> prefix/suffix count
-> eligible engraving pool
-> weighted roll
-> tier roll
-> PartInstance with provenance
```

必須保存：

- `id`
- `baseId`
- `slot`
- `rarity`
- `itemLevel`
- `affixes`
- `statBonuses`
- `resistanceBonuses`
- `modifiers`
- `generatedBy.arenaId`
- `generatedBy.enemyLevel`
- `generatedBy.balanceVersion`
- `generatedBy.seed`

驗收：

- 同 seed 可重現。
- prefix 最多 3。
- suffix 最多 3。
- group 不重複。
- illegal slot affix 不會出現。

## 6. Drive / Rune Contract

Drive Core 必須包含：

- `tags`
- `trigger`
- `cost`
- `cooldown`
- `hit`
- `dot`
- `minion`
- `arenaEffect`
- `scaling`

Tuning Rune 必須包含：

- `requiredTags`
- `excludedTags`
- `supportFamily`
- `costMultiplier`
- `instability`
- `behavior`
- `modifiers`

驗收：

- 所有 required tags 都要符合。
- 任一 excluded tag 命中則不可裝。
- 同一 supportFamily 第一版不可重複。
- rune 應改變技能行為或成本，不只是面板文字。

## 7. Forge Contract

第一版 Forge Media 動作：

- salvage：拆解零件取得材料。
- upgrade rarity：提升稀有度並補合法詞綴。
- reroll affixes：重骰所有詞綴。
- reroll values：保留詞綴，重骰 tier 數值。
- add engraving：增加一條 prefix 或 suffix。
- remove engraving：移除一條詞綴。

驗收：

- locked item 不可被 salvage。
- 打造後仍通過 prefix/suffix/group/slot legality。
- 材料收支可由 save 保存。

## 8. Boss Gate Contract

Boss Gate 不是戰鬥 UI，而是 progression evaluator。

輸入：

- boss gate id
- frame id
- drive id
- loadout
- optional arena key

輸出：

- `successChance`
- `estimatedTtk`
- `failureReasons`
- `recommendedStats`
- `rewardUnlocks`

失敗原因分類：

- `dps`
- `tracking`
- `guard`
- `drift`
- `grip`
- `resistance`
- `sustain`

## 9. Arena Key Contract

Arena Key 是物品，不是 UI 節點。

生成順序：

```text
arena source
-> tier
-> base arena
-> rarity
-> quality
-> prefix/suffix arena affixes
-> reward bias
-> bossGateId optional
```

Arena Key 的詞綴必須同時改變：

- enemy integrity
- enemy impact
- enemy guard
- enemy rpm
- reward quantity
- reward rarity
- slot reward bias
- boss pressure

## 10. Save Contract

Save 只存 serializable state：

- selected frame / drive / arena
- equipment
- inventory
- rune ids
- talent ids
- wallet
- arena keys
- cleared boss gates
- route clear history
- last settled time

不存：

- canvas objects
- runtime entity positions
- particle/effect state
- React selected panel

## 11. UI 接線前完成線

進入 UI 階段前，必須已完成：

- Top Part generator tests。
- Drive/Rune validation tests。
- Crafting legality tests。
- Boss Gate projection tests。
- Arena Key generation tests。
- Save migration tests。
- `pnpm test` 通過。
- `pnpm build` 通過。

