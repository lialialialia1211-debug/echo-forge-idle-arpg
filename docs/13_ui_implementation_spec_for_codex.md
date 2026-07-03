# UI 實作規格（給 Codex 執行）— 戰鬥陀螺三畫面

> 版本 2026-07-02 ｜ 執行者：Codex ｜ 規劃/品管：Claude
>
> **這份文件是「做什麼、怎麼接」的實作規格。** 視覺目標見 `docs/12_ui_ux_mockup_zh.html`（線框圖，用瀏覽器開）。底層數值/資料語意見 `docs/11_foundation_layer_design_zh.html`。本文件只講 UI 層。

---

## 0. 如何讀這份文件

- 每個 Phase 有：**目標 → 元件清單（含 props 與資料來源）→ CSS → 驗收標準（checklist）**。
- **資料來源**欄標了每個 UI 值該從哪拿。標 `[現成]` 表示 store/runtime 已有；標 `[待底層]` 表示依賴尚未實作的底層工作，需用臨時代理值先接、之後再換真值。
- 遵循 repo 既有慣例：狀態用 `useGameStore`（zustand，`src/game/ui/store.ts`）；型別放 `engine/types`；CSS class 命名沿用 `CombatArena.css` 的 kebab-case 風格。
- **漸進式**：Phase 1 → 2 → 3 依序做，每個 Phase 都要能編譯、能跑、通過該 Phase 驗收標準才進下一個。

---

## 1. 前置：資料合約與依賴盤點

### 1.1 現成可用（`src/game/ui/store.ts` / engine）
| 資料 | 來源 | 用途 |
|---|---|---|
| `encounter.rank`（`"boss" \| "elite" \| "normal"`） | `EncounterState` | **血條三級規則的判定依據** |
| `build.equipment`（七槽） | `CharacterBuild` | 養成畫面七槽顯示 |
| `inventory` / `inventoryCapacity` | store | 背包格 |
| `currencies`（`CurrencyWallet`） | store | 貨幣顯示 |
| `combatEvents`（`CombatEvent[]`，`tone`+`text`） | store | 掉落/事件 toast |
| `skillCharge` | store | **暫充當 Flux 值**（見 1.3） |
| 玩家存活值（`spinPower`/`spinIntegrity`） | `arenaRuntime`，經 `CombatArena` 取得 | **暫充當 E 值**（見 1.3） |
| `areaId` / `areas` 資料 | store + `data/areas.ts` | 地圖清單基底 |

### 1.2 需新增
| 新增項 | 位置 | 說明 |
|---|---|---|
| `screen: "combat" \| "map" \| "workbench"` | `GameStore` | 三畫面導覽狀態，預設 `"combat"` |
| `setScreen(screen)` | `GameStore` action | 切換畫面 |

### 1.3 依賴底層（`[待底層]`，先用代理值）
| UI 需要 | 底層真值（見 doc 11） | 現在先接什麼 |
|---|---|---|
| Flux（魔力球）當前值 / 上限 | `flux` / `maxFlux`（尚未實作） | 先綁 `skillCharge`（0..1 或現有範圍），底層做好後換成真 `flux/maxFlux` |
| E（命球）當前值 / 上限 | 旋轉能量 E（doc 11 §2，尚未取代 spinIntegrity） | 先綁現有玩家存活值，底層做好後換真 E |
| Flux 乾涸旗標（紅色預警） | `flux <= 閾值`（尚未實作） | 先用 `skillCharge <= 0.15` 代理 |

> **重要：UI 這一層現在就能全部做完**，只要把上面三個值抽象成「命比例 lifeRatio ∈ [0,1]」「魔比例 fluxRatio ∈ [0,1]」「fluxLow: boolean」三個 selector，之後底層換真值時只改 selector、不動元件。**Codex 請優先建立這三個 selector 當接縫。**

---

## 2. 導覽：三畫面結構

- 在 `GameStore` 加 `screen` 狀態與 `setScreen`。
- 頂層 UI（目前 `CombatArena` 或 `App`）依 `screen` 切渲染：`<CombatScreen>` / `<MapScreen>` / `<WorkbenchScreen>`。
- 切換入口：戰鬥畫面提供「地圖」「養成」入口按鈕；地圖/養成畫面提供「返回戰鬥」。
- **現有 `CombatArena.tsx`（2393 行）目前把三種內容全塞在一起**。重構方向：把「工作台區塊（`.workbench-panel` 系列、`.panel-tabs`、`inventory-grid`、`drive-grid`、`talent-*`、`forge-*`、`circuit-*`）」抽到 `WorkbenchScreen`；把「爬塔軌、遙測表、流派相關」從戰鬥畫面移除；戰鬥畫面只留 Phase 1 定義的元件。

---

## 3. Phase 1 — 戰鬥畫面（CombatScreen）★最高優先

### 3.1 目標
- **中央圓形競技場（Phaser canvas）佔畫面 ≥ 2/3**，置中。
- 其餘 UI 一律「覆蓋（overlay）」在角落/邊緣，**絕不佔用版面欄位、不擋中央戰鬥**。
- 畫面上只有：競技場、左下雙球 HUD、頂部極簡條、（條件性）BOSS 血條、掉落 toast。**其餘全部不在此畫面。**

### 3.2 元件清單
| 元件 | 位置 | props / 資料來源 | 備註 |
|---|---|---|---|
| `CombatStage` | 中央 | 包現有 `ArenaPhaserView` | 尺寸 ≥ 2/3 螢幕（用 `min(66vw,66vh)` 之類保持圓形） |
| `OrbHud` | 左下角 overlay | `lifeRatio` `fluxRatio` `fluxLow`（見 §1.3 selector） | 詳規 §3.3 |
| `CombatTopStrip` | 頂部 overlay | 地圖名（`areaId`→名稱）、暫停/播放、速度 tab（沿用現有 speed-tabs 狀態） | 極簡，半透明 |
| `BossBar` | 頂部橫幅 overlay | `encounter.rank === "boss"` 時渲染；血量比例來自 boss 存活值 | **僅 boss 顯示** |
| `EliteHpBar` | 跟隨敵方小陀螺 | 每個 `rank==="elite"` 的敵人，血條浮於其上方 | 由 Phaser 世界座標投影到畫面，或在 canvas 內畫 |
| `LootToast` | 右下角 overlay | `combatEvents` 中 `tone==="drop"` 的最新項 | 短暫淡入淡出 |

### 3.3 OrbHud 詳規（雙球·左下·疊合）
- **位置：左下角**（定案）。
- **E 命球**：較大的圓（約 90px），綠色系。液面高度 = `lifeRatio`（0..1），由下往上填。
- **Flux 魔球**：較小的圓（約 56px），藍/紫色系，**覆蓋在命球的右上方**（`z-index` 高於命球，邊緣用背景色描一圈與命球區隔）。液面高度 = `fluxRatio`。
- **液面**用 CSS 由下往上填色（`height: {ratio*100}%` 的內層 div），可加緩動 transition。
- **死亡螺旋預警**：`fluxLow === true` 時，兩球接觸處/魔球外緣泛紅（紅色 glow 或 pulse animation）。這是「Flux 快乾 → E 要開始只掉不回」的視覺警告，對應 doc 11 §3。
- 參考線框：`docs/12` 的 `.orb-hud / .orb-life / .orb-mana`。

### 3.4 血條顯示規則（三級·定案）
| rank | 顯示 | 實作 |
|---|---|---|
| `boss` | 畫面頂部橫跨大血條（`BossBar`） | 頂部固定 overlay，紅色系，帶 boss 名 |
| `elite` | 血條浮在該小陀螺正上方（`EliteHpBar`） | 跟隨該敵人座標；短小血條 |
| `normal` | **不顯示血條** | 不渲染任何血條 |
- **雜怪死亡表達（定案）**：直接**碎裂消失**——無血條、無倒地過場，致死當下播碎裂粒子 + fade out 後移除。boss/elite 可另做較隆重的死亡演出。
- 我方命/魔一律看左下雙球，**陀螺上不另掛我方血條**（避免資訊重複）。

### 3.5 需從戰鬥畫面移除的現有元素
- `.workbench-panel` 全系列、`.panel-tabs`、`inventory-grid`、`drive-grid`、`socket-detail-panel`、`talent-*`、`forge-*`、`circuit-*` → 移到 Phase 3 養成畫面。
- `.telemetry-grid`、`run-review-strip`、`run-objective-rail`（爬塔軌）、`collision-debug`、`arena-tuning-panel` → 移出戰鬥畫面（爬塔軌相關併入地圖畫面；debug/tuning 收進開發者選項或移除）。
- `arena-hud-grid` 的數值表 → 由 `OrbHud` + boss/elite 血條取代。
- **流派狀態面板 → 不做**（見 §6 非目標）。

### 3.6 Phase 1 驗收標準
- [ ] 中央圓形競技場實際佔畫面 ≥ 2/3，且保持正圓。
- [ ] 左下角出現雙球 HUD，命球=大、魔球=小且覆蓋在命球右上，兩球液面隨值升降。
- [ ] 手動把 flux 代理值調到低 → 雙球接觸處出現紅色預警。
- [ ] 遭遇 boss 時頂部出現橫幅血條；非 boss 時無此條。
- [ ] elite 敵人頭上有血條並跟隨移動；normal 敵人無血條。
- [ ] normal 敵人死亡 = 碎裂消失，無血條殘留。
- [ ] 戰鬥畫面上不再出現工作台/背包/天賦/遙測/流派任何面板。
- [ ] 提供「地圖」「養成」入口可切換畫面。
- [ ] `npm test` 綠燈、`npm build` 通過。

---

## 4. Phase 2 — 地圖 / 刷圖畫面（MapScreen，POE2 鑰匙系統）

### 4.1 目標
POE2 式刷圖：地圖有階級，高階地圖上鎖、需插「鑰匙」才能進；鑰匙是掉落物，有稀有度與詞綴（更難更肥）；**王域需專屬王鑰**。

### 4.2 對接 repo 現成資產
- `data/arenaKeyAffixes.ts`（鑰匙詞綴）、`engine/arenaKeys.ts`（鑰匙生成 + 合法檢查 `isArenaKey*`）、`data/bossGates.ts`（王域門檻）、`data/areas.ts`（地圖基底）、`data/circuitAtlasNodes.ts`（若要做圖集節點）。
- **這套資料骨架已存在，Phase 2 主要是把它「顯示 + 可操作」，非從零設計。**

### 4.3 元件清單
| 元件 | props / 資料來源 | 備註 |
|---|---|---|
| `MapGrid` | 可玩地圖清單（`areas` + 解鎖狀態） | 格狀列表（線框 B） |
| `MapTile` | `tier`、`state: "open"\|"locked"\|"boss"` | locked 顯示 🔒 與需求 |
| `KeyDevice` | 選中的鑰匙、其詞綴（`arenaKeyAffixes`）、`onGo` | 插鑰匙 → 顯示詞綴 → 出發 |
| `KeyInventory` | 玩家持有鑰匙（普通/稀有/王鑰計數） | 鑰匙是 inventory 物品之一 |
| `KeyCraftPanel` | 素材 → 合成/升階鑰匙 | 見 §4.4 |

### 4.4 鑰匙合成規則（定案）
- **一般鑰匙：可合成 / 可升階**（用素材做出或提升鑰匙階級與詞綴）。
- **高難 BOSS 鑰匙（王鑰）：只能靠掉落，不可合成。** 合成面板要把王鑰排除在可產出清單外，維持王戰稀缺性與分量。

### 4.5 Phase 2 驗收標準
- [ ] 地圖以格狀顯示，低階 open、高階 locked（標示需鑰匙）、王域標示需王鑰。
- [ ] 選鑰匙插入 KeyDevice → 顯示該鑰匙的詞綴（讀 `arenaKeyAffixes`）→「出發」進入該地圖戰鬥。
- [ ] 沒有對應鑰匙時，高階/王域地圖無法進入。
- [ ] 合成面板可產出/升階一般鑰匙；**王鑰不出現在可合成清單**。
- [ ] KeyInventory 正確反映持有數量。
- [ ] `npm test` / `npm build` 通過。

---

## 5. Phase 3 — 養成 / 工作台畫面（WorkbenchScreen）

### 5.1 目標
把原本擠在戰鬥畫面的密集養成介面，搬到獨立全屏畫面，慢慢調。分頁：**裝備 / 技能（Drive+符文）/ 天賦 / 熔煉**。

### 5.2 內容
- **裝備頁**：七槽（`build.equipment`）+ 背包（`inventory`）+ 詞綴比較（選中一件顯示前綴/後綴、與現有比較 ↑↓）。多沿用現有 `.workbench-*` 元件，移動位置即可。
- **技能頁**：Drive（主動，1 個）+ 符文（輔助，最多 5，隨進度 2→3→5），沿用 `toggleSupport` 與符文相容檢查。
- **天賦頁**：**先留空框 / placeholder**（天賦節點尚未設計，見 §6）。放一個「開發中」佔位，保留分頁結構。
- **熔煉頁**：沿用現有 forge 相關。

### 5.3 明確要求
- **詞綴比較區不得顯示「這推進了哪個流派 / 還差幾件」** —— 只呈現客觀詞綴數值與升降，讓玩家自己判讀、自己組流派（定案，見 §6）。

### 5.4 Phase 3 驗收標準
- [ ] 養成為獨立全屏畫面，戰鬥畫面切過來才顯示。
- [ ] 裝備/技能/熔煉頁可用；天賦頁為 placeholder 佔位。
- [ ] 詞綴比較只有客觀數值，無任何流派提示文字。
- [ ] 從養成可返回戰鬥、可到地圖。
- [ ] `npm test` / `npm build` 通過。

---

## 6. 明確非目標（不要做）

- **不做「流派狀態/追蹤面板」**：不顯示任何「重擊流 6/8」「還差幾件」之類提示。流派完全交給玩家摸索——官方不定義、不教學、不追蹤。（設計者明確要求）
- **不設計天賦節點內容**：天賦頁只留框，節點與 keystone 內容之後另案設計。
- **不在戰鬥畫面放我方血條數字表**：命/魔只用左下雙球表達。
- **地圖圖集（Atlas 節點連線）非本期目標**：先做格狀列表；圖集列為之後可選升級。

---

## 7. 建議實作順序與依賴

1. **先建三個接縫 selector**：`lifeRatio` / `fluxRatio` / `fluxLow`（§1.3），現在綁代理值。之後底層能量迴圈（doc 11 §2、§3）做好，只改 selector 內部、不動 UI。
2. **加 `screen` 導覽狀態**（§2），把現有 `CombatArena` 拆成三個 Screen 元件的殼。
3. **Phase 1 戰鬥畫面**（最高優先，也是最有感的改動）。
4. **Phase 2 地圖/鑰匙**（接 repo 現成 arenaKeys 資產）。
5. **Phase 3 養成**（主要是搬移現有元件 + 天賦留框）。

> 依賴提醒：Phase 1 的雙球「真值」依賴底層雙池能量（doc 11）。若底層尚未做，先用代理值把 UI 做完，兩者可並行；底層落地後換 selector 即可。**UI 不需等底層就能開工。**

---

## 8. 給 Codex 的執行提示

- 沿用 repo 既有模式：zustand selector、`CombatArena.css` 的 class 命名、`engine/types` 型別。先讀 `CombatArena.tsx` 現有結構再拆分，不要整檔重寫，漸進搬移。
- 每個 Phase 完成後跑 `npm test`（現有 76 測試須維持綠燈）與 `npm build`。
- 視覺對照 `docs/12_ui_ux_mockup_zh.html`；數值語意對照 `docs/11_foundation_layer_design_zh.html`。
- 有設計層疑問（非實作細節）→ 回報，由設計端（Claude/設計者）裁決，不要自行發明流派/數值規則。
