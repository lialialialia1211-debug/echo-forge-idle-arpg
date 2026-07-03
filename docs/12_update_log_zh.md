# 更新紀錄

日期：2026-07-03
狀態：Phase 1 到 Phase 4 已完成並準備發布到 QA 站
QA 連結：https://lialialialia1211-debug.github.io/echo-forge-idle-arpg/

## 2026-07-03 UX 修正與 Anomaly 2.0

- Damage breakdown 改用 `resolveTopHit` / `projectTopCombat` 的真實投射數值，面板顯示碰撞、驅動、持續傷害與總 DPS。
- Breakpoint 面板會標示 penalty 門檻；Boss gate、Phaser label、resource orb 與 canvas aria 補齊繁中顯示。
- Heavy collision 改為完整結構傷害但只造成 35% spin energy bleed；rival projectile reflect 改為真正反射玩家 projectile hit 的 30%。
- 離線結算會偵測未來 `lastSettledAt`，歸零收益並重設結算時間，避免調時造成錯誤收益或 crash。
- Arena anomaly 擴充到 8 個，新增 `playerRule`：`noFluxSustain`、`shrinkingArena`、`heavyResonance`，並加入 tier 4/5 終局 arena 與 network 節點。
- Save schema 維持 v5；本輪未新增破壞性存檔欄位。
- `pnpm test`：通過，20 個 test files / 160 tests。

## 2026-07-03 Phase 1-4 實作

本次更新把 `docs/codex-implementation-plan.md` 中 Phase 1 到 Phase 4 的核心落地到可玩版本，重點是把 UI hardcode 的帳號流程、掉落、鍛造、路線與進階規則移回 engine/data/save 邊界，讓後續平衡與 QA 能依照資料驗證與引擎測試推進。

## 主要變更

- 新增 account reducer 與 account state adapter，集中處理裝備、鎖定、分解、鍛造、符文、天賦、Atlas、鑰匙、掉落與擊殺累積。
- 新增離線結算、掉落 roll helper、idle automation 與 balance soak，讓 idle ARPG 迴圈可用測試驗證。
- 擴充 Top Part、Damage、Runtime schema，加入 hit flags、drive scaling、DoT/ailment、launcher profile、duel mode、anomaly、circuit network 與 doctrine。
- 擴充天賦到 64 nodes，補上 doctrine data、arena anomaly data、circuit network data。
- Save schema 升到 v5，加入 doctrineId、clearedRivalIds、part revision、migration sanitize 與 corrupt save backup，避免壞存檔造成 app crash。
- Forge action 改為 engine cost/validation，鍛造後維持穩定 part id 並使用 revision 表示變更。
- CombatArena 串接 account reducer、offline report、doctrine selection、boss duel、route anomaly/circuit network 與新的 Forge/Route 流程。
- 移除未使用的 `src/game/ui/store.ts` 與 `zustand` dependency。

## 驗證紀錄

- `pnpm typecheck`：通過。
- `pnpm test`：通過，20 個 test files / 160 tests。
- `pnpm build`：通過。
- Browser QA：通過。
  - 首頁載入後沒有 ErrorBoundary。
  - Start 後戰鬥進入 Live，Clear / Kills / canvas 狀態有變化。
  - Start / Pause / Reset 可用。
  - Loadout / Inventory / Skills / Forge / Route / Talents tabs 可切換。
  - Forge 實際執行 Reroll，資源正確扣除。
  - Route 實際執行 Run Key，Keys 正確消耗且無 crash。
  - Browser console 沒有 error 或 unhandled exception。
  - 390px mobile viewport 無水平溢出。

## QA 發布

QA 站使用 GitHub Pages workflow `Deploy QA Site`。本次變更 push 到 `main` 後會自動執行 typecheck、test、`pnpm build:pages` 並發布到：

https://lialialialia1211-debug.github.io/echo-forge-idle-arpg/

## 2026-07-03 第一章節奏與教學同步

- 新增第一章資料 `chapters.ts`：4 個 network 節點 + 1 個 Rim Warden + 1 個 Boss Gate，Map 顯示 N/6 進度。
- 掉落曲線改為 `balanceConfig.drops.rarityWeightsByTier` + `rarityExponent 0.7`，並加入 12/50 kill pity。
- T1/T2/T3/T4+ 清圖目標改為 60-80 / 90-120 / 120-160 / 150-200；完圖給 ash 10×tier、glass 2×tier。
- Rim Warden 降為 2 符文、3 天賦、無教義；rival/boss 首通由 reducer 防重複發放獎勵。
- Save schema 更新到 v6，新增 `seenTutorialIds` 與 migration/sanitize。
- 新增 12 張教學卡、anchor 高亮與「重看教學」入口；天賦盤改用 1760×1200 固定世界畫布並加入不重疊測試。
