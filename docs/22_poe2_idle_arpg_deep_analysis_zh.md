# 戰鬥陀螺版 POE2 網頁放置 ARPG 深度解析

日期：2026-07-04  
狀態：Implementation Pass A-C + QA

## 目標定位

本專案不應只做「有 POE 數值的陀螺戰鬥」，而是要形成一個可長期掛機、可主動推進、可反覆調整 build 的網頁放置 ARPG：

```text
Build 選擇
-> 戰鬥陀螺實戰
-> 掉落與鍛造
-> 路線 / 鑰匙 / 異象選擇
-> Atlas / 天賦 / Doctrine 長線配置
-> 更高風險與更高收益
```

POE2 方向值得借鏡的不是單一技能或職業，而是終局地圖的「可預期目標、可切換專精、跑圖前策略、長線可追求內容」。官方 0.5.0 endgame 更新強調固定 Atlas 目標、Atlas Tree 擴張、地圖古代詞綴、Masters of the Atlas、以及 league mechanic 專屬進度。轉成本站版本，就是每條 Circuit Network 路線都必須回答三個問題：

- 這條線現在打不打得動？
- 這條線值不值得掛？
- 打這條線會推進哪個長期目標？

## 目前已落地

- 3 個 Top Frame 對應 class archetype。
- 6 個 Drive Core 對應 Skill Gem。
- 15 個 Tuning Rune 對應 Support Gem。
- 7 個 Top Part slot、prefix / suffix / group / tier / rarity / provenance。
- Forge actions：升稀有、重骰詞綴、重骰數值、新增、移除。
- Arena Key 對應 Waystone / Map item，已有 affix 與 reward/risk summary。
- Circuit Network 對應 Atlas，已有 fog、rival、boss gate、anomaly。
- Circuit Atlas 對應 Atlas Passive，已有 reward / density / boss / defense 分支。
- 離線收益與 save migration 已存在。

## 核心差距

### 1. Endgame 策略尚未成形

目前系統資料很多，但玩家在地圖上仍偏向「看哪個按鈕亮就按哪個」。POE2-like endgame 需要在跑圖前就呈現策略：安全刷、推進、Boss、異象、離線掛、鑰匙消耗。

本次已補上第一步：`selectRouteStrategyProjection` 將選定節點轉成 risk / reward / idle / clear speed 與建議行動。

### 2. 放置版需要「離線目的地」而不是只結算時間

離線收益已存在，但下一步應把離線目的地做成正式 loop：

- 最近 8 小時掛在哪條 Network node。
- 該 node 的風險、收益、掉落偏向、是否阻擋 unique/rival drop。
- 離線報告回來後直接給「繼續掛 / 改跑推進線 / 回工坊鍛造」。

### 3. Itemization 有骨架，但缺少 chase layer

現有 affix 合法性與 crafting 很好，但還沒有足夠長線追逐：

- base type identity 還可以更強。
- relic / unique effect 可以綁路線、名宿、Boss。
- craft media 可以從「灰燼 / 玻璃 / 迴響」擴成 league mechanic material。
- 需要 item filter / salvage rule，否則放置版掉落會很快變成整理負擔。

### 4. Build readable，但 build identity 還不夠尖

Drive / Rune 已有 tag 與 behavior，但玩家還不容易形成「我正在玩某一派」：

- Shard Barrage：投射、暴擊、清圖。
- Ember Scour / Molten Groove：地面火痕、持續、控場。
- Storm Lattice / Chain Tempest：連鎖、觸發、過載。
- Heavy collision：重撞、出界壓力、名宿決鬥。

下一步需要 build archetype score，讓 UI 能說「這是高速投射刷圖配置」而不是只列數值。

## 優化原則

1. 先做策略可讀性，再加資料量。
2. 每個新系統都要同時支援主動遊玩與離線收益。
3. Route / Key / Atlas / Forge 要形成閉環，不做孤立按鈕。
4. 難度上升必須伴隨清楚 reward bias。
5. UI 只呈現 engine selector 結果，不把核心判斷硬寫在 React。

## 接下來四批更新

### A. Route Strategy 與離線掛機核心化

- 將路線策略卡擴展到完整 Route list。
- 離線目的地顯示 expected kills / expected drops / overflow salvage。
- 離線報告提供下一步 CTA。
- Route node 加 reward target：parts、forge media、key sustain、rival unique、boss fragment。

### B. Build Archetype 與技能連結可讀性

- 新增 `selectBuildArchetypeProjection`。
- 分數：collision、projectile、trail/dot、chain、bossing、idle safety。
- Skills panel 顯示目前 build identity 與缺口。
- Rune catalog 加「推薦插入」排序。

### C. Loot Filter / Auto Salvage

- Save schema 新增 loot policy。
- 規則：低於 rarity、非目標 slot、非目標 tag、低 itemLevel 自動拆。
- Inventory 顯示「保留原因」。
- 離線結算套用同一套 policy，減少整理負擔。

### D. Endgame Masters / Doctrine 進階化

- Doctrine 從單選 passive strip 進化成 3 個 endgame master。
- 每個 master 12 nodes，只能啟用 4 個，可隨路線切換。
- 對應 POE2 Masters of the Atlas，但改成陀螺世界觀：
  - 製圖者：Key sustain / route reward。
  - 鍛爐師：craft media / affix control。
  - 名宿獵人：rival / boss / unique chase。

## 本次實作決策

本次先做 `Route Strategy Projection`，原因：

- 不動 save schema，風險低。
- 直接強化 Map/Route 的決策層。
- 可被離線收益、Route list、Next Action、QA 站持續重用。
- 符合 POE2 終局「跑圖前先選策略」的方向，也符合網頁放置版「掛哪裡」的核心需求。

## 2026-07-04 更新落點

已開始落地 A 批次：

- Route list 每一行顯示策略建議、預估每小時擊殺、預估每小時掉落。
- Route detail 的策略卡補上離線收益預估與 overflow salvage 預估。
- Route node 顯示 reward target：零件、鍛材、鑰匙、名宿裝、Boss、星圖。
- 掉落機率抽成 engine helper，避免 UI projection 與實際掉落公式分歧。
- 離線報告補上 CTA：繼續掛目前路線、改掛推薦線、查看推薦推進線、回工坊處理掉落。

下一個小步建議是進入 B 批次：新增 build archetype projection，讓玩家知道目前是清圖、名宿決鬥、火痕持續、連鎖觸發或安全掛機配置。

### B 批次已落地

- 新增 `selectBuildArchetypeProjection`，根據 Drive tag、Rune behavior、DPS 分佈與路線安全度推導 build identity。
- Skills panel 顯示主流派、前四個 archetype 分數，以及目前缺口。
- 目前分類：高速投射清圖、火痕持續控場、連鎖觸發、重撞決鬥、Boss 爆發、安全掛機。
- Rune catalog 依目前 build identity 重新排序，讓適合當前流派的符文排在前面。

下一步可進 C2 批次：新增正式 loot policy 與 save migration，讓 inventory 建議變成可配置的自動拆解規則。

### C 批次已落地（不動 save schema 版）

- Inventory cell 顯示保留理由：已裝備、已鎖定、裝備升級、鍛造候選、高稀有保留、拆解候選。
- Part detail 額外顯示 retention card，讓玩家知道為什麼要留或可以拆。
- 目前先不新增 save schema；正式 auto salvage policy 要等 UI 理由與玩家預期穩定後再落地。

## 本輪完成範圍與驗證

已完成：

- A 批次：Route Strategy、Route list、離線收益預估、reward target、離線報告 CTA。
- B 批次：Build archetype projection、Skills panel build identity、Rune catalog 推薦排序。
- C 批次第一階段：Inventory 保留理由與 part detail retention card。

已驗證：

- `pnpm typecheck`
- `pnpm test`：22 個測試檔、181 個測試。
- `pnpm build`
- Browser QA：首頁載入、Start / Pause / Reset、Route Forge Key / Run Key、Forge 操作、工坊各 tab、console error、390px mobile horizontal overflow。

## 下一批未實施計畫

### C2. 正式 Loot Policy / Auto Salvage

- 新增 save schema 與 migration，保存玩家的 loot policy。
- 將目前的「保留理由」轉為可配置規則：rarity、slot、tag、item level、score threshold。
- 離線結算與即時掉落共用同一套 policy。
- 增加 policy preview：預估每小時保留、拆解與材料回收。

### D. Endgame Masters / Doctrine 進階化

- 將 Doctrine 從單選條擴成 3 個 endgame master。
- 每個 master 提供 12 nodes，只能啟用 4 個，形成長線取捨。
- Master 類型先落三個：
  - 製圖者：Key sustain、route reward、星圖展開。
  - 鍛爐師：craft media、affix control、鍛造風險回收。
  - 名宿獵人：rival、boss、unique chase。
- 實作順序固定走 system contract -> data schema -> engine tests -> engine implementation -> save/migration -> UI connection -> browser playtest。
