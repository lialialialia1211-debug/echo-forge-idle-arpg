# Echo Forge 可玩成品總規劃

日期：2026-06-30  
狀態：Draft v0.1  
目的：定義「做到什麼程度才算有成品可以玩」，包含玩法、內容量、遊戲畫面、UI/UX、製作里程碑與驗收標準。

## 1. 影片參考狀態

使用者提供參考影片：

```text
https://www.bilibili.com/video/BV1KrTw6BE7N/
```

目前限制：

- 已嘗試讀取頁面，但 Bilibili 對直接抓取回應 `412 Precondition Failed`。
- 因此本文不假裝已完整解析影片內容。
- 影片先作為「待人工確認的視覺/節奏參考」。

後續如果能人工看影片，應補記以下觀察：

- 主畫面是偏戰鬥場景、清單 dashboard，還是兩者混合。
- 玩家主要看哪一塊資訊：角色、怪物、掉寶、技能、背包、升級、數字跳動。
- UI 密度：偏輕量手遊式，還是偏 POE/暗黑式密集資訊。
- 掉寶回饋：是否有光柱、飛字、掉落音效、稀有度顏色。
- 成長節奏：幾秒一次掉落、幾分鐘一次升級、多久一次重大選擇。
- 美術氛圍：寫實暗黑、像素、2D 卡牌、Q 版、剪影、或 UI-only。

在影片尚未人工整理前，本規劃採用：

```text
暗黑放置 ARPG 中控台 + 中央戰鬥視覺窗 + 深度背包/打造/技能面板
```

## 2. 成品分級

不要只用「完成/沒完成」判斷。Echo Forge 應分成四級。

### 2.1 Prototype

目的：證明公式與 UI 方向可行。

目前已接近這一級：

- 可以切職業。
- 可以切區域。
- 可以看到 DPS、EHP、掉寶 EV。
- 可以手動跑 30 秒 farming tick 或啟動自動 farming。
- 可以累積背包、貨幣與本輪 farming report。
- 可以裝備物品並重算數值。
- 可以鎖定、分解與自動處理背包爆倉。

不足：

- 沒有打造。
- 沒有存檔持久化背包、裝備與貨幣。
- 沒有 loot filter / sort。
- 沒有區域解鎖。
- 沒有 Boss gate。
- 戰鬥畫面還只是 dashboard，缺少「遊戲正在進行」的視覺感。

### 2.2 Playable MVP

這是第一個「真的可以玩」的版本。

最低完成線：

- 玩家可以從 0 開始選職業。
- 點 Start Farming 後，系統會持續模擬刷怪。
- 每 3 到 10 秒可看到戰鬥進度、掉寶或材料回饋。
- 物品進背包，能裝備、比較、鎖定、分解。
- 能透過裝備/技能/打造讓 DPS、EHP、收益變強。
- 能解鎖至少 6 個區域。
- 有第一個 Boss gate。
- 有本地存檔、離線收益、匯出/匯入。
- 30 到 60 分鐘內能完成一輪明確 progression。

這一級才算「可以給人試玩」。

### 2.3 Alpha

目的：讓遊戲不只是能玩，而是能測留存與樂趣。

最低完成線：

- 3 個職業都有明顯玩法差異。
- 至少 10 到 12 個主動技能。
- 至少 24 到 36 個輔助模組。
- 至少 80 個可生成詞綴。
- 至少 12 個區域。
- 至少 3 個 Boss gate。
- 被動節點圖 40 到 60 個節點。
- 打造有 6 到 8 種動作。
- 掉寶 filter 和 auto-salvage 可設定。
- UI 在 desktop 和 mobile 都可正常玩。
- 前 2 小時有明確成長節奏。

這一級才適合做較完整的外部測試。

### 2.4 V1.0

目的：可公開發布的第一版。

最低完成線：

- 6 個職業或 3 職業 + 每職業 2 個分支。
- 20 到 30 個主動技能。
- 50 到 80 個輔助模組。
- 150 到 250 個詞綴。
- 20 到 30 個區域。
- 5 到 8 個 Boss gate。
- 被動圖 120 到 180 個節點。
- 完整本地帳號/角色名冊。
- 雲端存檔可以是 Beta，但 save schema 必須可遷移。
- 10 小時以上內容。
- 音效、掉寶回饋、動畫、UI polish 到位。

## 3. Playable MVP 必須做到的內容量

第一個可玩版本不要追完整 POE 規模，但必須有完整循環。

### 3.1 職業

必備 3 個：

- Veilrunner：遠程投射物、閃避、暴擊、刷速。
- Ashweaver：火/雷法術、能量護盾、爆發。
- Ironbound：近戰、護甲、生命、格擋、恢復。

每個職業必須有：

- 起始技能。
- 起始輔助推薦。
- 起始裝備。
- 職業被動起點。
- 一個明顯弱點。
- 一個適合的 Boss gate 解法。

### 3.2 技能

Playable MVP：

- 6 個主動技能。
- 12 到 18 個輔助模組。
- 每個角色第一版裝 1 個主動技能。
- 每個主動技能 3 個輔助槽。
- 後續可解鎖第 4 個槽。

技能 UI 必須提供：

- 相容輔助高亮。
- 不相容輔助 disabled 並顯示原因。
- 裝上/拿下後即時顯示 DPS、EHP、loot EV delta。
- 技能標籤可見。

### 3.3 裝備與掉寶

Playable MVP 裝備槽：

- main hand
- off hand
- helmet
- body armour
- gloves
- boots
- belt
- amulet
- ring left
- ring right
- charm one
- charm two later unlock

內容量：

- 20 到 30 個 item bases。
- 50 到 80 個 affixes。
- 4 種 rarity：normal、magic、rare、relic。
- 每件 rare 最多 3 prefix + 3 suffix。
- 掉寶保留 seed/provenance。

必備行為：

- equip
- compare
- lock
- salvage
- sort
- filter
- auto-salvage by rarity/value

### 3.4 打造

Playable MVP 打造動作：

- upgrade rarity
- reroll all affixes
- reroll numeric values
- add random prefix/suffix
- remove random modifier
- lock item
- salvage to materials

打造 UI 必須顯示：

- 材料消耗。
- 可用/不可用原因。
- 成功後預覽結果。
- 是否會保留 locked affix。
- 風險提示。

### 3.5 區域與 Boss

Playable MVP：

- 6 個普通區域。
- 1 個 Boss gate。
- 每區有不同 hazard 和 reward bias。

區域 UI 必須顯示：

- monster level。
- 預估 kills/hour。
- 預估 deaths/hour。
- 掉寶 bias。
- 解鎖條件。
- 推薦 DPS/EHP。
- 是否適合離線。

Boss gate 必須顯示：

- 成功率。
- 預估 TTK。
- 主要死亡原因。
- 失敗後建議提升方向。

### 3.6 被動與成長

Playable MVP：

- 小型被動圖 20 到 30 個節點。
- 每次升級或 Boss 後取得 passive point。
- 節點類型：傷害、防禦、掉寶、技能槽、打造效率。

被動 UI 第一版可以不是巨大星圖，但必須有圖狀感：

- class 起點不同。
- 節點連線清楚。
- 可點選、預覽、確認。
- 點下後 simulation 更新。

### 3.7 存檔與離線

Playable MVP 必備：

- 自動本地存檔。
- 手動匯出/匯入。
- 離線收益結算 modal。
- 離線上限。
- 背包滿時 auto-salvage。
- save schema version。
- migration test。

## 4. 核心 UX 流程

### 4.1 第一次進遊戲

目標：30 秒內開始玩。

流程：

```text
開啟遊戲
-> 選職業
-> 看到起始技能與推薦輔助
-> 選第一區 Cinder Road
-> 點 Start Farming
-> 立刻看到戰鬥視覺、進度條、DPS/EHP、掉落 feed
```

不應要求：

- 長教學。
- 大量設定。
- 先讀說明文。
- 先建立帳號。

### 4.2 第一個 5 分鐘

目標：玩家感到「有掉寶、有變強」。

必須發生：

- 取得第一件 magic item。
- 取得第一件 rare item。
- 裝備比較告訴玩家這件是 DPS/EHP/loot upgrade。
- 玩家按 Equip 後看到數字上升。

### 4.3 第一個 15 分鐘

目標：玩家做第一個 build choice。

必須發生至少一項：

- 換輔助模組。
- 做第一次打造。
- 解鎖第 2 或第 3 區。
- 取得第一個被動點。
- 選擇偏 DPS、EHP 或 Magic Find 的路線。

### 4.4 第一個 30 到 60 分鐘

目標：完成第一輪小高潮。

必須發生：

- 挑戰第一個 Boss gate。
- 第一次失敗時能理解缺什麼。
- 調整裝備/技能/打造後再挑戰。
- 成功後解鎖新區域、技能槽或打造動作。

### 4.5 回歸遊戲

目標：離線回來有獎勵但不失控。

流程：

```text
回到遊戲
-> Offline Report modal
-> 顯示時間、掉落、材料、auto-salvage、被丟棄或保留的高價值物品
-> 一鍵整理
-> 回到 farming
```

## 5. 遊戲畫面總覽

Playable MVP 至少需要 8 個畫面或面板。

### 5.1 Main Farming Screen

這是第一屏，也是玩家最常看的畫面。

桌面佈局：

```text
左側：角色/區域/技能快捷
上方：職業、等級、目前區域、online/offline、資源
中央上：戰鬥視覺窗
中央下：掉寶 feed + 事件 feed
右側：DPS/EHP/loot/hr/deaths/hr/inventory pressure
底部或右下：Start/Stop、Boss Attempt、Filter、Auto-Salvage
```

中央戰鬥視覺窗必須有：

- 角色剪影或職業 portrait。
- 怪物 wave 或 boss silhouette。
- HP bar / progress bar。
- 技能施放節奏。
- 傷害數字。
- 掉寶光柱或飛入 feed 的動畫。
- 區域背景氛圍。

它不需要是完整動作遊戲，但要讓人感覺「角色正在刷」。

### 5.2 Character Screen

內容：

- 職業幻想。
- 等級/XP。
- 核心屬性。
- offense summary。
- defense summary。
- farming summary。
- 目前裝備摘要。

UX 重點：

- 一眼知道角色偏 DPS、坦度、掉寶還是速度。
- 點任何 stat 可以看到來源 breakdown。

### 5.3 Inventory And Equipment

桌面佈局：

```text
左：裝備人形槽
中：背包列表/格子
右：物品比較 panel
底：filter/sort/salvage actions
```

必備功能：

- hover/click item。
- compare current slot。
- equip。
- lock。
- salvage。
- sort by rarity / DPS delta / EHP delta / EV delta / item level。
- filter by rarity / slot / stat tag。

手機版：

- 裝備槽、背包、比較拆成 tabs。
- 物品比較用 full-screen sheet。

### 5.4 Skills / Rune Links

內容：

- 主動技能核心。
- 3 到 5 個輔助槽。
- 可用輔助列表。
- 相容與不相容原因。
- DPS delta。
- cost / downside。

視覺：

- 不叫 POE socket/link。
- 用原創符文連結、戰技模組、etched plates、rune circuits。
- 主動技能在中心，輔助圍繞。

### 5.5 Crafting Bench

內容：

- 選中物品。
- 材料錢包。
- 打造動作。
- 結果 preview。
- risk/reward。
- 最近打造紀錄。

UX 重點：

- 不讓玩家誤分解 locked item。
- 高風險打造要二次確認。
- 打造後立即更新 compare。

### 5.6 Passive Graph

內容：

- 小型圖狀被動樹。
- 職業起點。
- 已解鎖點數。
- 節點 preview。
- Confirm allocation。

第一版節點類型：

- +damage
- +life/shield
- +armour/evasion
- +item rarity/quantity
- +support slot unlock
- crafting efficiency

### 5.7 Area Map / Route Select

內容：

- 區域列表或節點地圖。
- danger / reward preview。
- unlock condition。
- boss gate 狀態。
- farming profile：safe XP、gear hunt、material farm、boss prep。

UX 重點：

- 玩家知道下一個目標是哪裡。
- 高風險區域有明確紅色/警示。

### 5.8 Account / Save

內容：

- Local profile。
- Character roster placeholder。
- Export save。
- Import save。
- Cloud save coming later。
- Schema version。
- Last saved time。

不做：

- MVP 不做真登入。
- 不做付款、社群、交易。

## 6. UI/UX 視覺方向

### 6.1 風格關鍵字

```text
dark ARPG
forged metal
ash and ember
etched glass
runic circuitry
dense but readable
loot glow
workbench UI
```

### 6.2 色彩

底色：

- near black
- charcoal
- deep iron

功能色：

- ember red：危險、生命、失敗。
- brass gold：rare、重點操作、標題。
- spectral teal：可用、成功、閃避/能量。
- violet：relic/chase、特殊掉落。
- muted parchment：文字和次級資訊。

稀有度色：

- normal：soft gray/parchment。
- magic：teal/blue-green。
- rare：gold/brass。
- relic：violet。

### 6.3 字體與資訊密度

原則：

- dashboard 使用緊湊但不擁擠的字級。
- 英文 ID 不直接露出給玩家。
- 數字要可掃讀。
- tooltip 顯示完整 formula/source。
- 長詞綴不能擠爆卡片。

### 6.4 動效

必備動效：

- farming progress pulse。
- damage number float。
- loot drop flash。
- rare/relic 掉落強光。
- equip 後 stat delta highlight。
- offline reward count-up。

避免：

- 全頁一直動。
- 背景 orb/blob 裝飾。
- 影響讀數字的強動畫。

### 6.5 音效

Playable MVP 可先不做完整音樂，但至少規劃：

- click。
- equip。
- salvage。
- rare drop。
- relic drop。
- boss gate start/fail/success。
- offline reward。

## 7. 主要互動狀態

### 7.1 Farming State

狀態：

- stopped
- farming
- inventory full
- death pressure high
- boss available
- offline settlement pending

每個狀態都要有 UI 提示。

### 7.2 Item State

狀態：

- new
- selected
- equipped
- locked
- filtered
- salvage candidate
- crafted

每個狀態都要靠圖示/顏色/按鈕狀態表示，而不是只靠文字。

### 7.3 Area State

狀態：

- locked
- available
- farming
- unsafe
- mastered
- boss pending
- boss cleared

## 8. 製作路線圖

### Phase 0：目前基礎

狀態：已進行。

已完成：

- project scaffold。
- engine formulas。
- starter dashboard。
- item generation prototype。
- equip compare prototype。
- farming tick。
- retained inventory。
- item lock/salvage。
- inventory capacity auto-salvage。
- starter currency wallet。
- docs baseline。

下一步：

- save persistence for inventory/equipment/currencies。
- loot filter / sort。
- crafting bench。

### Phase 1：Playable MVP Core

目標：第一個可以玩 30 到 60 分鐘的版本。

必做：

- Start/Stop farming loop。
- 持續掉寶。
- 背包容量。
- 裝備/比較/鎖定/分解。
- 打造台。
- 本地存檔。
- 離線收益。
- 6 區域 progression。
- 1 Boss gate。
- 中央戰鬥視覺窗第一版。

驗收：

- 從新角色到第一個 Boss clear 有完整流程。
- 沒有任何必要操作只能靠 debug。
- 重整頁面後進度存在。

### Phase 2：UI/UX Polish Pass

目標：讓它看起來像遊戲，不只是工具。

必做：

- combat diorama。
- loot drop animation。
- offline report modal。
- item compare panel polish。
- mobile drawers。
- tooltips。
- empty/loading/error states。
- icon pass。
- rarity visual pass。

驗收：

- 截圖看起來像暗黑放置 ARPG。
- 390px 手機可玩。
- 1280px laptop 不擁擠。

### Phase 3：Alpha Content Expansion

目標：能外部測試。

必做：

- 10 到 12 主動技能。
- 24 到 36 輔助。
- 80 詞綴。
- 12 區域。
- 3 Boss。
- 40 到 60 被動節點。
- 更多 item bases。
- 初版 balance pass。

驗收：

- 2 小時內有多次 build choice。
- 三職業玩法不重疊。
- 掉寶不重複無聊。

### Phase 4：V1.0 Production

目標：公開發布第一版。

必做：

- 10 小時內容。
- 完整音效與 UI 動效。
- save migration 完善。
- crash/error recovery。
- performance pass。
- accessibility pass。
- optional cloud save beta。

## 9. 可玩成品驗收清單

Playable MVP 必須全部通過：

- 新玩家 30 秒內開始 farming。
- 5 分鐘內第一個裝備升級。
- 15 分鐘內第一個 build choice。
- 30 到 60 分鐘內第一個 Boss gate。
- 重整頁面不丟進度。
- 離線回來有收益報告。
- 手機 390px 可完成 equip/craft/farm。
- 桌面 1280px 可同時看戰鬥、掉寶、裝備比較。
- 裝備比較可信。
- 打造不會產生非法物品。
- `pnpm test` 通過。
- `pnpm build` 通過。
- browser console 無 error。

## 10. 目前專案到 Playable MVP 的缺口

已完成：

- 基礎 engine。
- 基礎 dashboard。
- 物品生成 prototype。
- 裝備比較 prototype。
- farming tick。
- retained inventory。
- item lock/salvage。
- inventory capacity auto-salvage。
- starter currency wallet。
- 初始 docs。

缺口：

- crafting。
- save persistence for inventory/equipment/currencies。
- loot filter / sort。
- offline settlement modal。
- area unlock。
- boss gate。
- passive graph。
- combat visual window。
- tooltips。
- mobile inventory compare flow。
- sound/effects。
- content expansion。

## 11. 下一步執行順序

建議不要跳 UI polish，先把真正循環接起來：

1. Save inventory/equipment/currencies。
2. Loot filter / sort。
3. Crafting bench。
4. Area unlock and boss gate。
5. Combat visual window。
6. Passive graph。
7. UI/UX polish pass。
8. Content expansion。
9. Alpha playtest。

## 12. 參考影片整合方式

等影片內容能確認後，把觀察落到這些欄位：

```text
Reference name:
What to borrow:
What to avoid:
Main screen composition:
Combat feedback:
Loot feedback:
Inventory interaction:
Progression pacing:
Mobile/desktop relevance:
```

重要邊界：

- 可以學習節奏、版面密度、回饋方式。
- 不複製影片中任何具體 UI 素材、美術、名稱、icon、文案。
