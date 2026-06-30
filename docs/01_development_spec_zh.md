# Echo Forge 開發規格書

日期：2026-06-30  
狀態：Draft v0.1  
適用範圍：MVP 0 到 MVP 1

## 1. 專案定位

Echo Forge 是一款瀏覽器優先的類暗黑放置 ARPG。遊戲重點不是即時操作跑圖，而是用深度數值、掉寶、裝備比較、技能模組、打造與區域推進，形成長期可優化的刷寶循環。

核心玩家動詞：

- 選職業
- 配技能與輔助模組
- 選區域掛機
- 取得掉落與打造材料
- 比較裝備
- 打造與分解
- 提升 DPS、EHP、收益與穩定度
- 解鎖更高階區域與 Boss gate

## 2. 設計原則

- Engine-first：先做純邏輯與測試，再擴 UI。
- Data-driven：職業、技能、輔助、物品基底、詞綴、區域、打造都從資料定義。
- Local-first, account-ready：第一版本地存檔，但 schema 從一開始支援未來帳號與雲端。
- Test-heavy formulas：傷害、防禦、掉寶、離線收益、RNG、存檔遷移都要測。
- UI after simulation：React UI 只呈現與操作，遊戲規則不得藏在 component 裡。
- Original content：可參考 ARPG 系統形狀，不複製 POE/POE2 名稱、圖示、詞綴表、被動樹、地圖、Boss、劇情或美術。

## 3. 目標平台

- Desktop browser：優先支援 1280px 以上。
- Laptop browser：支援 1024px 到 1279px。
- Mobile browser：支援 390px 寬度以上，採單欄與抽屜/折疊式資訊。
- First runtime：Vite + React + TypeScript。
- 第一版不使用 Phaser、Three.js 或 canvas 戰鬥場景；這是數值與 dashboard 型放置遊戲。

## 4. 第一版範圍

MVP 0：Engine Slice

- 3 個職業原型。
- 6 個主動技能。
- 12 個輔助模組。
- 6 個區域。
- 傷害、防禦、掉寶、離線收益公式。
- 本地可跑 dashboard。
- 基礎測試。

MVP 1：Playable Loop

- 角色建立與切換。
- 區域推進與解鎖條件。
- 掉寶 feed。
- 物品實例生成。
- 裝備欄與背包。
- 裝備比較：DPS、EHP、收益變化。
- 打造台。
- 本地存檔、匯出、匯入。
- 第一個 Boss gate。

## 5. 第一版不做

- 真實登入與雲端同步。
- 交易市場。
- 多人互動。
- 大型完整被動樹。
- 全量 POE 級詞綴庫。
- 真實 2D/3D 戰鬥場景。
- 賽季、排行榜與伺服器權威經濟。
- 直接使用任何 POE/POE2 原始資料或美術。

## 6. 核心循環

```text
選職業
-> 配主動技能與輔助模組
-> 選區域
-> 模擬掛機戰鬥
-> 掉寶與材料
-> 篩選、裝備、分解
-> 打造
-> 提升效率
-> 解鎖下一區或挑戰 Boss
```

每次循環至少要讓玩家看到其中一種成長：

- DPS 提升。
- EHP 或死亡率改善。
- 掉寶效率提升。
- 更高區域可穩定刷。
- 新技能、輔助或打造選項解鎖。

## 7. 職業規格

第一版職業：

- Veilrunner：投射物、閃避、暴擊、速度。
- Ashweaver：法術、元素、護盾、爆發。
- Ironbound：近戰、護甲、生命、格擋、恢復。

每個職業必須定義：

- stable `id`
- 顯示名稱
- 玩法定位
- 基礎能力值
- 每級成長
- 起始技能
- 偏好技能標籤
- 被動樹起點 placeholder

驗收標準：

- 切換職業會改變可見 DPS/EHP/收益。
- 職業資料不依賴 UI component。
- 每個職業至少有一套可用起始 skill/support loadout。

## 8. 技能與符文連結規格

第一版採用 POE2-like 技能頁邏輯加原創符文板視覺。

規則：

- 技能不插在裝備上。
- 每個角色第一版只裝備 1 個主動技能。
- 每個主動技能最多 3 個輔助槽。
- 輔助模組透過技能標籤判斷相容性。
- 不相容輔助不可連結，也不能進入計算。
- 支援後期擴到 4 到 5 個輔助槽。

主動技能資料至少包含：

- `id`
- display name
- tags
- damage types
- base use time
- base crit chance
- level damage curve
- optional allowed class IDs

輔助模組資料至少包含：

- `id`
- display name
- required tags
- excluded tags
- modifiers
- cost multiplier

驗收標準：

- UI 顯示相容輔助。
- 切換輔助會即時影響 simulation。
- 標籤規則可測試。

## 9. 屬性與詞綴規格

屬性系統必須支援：

- `flat`
- `increased`
- `reduced`
- `more`
- `less`
- `cap`
- `penetration`
- `extraAs`

計算規則：

- flat 加到 base。
- increased/reduced 在同一加法桶。
- more/less 逐個乘算。
- tagged modifier 只對相容 skill tags 生效。
- cap 類型用於上限約束。

驗收標準：

- increased 疊加、more 乘算有單元測試。
- tagged modifier 命中與不命中都有測試。
- 未來新增 stat 不需要改 React UI 才能參與 engine 計算。

## 10. 戰鬥規格

第一版戰鬥是抽象模擬，不是即時場景。

輸入：

- character class stats
- skill and support modifiers
- area monster stats
- enemy evasion
- enemy resistance
- boss life

輸出：

- average hit
- DPS
- hit chance
- crit chance
- crit expected multiplier
- effective resistance
- hits per second
- boss time to kill

基礎計算順序：

```text
base skill damage
-> flat damage
-> increased/reduced
-> more/less
-> extra-as
-> enemy resistance after penetration
-> hit chance
-> crit expected multiplier
-> action rate and uptime
-> DPS and TTK
```

驗收標準：

- 起始角色在第一區可以產生正數 DPS。
- 支援模組改變 DPS。
- 命中率有上下限。
- Boss TTK 不能是 NaN 或 Infinity。

## 11. 防禦規格

第一版防禦輸出：

- total pool
- physical EHP
- elemental EHP
- armour reduction
- evade chance
- expected incoming DPS
- net damage per second
- deaths per hour

防禦層：

- life
- shield
- armour
- evasion
- block
- resistance
- recovery per second

驗收標準：

- 高階區域死亡壓力會降低 farm efficiency。
- 提升 EHP 或 recovery 會降低 deaths/hour。
- 防禦公式獨立於 UI。

## 12. 掉寶與收益規格

第一版掉寶採期望值模型，後續加物品實例。

輸出：

- farm efficiency
- kills per hour
- items per hour
- rare items per hour
- chase items per hour
- currency per hour
- total EV per hour

影響因素：

- DPS and monster life
- deaths/hour
- area reward multiplier
- base drop chance
- item quantity
- item rarity
- soft-cap rarity exponent

驗收標準：

- 死亡率會降低 farm efficiency。
- item rarity 提升稀有掉落，但不得完全取代戰力。
- item quantity 增加總掉落量。

## 13. 物品與裝備規格

第一版目標裝備槽：

- mainHand
- offHand
- helmet
- bodyArmour
- gloves
- boots
- belt
- amulet
- ringLeft
- ringRight
- charmOne
- charmTwo

物品生成流程：

```text
choose area drop table
-> choose item class
-> choose base item
-> assign item level
-> roll rarity
-> attach implicit modifiers
-> roll prefix/suffix count
-> filter affixes by item level, class, tag, group
-> weighted roll affixes
-> roll tier values
-> create item instance with seed/provenance
```

物品卡顯示：

- rarity
- base item
- item level
- prefix/suffix list
- DPS delta
- EHP delta
- loot EV delta
- equip
- lock
- salvage

驗收標準：

- item instance 有 stable ID。
- generatedBy 記錄 area、monster level、balance version、seed。
- 詞綴 group 不重複。
- prefix/suffix 數量限制可測。

## 14. 打造規格

MVP 1 打造動作：

- upgrade rarity
- reroll all affixes
- reroll numeric values
- add one random prefix or suffix
- remove one random modifier
- salvage to materials
- lock item

驗收標準：

- 打造結果可重現或有 seed provenance。
- 鎖定物品不能分解。
- 打造材料收支進入 save schema。
- 打造不會產生非法 affix 組合。

## 15. 區域與 Boss Gate 規格

區域資料至少包含：

- `id`
- display name
- tier
- area level
- monster life
- monster damage
- enemy evasion
- enemy accuracy
- enemy resistance
- max kills per minute
- base drop chance
- quantity and rarity bonus
- reward multiplier
- boss life

Boss gate 必須測試：

- DPS
- EHP
- hit chance
- recovery
- resistance or mitigation

驗收標準：

- 每一區都有明確風險與收益差異。
- 下一區不是純 UI 開關，而是由數值門檻或 Boss gate 解鎖。
- Boss 失敗能指出缺哪一層能力。

## 16. 離線收益規格

第一版：

- offline cap 預設 12 小時。
- offline efficiency 低於在線。
- survival multiplier 由 deaths/hour 影響。
- inventory cap 超出後自動分解。

驗收標準：

- 離線收益有上限。
- 高死亡率會降低離線收益。
- 超出背包容量的掉落不會消失，而是依規則分解。

## 17. 存檔規格

存檔從第一版就採帳號形狀：

- schemaVersion
- accountId nullable
- settings
- roster
- sharedStash
- currencies
- achievements
- lastSavedAt

角色存檔：

- id
- name
- classId
- level
- xp
- selectedAreaId
- build
- lastSettledAt

驗收標準：

- Zod schema 驗證。
- 壞存檔不讓 app crash。
- 每次 schema 變更都要有 migration。
- save source of truth 不在 React component local state。

## 18. UI 規格

第一屏必須是可玩的 dashboard，不做 landing page。

桌面佈局：

- 左側：導航、職業、區域、技能。
- 中間：simulation、loot feed。
- 右側：survival、rewards、offline。

手機佈局：

- 單欄。
- 導航縮成 icon。
- 長列表可滾動。
- 裝備比較後續用全屏 panel 或 drawer。

UI 風格：

- dark ARPG workshop
- metal / ash / ember / glass
- rarity colors
- dense but readable
- no marketing hero

驗收標準：

- 1280px、1440px、390px 不爆版。
- 長詞綴不遮擋主要資訊。
- console 無 error/warn。
- UI 不直接實作遊戲規則。

## 19. 測試規格

單元測試最低要求：

- modifier stacking
- tagged modifiers
- hit chance caps
- combat positive outputs
- support changes DPS
- death pressure affects loot
- deterministic RNG
- save schema
- item affix eligibility
- prefix/suffix limits
- offline cap

Browser QA：

- desktop 1440px
- laptop 1280px
- mobile 390px
- class switching
- area switching
- support toggling
- long item names
- inventory compare
- save export/import

## 20. Definition Of Done

一個功能完成必須滿足：

- 對應資料、engine、UI 邊界清楚。
- 有必要測試。
- `pnpm test` 通過。
- `pnpm build` 通過。
- 若影響 UI，完成至少桌面與手機煙測。
- 若影響 save schema，更新 migration 與文件。
- 若新增遊戲內容，使用原創名稱與資料。
