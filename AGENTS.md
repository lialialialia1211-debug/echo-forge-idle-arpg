# Echo Forge Project Rules

本專案預設使用繁體中文溝通。修改前必須先讀現有程式與文件，不得直接憑印象改 UI 或玩法。

## 交付前強制規則

每次交付前必須通過兩類測試，兩類都通過才可以回報完成。

### 1. 程式碼與資料測試

至少執行：

```bash
pnpm typecheck
pnpm test
pnpm build
```

測試必須覆蓋或確認：

- 靜態資料 ID 可被 engine 查到。
- Top Part base / engraving / rarity / prefix / suffix / group 合法。
- Drive Core 與 Tuning Rune 的 tag 相容性合法。
- Arena Key affix 與 Boss Gate 資料合法。
- Save schema 與 migration 不會讓舊存檔或壞存檔造成 app crash。
- 任何新增資料不得只改 UI hardcode，必須能通過 engine 或 data validation。

### 2. 實際遊戲測試

必須用瀏覽器實際開啟遊戲，至少完成：

- 首頁載入後沒有 ErrorBoundary。
- 按 Start 後戰鬥會跑，wave / kills / canvas 狀態有變化。
- Start / Pause / Reset 可用。
- Loadout / Inventory / Skills / Forge / Route / Talents tabs 可切換。
- Forge 至少能執行一個合法操作或正確 disabled。
- Route 至少能 Forge Key 或 Run Key，且不造成 crash。
- Browser console 沒有 error 或 unhandled exception。
- 390px mobile viewport 無水平溢出。

若任一項失敗，不能交付。必須先修復、重跑兩類測試，再回報。

## 架構邊界

- `src/game/engine` 保持純 TypeScript，不 import React、DOM、localStorage、network。
- `src/game/data` 只放靜態資料與查表 helper，不放 runtime/UI state。
- `src/game/save` 負責 schema、migration、local adapter；save 只能保存可序列化狀態。
- `src/game/ui` 只接 engine API、呈現狀態與處理使用者操作，不寫核心公式。
- Canvas 只負責戰鬥盤呈現；文字密集 UI 放 DOM panel。

## 玩法落地順序

功能順序固定：

```text
system contract
-> data schema
-> engine tests
-> engine implementation
-> save/migration
-> UI connection
-> browser playtest
```

不得跳過 engine/data tests 直接做大型 UI。

## Bug 修復規則

- 先重現，再修復。
- 修復後必須新增或更新能防止回歸的測試。
- 不能用 ErrorBoundary、try/catch、清空資料或隱藏 UI 來掩蓋核心錯誤。
- 不能要求使用者手動清 localStorage 才能正常玩；需要 migration 或容錯。

