# The Last Open Store

A multiplayer convenience-store simulator set in a rainy, neon-lit town at night. Every
player runs their own little store: order stock, physically stock shelves and coolers,
ring up 20 kinds of customers, expand and restyle the shop, and slowly uncover five
family-friendly town mysteries that span several play sessions.

Everything (the town, the stores, NPCs, UI) is generated from code. There are no
assets to import: open the place file, press Play, publish.

---

## Open it in Roblox Studio

**Option A: no tools needed**
1. Download `TheLastOpenStore.rbxlx` from this folder.
2. In Roblox Studio: **File → Open from File…** and pick it.
3. Press **Play**. The town builds itself in about a second and you spawn behind your counter.
4. Multiplayer test: **Test tab → Clients and Servers → 2 players → Start**.

**Option B: Rojo** (for ongoing development): `rojo serve` and connect from the Rojo plugin.
If you edit `src/` without Rojo, rebuild the place with `python3 tools/build_place.py`.

### Settings to set once (Home → Game Settings)
| Setting | Value | Why |
|---|---|---|
| Security → Enable Studio Access to API Services | **On** | Saving/leaderboards in Studio tests |
| Places → Max Players | **6** | One store plot per player |
| Avatar → Avatar type | R15 or R6 | Both supported |

Publish with **File → Publish to Roblox**, then add an icon and thumbnails in the
Creator Dashboard (night shots of a glowing store in the rain work great).

---

## The first 5 minutes
1. You spawn behind your counter. Your shelves are already stocked, and customers walk in within seconds.
2. A guide beam points at the register. Press **E** to ring up your first customer: *cha-ching*, floating cash, a review.
3. The tutorial walks you through **ordering stock**, **stocking a shelf** (walk up, press E) and **buying an upgrade**.
4. Around minute 3 the sun sets: the rain picks up, neon flickers on, and a **night event** may roll for the whole server.

## The first hour
Level-ups unlock new products. Upgrades add a cashier, a stock clerk, more customers and
better prices. Expanding knocks the stockroom wall back. Daily challenges, achievements
and the first mysterious customers appear.

## Long term
5 multi-session mysteries, 50 products to collect (some only on rare nights), 20 customers
to meet, 10 themes, decor, a 7-day streak, weekly events, seasonal cosmetics, leaderboards,
and visiting and rating friends' stores.

---

## Content
| Thing | Count | Where |
|---|---|---|
| Products | **50** (37 everyday, 8 rare/event, 5 secret) | `src/shared/Products.lua` |
| Customer types | **20** (15 everyday + 5 mysterious) | `src/shared/CustomerTypes.lua` |
| Store upgrades | **30** in 6 branches | `src/shared/Upgrades.lua` |
| Store expansion levels | **4** (Kiosk → Night Market) | Upgrades + `StoreBuilder.lua` |
| Store themes | **10** | `src/shared/Cosmetics.lua` |
| Uniforms / decor / checkout effects / layouts | 8 / 11 / 6 / 3 | `Cosmetics.lua` |
| Night events (rare, server-wide) | **10** | `src/shared/Events.lua` |
| Weekly events | 5 (rotate Mondays) | `Events.lua` |
| Achievements | **25** | `src/shared/Achievements.lua` |
| Daily challenge pool | 12 (3 per day) | `src/shared/Challenges.lua` |
| Mysteries | **5**, 25 clues | `src/serverstorage/Mysteries.lua` (server-only) |

---

## Architecture

```
ReplicatedStorage/Shared        catalogs + pure helpers (shared by server and client)
  Config, Util, Products, Upgrades, Effects, Cosmetics, Unlocks,
  CustomerTypes, Events, Achievements, Challenges
ReplicatedStorage/Remotes       created at runtime by Net
ReplicatedStorage/WorldState    attributes: Night, Weather, EventId/Name/Desc, Weekly...
ServerStorage/ServerData        Mysteries (clue answers stay off the client)
ServerScriptService/Server
  Main.server.lua               boot order (DataService starts last)
  Services/
    Log, Bus, Net               logging, in-server event bus, secure remote layer
    DataService                 DataStore saves with session locking
    WorldBuilder                the town, lamps, alleys, pier, mystery objects, zones
    StoreBuilder                one store's building, shelves, coolers, decor slots
    CycleService                day/night, weather, lighting moods, night + weekly events
    EconomyService              cash, XP/levels, ordering stock, sale pricing
    StoreService                plots, shelves, queue/checkout, clerk, customization, reviews
    CustomerService             customer AI (pathfinding), pedestrians, reviews
    ProgressionService          upgrades, achievements, daily rewards/challenges, leaderboards, tutorial
    MysteryService              clues, secret products, journal data
    SocialService               visits, ratings, friend bonuses
    ShopService                 optional Robux cosmetics (idempotent receipts)
    StateService                batched per-player state snapshots to the UI
StarterGui/MainUI (ScreenGui)   UIController + Kit, State, Hud, Menus, Journal, Customize, Extras, Dialogs
StarterPlayerScripts/Client     Atmosphere (rain, lightning, flicker, doors, ambience)
Workspace                       generated at runtime (Town, Stores, Customers)
```

Services talk through `Bus` events (`Sale`, `Stocked`, `ClueFound`, `NightStarted`, ...)
instead of requiring each other, which keeps the modules independent.

## Security
- **Server-authoritative economy.** The client only sends intentions ("buy 10 cola",
  "stock slot 2"). Prices, costs, rewards and inventory changes are computed and
  validated on the server.
- **One endpoint, validated.** All requests go through `Net.Handle`: a whitelist of
  actions, type and range checks on every argument (`Net.Int/Str/Key`), and a
  **token-bucket rate limit per player per action**. Handlers run in `pcall`, so a
  malformed request can't break a service.
- **Physical checks.** Stocking requires standing near the shelf, and ratings require
  being inside that store. Prompts are handled on the server.
- **No duplication.** Saves use **session locking** (`UpdateAsync` + JobId lock), so a
  player hopping servers can't load a copy before the old server saves. Customers' carts
  are returned to the shelves *before* the final save.
- **Safe failures.** If a save can't load, the player can play but **nothing is
  written**, so good data is never overwritten. Robux receipts are idempotent and only
  confirmed after the grant is saved.
- **Text filtering.** Store names go through `TextService` filtering. Ratings use
  fixed texts (no free text).

## Performance (mobile-friendly)
- One 0.5s loop handles all store spawning. Each customer is a single coroutine using
  `MoveTo` and pathfinding only indoors. Caps: 3–7 customers per store, 30 per server.
- State snapshots are batched (at most about 4 per second per player). Menus throttle
  their refreshes.
- Rain is one local emitter that follows the camera. Low graphics mode turns off bloom,
  flicker and particles.

---

## Build log: what each phase delivered

| Phase | Delivered | Checked by |
|---|---|---|
| 1. Architecture + map | Rojo layout, place builder, generated town: 6 plots, gas station, homes, tailor, park, alleys (walled, with steam and neon), boarded-up First Light Mart, town square, clock tower, pier and lighthouse, rain-slick puddles, street lamps | lint, XML build |
| 2. Ownership + economy | Plot claiming/reset, cash/XP/levels, leaderstats, ordering with discounts | lint, API check |
| 3. Inventory + shelves | Backroom inventory, 12 units (shelves + coolers), 4 slots each, physical stocking with distance checks, visual items and price tags, refill/clear/swap | lint, API check |
| 4. Customer AI | 20 personalities with budgets, preferences, patience, tips and dialogue; pathfinding; queue with patience bars; manual + auto checkout; reviews and ratings; walk/idle animations; pedestrians | lint, API check |
| 5. Night cycle + events | 12-minute day, lighting moods, rain/storm/fog, 10 server-wide night events (shooting stars to catch, blackout, aurora, ...) | lint |
| 6. Progression | 30 upgrades, 4 expansions, 25 achievements, daily streak, daily challenges, weekly event, seasonal unlocks, global leaderboards, tutorial | lint, API check |
| 7. UI + animations | HUD, 8 menus, stock and rating dialogs, toasts, guide beam, floating cash, checkout bursts, sliding doors, flicker, lighthouse sweep; scales for phone/PC/TV; gamepad (Y = menu bar, B = close) and keyboard shortcuts | lint, request/handler match |
| 8. Mysteries | 5 mysteries, 25 clues (dialogue, night-only objects, timed locations, multi-night patterns, next-day locks), 5 secret products, journal with hints | lint, API check |
| 9. Multiplayer | Store directory + teleport visits, guestbook ratings (once/day), friend visit bonus, shared events, leaderboards | lint, API check |
| 10. Saving + security | Session-locked saves, autosave, BindToClose, safe-failure mode, rate limits, validation, idempotent receipts | lint, review |

**About testing:** these checks ran in a code environment *without* Roblox Studio:
- A linter for block/bracket balance and undeclared variables
- A cross-module check that every `Module.Function` used actually exists
- A check that every client request has a server handler
- A successful place-file build

The game has **not yet been run inside Roblox**, so expect a few small runtime fixes on
the first Studio test. If anything errors, copy the red text from the **Output** window.

### Studio test checklist
1. Press Play: town builds, you spawn behind your counter, the HUD shows $150 and Level 1.
2. Customers walk in within ~10s, browse, and queue. Press E at the register: cash, review, tutorial step 2.
3. Order stock (O), walk to a shelf, press E, pick a slot. Items appear on the shelf.
4. Buy Sturdy Shelves (U). The tags show /12.
5. Wait for night (~2 min): lamps turn on and an event toast may appear.
6. 2-player test: the second player gets plot 2. Use Town (T), then Visit, then rate via the guestbook.

---

## Limitations and the working alternatives chosen
| Wanted | Limitation | What's in the game instead |
|---|---|---|
| Player trading | A safe trade needs both saves to commit atomically; half-applied trades are the classic dupe exploit | Visiting, ratings, friend bonuses (no item transfer) |
| Ambient audio | Sound assets must be owned or licensed by you; IDs can't be bundled | `Config.Audio` slots. Paste IDs to enable rain/day/night ambience; the volume setting appears automatically |
| Cosmetic emote animations | Custom animations must be uploaded to your account | Cosmetic **checkout effects** (particle bursts) + uniforms |
| Hand-modeled art | Everything is built from parts in code | A cohesive low-poly neon look. Swap in your own models any time; services only need the markers |
| Robux items | Developer Product IDs come from your account | `Config.RobuxProducts`. Buy buttons only appear once an ID is set, and every item is also earnable |

## Balancing cheat sheet
- Too slow early? Lower `Config.CustomerSpawnInterval`, raise product `Price`s.
- Too much money? Raise upgrade `Cost`s or `Config.XpForLevel`.
- Mysteries too slow? Raise `Config.MysteryCustomerChance`.
- Night too short? Raise `Config.DayLengthMinutes`.
