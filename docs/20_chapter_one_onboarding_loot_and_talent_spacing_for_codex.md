# Codex 開工指示 — 第一章（引導教學＋掉落曲線）＋ 天賦盤節點間距修復

> 版本 2026-07-03 ｜ 執行者：Codex ｜ 規劃/品管：Claude（驗收 Fable 5）
>
> **這批目標：給遊戲一個真正的「第一章」——新手從開局到擊敗第一個 Boss 門有明確目標、逐步教學、正確的掉落節奏；同時修掉天賦盤 151 對節點互相重疊的問題，並收 docs/19 的三個尾巴。** 行號以 commit `64593cd` 為準（164 tests 綠）。
>
> 背景事實（本批規劃依據，均已程式碼實證）：全專案目前**零教學元素**（grep tutorial/onboard/hint/引導 零命中）；稀有度是線性公式（`topDropRolls.ts:79`），tier1 開局 engraved 機率即 34.29%、relic 6.67%，與 docs/05:690 的指數 soft-cap 設計意圖相悖；每圖 150–200 殺才出 Boss；第一個 rival 滿配（4 符文+6 天賦+教義）對裸裝新手；貨幣只能靠分解取得；無保底、無首殺獎勵。

## 先讀
- docs/19（上批）、docs/05 §「rareChance = baseRareChance × rarityScore^rarityExponent」（:690-699）、docs/01 §12 掉寶規格。
- AGENTS.md：schema 變更必須走 migration＋測試（本批 Task D 需要 schema v6）。

## 鐵則
1. 顯示字串走 `zh-Hant.ts`；內部 id 英文。
2. 玩法落地順序：data schema → engine tests → engine → save/migration → UI（教學系統也遵守）。
3. 修 bug 先重現加回歸測試；交付前 typecheck/test/build 全過＋真機實測。
4. 數值常數一律進 `balanceConfig`，不散落硬編碼。
5. 有設計疑問回報。

---

## Task A — 天賦盤節點間距修復（使用者回報的現行 bug，P0）

量化現況：98 節點（73 minor 82×52px／18 notable 96×60px／7 keystone 112×70px），以 1100×760px 容器換算有 **151 對重疊**（680×430px 下 414 對）。最慘案例：`talent_route_engine_mastery_b` ↔ `talent_keystone_greedy_route` 中心距 18.8px（需 ≥97px）。三個來源：`clusterOffsets` 內部最小間距 7.81% 卡臨界、14 個 cluster 錨點最近僅 9.43%（節點半徑 11% 需 ≥22%）、keystone 上批收邊(6-94%)後撞進鄰近 cluster。

### A1 世界座標系（渲染層）
天賦盤的百分比座標目前解析於「容器尺寸」——容器越窄節點越擠。改為**固定虛擬畫布**：
- `.talent-board-viewport` 改為固定世界尺寸 `1760×1200px`（常數 `TALENT_WORLD_WIDTH/HEIGHT`，放 TalentTreeView 頂部可調），節點百分比座標一律對世界尺寸解析。
- 初始縮放 = fit-to-container（世界完整可見），pan 邊界由世界尺寸與當前 scale 動態計算（順便取代 `TalentTreeView.tsx:66-67` 遺留的 ±420px 寫死值）。
- cluster 視覺分區（`clusterRegions`）同步改算世界座標。

### A2 座標重排（資料層）
以世界 1760×1200 為基準，目標最小中心距：minor-minor ≥ 90px（5.1%）、含 notable ≥ 100px、含 keystone ≥ 115px。做法：
1. `clusterOffsets`（`talentNodes.ts:329` 附近）六組偏移整體放大 1.5 倍（放大後仍會被 `pos()` 夾限保護）。
2. 最近的四對 cluster 錨點（`flux↔thermal_mass` 9.43%、`void↔iron_storm` 12.81%、`speed↔arc_velocity` 13.93%、`loot↔route_engine` 13.93%）拉開到 ≥20%，維持鏈狀分支的視覺流向（前置 cluster 指向後繼 cluster）。
3. 7 顆 keystone 逐顆重新擺位：放在其所屬 cluster 的「外側延伸」位置，與最近節點中心距 ≥115px，且維持在 6–94% 內。
4. 兩顆原始座標幾乎重合的跨 cluster 節點（`talent_impact_path (15,33)` ↔ `talent_glass_mastery_a (14,33)`）一併分開。

### A3 不重疊成為可測不變量（本項是重點，讓此 bug 絕種）
在 `topDataIntegrity.test.ts` 新增測試：窮舉全部節點對，以世界尺寸換算像素中心距，斷言 `dist ≥ (widthA + widthB) / 2 + 8px 呼吸空間`（節點寬依 kind 查表，與 CSS 常數同步——把三種尺寸抽成可 import 的常數避免測試與 CSS 漂移）。座標調到測試綠為止。

**Task A 驗收**：
- [ ] 不重疊測試存在且綠（含 8px 呼吸空間）。
- [ ] 初始視圖世界完整可見；縮放到 1.0 以上時 pan 可達所有節點（無 ±420 寫死殘留）。
- [ ] 真機目視：無任何兩節點交疊，cluster 分區底色與節點位置一致。

---

## Task B — docs/19 收尾三項

1. **地圖畫面版面補完**（docs/19 Task D 未做的部分）：
   - atlas 圖集改為左欄**填滿全高的主視覺**（現況被壓在 `clamp(220px,27vh,292px)`，`CombatArena.css:457-460`）；circuit chip 選擇與 breach rail 收成左欄頂部一條橫向摘要列。
   - 異常/勁敵/王門資訊**在 atlas 圖上的節點直接可點**（現況是右欄獨立列表 `route-clear-list`，`CombatArena.tsx:2176-2209`）——點圖上節點 → 右欄顯示該節點詳情。列表可保留為右欄的次要檢視。
   - 清場紀錄（clears，`CombatArena.tsx:2211-2224`）收進摺疊區，預設收合。
2. **補 `stat.grip`「抓地」詞條**（zh-Hant，docs/18/19 兩批都漏，Boss 門 grip 失敗仍印英文）。
3. **本批做完後同步 docs/12**（測試數、本批條目）。

**Task B 驗收**：
- [ ] 地圖畫面 atlas 全高、圖上節點可點出右欄詳情、clears 預設收合。
- [ ] Boss 門 grip 失敗顯示「抓地」（grep zh-Hant 有 `stat.grip`）。

---

## Task C — 第一章掉落曲線與節奏修正（engine 層）

第一章定義（新增 `src/game/data/chapters.ts`）：
```ts
export const chapters = [{
  id: "chapter_cinder",
  displayNameKey: "chapter.cinder.name",        // 「第一章：燼火試煉」
  nodeIds: ["network_cinder_gate", "network_glass_branch", "network_rim_fortress", "network_brass_judicator"],
  rivalIds: ["rival_rim_warden"],
  bossGateId: "boss_gate_brass_judicator",
}];
```
進度 = 已清節點+rival+boss 門 / 總數，供 UI 顯示（Task D5）。

### C1 稀有度曲線指數化（落實 docs/05 的 soft-cap 設計）
替換 `topDropRolls.ts:79-80` 的線性公式為「分層基礎權重 × 指數壓制加成」：
1. `balanceConfig.drops.rarityWeightsByTier`（新表，權重合計 100，可調）：

| tier | common | tuned | engraved | relic |
|---|---|---|---|---|
| 1 | 70 | 25 | 4.7 | 0.3 |
| 2 | 58 | 31 | 9.7 | 1.3 |
| 3 | 46 | 34 | 16 | 4 |
| 4 | 38 | 34 | 21 | 7 |
| 5 | 30 | 33 | 26 | 11 |

2. 玩家 rarity 加成（partRarity＋rewardRarity＋anomaly）以指數 soft-cap 作用於稀有尾端：`rareScale = (1 + rarityScore) ^ balanceConfig.drops.rarityExponent`（初值 **0.7**），乘在 engraved 與 relic 權重上後重新歸一化。效果：堆 rarity 有感但報酬遞減，白圖不會下傳奇雨。
3. 引擎測試：tier1 無加成時抽樣 10000 次，分佈落在權重 ±2%；rarityScore=1 時 engraved+relic 佔比提升但 < 線性版的值（斷言 soft-cap 生效）。

### C2 隱形保底（pity）
`rollDropOutcome` 掛兩個計數器（存在 runtime state，隨每張圖重置即可，不進存檔）：
- 連續 **12** 次擊殺未獲 tuned 以上 → 下一次掉落保底 tuned。
- 連續 **50** 次擊殺未獲 engraved 以上 → 下一次掉落保底 engraved。
- 自然掉出對應稀有度即重置計數。常數進 `balanceConfig.drops.pity`。測試：以固定 rng 種子強制低 roll，斷言保底觸發。

### C3 首殺獎勵（第一章的煙火）
首次進入 `clearedRivalIds` / `clearedBossGateIds` 時（`accountReducer` 判斷「本次結算前不在清單內」）：
- rival 首殺：其 `uniqueDropBaseIds` 保證掉落一件（稀有度保底 engraved）＋ **echo ×1**（解決 echo 在新曲線下開局不可得、`remove` 鍛造摸不到的問題）。
- boss 門首通：保證 engraved 一件 ＋ glass ×5 ＋ echo ×1。
- 常數進 `balanceConfig.drops.firstClear`。測試：首殺有獎勵、二殺無。

### C4 擊殺目標分層（拆掉 300-500 殺的新手斷崖）
`mapKillTarget` 由固定 150-200（`arenaRuntime.ts:52-53`）改為 `balanceConfig.progression.mapKillTargetByTier`：
| tier | min–max |
|---|---|
| 1 | 60–80 |
| 2 | 90–120 |
| 3 | 120–160 |
| 4+ | 150–200 |

### C5 第一個 rival 降配（教學考試，不是牆）
`rival_rim_warden`（`namedRivals.ts:67-80`）從 4 符文+6 天賦+教義降為 **2 符文+3 天賦+無教義**（保留其機制 mechanicId 不動——威脅感來自機制，不是數值牆）。其後的 rival 維持現配置形成難度階梯。

### C6 通關貨幣（給經濟第二條腿）
擊殺地圖 Boss（完圖）時發放 `ash 10×tier、glass 2×tier`（`balanceConfig.progression.mapClearReward`）。擊殺一般怪**不**掉貨幣，維持「刷怪拿裝、完圖拿錢、分解補差」的分工。測試：完圖入帳。

### C7 槽位權重平衡
`dropLabelOptions`（`topDropRolls.ts:8-29`）各槽位權重合計目前不均（launcher 1.7 vs attackRing 2.52），全部歸一到每槽合計 2.0±0.1（保留槽內各 label 的相對比例）。資料完整性測試斷言各槽合計在容差內。

**Task C 驗收**：
- [ ] C1-C7 各自的引擎測試綠；balanceSoak 重跑通過。
- [ ] 模擬驗證（寫一次性 soak 斷言或手玩）：tier1 前 60 殺期望 engraved ≤ 2 件、relic 0 件（除首殺獎勵）；首殺 rival 必得專屬掉落＋echo。

---

## Task D — 教學引導系統（UI 層，依賴 C 的節奏定案）

原則：**情境觸發的小卡片，不是開場說明書牆**。每步在對的時機出現、說一件事、可跳過。

### D1 資料層：`src/game/data/tutorialSteps.ts`
```ts
export type TutorialStepDef = {
  id: string;
  titleKey: string; bodyKey: string;          // 走 zh-Hant 字串表
  anchor?: string;                            // 對應 UI data-tutorial-anchor 屬性，高亮該元素
  trigger: TutorialTrigger;                   // 見 D3 觸發表
};
```

### D2 存檔層：schema **v6**
`top` 新增 `seenTutorialIds: string[]`。v1–v5 migration 全部補空陣列＋sanitize 過濾非法 id（照 clearedRivalIds 的既有模式，`migrations.ts:74,246-269`）。遷移測試：v5→v6 補空陣列、保留既有值、過濾非法 id 三情境。

### D3 十二個教學步驟（觸發條件都是現有可觀測狀態，逐條實作）

| id | 觸發 | 內容要點（文案 Codex 擬繁中初稿，回報後統一） | anchor |
|---|---|---|---|
| tut_welcome | 首次載入且 seenTutorialIds 空 | 第一章目標：擊敗黃銅審判官；先按「開始」看一場 | Start 鈕 |
| tut_first_drop | 首次 `drops.length > 0` | 掉落與稀有度顏色（白→藍→黃→橙） | 掉落 toast |
| tut_first_equip | 首次 `selectedPartVerdict.action === "equip"` | 右欄比較：綠升紅降、門檻跨越提示 | 檢視器欄 |
| tut_first_talent | 首次可用天賦點 ≥1 | 每 5 殺 1 點；點擊節點配點；基石有代價 | talents 分頁 tab |
| tut_first_forge | 首次錢包足以 upgrade 且有選中零件 | 鍛造五動作，先試強化 | forge 分頁 tab |
| tut_first_rune | 首次獲得符文掉落 | 符文=乘法加成，注意 tag 需求 | skills 分頁 tab |
| tut_doctrine | 首次進 talents 且 doctrineId 為 null | 教義=玩法路線，選一個 | 教義橫條 |
| tut_map_unlock | 首次解鎖第二個 circuit 節點 | 地圖網絡：節點→條件→獎勵 | 地圖 screen tab |
| tut_rival_gate | 首次選中帶 requiredRivalId 的節點 | 宿敵有獨特機制；建議先配天賦/換裝再挑戰 | 右欄詳情 |
| tut_first_key | 首次獲得 arena key | 鑰匙=風險與報酬，詞綴會改變戰局 | 鑰匙區 |
| tut_first_anomaly | 首次選中帶 anomalyId 的節點 | 異常=規則挑戰＋更好報酬（沿用 docs/18 的規則文案） | 異常標記 |
| tut_boss_gate | 首次看到 boss gate 面板 | 六項數值需求怎麼讀；秒傷/追蹤從裝備天賦來 | boss 門面板 |

### D4 UI 元件
- `TutorialCard`：右下角小卡（標題＋兩三行說明＋「知道了」/「不再顯示教學」），出現時 anchor 元素加高亮描邊（`data-tutorial-anchor` 屬性定位，CSS outline，不擋點擊）。同一時間最多一張，佇列依觸發順序。
- 設定區加「重看教學」按鈕：清空 `seenTutorialIds`。
- 全部文案進 zh-Hant 字串表。

### D5 第一章進度指示
地圖畫面頂部顯示「第一章：燼火試煉 N/6」（4 節點+1 宿敵+1 Boss 門），讀 `chapters.ts` 與 cleared 集合。完成 6/6 時顯示完章祝賀卡（保留章節結構，第二章 nodeIds 之後再填）。

**Task D 驗收**：
- [ ] schema v6 遷移測試三情境綠；舊存檔升級不炸。
- [ ] 12 步驟逐一觸發驗證（新存檔真機走一輪，每步出現一次、確認後不再出）。
- [ ] 「重看教學」可重置；教學卡不擋操作、可跳過。
- [ ] 地圖顯示第一章進度，完章有祝賀。

---

## 並行 / 序列
- `A`（天賦間距）與 `B`（docs/19 收尾）互不相干，先行並行。
- `C`（engine 掉落/節奏）先於 `D`（教學引用 C 的節奏與獎勵事件）。
- 建議順序：`(A ∥ B) → C → D`。C 的七個子項各自獨立可逐一提交。

## 完工驗收：刪存檔從零真機玩一輪第一章
1. 開局看到歡迎卡與章節目標；照教學指引走完前三步（開戰→撿裝→換裝）不需要猜。
2. tier1 前 60 殺以白藍裝為主，黃裝 ≤2 件、無傳奇；保底讓最長乾旱不超過 12 殺。
3. 60-80 殺出 Boss、完圖拿到貨幣；解鎖第二節點時地圖教學出現。
4. 首殺 rim_warden（降配後可在合理配置下取勝）拿到專屬掉落＋echo，首通 boss 門有獎勵包。
5. 天賦盤縮放平移下無任何節點重疊；不重疊測試綠。
6. 地圖畫面 atlas 全高、節點圖上可點；章節進度 N/6 正確累計。

## 下批候選（本批不做，先掛號）
- 第二章內容（circuitNetwork 後半段成章、第二個 boss gate 設計）。
- items/hour 掉落效率遙測面板（docs/01 §12）。
- smart loot 微偏向（依最弱槽位加權 10-15%）。
- 戰鬥畫面瘦身（docs/13 Phase 1 剩餘）。
- 離線結算單調時鐘（schema v7 順路做）。

## 佔位/風格備註
- 本批新常數全進 balanceConfig：rarityWeightsByTier、rarityExponent 0.7、pity {tuned:12, engraved:50}、firstClear 獎勵、mapKillTargetByTier、mapClearReward。
- 教學文案語氣：短句、直接、不賣萌；每卡 ≤3 行。
- 對照表新增：chapter「章」、pity 不外顯（不要在 UI 提「保底」二字，維持隱形）。
