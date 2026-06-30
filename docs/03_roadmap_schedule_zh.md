# Echo Forge 開發時程表

日期：2026-06-30  
狀態：Draft v0.1  
起算日：2026-06-30

## 1. 排程假設

- 以單一主要開發者節奏估算。
- 每週約 4 到 5 個有效開發日。
- 每個里程碑都包含 implementation、test、browser QA、文件更新。
- 美術資產先用 CSS、Lucide icons 與 placeholder，正式原創圖示另排。
- 若加入真實後端、帳號或 2D/3D 戰鬥場景，時程需重新估算。
- 可玩成品完成線以 [04 可玩成品總規劃](./04_playable_product_plan_zh.md) 為準。

## 2. 當前狀態

截至 2026-06-30，已完成：

- Vite + React + TypeScript 專案骨架。
- 第一版 engine modules。
- 三職業、六技能、十二輔助、六區域資料。
- combat / defense / loot / offline simulation。
- account-shaped Zod save schema。
- prototype dashboard。
- item instance generation。
- rarity、prefix/suffix、affix tier rolling。
- prototype inventory/equipment 資料流。
- equip compare deltas。
- farming tick 與 retained inventory。
- item lock / salvage。
- inventory capacity overflow auto-salvage。
- ash / glass / echo starter currency wallet。
- 8 個 test files，17 個 tests。
- production build 通過。
- desktop 與 390px mobile smoke test 通過。

尚未完成：

- crafting actions。
- save persistence for inventory/equipment/currencies。
- save persistence UI。
- loot filter / sort rules。
- boss gate 解鎖流程。
- passive graph。
- 完整 Alpha QA。

## 3. 里程碑總覽

| Milestone | 時間 | 目標 | 狀態 |
| --- | --- | --- | --- |
| M0 Foundation | 2026-06-30 到 2026-07-02 | 可跑原型、engine slice、正式規格與架構文件 | In progress |
| M1 Loot Loop | 2026-07-03 到 2026-07-10 | 物品生成、背包、裝備比較、分解與貨幣 | In progress |
| M2 Craft And Save | 2026-07-11 到 2026-07-18 | 打造台、本地存檔、匯出匯入、離線結算 | Planned |
| M3 Progression | 2026-07-19 到 2026-07-26 | 區域解鎖、Boss gate、角色成長、第一版被動節點 | Planned |
| M4 Playable Alpha | 2026-07-27 到 2026-08-04 | 30 到 60 分鐘可玩循環、平衡調整、QA | Planned |
| M5 Account Prep | 2026-08-05 到 2026-08-14 | 帳號頁 placeholder、save migration、cloud-ready adapter | Planned |

## 4. M0 Foundation

時間：2026-06-30 到 2026-07-02

目標：

- 建立專案骨架。
- 建立 engine-first 邊界。
- 建立第一版可跑 dashboard。
- 補完整開發規格、架構、時程。

交付物：

- `package.json`
- `src/game/engine`
- `src/game/data`
- `src/game/save`
- `src/app`
- `docs/01_development_spec_zh.md`
- `docs/02_architecture_zh.md`
- `docs/03_roadmap_schedule_zh.md`

驗收：

- `pnpm test` 通過。
- `pnpm build` 通過。
- dev server 可開。
- README 有文件入口。
- docs 足以支撐下一階段開發。

## 5. M1 Loot Loop

時間：2026-07-03 到 2026-07-10

目標：

- 從 EV 掉寶模型推進到真實 item instance。
- 讓玩家可以看到背包、裝備、比較與分解。

工作項目：

- 新增 `itemGeneration.ts`。
- 新增 `inventory.ts`。
- 新增 `itemScoring.ts`。
- 實作 `ItemInstance`、`RolledAffix`、`ItemRarity`。
- 實作 affix eligibility。
- 實作 prefix/suffix count。
- 實作 weighted affix rolling。
- 實作 item value rolls。
- 建立 EquipmentSlots UI。
- 建立 InventoryList UI。
- 建立 ItemCard UI。
- 建立 ComparePanel UI。
- 掉寶 feed 接真實生成結果。

驗收：

- 每次 farming tick 可以產生 item 或 material bundle。
- 物品有 base、rarity、item level、affixes、seed provenance。
- 裝備後 simulation 更新。
- Compare panel 顯示 DPS/EHP/loot EV delta。
- 鎖定物品不可 salvage。
- 背包滿時會自動分解未保護的低價物品。
- 分解與 farming tick 會累積基礎材料。
- item generation 有 deterministic tests。

風險：

- 詞綴資料太少會讓掉寶重複感重。
- 背包 UI 容易過密。
- item scoring 若太粗，裝備比較會誤導玩家。

## 6. M2 Craft And Save

時間：2026-07-11 到 2026-07-18

目標：

- 補第一版打造台。
- 讓玩家進度可以保存、匯出、匯入。
- 離線回歸可以結算。

工作項目：

- 新增 `crafting.ts` engine。
- 新增 crafting currency data。
- 實作 upgrade rarity。
- 實作 reroll all affixes。
- 實作 reroll numeric values。
- 實作 add random prefix/suffix。
- 實作 remove random modifier。
- 實作 salvage to materials。
- 補 `AccountSave` inventory/equipment/currencies。
- 補 save migrations。
- 補 localStorage/IndexedDB adapter。
- 新增 export/import UI。
- 實作 offline settlement from lastSavedAt。

驗收：

- 重整頁面不丟進度。
- 匯出字串可匯入還原。
- 打造消耗材料並產生合法物品。
- 離線收益套用 offline cap。
- save schema 變更有 migration test。

風險：

- IndexedDB adapter 需要錯誤復原。
- save migration 若拖延，後續資料會很難改。
- 打造動作若太隨機，玩家早期可能感覺失控。

## 7. M3 Progression

時間：2026-07-19 到 2026-07-26

目標：

- 讓區域推進形成目標。
- 加入第一個 Boss gate。
- 補小型被動節點圖或節點列表。

工作項目：

- 新增 `progression.ts`。
- 新增 unlock requirements。
- 新增 XP curve。
- 新增 character level-up。
- 新增 first boss gate。
- 新增 boss attempt result。
- 新增 missing-layer feedback。
- 新增 passive node data。
- 新增 passive allocation engine。
- 新增 Passive UI 第一版。

驗收：

- 玩家不能直接跳最高區。
- Boss 失敗會顯示缺 DPS/EHP/accuracy/resistance/recovery。
- 升級會提供可感知成長。
- 被動節點改變 simulation。
- 30 分鐘內至少解鎖 2 到 3 個區域。

風險：

- progression curve 容易卡或太快。
- Boss gate feedback 若不清楚，玩家不知道怎麼改 build。

## 8. M4 Playable Alpha

時間：2026-07-27 到 2026-08-04

目標：

- 達到 30 到 60 分鐘可玩的 alpha。
- 重點是完整循環與清楚成長，不是內容量。

工作項目：

- 平衡第一版區域曲線。
- 調整 drop rate。
- 補 loot filter 第一版。
- 補 material economy。
- 補 UI polish。
- 補 mobile drawer/panel。
- 補 keyboard navigation basics。
- 補 debug panel。
- 補 browser QA checklist。

驗收：

- 新角色 5 到 8 分鐘內拿到第一件 rare-like item。
- 10 到 15 分鐘內有第一個 build-defining choice。
- 30 到 60 分鐘內完成第一輪 Boss gate。
- mobile 390px 不爆版。
- 長詞綴不遮擋。
- 長時間 loot feed 不明顯卡頓。

風險：

- UI 資訊密度過高。
- 掉寶太多造成決策疲勞。
- 手機版裝備比較容易擠。

## 9. M5 Account Prep

時間：2026-08-05 到 2026-08-14

目標：

- 不做真實登入，但完成後端化準備。
- 讓之後接 Supabase 或 custom backend 時不需要重寫 save model。

工作項目：

- Account page placeholder。
- Character roster UI。
- Save conflict model 草案。
- Cloud adapter interface。
- Server settlement API interface 草案。
- Balance versioning。
- 高價值 item generation server ownership 設計。
- migration audit。

驗收：

- 本地 save 可映射到 account/roster/stash/currencies。
- adapter interface 不依賴 Supabase/Firebase 特定 SDK。
- 文件描述雲端同步與衝突處理。
- 所有 save tests 通過。

風險：

- 太早綁定特定 backend 會降低彈性。
- 如果 item generation 沒有 provenance，未來反作弊會困難。

## 10. 每週節奏

每週固定節奏：

1. 明確本週 milestone。
2. 更新 docs 和 acceptance criteria。
3. 寫 engine tests。
4. 實作 engine。
5. 接 UI。
6. 跑 `pnpm test`。
7. 跑 `pnpm build`。
8. 做 desktop/mobile browser QA。
9. 更新 README 或 changelog。

## 11. 近期任務清單

優先順序：

1. 把 inventory/equipment/currencies 寫入 account-shaped save schema。
2. 補 save migration 與 import/export UI。
3. 建立 loot filter / sort 第一版。
4. 新增 crafting actions。
5. 建立中央戰鬥視覺窗第一版，讓主畫面更像遊戲而非純工具。
6. 拆分 Inventory / Equipment / Compare UI components。
7. 補 browser QA checklist 與 mobile drawer flow。

## 12. 版本節點

建議標記：

- `v0.1.0-foundation`：目前 engine/dashboard/docs。
- `v0.2.0-loot-loop`：物品生成與背包。
- `v0.3.0-craft-save`：打造與存檔。
- `v0.4.0-progression`：區域與 Boss gate。
- `v0.5.0-alpha`：30 到 60 分鐘可玩 alpha。

## 13. 停止擴張規則

如果遇到以下情況，先停止新增內容，回頭補底層：

- 新功能需要把規則寫在 React component。
- 新資料需要手動改多個 UI hardcode。
- 新增物品後 build comparison 不可信。
- save schema 無法描述新增狀態。
- 測試需要大量 mock UI 才能驗證公式。
- 390px mobile 開始不可用。

## 14. 可延後清單

這些不進 MVP 1：

- 真登入。
- 雲端同步。
- 交易市場。
- 大型被動樹。
- 大量 unique/relic 手工物品。
- minion AI。
- ailment stack 深度規則。
- endgame map atlas。
- season system。
- leaderboard。
