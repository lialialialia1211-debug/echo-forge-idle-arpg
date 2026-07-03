# 目前可玩切片進度

日期：2026-06-30  
狀態：Slice A/B 骨架已落地，可在 `http://127.0.0.1:5173/` 遊玩與檢查。

> 歷史快照：本文件保留 2026-06-30 當時狀態。最新 QA、測試數與 schema 狀態請以 `docs/12_update_log_zh.md` 為準。

## 已完成

- 主畫面已改為 2D 俯視戰鬥陀螺競技場，不再是舊式資料 dashboard。
- 玩家陀螺會自動尋敵、移動、碰撞、受傷、擊殺敵人。
- 怪物會自動生成，依 wave 產生 pack / elite / boss 節奏。
- Drive Core 會自動觸發技能，不需要玩家手動施放。
- 不同 Drive Core 目前已有不同效果：
  - `Shard Barrage`：碰撞後觸發 impact sparks。
  - `Ember Scour`：冷卻自動觸發 heat / ember trail。
  - `Storm Lattice`：冷卻自動觸發 static / storm arc。
- UI 已包含 Start/Pause、Reset、1x/2x/4x、Top Frame、Drive Core、Arena Circuit、Telemetry、Combat Log、Drops。
- Canvas 畫面包含競技盤、陀螺、敵人、生命環、技能特效、掉落物、HUD。
- 已新增完整工坊頁籤：Loadout、Inventory、Skills、Talents。
- 已新增 7 個裝備欄位：Core、Attack Ring、Weight Disk、Tip、Launcher、Seal、Circuit Chip。
- 掉落物會轉成真正的 Top Part，進入背包，可以比較、裝備、鎖定、拆解。
- 裝備會實際進入 `resolveTopRuntimeStats`，換裝後戰鬥數值會重算。
- Drive Core 技能頁會顯示技能資料，符文會依照 tag 相容性啟用/禁用。
- 天賦頁已有點數、前置條件、啟用/鎖定狀態，點選後會實際改變 runtime stats。
- 新工坊的 mobile 390px 檢查待重跑；瀏覽器 viewport 控制在本輪測試時逾時。

## 已落地的公式層

目前實作的是 POE-like 數值邏輯，不使用 POE2 原始命名或資料表。

- damage packet：`impact / heat / glass / static / void`
- flat added
- increased / reduced
- more / less
- conversion
- gain as extra
- hit chance：`tracking` vs `drift`
- crit expected value：`edge` / `fracture`
- guard mitigation：impact 對應 armour-like 公式
- resistance / penetration
- part quantity / part rarity 初版掉落修正
- equipment / rune / talent bonuses

## 本次新增主要檔案

- `src/game/engine/topTypes.ts`
- `src/game/engine/topDamage.ts`
- `src/game/engine/topAssembly.ts`
- `src/game/engine/arenaRuntime.ts`
- `src/game/data/topFrames.ts`
- `src/game/data/driveCores.ts`
- `src/game/data/arenaCircuits.ts`
- `src/game/ui/arena/CombatArena.tsx`
- `src/game/ui/arena/CombatArena.css`
- `src/game/data/topParts.ts`
- `src/game/data/tuningRunes.ts`
- `src/game/data/talentNodes.ts`
- `src/game/engine/topDamage.test.ts`
- `src/game/engine/arenaRuntime.test.ts`
- `src/game/engine/topAssembly.test.ts`

## 下一步實作順序

1. 接上 save schema：保存 loadout、inventory、currencies、arena progress。
2. 加入 Arena Progression：場地解鎖、Boss gate、route clear reward、reward bias。
3. 擴充 Drive Core 與特效：void pull、satellite orbit、heavy crash、chain fork、burn groove hazard。
4. 擴充 Part affix pool 與 rarity 規則，讓換裝選擇更像 ARPG。
5. 建立 Crafting：升階、重骰、鎖詞、拆解材料消耗。
6. 做第一輪平衡：確保每個 frame/drive 都有 5-10 分鐘內可感受到的差異。

## 驗證結果

- `pnpm test`：12 files / 30 tests passed。
- `pnpm build`：TypeScript + Vite production build passed。
- Browser playtest：
  - Start 後會自動生成敵人。
  - Combat Log 會更新技能命中、擊殺、掉落。
  - 切換 `Storm Lattice` 後，Log 會顯示 `Storm Lattice hits...`。
  - Inventory 可比較並裝備 Top Part。
  - Loadout 會顯示裝備後的新 Core。
  - Skills 頁會依 Drive Core 更新可用符文。
  - Talents 可花點啟用，Telemetry 數值會改變。
  - 新工坊 mobile 390px 尚未完成驗證，原因是 viewport 控制工具逾時。
  - browser console 無 error。
