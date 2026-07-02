# 更新紀錄

日期：2026-07-03
狀態：Phase 1 到 Phase 4 已完成並準備發布到 QA 站
QA 連結：https://lialialialia1211-debug.github.io/echo-forge-idle-arpg/

## 2026-07-03 Phase 1-4 實作

本次更新把 `docs/codex-implementation-plan.md` 中 Phase 1 到 Phase 4 的核心落地到可玩版本，重點是把 UI hardcode 的帳號流程、掉落、鍛造、路線與進階規則移回 engine/data/save 邊界，讓後續平衡與 QA 能依照資料驗證與引擎測試推進。

## 主要變更

- 新增 account reducer 與 account state adapter，集中處理裝備、鎖定、分解、鍛造、符文、天賦、Atlas、鑰匙、掉落與擊殺累積。
- 新增離線結算、掉落 roll helper、idle automation 與 balance soak，讓 idle ARPG 迴圈可用測試驗證。
- 擴充 Top Part、Damage、Runtime schema，加入 hit flags、drive scaling、DoT/ailment、launcher profile、duel mode、anomaly、circuit network 與 doctrine。
- 擴充天賦到 64 nodes，補上 doctrine data、arena anomaly data、circuit network data。
- Save schema 升到 v4，加入 doctrineId、part revision、migration sanitize 與 corrupt save backup，避免壞存檔造成 app crash。
- Forge action 改為 engine cost/validation，鍛造後維持穩定 part id 並使用 revision 表示變更。
- CombatArena 串接 account reducer、offline report、doctrine selection、boss duel、route anomaly/circuit network 與新的 Forge/Route 流程。
- 移除未使用的 `src/game/ui/store.ts` 與 `zustand` dependency。

## 驗證紀錄

- `pnpm typecheck`：通過。
- `pnpm test`：通過，26 個 test files / 146 tests。
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

