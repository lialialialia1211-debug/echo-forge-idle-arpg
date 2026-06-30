# Echo Forge：暗黑金屬戰鬥陀螺設計文檔

日期：2026-06-30  
狀態：Draft v0.2  
目標：把目前的 idle ARPG 原型改造成「2D 俯視暗黑金屬戰鬥陀螺」自動戰鬥遊戲。

## 0. 重要邊界

本專案要借用的是 Path of Exile 2 / Path of Exile 系列的「數值計算邏輯與系統語法」，包含 base damage、flat added、increased/reduced、more/less、conversion、gain as extra、hit/crit、resistance、penetration、armour、evasion、ailment、damage taken modifiers、技能/輔助/詞綴/被動/終局等資料結構。

本專案會保留：

- POE-like 的傷害與防禦運算順序。
- POE-like 的 modifier algebra。
- POE-like 的技能、輔助、詞綴、裝備、掉落、打造、終局系統深度。
- POE-like 的 build scaling 思路，例如轉傷、穿透、more multiplier、觸發、保留、異常、護甲與抗性分層。

本專案不能直接複製：

- Path of Exile 2 的完整原始資料庫。
- 官方技能、物品、怪物、Boss、地圖、詞綴、貨幣、Ascendancy、Unique item 的名稱與完整效果。
- 官方數值表、掉落表、權重表、被動樹結構、怪物資料、地圖詞綴資料。
- 官方美術、音效、圖示、UI、故事、世界觀文字。

因此本文採用「POE2-like system contract, original data implementation」：

- 公式層與運算順序採 POE-like。
- 系統層級對齊 POE2 的深度與資料型態。
- 命名、資料表、技能名稱、詞綴名稱、怪物、貨幣、區域全部原創。
- 平衡數值可以從 POE-like 曲線推導，但不直接搬官方數值表。
- 若未來有合法授權資料來源，可透過 `data/importers` 做轉換，但遊戲本體仍應保留原創資料集。

參考依據：

- 官方網站指出 POE2 採用 Skill Gem 與 Support Gem 組合系統，且有大量 Skill Gems 與 Support Gems。
- 官方更新頁持續新增 Ascendancy、Lineage Support、Unique、Endgame、Pinnacle Boss、League 等內容，代表資料會頻繁變動。
- 因資料會變動，本設計以可版本化 schema 與 balance version 管理，而不是硬寫固定資料。

## 1. 新遊戲定位

### 1.1 一句話

玩家組裝一顆暗黑金屬戰鬥陀螺，進入 2D 俯視競技盤；陀螺自動追擊、自動碰撞、自動觸發技能，玩家透過零件、技能、輔助模組、詞綴、打造與終局路線打造自己的刷寶機器。

### 1.2 玩家主要動詞

- 選擇陀螺架構。
- 裝配核心、攻擊環、重量盤、軸尖、發射器、符印。
- 選擇主技能模組。
- 插入輔助模組。
- 選擇競技盤/區域。
- 啟動自動戰鬥。
- 觀察碰撞、失衡、出界、破壞、掉落。
- 比較零件。
- 鎖定、分解、打造。
- 推進終局競技路線與 Boss gate。

### 1.3 不做

- 不做 POE2 的手動走位與手動施法。
- 不做真實陀螺品牌或現實玩具授權內容。
- 不做即時多人對戰。
- 不直接複製 POE2 名稱、資料表、物品表、技能表、怪物表或美術。

## 2. 系統映射總表

| POE2 系統概念 | 戰鬥陀螺系統 | 說明 |
| --- | --- | --- |
| Character Class | Top Frame / 陀螺架構 | 決定基礎屬性與玩法傾向 |
| Ascendancy | Doctrine / 戰術流派 | 中後期專精 |
| Skill Gem | Drive Core / 主驅動模組 | 自動觸發的主要技能 |
| Support Gem | Tuning Rune / 調律符文 | 修改主技能效果 |
| Weapon | Attack Ring / 攻擊環 | 決定撞擊類型與技能相容性 |
| Armour/Evasion/ES | Shell/Grip/Flux Guard | 防禦層轉成陀螺穩定、防撞、護盾 |
| Life | Spin Integrity | 陀螺本體完整度 |
| Mana | Flux | 技能能量 |
| Spirit / Reservation | Resonance Reserve | 常駐效果保留量 |
| Flask | Service Charge | 自動修復/增幅短效資源 |
| Item Rarity | Part Rarity | 零件稀有度 |
| Affix | Engraving / 刻印詞綴 | 零件隨機屬性 |
| Unique | Relic Part | 手工規則零件 |
| Currency | Forge Media | 打造材料 |
| Passive Tree | Gyro Circuit | 陀螺被動迴路 |
| Atlas / Maps | Circuit Ladder / 競技盤網絡 | 終局場地推進 |
| Boss | Apex Spinner | 精英/Boss 陀螺 |
| League Mechanic | Arena Anomaly | 特殊競技盤事件 |

## 3. 世界觀與風格

### 3.1 美術方向

關鍵詞：

```text
dark metal arena
occult machinery
ritual bearing
black iron
ember scoring
etched brass
glass energy
magnetic sparks
industrial altar
top-down combat disk
```

### 3.2 競技盤設計

競技盤不是兒童玩具場，而是黑鐵祭壇：

- 圓形競技盤。
- 外圈是黑鐵護欄。
- 中圈是刻紋金屬。
- 內圈是發光符文軌道。
- 盤面有裂縫、熔痕、玻璃嵌片、磁力陷阱。
- 出界不是單純掉出去，而是被「磁環吐出」或「裂縫吞沒」。

### 3.3 視覺層級

第一優先：

- 玩家陀螺位置。
- 敵方陀螺位置。
- 碰撞瞬間。
- 技能特效。
- 生命/旋轉力狀態。

第二優先：

- 掉落提示。
- 波次。
- 場地危險。
- 精英/Boss 提示。

第三優先：

- 詳細數值。
- 背包。
- 裝備比較。
- 打造。

## 4. 核心戰鬥循環

### 4.1 循環

```text
Start Battle
-> 生成敵方陀螺
-> 玩家陀螺自動尋敵
-> 雙方依運動模型移動
-> 進入碰撞半徑
-> 計算撞擊、失衡、反彈、耐久損失
-> 主技能依觸發條件自動發動
-> 輔助模組修改技能行為
-> 敵方 Spin Integrity 或 Spin Power 歸零 / 出界
-> 掉落零件或材料
-> 下一波生成
-> 每 N 波進入 Boss
```

### 4.2 勝利方式

| 勝利類型 | 條件 | 對應 build |
| --- | --- | --- |
| Break | 敵方 Spin Integrity 歸零 | 高 Impact / Critical |
| Spin Out | 敵方 Spin Power 歸零 | Drain / Burn / Friction |
| Ring Out | 敵方被撞出競技盤 | Weight / Knockback / Grip control |
| Overload | 敵方 Flux 失控爆裂 | Lightning / Void / Resonance |
| Attrition | 敵方長時間失衡後崩解 | Tank / Thorns / Recovery |

### 4.3 敗北方式

- 玩家 Spin Integrity 歸零。
- 玩家 Spin Power 歸零。
- 玩家被擊出競技盤。
- Boss 時限內未擊敗，競技盤過載。

第一版可以只做：

- 玩家不立即結束 run，而是死亡壓力降低效率。
- Boss wave 失敗後退回上一個 route step。

## 4.5 POE-like 數值公式層

本節是本專案最重要的數值規格：所有陀螺戰鬥都用 POE-like 運算順序，只把表現語言換成戰鬥陀螺。

### 4.5.1 核心原則

本專案採用以下計算語法：

- `base` 是技能、零件或敵人等級提供的基礎值。
- `flat added` 先加到 base。
- `increased` 與 `reduced` 在同一加法桶相加。
- `more` 與 `less` 逐個乘算。
- local modifier 先作用在零件基底，再進入 global 計算。
- tagged modifier 只作用在符合 tag 的傷害或技能。
- converted damage 同時吃原始類型與轉換後類型的可用 modifier。
- `gain as extra` 不消耗原始傷害，另開一份額外傷害。
- hit damage、damage over time、ailment damage 分開計算。
- enemy mitigation 在 offensive scaling 完成後處理。
- damage taken modifier 在防禦層之後再處理。

通用公式：

```text
scaledValue =
  (base + flatAdded)
  * (1 + sum(increased) - sum(reduced))
  * product(1 + more)
  * product(1 - less)
```

### 4.5.2 攻擊與法術基底

POE-like 區分 attack 與 spell，本專案對應：

| POE-like | 陀螺版本 |
| --- | --- |
| Attack uses weapon base | Collision skill uses Attack Ring base Impact |
| Spell has gem base damage | Drive skill uses Drive Core level curve |
| Projectile can be attack/spell | Shard/bolt effect may inherit ring or drive base |
| Minion uses minion base | Satellite top uses satellite base stats |

Collision hit：

```text
attackBase =
  attackRing.baseImpact
  * localPartQuality
  * localIncreasedImpact

collisionBaseHit =
  attackBase
  + flatImpactFromCore
  + flatImpactFromDisk
  + flatImpactFromRunes
```

Drive hit：

```text
driveBase =
  driveCore.baseDamageByLevel(level)
  + flatDriveDamage
```

### 4.5.3 傷害類型

POE-like damage type 改成陀螺傷害類型：

| POE-like Damage | 陀螺 Damage Type | 說明 |
| --- | --- | --- |
| Physical | Impact | 金屬撞擊 |
| Fire | Heat | 熔痕與灼燒 |
| Cold | Glass | 玻璃裂化與脆化 |
| Lightning | Static | 電弧與過載 |
| Chaos/Void-like | Void | 重力、腐蝕、異常空間 |

傷害包：

```ts
type DamagePacket = {
  impact: number;
  heat: number;
  glass: number;
  static: number;
  void: number;
};
```

### 4.5.4 轉傷與 Gain As Extra

轉傷規則：

```text
sourceDamage = base type bucket
convertedAmount = sourceDamage * conversionPercent
sourceDamage -= convertedAmount
targetDamage += convertedAmount
```

限制：

- 同一來源的 conversion 總量最多 100%。
- 若 conversion 總量超過 100%，依規則 normalize。
- converted damage 仍記得原始來源 tag，用於吃原始類型 modifier。

Gain as extra：

```text
extraHeat = impactDamageBeforeMitigation * gainImpactAsHeatPercent
```

差異：

- conversion 會移動傷害。
- gain as extra 會新增傷害。
- gain as extra 不受 conversion 100% 限制。

陀螺例子：

```text
Attack Ring: 100 Impact
Modifier A: 40% of Impact converted to Heat
Modifier B: Gain 20% of Impact as Static

Before scaling by type:
Impact = 60
Heat = 40
Static extra = 20
```

### 4.5.5 Damage Modifier 套用順序

每一個 damage bucket 依 tag 套用：

```text
applicableTags = [
  damageType,
  skillTags,
  sourceTags,
  partTags,
  conditionTags
]
```

例如：

- `increased Impact Damage` 作用於 Impact。
- `increased Collision Damage` 作用於 collision source。
- `increased Heat Damage` 作用於 Heat。
- `increased Damage with Attack Rings` 作用於 Attack Ring 來源。
- `more Damage with Area Drive Skills` 只作用於 area drive。

converted damage 的處理：

```text
40 Impact converted to Heat
=> receives Impact modifiers that apply before/through conversion
=> receives Heat modifiers because final damage type is Heat
=> receives generic Damage modifiers
```

### 4.5.6 Hit Chance

POE-like hit chance 由 Accuracy 對 Evasion 決定。本專案改名：

| POE-like | 陀螺 |
| --- | --- |
| Accuracy | Tracking |
| Evasion | Drift |

第一版公式：

```text
hitChance =
  clamp(
    tracking / (tracking + defenderDrift * 0.85),
    0.05,
    0.95
  )
```

後期可換成更接近 POE 的非線性公式，但仍保留上下限。

自動戰鬥中不逐次擲骰時，用 expected value：

```text
expectedHitDamage = finalHitDamage * hitChance
```

若要產生畫面事件，可以用 deterministic RNG 決定是否 miss/crit，但總體結算仍要接近 EV。

### 4.5.7 Critical Strike

POE-like：

- base critical chance 來自技能或武器。
- increased critical chance 加法桶。
- critical multiplier 決定暴擊後倍率。

陀螺：

| POE-like | 陀螺 |
| --- | --- |
| Critical Chance | Edge |
| Critical Multiplier | Fracture |

公式：

```text
critChance =
  clamp(
    baseEdge * (1 + increasedEdge - reducedEdge) + flatEdge,
    0,
    critCap
  )

critMultiplier =
  baseFracture + addedFracture

expectedCritMultiplier =
  1 + critChance * (critMultiplier - 1)
```

最終 hit：

```text
expectedHit =
  hitDamage
  * hitChance
  * expectedCritMultiplier
```

### 4.5.8 Enemy Mitigation：Resistance / Penetration / Exposure

POE-like mitigation 對應：

| POE-like | 陀螺 |
| --- | --- |
| Elemental Resistance | Heat/Glass/Static Resistance |
| Chaos Resistance | Void Resistance |
| Penetration | Resistance Pierce |
| Exposure | Resistance Scoring |

處理順序：

```text
effectiveResistance =
  clamp(
    baseResistance
    + resistanceAdditions
    - exposure
    - penetrationForThisHit,
    minimumResistance,
    maximumResistance
  )

damageAfterResistance =
  damage * (1 - effectiveResistance)
```

注意：

- penetration 只對自己的 hit 生效，不永久改敵人面板。
- exposure/scoring 是 debuff，可影響後續 hit。
- 本專案用 `Scoring` 作為陀螺語言，例如 `Heat Scoring` 表示敵方外殼被熔痕削弱。

### 4.5.9 Armour / Guard

POE-like armour 是「對單次 physical hit 的非線性減傷」，大 hit 比小 hit 更難被 armour 完全抵消。

陀螺對應：

| POE-like | 陀螺 |
| --- | --- |
| Armour | Guard |
| Physical Hit | Impact Hit |

本專案公式：

```text
impactReduction =
  guard / (guard + armourConstant * incomingImpactHit)

impactAfterGuard =
  incomingImpactHit * (1 - impactReduction)
```

第一版 `armourConstant = 10`。  
若要更接近不同版本 POE 的手感，可以在 balance version 中調整為 5、10、12 等常數。

重要：

- Guard 對小撞擊很有效。
- Guard 對 Boss 重擊效果下降。
- 這會自然鼓勵高 Mass Boss 對坦克 build 仍有威脅。

### 4.5.10 Flux Guard / Energy Shield-like

POE-like Energy Shield 對應 Flux Guard。

規則：

- hit 先扣 Flux Guard，再扣 Spin Integrity。
- 某些 Void/Chaos-like 傷害可以 bypass 部分 Flux Guard。
- 一段時間未受 hit 後 Flux Guard 開始 recharge。
- 被持續傷害打斷 recharge。

公式：

```text
if timeSinceLastHit >= rechargeDelay:
  fluxGuard += maxFluxGuard * rechargeRate * deltaTime
```

### 4.5.11 Block / Deflect

Block 對應 Deflect。

```text
if hit is deflected:
  damageTaken *= (1 - deflectMitigation)
  attackerRecoil += recoilFromDeflect
```

第一版用 EV：

```text
expectedDamageAfterDeflect =
  damage * (1 - deflectChance * deflectMitigation)
```

### 4.5.12 Damage Taken Modifiers

防禦層後處理：

```text
damageTaken =
  damageAfterMitigation
  * (1 + increasedDamageTaken - reducedDamageTaken)
  * product(1 + moreDamageTaken)
  * product(1 - lessDamageTaken)
```

陀螺例子：

- `Enemy takes 12% increased Collision Damage`
- `You take 20% less Recoil Damage while Guarded Spin is active`
- `Boss takes 30% less Ring-Out Pressure`

### 4.5.13 Damage Over Time

DoT 不 hit，不走 hit chance，不 crit，除非特殊規則明確允許。

DoT 類型：

| POE-like | 陀螺 |
| --- | --- |
| Ignite/Burning | Heat Scorch |
| Poison/Chaos DoT | Void Corrosion |
| Bleed | Friction Bleed |
| Ground Effect | Groove Hazard |

公式：

```text
dotDps =
  baseDot
  * (1 + increasedDot + increasedTypeDamage + increasedGenericDamage)
  * product(moreDot)
  * enemyDamageTakenMultipliers
  * (1 - effectiveResistance)
```

### 4.5.14 Ailment / 異常

POE-like ailment 改成陀螺異常：

| POE-like | 陀螺異常 | 效果 |
| --- | --- | --- |
| Ignite | Scorch | 持續 Heat DoT |
| Shock | Overcharge | 增加 damage taken 或技能失控 |
| Chill | Drag | 降低 RPM / movement |
| Freeze | Lock | 短暫無法移動 |
| Bleed | Friction Bleed | 移動時額外 Spin loss |
| Poison | Corrosion | Void DoT 可疊層 |
| Stun | Stagger | 中斷軌跡並增加 ring-out 風險 |

異常強度：

```text
ailmentMagnitude =
  function(
    hitDamageRelativeToEnemyThreshold,
    ailmentEffect,
    enemyAilmentResistance
  )
```

第一版可簡化：

```text
ailmentChance =
  baseChance
  + chanceFromCrit
  + chanceFromModifiers

ailmentMagnitude =
  clamp(hitDamage / enemyAilmentThreshold, minMagnitude, maxMagnitude)
  * (1 + increasedAilmentEffect)
```

### 4.5.15 Stun / Stagger / Ring-Out

POE-like stun 對應 Stagger。

```text
staggerPower =
  postMitigationHitDamage
  * attackerMassFactor
  * stunModifiers

staggerThreshold =
  defenderMaxIntegrity
  * defenderStability
  * bossStaggerResistance

staggerChance =
  clamp(staggerPower / staggerThreshold, 0, maxStaggerChance)
```

Ring-Out 壓力：

```text
ringOutPressure =
  knockback
  + staggerBonus
  + arenaHazardPull
  - defenderGrip
  - defenderMassResistance
```

這是戰鬥陀螺獨有層，但仍遵守 POE-like hit -> mitigation -> ailment/stun 的順序。

### 4.5.16 Resource：Flux / Reservation

Mana 對應 Flux。Spirit/Reservation 對應 Resonance Reserve。

```text
availableFlux =
  maxFlux
  - reservedFlux

skillCanTrigger =
  currentFlux >= skillCost
  && cooldownReady
  && triggerConditionMet
```

自動戰鬥中：

- 技能一律自動觸發。
- 玩家配置 trigger priority。
- 若 Flux 不足，技能跳過該次觸發。
- 保留型效果會佔用 Resonance Reserve。

### 4.5.17 Cooldown / Trigger

POE-like 觸發技能必須受 cooldown、cost、trigger condition 控制。

```text
triggerRate =
  min(
    conditionFrequency,
    1 / effectiveCooldown,
    resourceSustainableRate
  )

effectiveCooldown =
  baseCooldown / (1 + cooldownRecoveryRate)
```

觸發事件：

- onCollision。
- onHeavyCollision。
- onCrit。
- onKill。
- onEnemyEnterRadius。
- onSpinLow。
- onGuardBreak。

### 4.5.18 Loot Quantity / Rarity

POE-like item quantity / rarity 對應 part quantity / rarity。

```text
dropAttempts =
  baseDropChance
  * arenaRewardMultiplier
  * (1 + partQuantity)
  * survivalEfficiency

rarityScore =
  1
  + partRarity
  + arenaRarity
  + bossRarityBias

rareChance =
  baseRareChance * rarityScore ^ rarityExponent
```

注意：

- Quantity 影響掉落次數。
- Rarity 影響稀有度升級。
- Boss/Elite 有獨立 reward bias。

### 4.5.19 Expected Value 與實際戰鬥事件

Idle/Auto battle 需要穩定手感，因此採雙層模型：

1. Engine 結算用 EV，避免每秒結果過度震盪。
2. 畫面事件用 deterministic RNG，讓玩家看到 miss/crit/drop。

```text
simulationExpectedDps = deterministic formula EV
visualEvents = seeded RNG around EV
```

這樣能保留 POE-like build math，又能讓戰鬥畫面有節奏。

### 4.5.20 實作優先順序

第一階段必做：

1. base + flat + increased/reduced + more/less。
2. attack/drive base 分離。
3. hit chance。
4. crit EV。
5. resistance + penetration。
6. Guard armour-like formula。
7. DoT 分離。
8. trigger cooldown。
9. quantity/rarity。

第二階段：

1. conversion / gain as extra。
2. ailment magnitude。
3. stagger/ring-out。
4. reservation。
5. local/global modifier 完整拆分。

## 5. 陀螺屬性系統

### 5.1 主要屬性

| 屬性 | 類型 | 對應 POE-like 角色 |
| --- | --- | --- |
| Spin Integrity | 防禦池 | Life |
| Flux Guard | 防禦池 | Energy Shield |
| Guard | 減傷 | Armour |
| Drift | 迴避 | Evasion |
| Grip | 抗擊退/抗出界 | Stun/Knockback defense |
| Impact | 撞擊傷害 | Attack Damage |
| Edge | 暴擊傾向 | Critical Chance |
| Fracture | 暴擊倍率 | Critical Multiplier |
| RPM | 行動速度 | Attack/Cast Speed |
| Mass | 撞擊權重 | Stun/Knockback power |
| Resonance | 技能恢復 | Mana/Spirit scaling |
| Flux | 技能能量 | Mana |
| Heat | 火焰異常資源 | Ignite/Burn |
| Static | 閃電異常資源 | Shock/Chain |
| Void Pull | 虛空控制 | Chaos/Void crowd control |
| Part Quantity | 掉落數量 | Item Quantity |
| Part Rarity | 掉落稀有 | Item Rarity |

### 5.2 衍生屬性

| 衍生屬性 | 公式方向 |
| --- | --- |
| Collision DPS | Impact * RPM * hit chance * uptime |
| Ring-Out Pressure | Mass * speed * knockback modifiers - enemy Grip |
| Stability EHP | Integrity + Flux Guard after Guard/Drift |
| Skill Throughput | Resonance * cooldown recovery * trigger rate |
| Arena Efficiency | kill speed * survival * item output |

### 5.3 Modifier 類型

保留 POE-like modifier algebra：

- flat
- increased
- reduced
- more
- less
- penetration
- extraAs
- conversion
- chance
- cooldown
- reservation
- trigger
- ailmentMagnitude
- ailmentDuration

陀螺命名：

| Modifier Type | 顯示文案 |
| --- | --- |
| flat | `+12 Impact` |
| increased | `18% increased RPM` |
| more | `22% more Collision Damage` |
| reduced | `10% reduced Recoil Taken` |
| less | `15% less Grip while Overheated` |
| penetration | `Hits ignore 12% Guard` |
| extraAs | `Gain 20% of Impact as Heat Damage` |
| conversion | `40% of Impact converted to Static` |
| trigger | `Trigger Spark Lash on Heavy Collision` |

## 6. 陀螺架構

原本 class 改為 Top Frame。

### 6.1 Swift Razor

原型：高速攻擊、暴擊、碎片射擊。  
視覺：細長金屬刃、青綠拖尾、切割火花。

基礎傾向：

- 高 RPM。
- 高 Drift。
- 高 Edge。
- 低 Mass。
- 中低 Integrity。

適合：

- Projectile-like shard builds。
- Critical burst。
- Hit-and-run collision。
- 高掉落效率但較脆。

### 6.2 Ember Crucible

原型：火焰、熔痕、持續場地傷害。  
視覺：黑鐵核心、紅熱裂縫、熔岩軌跡。

基礎傾向：

- 高 Resonance。
- 高 Heat。
- 中等 Integrity。
- 中等 RPM。
- 低 Drift。

適合：

- Burn zones。
- Auto-trigger spells。
- AoE arena control。
- 連鎖爆燃。

### 6.3 Iron Bastion

原型：重型、防禦、反傷、Ring Out。  
視覺：厚重輪廓、黃銅鉚釘、沉重撞擊波。

基礎傾向：

- 高 Mass。
- 高 Guard。
- 高 Grip。
- 高 Integrity。
- 低 RPM。

適合：

- Knockback。
- Thorns/Recoil。
- Boss tank。
- Slow but reliable farming。

### 6.4 Void Gyre

原型：拉扯、重力、能量崩解。  
視覺：黑紫旋渦、玻璃碎片、空間裂紋。

基礎傾向：

- 高 Void Pull。
- 高 Flux。
- 中等 RPM。
- 低 Guard。
- 高控制。

適合：

- Pull enemies。
- Damage over time。
- Flux overload。
- Boss debuff。

### 6.5 Storm Needle

原型：連鎖、瞬衝、電弧。  
視覺：藍白電線、瞬間位移殘影。

基礎傾向：

- 高 Static。
- 高 trigger rate。
- 高 cooldown recovery。
- 中低 Integrity。

適合：

- Chain。
- Shock。
- Cooldown loops。
- multi-target arena。

### 6.6 Bone Satellite

原型：副陀螺、召喚、持續壓迫。  
視覺：主陀螺周圍有小型齒輪衛星。

基礎傾向：

- 高 minion scaling。
- 高 duration。
- 中等防禦。
- 主體傷害較低。

適合：

- Satellite tops。
- Swarm pressure。
- Passive automation。
- safer idle builds。

## 7. 零件槽位

### 7.1 槽位總表

| 槽位 | 作用 | POE-like 對應 |
| --- | --- | --- |
| Core | 基礎屬性與主能量 | Body / character base |
| Attack Ring | 撞擊形狀與技能相容 | Weapon |
| Weight Disk | Mass、Guard、Recoil | Armour / shield |
| Tip | 移動軌跡、Grip、Drift | Boots / movement |
| Launcher | 開局 RPM、充能、節奏 | Flask / weapon swap / resource |
| Seal | 特殊詞綴、保留、觸發 | Jewel / charm |
| Circuit Chip | 被動插槽 | Passive cluster |

### 7.2 Core

控制：

- Spin Integrity。
- Flux。
- Resonance。
- 基礎防禦層。
- 主架構限制。

命名模板：

```text
{Material}{Noun} Core
Ashwrought Heart Core
Glassvein Reactor Core
Black-Iron Wound Core
```

### 7.3 Attack Ring

控制：

- Impact。
- Edge。
- Fracture。
- 技能 tag 相容。
- 碰撞半徑。

類型：

- Blade Ring：切割、暴擊。
- Hammer Ring：重擊、擊退。
- Thorn Ring：反傷、流血。
- Arc Ring：電弧、連鎖。
- Ember Ring：火焰、地面熔痕。
- Void Ring：拉扯、失衡。

### 7.4 Weight Disk

控制：

- Mass。
- Guard。
- Recoil taken。
- Ring-out resistance。

### 7.5 Tip

控制：

- 移動模式。
- Grip。
- Drift。
- RPM。
- 出界風險。

Tip 行為：

| Tip Type | 行為 |
| --- | --- |
| Needle Tip | 高速直線追擊 |
| Anchor Tip | 穩定繞圈 |
| Hook Tip | 主動貼近敵人 |
| Wraith Tip | 穿越危險區 |
| Furnace Tip | 留下火焰路徑 |
| Magnet Tip | 拉扯敵人 |

### 7.6 Launcher

控制：

- 開局 RPM。
- 首次技能觸發速度。
- 自動戰鬥節奏。
- Service Charge。

### 7.7 Seal

小型特殊槽：

- 掉落效率。
- 元素加成。
- 保留效果。
- 自動觸發。
- 稀有 build-enabler。

## 8. 技能模組系統

### 8.1 主技能模組

主技能模組對應 Skill Gem，但改成 Drive Core。

資料欄位：

```ts
type DriveCoreDef = {
  id: string;
  displayName: string;
  tags: DriveTag[];
  requiredRingTags?: string[];
  baseCooldown: number;
  trigger: TriggerRule;
  damageProfile: DamageProfile;
  arenaEffect?: ArenaEffectDef;
  visualEffect: VisualEffectDef;
};
```

### 8.2 觸發規則

玩家不手動施放。技能自動發動。

TriggerRule：

- onCooldown。
- onCollision。
- onHeavyCollision。
- onCrit。
- onKill。
- onSpinLow。
- onEnemyEnterRadius。
- onBossPhase。
- whileChannelingSpin。
- afterRingOut。

### 8.3 原創主技能清單

| ID | 名稱 | Tags | 自動觸發 | 效果 |
| --- | --- | --- | --- | --- |
| drive_shard_barrage | Shard Barrage | attack, projectile, physical, critical | onCollision | 撞擊時射出金屬碎片 |
| drive_ember_scour | Ember Scour | spell, fire, area, duration | onCooldown | 留下燃燒軌跡 |
| drive_granite_crash | Granite Crash | attack, melee, physical, impact | onHeavyCollision | 扇形震波與擊退 |
| drive_storm_lattice | Storm Lattice | spell, lightning, chain | onCollision | 電弧連鎖敵人 |
| drive_bone_orbit | Bone Orbit | minion, duration, physical | onCooldown | 召喚衛星陀螺 |
| drive_rift_maw | Rift Maw | void, area, control | onEnemyEnterRadius | 拉扯並造成失衡 |
| drive_magnet_reave | Magnet Reave | physical, control, melee | onCooldown | 產生磁性衝刺 |
| drive_iron_dirge | Iron Dirge | thorns, physical, duration | whenDamaged | 反彈並降低敵 RPM |
| drive_glass_comet | Glass Comet | projectile, cold, critical | onCrit | 發射穿透玻璃彈 |
| drive_redline_overdrive | Redline Overdrive | speed, fire, risk | onKill | 短時間大幅提升 RPM，增加失控風險 |

### 8.4 技能 tag 命名

DriveTag：

```text
attack
spell
projectile
melee
area
duration
chain
minion
physical
fire
cold
lightning
void
critical
speed
control
thorns
risk
```

不使用 POE2 原技能名，避免 IP 依賴。

## 9. 輔助模組系統

### 9.1 對應

Support Gem 改成 Tuning Rune。

功能：

- 不給新技能。
- 修改 Drive Core。
- 依 tag 判斷相容。
- 有 cost/reservation/instability multiplier。

### 9.2 資料欄位

```ts
type TuningRuneDef = {
  id: string;
  displayName: string;
  requiredTags: DriveTag[];
  excludedTags?: DriveTag[];
  modifiers: ModifierDef[];
  costMultiplier: number;
  instability?: number;
  visualAugment?: VisualAugmentDef;
};
```

### 9.3 原創輔助清單

| ID | 名稱 | 相容 | 效果 |
| --- | --- | --- | --- |
| rune_splintered_edge | Splintered Edge | projectile | 更多投射物，較少單發傷害 |
| rune_red_heat | Red Heat | fire | 提升燃燒時間與 Heat buildup |
| rune_deep_bearing | Deep Bearing | physical, melee | 更多撞擊傷害，降低 RPM |
| rune_echo_coil | Echo Coil | spell | 技能有機率重複 |
| rune_magnetic_teeth | Magnetic Teeth | control | 拉扯增強，增加 Flux cost |
| rune_shock_fork | Shock Fork | lightning, chain | 連鎖數增加 |
| rune_hollow_mass | Hollow Mass | impact | 擊退提高，穩定降低 |
| rune_guarded_spin | Guarded Spin | duration | 持續效果期間獲得 Guard |
| rune_knife_orbit | Knife Orbit | minion | 衛星陀螺攻擊頻率提高 |
| rune_last_rotation | Last Rotation | risk | 低 Spin 時爆發，之後失衡 |

### 9.4 插槽規則

- 初始每顆主技能有 2 個輔助槽。
- 中期升到 3。
- 後期靠稀有材料/被動升到 5。
- 同一技能不可重複裝同一顆 rune。
- 每顆 rune 可有 `supportFamily` 防止類似效果疊太多。

## 10. 稀有度與零件生成

### 10.1 稀有度

| 稀有度 | 顯示 | 規則 |
| --- | --- | --- |
| common | Common | 無詞綴或少量 implicit |
| tuned | Tuned | 1-2 詞綴 |
| engraved | Engraved | 4-6 詞綴 |
| relic | Relic | 固定特殊規則，少量可變 |
| mythic | Mythic | 終局 chase，第一版不做 |

避免使用 POE2 的 Normal/Magic/Rare/Unique 原樣命名，語意可相似但品牌語言原創。

### 10.2 生成流程

```text
choose arena drop table
-> choose part slot
-> choose base part
-> assign item level
-> roll rarity
-> apply implicit
-> roll prefix/suffix count
-> filter engravings by slot, item level, tags, group
-> weighted roll engravings
-> roll tier values
-> create PartInstance with seed/provenance
```

### 10.3 詞綴槽

- Prefix：主要力量，如 Impact、RPM、Heat、Static。
- Suffix：防禦、控制、掉落、觸發條件。
- Relic Line：Relic 專屬規則，不進一般 pool。

### 10.4 詞綴群組

範例：

```text
impact_flat
impact_percent
rpm_percent
guard_percent
spin_integrity_flat
flux_guard_percent
mass_flat
grip_percent
drift_percent
heat_damage
static_chain
void_pull
part_quantity
part_rarity
cooldown_recovery
trigger_chance
```

## 11. 打造貨幣

POE2-like currency system 改成 Forge Media。

| 材料 | 功能 |
| --- | --- |
| Ash Shard | 基礎分解材料 |
| Temper Glass | 重骰數值 |
| Iron Psalm | 增加一條詞綴 |
| Null Bearing | 移除一條詞綴 |
| Brass Omen | 升級稀有度 |
| Echo Core | 重骰全部詞綴 |
| Red Seal | 鎖定一條詞綴後打造 |
| Mirror Spark | 複製零件外觀/模板，終局 chase |

不使用 POE2 貨幣名稱。

## 12. 競技盤與終局

### 12.1 區域改名

原區域改為 Arena Circuit。

| 舊概念 | 新名稱 | 風格 |
| --- | --- | --- |
| Cinder Road | Cinder Crucible | 入門火痕盤 |
| Salt Catacomb | Brine Ossuary Ring | 白骨鹽晶盤 |
| Glass Mire | Glass Mire Basin | 玻璃濕地盤 |
| Red Chancel | Red Chancel Disk | 血色祭壇盤 |
| Moon Furnace | Lunar Furnace Bowl | 月鐵熔爐盤 |
| Echo Vault | Echo Vault Gyre | 終局回聲盤 |

### 12.2 場地詞綴

Map modifier 對應 Arena Modifier：

- `+ Monster Top Mass`
- `+ Enemy RPM`
- `Enemies leave Burning Grooves`
- `Outer Rail periodically opens`
- `Arena has Magnetic Storms`
- `Boss Top gains extra Guard`
- `More Part Quantity`
- `More Part Rarity`
- `More Relic Chance`

### 12.3 終局網絡

POE-like Atlas 改成 Circuit Network。

元素：

- Node：一個競技盤。
- Modifier：盤面規則。
- Boss Gate：需要 key 或進度。
- Pinnacle：Apex Spinner。
- Anomaly：特殊事件。
- Forge Shrine：打造加成節點。
- Memory Track：重跑過去 boss 的節點。

### 12.4 Boss 類型

| Boss Type | 行為 |
| --- | --- |
| Crusher | 高 Mass、Ring Out 壓力 |
| Furnace | 火焰場地、持續 Spin drain |
| Mirror | 分身、反射、假目標 |
| Choir | 召喚衛星陀螺 |
| Null | 重力拉扯、技能封鎖 |
| Crown | 多階段 Pinnacle Boss |

## 13. 自動戰鬥運動模型

### 13.1 每 tick 狀態

```ts
type TopRuntimeState = {
  id: string;
  team: "player" | "enemy";
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  spinIntegrity: number;
  maxSpinIntegrity: number;
  spinPower: number;
  maxSpinPower: number;
  flux: number;
  maxFlux: number;
  rpm: number;
  mass: number;
  grip: number;
  drift: number;
  guard: number;
  instability: number;
  activeEffects: RuntimeEffect[];
};
```

### 13.2 AI 行為

玩家陀螺：

- 自動尋找最近敵人。
- 若自身 Grip 高，採貼身壓制。
- 若 Drift 高，採繞圈切入。
- 若 projectile skill，高速繞圈保持距離。
- 若 low spin，轉向外圈恢復或避戰。

敵方陀螺：

- Pack：直線接近。
- Elite：有一個特殊行為。
- Boss：多階段行為。

### 13.3 碰撞計算

簡化版：

```text
relativeVelocity = distance of velocity vectors
impactPower = relativeVelocity * attacker.mass * attacker.impact
guardedDamage = impactPower * mitigation(defender.guard)
spinDamage = impactPower * spinDrainScalar
knockback = impactPower / defender.mass - defender.grip
instabilityGain = knockback * instabilityScalar
```

### 13.4 出界

```text
if distanceFromCenter + radius > arenaRadius:
  if gripCheck fails:
    ringOut
  else:
    bounce with spinPower loss
```

## 14. 技能視覺規則

### 14.1 Tag -> visual

| Tag | 視覺 |
| --- | --- |
| physical | 金屬火花、白黃衝擊線 |
| fire | 熔紅拖尾、燃燒軌跡 |
| cold | 玻璃霜裂、藍白碎片 |
| lightning | 電弧、瞬間折線 |
| void | 黑紫扭曲、吸引環 |
| projectile | 從陀螺外緣射出碎片 |
| area | 圓形/扇形盤面波紋 |
| critical | 短暫金色閃光 |
| minion | 小陀螺衛星 |
| duration | 殘留場地 decal |
| chain | 多目標連線 |
| control | 磁力線、拉扯方向箭頭 |

### 14.2 第一版 Canvas 特效

必做：

- 陀螺旋轉紋理。
- 拖尾。
- 碰撞火花。
- 血條/旋轉力環。
- 掉落飛出。
- 火焰軌跡。
- 電弧。
- 虛空吸引圈。
- Boss 出場震動。

延後：

- 粒子物理。
- 真實音效。
- 高級 shader。

## 15. UI/UX 佈局

### 15.1 首屏

```text
┌─────────────────────────────────────────────┐
│ Top Bar: Arena / Wave / Speed / Drops       │
├─────────────────────────────────────────────┤
│                                             │
│              2D Top-Down Arena              │
│                                             │
│       player top  -> auto combat -> enemies │
│                                             │
├─────────────────────────────────────────────┤
│ Start / Pause / x1 x2 / Build / Inventory   │
└─────────────────────────────────────────────┘
```

### 15.2 桌面

- 70% 寬度給競技盤。
- 右側窄欄顯示當前 build 與掉落 toast。
- 背包預設收合。
- 裝備比較用 drawer。

### 15.3 手機

- 競技盤在第一屏。
- HUD 變成上下兩條。
- 背包用 bottom sheet。
- 詳細數值放次級頁。

### 15.4 UI 不應該做

- 不把 DPS/EHP 卡片放滿首屏。
- 不在戰鬥盤上覆蓋大型說明。
- 不把每個系統都常駐展開。

## 16. 命名規則

### 16.1 ID 規則

全部小寫 snake_case。

```text
frame_swift_razor
frame_ember_crucible
drive_shard_barrage
rune_splintered_edge
part_core_ashwrought_heart
affix_impact_flat_1
arena_cinder_crucible
boss_brass_judicator
currency_ash_shard
```

### 16.2 顯示名稱規則

語氣：

- 黑鐵。
- 黃銅。
- 熔火。
- 玻璃。
- 回聲。
- 裂隙。
- 軸承。
- 齒輪。
- 祭壇。
- 合金。

避免：

- 直接使用 POE2 官方名稱。
- 太現代科技詞，如 laser cannon、AI chip。
- 太可愛玩具詞。

### 16.3 零件命名模板

Common/Tuned/Engraved：

```text
{Prefix} {BasePart} of {Suffix}
Ashworn Blade Ring of Overturning
Glassvein Needle Tip of Static Wake
Black-Iron Weight Disk of the Deep Bearing
```

Relic：

```text
{RelicName}, {Subtitle}
The Ninth Bearing, Heart of the Locked Gyre
Redline Covenant, Engine of the Last Rotation
Mirror-Tooth Halo, Ring of False Impacts
```

### 16.4 Arena 命名模板

```text
{Material/Theme} {ArenaNoun}
Cinder Crucible
Brine Ossuary Ring
Glass Mire Basin
Red Chancel Disk
Lunar Furnace Bowl
Echo Vault Gyre
```

ArenaNoun：

- Crucible
- Ring
- Basin
- Disk
- Bowl
- Gyre
- Foundry
- Vault
- Shrine
- Rail

### 16.5 Affix 顯示命名

Prefix 例：

- Serrated
- Red-Hot
- Glasscut
- Deep-Bearing
- Magnetized
- Hollow
- Volt-Etched
- Ashwrought
- Gravebound

Suffix 例：

- of Overturning
- of Static Wake
- of the Locked Rail
- of Furnace Drag
- of the Hollow Orbit
- of Splintered Motion
- of Deep Grip
- of Last Rotation

## 17. 資料結構規劃

### 17.1 建議目錄

```text
src/game/data/
  topFrames.ts
  driveCores.ts
  tuningRunes.ts
  topPartBases.ts
  engravings.ts
  arenaCircuits.ts
  arenaModifiers.ts
  bossTops.ts
  forgeMedia.ts
  relicParts.ts

src/game/engine/
  topStats.ts
  topAssembly.ts
  topCombat.ts
  topPhysics.ts
  arenaRuntime.ts
  topLoot.ts
  topCrafting.ts
  topScoring.ts
  topProgression.ts

src/game/ui/
  arena/
    CombatArena.tsx
    ArenaCanvas.tsx
    ArenaHud.tsx
  assembly/
    TopAssemblyPanel.tsx
  inventory/
    PartInventoryDrawer.tsx
    PartComparePanel.tsx
```

### 17.2 Balance version

所有生成物都必須保存：

```ts
generatedBy: {
  arenaId: string;
  enemyLevel: number;
  balanceVersion: string;
  seed: string;
}
```

### 17.3 POE2 data adapter 邊界

若未來要接外部資料，只能放在：

```text
src/game/data/importers/poeLikeAdapter.ts
```

轉換規則：

- 輸入：外部資料。
- 輸出：本遊戲原創 schema。
- 不保留外部名稱。
- 不保留外部描述文案。
- 不保留官方完整數值表，除非已確認授權可用。
- 可以保留公式型態與運算順序，例如 increased/reduced 加法桶、more/less 乘法桶、conversion、gain as extra、mitigation、hit/crit、ailment、trigger/cooldown。
- 平衡用的 base values、權重、掉落率、怪物曲線，以本專案原創 balance table 重新建立。

## 18. 第一版開發切片

### Slice A：戰鬥盤替換

目標：

- 首屏只有競技盤是主角。
- 玩家陀螺自動打敵方陀螺。
- 敵人自動生成。

交付：

- `CombatArena.tsx`
- Canvas render loop。
- 玩家/敵方陀螺位置。
- 自動追蹤。
- 碰撞火花。
- 擊敗後下一波。

### Slice B：技能特效

目標：

- 不同 Drive Core 有不同視覺。
- 技能自動觸發。

交付：

- fire trail。
- projectile shard。
- lightning chain。
- void pull。
- satellite orbit。

### Slice C：零件系統

目標：

- 裝備欄轉為陀螺零件。
- 掉落從裝備變為零件。

交付：

- Core/Ring/Disk/Tip/Launcher/Seal。
- 零件比較 Impact/RPM/Stability/Part Rarity。
- 裝備後即時改變戰鬥。

### Slice D：打造與終局

目標：

- 分解變材料。
- 打造改詞綴。
- 終局 arena node 初版。

## 19. 驗收標準

第一個可玩版本必須做到：

- 開頁 3 秒內看到 2D 俯視競技盤。
- 按 Start 後敵方陀螺自動生成。
- 玩家陀螺自動追擊與碰撞。
- 不需要手動施法。
- 至少 5 種主技能有明顯不同特效。
- 擊敗敵人會掉落零件。
- 裝備零件後戰鬥表現可見改變。
- 背包不是首屏主體。
- 390px 手機可玩。
- `pnpm test` 和 `pnpm build` 通過。

## 20. 目前專案改造策略

目前專案已有：

- Modifier algebra。
- Combat/Loot/Defense simulation。
- Item generation。
- Inventory/equipment。
- Farming tick。
- Encounter stage prototype。

改造方式：

1. 保留 engine 的 modifier、RNG、loot、item generation 思想。
2. 逐步把 `ItemInstance` 改名或包裝為 `PartInstance`。
3. 把 equipment slot 轉為 top part slot。
4. 把 skill/support data 轉為 drive/rune data。
5. 把中心 UI 替換為 Canvas arena。
6. 把目前右側/左側 dashboard 收合成 build drawer。
7. 最後更新 save schema。

不建議一次刪光重寫，因為目前純 engine 與測試仍可重用。

## 21. 待討論決策

需要確認：

1. 陀螺是單顆主陀螺，還是後期可帶副陀螺隊伍？
2. Boss wave 是每 8 波固定，還是依 arena node 決定？
3. 玩家是否可以調整 AI stance，例如 aggressive / orbit / defensive？
4. 零件稀有度是否保留 relic 以上 chase？
5. 是否要做「陀螺出界」作為核心勝負條件？
6. 技能視覺優先做火/電/物理/虛空/召喚哪幾種？
7. 手機版是否允許戰鬥中打開背包，或必須 pause？
