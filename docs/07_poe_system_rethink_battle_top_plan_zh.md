# POE 數值體系與戰鬥陀螺化重規劃

日期：2026-06-30  
狀態：Planning Draft v0.1  
目的：先拆解 POE/POE2 的完整遊戲邏輯與進程，再規劃如何轉成原創「暗黑金屬戰鬥陀螺」網頁版。本文不代表已進入實作。
資料基準：2026-06-30 公開資料。POE/POE2 仍在更新，因此本文只採系統形狀，不搬官方資料表與數值。

## 0. 先修正方向

上一輪直接把 Atlas 節點貼進 UI 是錯的。POE 的終局不是「地圖列表」，而是以下系統互相咬合：

- 角色成長：等級、技能、輔助、天賦、升華。
- 裝備成長：基底、物品等級、稀有度、詞綴、詞綴池、打造、掉落來源。
- 戰鬥成長：傷害倍率、防禦層、命中/暴擊、異常、資源、速度、觸發。
- 區域成長：劇情區域、怪物等級、Boss gate、進入終局。
- 終局成長：Map/Waystone、地圖詞綴、Atlas 進度、Atlas 被動、特殊機制、碎片/Boss/Pinnacle。

戰鬥陀螺版本要先重建這些「進程關係」，再決定 UI 長相。

## 1. 參考系統摘要

以下是從公開資料歸納的系統形狀，不直接搬 POE 名稱、資料表或數值。

- Skill Gem / Support Gem：主動技能提供技能，輔助改變相容技能；相容性、連線/插槽、成本倍率與多輔助疊加是核心。參考：官方早期 socket/gem 說明、PoE Wiki skill/support gem。
- Passive Tree：角色天賦不是幾個加成卡片，而是大圖狀路徑選擇，提供小點、關鍵點、群集與路線成本。官方被動樹頁面顯示它是大型網狀樹。
- Itemization：物品以基底、需求、物品等級、稀有度、prefix/suffix、implicit/explicit、詞綴權重、詞綴 tier 組成。
- Currency/Crafting：貨幣不是單純錢，而是行為：升稀有、加詞、移詞、重骰、品質、鎖定/保護、特殊來源定向。
- Maps/Atlas：Map 是可被打造的終局關卡物品，有稀有度、詞綴、風險與回報；Atlas 是完成地圖後逐步揭露、推進與改造終局的系統。
- Atlas Passive：不是單一進度條，而是讓玩家選擇「我要農什麼、提高什麼風險、追什麼 Boss 或機制」的終局策略樹。

### 1.1 2026-06-30 重新確認到的關鍵點

- POE2 0.5.0 官方更新中，Atlas Passive Tree 已「significantly expanded with over 300 nodes」，而且 Atlas 點數來源改為完成 fortress 內地圖。這表示終局進程核心是「刷圖 -> 完成特定終局結構 -> 取得 Atlas/機制樹點數」，不是單純開節點。
- POE2 0.5.0 對 Delirium、Breach、Ritual、Vaal 等終局機制都採 hub / 特定地圖群 / 專屬 Atlas Tree / Pinnacle 或 crafting reward 的結構。這對本專案的翻譯應是 `Arena Anomaly` + `Protocol branch`，不是把所有內容混成一張地圖。
- Breach 的 Genesis Tree 是「消耗特定材料 -> 由樹節點影響產物」的 crafting/progression 混合系統；本專案可轉成 `Forge Shrine / Circuit Protocol`，讓終局材料與打造方向掛鉤。
- POE/POE2 的 crafting 核心不是商店購買，而是 currency action：升級稀有度、重骰、加詞、移詞、保留/鎖定、特定來源定向。這應翻譯為 Forge Media 的明確行為。
- Map 在 POE 裡本身是可打造物品：有 rarity、affix、quality、corruption 與風險/回報。戰鬥陀螺版的 `Arena Key / Circuit Disc` 必須先以「物品」存在，再讓 `Circuit Network` 消耗或改造它。

## 2. 本專案核心翻譯

| POE 系統 | 戰鬥陀螺版本 | 保留的設計功能 |
| --- | --- | --- |
| Class | Top Frame | 起始基礎值、玩法傾向、弱點 |
| Ascendancy | Doctrine / 戰術流派 | 中期專精，改變規則而不只是加數字 |
| Skill Gem | Drive Core | 主動技能核心，自動觸發 |
| Support Gem | Tuning Rune | 修改 Drive Core 行為、成本、風險 |
| Passive Tree | Gyro Circuit | 圖狀路徑、節點成本、build 路線 |
| Equipment | Top Parts | Core/Ring/Disk/Tip/Launcher/Seal/Chip |
| Weapon base | Attack Ring / Tip | 決定碰撞基底、半徑、命中方式 |
| Armour/Evasion/ES | Guard/Drift/Flux Guard | 防禦層分化 |
| Map | Arena Key / Circuit Disc | 可打造的終局入場物 |
| Map Mods | Arena Engravings | 增加怪物難度與回報 |
| Atlas | Circuit Network | 終局節點、揭露、路線與 Boss gate |
| Atlas Passive | Circuit Protocol Tree | 決定刷怪密度、掉落偏向、Boss/特殊事件 |
| League Mechanic | Arena Anomaly | 特殊玩法與獎勵池 |

## 3. 進程規劃

### 3.1 新手到第一個 Build 選擇

目標：30 秒開始打，5 分鐘內知道自己在養哪種陀螺。

流程：

```text
選 Top Frame
-> 得到起始 Drive Core
-> 裝 1-2 顆 Tuning Rune
-> 打第一個 Arena Circuit
-> 掉落 Top Part
-> 比較 Impact / RPM / Stability / Loot
-> 裝備或拆解
```

這階段不該出現完整 Atlas。只需要普通場地、簡單 boss、少量裝備槽。

### 3.2 中期：裝備與技能開始分化

目標：玩家開始思考 build，不只是裝更高數字。

新增：

- 第 3 個 rune slot。
- 第一批 Doctrine 選擇。
- 裝備詞綴開始有 tag，例如 `collision`、`heat`、`static`、`void`、`minion`。
- 第一個 crafting 行為：升稀有、加詞、重骰數值、拆解。
- 第一個 Boss Gate 會檢查缺口：DPS、Guard、Drift、Tracking、Grip、Resistance。

### 3.3 進入終局：Map 不是 UI 節點，而是消耗品

終局第一版不應直接畫大 Atlas。先做「可打造的 Arena Key」。

Arena Key 結構：

```ts
type ArenaKey = {
  id: string;
  tier: number;
  arenaBaseId: string;
  rarity: "common" | "tuned" | "engraved" | "relic";
  itemLevel: number;
  prefixes: ArenaAffix[];
  suffixes: ArenaAffix[];
  quality: number;
  rewardBias: RewardBias[];
  bossGateId?: string;
};
```

規則：

- 玩家刷普通場地取得 Arena Key。
- Arena Key 可用材料打造。
- 詞綴提高怪物血量、速度、Guard、危險、Boss 強度。
- 回報提高掉落數量、稀有度、特定零件池、特殊材料、Boss 碎片。
- 玩家不是「點高階地圖就進去」，而是要有 key、能打得過、願意承擔詞綴。

### 3.4 Atlas / Circuit Network

Atlas 應在 Arena Key 之後做。

第一版 Circuit Network 不需要很大，建議 18-24 個節點：

- 6 個普通場地節點。
- 4 個材料農場節點。
- 4 個特殊 Anomaly 節點。
- 3 個 Boss Gate。
- 1 個 Pinnacle placeholder。

節點本身只代表「地點與解鎖狀態」。真正的風險/回報仍由 Arena Key 和 Atlas Passive 決定。

### 3.5 Atlas Passive / Circuit Protocol

這才是 POE 式終局的重點。玩家不是只解鎖地點，而是改造刷圖規則。

Protocol 類型：

- Sustain：提高 Arena Key 掉落與 tier 升級。
- Density：更多敵方陀螺、更多 elite、更多碰撞事件。
- Reward Bias：偏向 Core/Ring/Tip/Seal/Chip 掉落。
- Crafting：更多材料、提高高 tier 詞綴機率。
- Bossing：Boss 更難，但掉落 boss fragment / relic。
- Anomaly：提高特殊事件出現率。

## 4. 數值體系應先補的缺口

目前已有 base/flat/increased/more、conversion、extra-as、hit、crit、guard、resistance。下一步不是多加 UI，而是補可長期擴充的規則。

優先順序：

1. Local vs Global modifier：Attack Ring 的 local impact 先作用在零件基底，再進全域。
2. Damage source：collision、drive、trail、satellite、recoil、hazard 分開。
3. DoT 與 Hit 分離：Heat Scorch / Void Corrosion 不應吃 hit chance 和 crit。
4. Ailment magnitude：Overcharge、Drag、Stagger、Scorch 要有門檻與強度。
5. Resource：Flux、cooldown、reservation，避免技能只有 CD。
6. Defense layers：Flux Guard recharge、Guard 對大 hit 衰減、Drift、Deflect、Grip/Ring-Out。
7. Reward math：quantity、rarity、area reward、boss reward、key rarity 分桶，不混成單一倍率。

## 5. 裝備與詞綴規劃

Top Part 不應只是 `statBonuses` 陣列。要像 POE 一樣有生成流程：

```text
選掉落來源
-> 選 slot
-> 選 base
-> 決定 itemLevel
-> roll rarity
-> 套 implicit
-> roll prefix/suffix 數量
-> 依 slot/tag/itemLevel 過濾詞綴池
-> 依 weight roll 詞綴
-> 依 tier roll 數值
-> 生成 PartInstance with provenance
```

詞綴類型：

- Offensive：flat impact、% impact、more collision、edge、fracture、penetration。
- Defensive：integrity、guard、flux guard、drift、grip、resist。
- Skill：+drive level、cooldown recovery、trigger chance、reservation efficiency。
- Loot：part quantity、part rarity、slot reward bias。
- Control：stagger、ring-out pressure、pull strength、hazard duration。

## 6. 技能寶石 / 輔助寶石規劃

Drive Core 必須從「傷害技能」升級成完整技能定義。

```ts
type DriveCoreDef = {
  id: string;
  tags: DriveTag[];
  trigger: TriggerRule;
  cost: FluxCost;
  cooldown: CooldownDef;
  hit?: HitProfile;
  dot?: DotProfile;
  minion?: SatelliteProfile;
  arenaEffect?: HazardProfile;
  scaling: ScalingRule[];
};
```

Tuning Rune 需要：

- requiredTags / excludedTags。
- support family，避免同類支援無腦疊。
- cost multiplier / instability。
- 行為改變，例如 projectile count、chain、area、duration、repeat、trigger。
- 明確 downside。

## 7. 網頁版資訊架構

第一屏仍應是戰鬥盤，不是 Atlas。

主畫面優先級：

1. 競技盤與戰鬥狀態。
2. 當前 Drive、生命/Spin/Flux、Wave、掉落。
3. 快速 Start/Pause/Speed。
4. 小型 build summary。

次級面板：

- Assembly：裝備。
- Drive：技能與 rune link。
- Forge：打造。
- Route：目前場地與 Arena Key。
- Circuit：Atlas / Protocol，終局解鎖後才出現。

## 8. 正確實作順序

不要先做 Atlas UI。順序應該是：

1. 寫 `docs/08_top_arpg_system_contract_zh.md`：定義名詞、進程、資料模型。
2. 補 Top Part 生成器：prefix/suffix/tier/weight/provenance。
3. 補 Drive/Rune 相容性與 cost/cooldown/resource。
4. 補 Arena Key：可打造的 map item。
5. 補第一個 Boss Gate：輸出失敗原因。
6. 補 Crafting：升稀有、加詞、移詞、重骰值。
7. 補 save persistence。
8. 再做小型 Circuit Network。
9. 最後才做 Circuit Protocol Tree。

## 9. MVP 切線

Playable MVP 不應追完整 POE 規模。應做到：

- 3 個 Top Frame。
- 6 個 Drive Core。
- 12-18 個 Tuning Rune。
- 7 個零件槽。
- 30-40 個 Top Part bases。
- 60-80 個詞綴。
- 6 個普通 Arena。
- Arena Key tier 1-5。
- 1 個 Boss Gate。
- 1 個小型 Forge。
- 1 個 12-18 節點 Gyro Circuit。
- 30-60 分鐘內完成第一輪：刷場地 -> 掉 key -> 打 key -> 打 boss -> 解鎖下一層。

## 10. 不做清單

第一版不做：

- 大型完整 Atlas。
- 完整 POE 被動樹規模。
- 交易市場。
- 真實 POE 名稱、詞綴、技能、地圖、Boss、美術。
- 太多 league mechanic。
- 一開始就做複雜 UI 動畫。

## 11. 下一步

下一步不是寫功能，而是把本規劃拆成可驗收的 system contract：

- `TopCombatContract`
- `TopPartGenerationContract`
- `DriveRuneContract`
- `ArenaKeyContract`
- `ProgressionGateContract`
- `CircuitNetworkContract`

每個 contract 先寫資料型別、計算順序、例子、測試案例，再動手實作。

## 12. 參考來源

- Path of Exile official passive tree: https://www.pathofexile.com/passive-skill-tree
- Path of Exile official Atlas skill tree: https://www.pathofexile.com/fullscreen-atlas-skill-tree
- Official forum explanation of skill gems and support gems: https://www.pathofexile.com/forum/view-thread/2773
- PoE Wiki - Skill gem: https://www.poewiki.net/wiki/Skill_gem
- PoE Wiki - Support gem: https://www.poewiki.net/wiki/Support_gem
- PoE Wiki - Map: https://www.poewiki.net/wiki/Map
- PoE Wiki - Atlas of Worlds: https://www.poewiki.net/wiki/Atlas_of_Worlds
- PoE Wiki - Modifier: https://www.poewiki.net/wiki/Modifier
- PoE Wiki - Currency: https://www.poewiki.net/wiki/Currency
- PoE Wiki - Crafting Bench: https://www.poewiki.net/wiki/Crafting_Bench
- PoE2 current endgame overview reference: https://mobalytics.gg/poe-2/guides/endgame-overview
- Path of Exile 2 0.5.0 official patch notes for updated Atlas mechanic direction: https://www.pathofexile.com/forum/view-thread/3932540
