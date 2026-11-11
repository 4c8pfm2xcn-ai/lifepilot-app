# Getaway City — an original cops & robbers Roblox game

An open-world **cops vs. robbers** game in the same genre as Roblox hits like *Jailbreak*,
but with its own name, map, rules and code. Everything (map, cars, tools, UI) is generated
from scripts, so there are no assets to upload: open the place file, press Play, publish.

## How to play

| Team | Loop |
|---|---|
| **Criminals** | Walk into an **OPEN** store and stay inside to fill your loot bag → the alarm alerts the police → escape → stand on the green **CASH IN** pad at the Hideout to turn your bag into cash. Robbing adds a **bounty** on your head. Use **Boost** to outrun cops. |
| **Police** | Watch for **ALARM** notifications → drive to the store → **Taser** wanted criminals (it knocks them out of cars) → **Handcuffs** up close to arrest them and earn a share of their bounty. |
| **Prisoners** | Arrested criminals wait out a 60s sentence in the City Jail… or find the **secret vent** and unscrew it to break out (escaping adds bounty). |

Progression: XP and **levels** unlock bigger heists (Bank at Lv 2, Museum at Lv 4). Cash buys faster
cars (Muscle Car, Supercar, Police Interceptor). Players get a **daily login streak** reward, and the
richest players are shown on a **global leaderboard** at the Hideout.

## Open it in Roblox Studio (2 minutes)

**Option A: no tools needed**
1. Download `GetawayCity.rbxlx` from this folder.
2. Double-click it (or Studio → *File → Open from File*).
3. Press **Play**. Pick a team. To test cops vs. robbers, go to the **Test** tab → *Clients and Servers* → 2 players → *Start*.

**Option B: Rojo (for ongoing development)**
```
rojo serve            # then connect from the Rojo Studio plugin
rojo build -o GetawayCity.rbxlx
```
If you edit files in `src/` without Rojo, regenerate the place with `python3 tools/build_place.py`.

### Saving progress (DataStores)
After you publish: *Home → Game Settings → Security → Enable Studio Access to API Services*.
Without this, Studio play-tests work but don't save. In live servers, saving always works.

## Publish it

1. *File → Publish to Roblox* → create a new experience named **Getaway City** (or your own name).
2. In the [Creator Dashboard](https://create.roblox.com/dashboard/creations):
   - **Icon (512×512) and 3+ thumbnails (1920×1080)**: this is the #1 factor in click-through.
     Show action: a car chase, a police car with lights, a big “$” moment.
   - Genre: *Action*, max players **24–30** (servers need enough cops *and* robbers).
   - Fill in the **Maturity questionnaire** (this game has no blood or guns, only tasers and handcuffs).
3. Monetization (optional): create a **Game Pass** “VIP” and three **Developer Products** (cash packs),
   then paste their IDs into `src/shared/Config.lua` (`Config.GamePasses.VIP`, `Config.CashProducts`).
   Buttons stay greyed out as “coming soon” until an ID is set.
4. Re-publish after any change.

## Project layout

```
src/shared/Config.lua              every number: payouts, cooldowns, prices, speeds, IDs
src/server/Main.server.lua         starts everything
src/server/Services/
  MapBuilder      generates the city (stores, police station, jail, hideout, roads, car pads)
  DataService     DataStore save/load, leaderstats, XP/levels, daily reward, global leaderboard
  TeamService     teams, team menu requests, police cap (40%), spawning/respawning
  RobberyService  store states OPEN → ALARM → CLOSED, loot bags, bounty, cashing in
  ArrestService   handcuffs + taser (all checks server-side, exploit-resistant)
  JailService     jail timer, vent breakout
  ToolService     builds team tools
  VehicleService  buy/spawn cars, part-built cars with smooth physics
  ShopService     VIP pass + cash products (receipts are idempotent and saved)
src/client/UI.client.lua           team menu, HUD, store status, notifications, shop
src/client/Driving.client.lua      car controls (keyboard, gamepad, mobile)
```

## Research: why games like this blow up

What the biggest Roblox games have in common (Brookhaven RP, Blox Fruits, Grow a Garden, MM2, Jailbreak):

1. **A 30-second core loop that's fun alone and better with others.** Cops & robbers is
   built-in social conflict: every robbery creates a chase story.
2. **Three retention loops:** social (play with friends, roles), progression (levels, unlocks,
   cars), and unpredictability (who's robbing what, which store just opened).
3. **Constant reasons to come back:** daily rewards, timed store re-openings, leaderboards,
   and above all **frequent updates**. Top games update weekly.
4. **Works on phones.** Most Roblox players are on mobile. This game's UI and driving support touch.
5. **Fair, generous monetization.** Convenience and cosmetics, not pay-to-win (VIP doubles cash and
   doesn't make you unarrestable).

Benchmarks to aim for: Day-1 retention above **15%** and average session above **15 min** (average
Roblox games see D1 around 12–15% falling to ~1% by D90). Track these in Creator Dashboard → Analytics.

## Honest launch plan

No one can guarantee a game goes viral. Most games that grow do it by **iterating fast on real
player data**. A realistic path:

1. **Week 1: polish what players see first.** Great icon and thumbnails, a 15-second gameplay
   video, and replace a few generated buildings with nicer models from your own builds or free
   Creator Store models.
2. **Soft launch.** Play with friends and fix whatever confuses new players in their first minute.
3. **Small ad test.** Run Roblox **Sponsored Experiences** with a small budget and compare thumbnails.
   Pick the one with the best click-through rate.
4. **Short-form video.** TikTok / YouTube Shorts of funny chases and jailbreaks. Invite small
   Roblox YouTubers (with an in-game reward code, which is easy to add).
5. **Update every week** and announce it in the game title (“[UPDATE] Getaway City”). Ideas ranked
   by impact:
   - More heists with mini-puzzles (lasers, keycards, vault codes)
   - Car customization (colors, rims, spoilers): great cosmetic monetization
   - Helicopters for police, a moving armored-truck robbery
   - Crews/parties, seasonal events, a battle pass
   - Private servers (enable in Dashboard; free money, popular with friend groups)
6. Join a **Roblox group** and build a Discord community for update announcements and bug reports.

## Balancing cheat sheet (`Config.lua`)

- Robberies too easy? Raise `Duration` or lower `Payout`.
- Cops can't keep up? Lower criminal car `MaxSpeed`, raise `TaserRange`.
- Jail too boring? Lower `JailTime` or `VentTime`.
- Economy too fast/slow? Change car `Price`s and `DailyReward`.
