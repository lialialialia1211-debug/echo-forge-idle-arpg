# UI 操作設計評估與下一輪優化方向

日期：2026-07-01  
狀態：Design Audit v0.1  
目標：參考同類作品後，合理化目前戰鬥陀螺 ARPG 的介面資訊架構與操作節奏。

## 1. 目前 UI 現況

目前入口是 `src/game/ui/arena/CombatArena.tsx`，畫面結構為：

```text
Topbar: 品牌 / 狀態 / 錢包 / Start / Reset / Debug / 速度
Main: 左側 Arena Canvas + HUD + combat log
Aside: 右側 Workbench tabs
  - Loadout
  - Inventory
  - Skills
  - Forge
  - Route
  - Talents
```

實際 QA 站量測：

- 桌面 1280x720：無水平溢出；戰鬥區約 798px，工作台約 440px。
- 手機 390x844：無水平溢出；但 topbar 約 204px，戰鬥區約 907px，workbench tabs 會落在 y=1136 左右，玩家要先滑過整個戰鬥區才看得到主要管理功能。
- 目前六個 tabs 平行呈現，但玩家的真正流程不是平行的，而是循環式：

```text
Run
-> 看掉落與戰鬥結果
-> 判斷零件是否升級
-> 裝備 / 鎖定 / 拆解 / 打造
-> 調整技能與天賦
-> 選 Route / Key / Boss Gate
-> Run
```

## 2. 同類作品參考

### Path of Exile

可參考的是「角色 build」與「地圖終局 build」分層。Atlas Passive Tree 是獨立於角色的終局樹，透過刷圖取得點數，再強化地圖獎勵與戰鬥內容。這對本專案的啟示是：`Route / Boss Gate / Circuit Network` 不應太早和角色 build 混在一起，應在玩家理解 Arena Key 和 Boss Gate 後再展開。

參考：https://www.poewiki.net/wiki/Atlas_Passive_Skill_Tree

### Diablo IV

Armory 的重點不是單一裝備欄，而是把 Equipment、Skills、Paragon Nodes、Glyphs 收成一個可命名、可快速檢視的 build snapshot。這對本專案的啟示是：`Loadout` 不該只是一排裝備槽，應該成為「Build Summary」，集中呈現零件、Drive Core、Runes、Talents 與核心輸出指標。

參考：https://news.blizzard.com/en-us/article/24162193/the-2-1-ptr-what-you-need-to-know

### Last Epoch

Forge 介面有清楚的「被打造物」、「prefix/suffix slots」、「材料槽」、「成本」、「上次結果」。這對本專案的啟示是：`Forge` 應以單一選中零件為中心，永遠顯示目前詞綴、可執行操作、材料成本、預期結果與風險，而不是只放一排動作按鈕。

參考：https://lastepoch.fandom.com/wiki/Crafting

### Brotato

Brotato 的核心是短局戰鬥與局間 build 選擇：玩家先戰鬥，再用非常快的節奏選武器、物品、屬性，形成下一輪策略。這對本專案的啟示是：戰鬥結束後必須直接把玩家帶到「最需要處理的掉落與升級」，減少手動找 Inventory / Forge 的成本。

參考：https://store.steampowered.com/app/1942280/Brotato/

### Backpack Battles

Backpack Battles 是 PvP inventory management auto battler，戰鬥自動，真正決策集中在買、做、放、調整物品。這對本專案的啟示是：因為戰鬥自動，所以 prep UI 本身就是主遊戲；零件、詞綴、相容性、升級預覽必須比目前更明確。

參考：https://store.steampowered.com/app/2427700/Backpack_Battles/

### Super Auto Pets

Super Auto Pets 強調 at-your-own-pace 的組隊與自動戰鬥。這對本專案的啟示是：即使系統深，也要把每回合的主要決策維持在少數清楚動作中，例如「保留 / 裝備 / 拆解 / 打造 / 開下一場」。

參考：https://store.steampowered.com/app/1714040/Super_Auto_Pets/

## 3. 建議資訊架構

把目前 6 個平行 tabs 改成 4 個主模式，降低玩家認知負擔：

```text
Arena
  - 戰鬥盤、HUD、目標、combat log、loot toast

Build
  - Loadout summary
  - Equipment slots
  - Drive Core
  - Tuning Runes
  - Talents
  - DPS / EHP / Risk projection

Loot
  - 最新掉落
  - Inventory
  - Filter / Sort
  - Compare / Equip / Lock / Salvage

Forge
  - Selected Part Inspector
  - Affix slots
  - Action preview
  - Material cost
  - Result history

Route
  - Arena Circuit
  - Arena Keys
  - Boss Gate projection
  - Clear history
```

`Skills` 和 `Talents` 應先收進 `Build`。等內容量真的變大，再讓 `Build` 內部使用二級 tabs，而不是一開始就和 Inventory / Forge / Route 同層。

## 4. 核心互動原則

### 4.1 永遠有 Next Action

Topbar 或 workbench 上方應有一條 `Next Action Strip`，根據狀態提示下一個主要動作：

- 沒開戰：`Start run`
- 有新掉落：`Review 3 drops`
- 選中可升級零件：`Equip upgrade` / `Forge selected part`
- 有 Arena Key：`Run selected key`
- Boss Gate 成功率足夠：`Attempt gate`

這不是教學文字，而是狀態導向的主要操作入口。

### 4.2 單一 Selected Part Inspector

Inventory、Equipment、Forge 都應共用同一個零件詳情元件，避免玩家在不同 tab 看到不同版本的資訊。Inspector 應包含：

- slot / rarity / item level
- implicit / prefix / suffix
- 與目前裝備相比的核心 delta
- lock 狀態
- equip / salvage / send to forge
- craft cost preview

### 4.3 Build Summary 不只是裝備欄

`Build` 應像 Diablo IV Armory 的概念，讓玩家一眼知道目前 build 由哪些層組成：

```text
Frame + Drive Core + Runes + 7 Top Parts + Talents + Route bias
```

第一版可只放 5 個摘要指標：

- Total DPS
- Effective HP
- Tracking
- Guard
- Reward Bias

### 4.4 Route 不急著做成大型 Atlas

目前系統契約已規定 Atlas 類 UI 不得早於 Arena Key 與 Boss Gate。下一輪 Route UI 應先做成小型「Key / Gate / Clear」管理面，而不是直接做大地圖。

## 5. 手機版調整方向

目前手機版沒有水平溢出，但主要管理 tabs 在戰鬥區下面很遠。建議：

- 手機使用 sticky bottom nav：`Run / Build / Loot / Forge / Route`。
- Start / Pause / Speed 保持 sticky 或壓縮成單列控制條。
- Combat log 預設折疊，避免把 workbench 推得更下面。
- Arena canvas 高度在手機第一屏控制於 320-380px，讓玩家不必滑過一整個 900px stage 才能管理裝備。
- Loot toast 點擊後直接切到 `Loot` 並選中該零件。

## 6. 分階段更新建議

### Phase 1：操作動線重整

目的：不改 engine，不改平衡，只改 UI 結構。

- 新增 `NextActionStrip`。
- 把 workbench tabs 改為 `Build / Loot / Forge / Route`。
- 抽出 `SelectedPartInspector`。
- `Inventory` 與 `Forge` 共用同一個 selected part 狀態。
- 手機版加 sticky bottom nav。

驗收：

- 390px 無水平溢出。
- 從掉落提示到裝備或拆解不超過 2 次點擊。
- 從選中零件到 Forge 不超過 1 次點擊。
- Start / Pause / Reset 在桌面與手機都不需要捲動才能使用。

### Phase 2：裝備與打造判斷輔助

目的：讓玩家知道「為什麼要換」與「打造可能發生什麼」。

- Compare delta 擴充為 DPS / EHP / Tracking / Reward 影響。
- Forge action 顯示成本、可能結果、失敗或 blocked 原因。
- 加入 batch salvage，但 locked item 不可被選入。
- Inventory filter 改為 slot / rarity / locked / upgrade candidate。

驗收：

- 每個 craft disabled 都有明確原因。
- 裝備比較不只顯示單項 stat，而是能看出 build 方向。
- 鎖定零件不會被 batch 操作影響。

### Phase 3：Route 與 Boss Gate 變成目標系統

目的：把「再跑一場」變成有方向的推進。

- Route panel 顯示目前推薦 circuit。
- Arena Key 顯示風險 / reward / slot bias。
- Boss Gate 顯示缺口與推薦補強 stat。
- Clear history 和 unlock 放在同一處。

驗收：

- 玩家可以明確知道下一個 gate 卡在哪個 stat。
- Key 的 reward bias 可以連到 Loot / Build 決策。
- Route UI 仍保持小型，不提前做大型 Atlas。

### Phase 4：Build Presets

目的：讓多 build 測試變簡單。

- 儲存 3-5 個 build loadouts。
- 每個 loadout 包含 equipment、drive、runes、talents。
- 缺少被拆掉的零件時顯示 missing 狀態。

驗收：

- 切 build 不會破壞 save schema。
- missing item 不會造成 crash。
- loadout preview 一眼能看出核心差異。

## 7. 下一個最合理的實作切點

建議先做 Phase 1，因為它能立刻改善 QA 朋友的回饋品質：朋友不需要理解全部系統，也能依照 `Run -> Loot -> Build/Forge -> Route` 的節奏測。

第一個 PR 可以只碰：

```text
src/game/ui/arena/CombatArena.tsx
src/game/ui/arena/CombatArena.css
```

不要先動 engine，不要先擴資料表，不要先做大 Atlas。先把現有功能整理成更合理的操作面，再根據 QA 回饋決定哪個系統值得加深。
