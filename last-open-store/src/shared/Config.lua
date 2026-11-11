-- The Last Open Store: global tuning. Every number that shapes the game lives
-- here (or in the catalog modules next to it), so balancing never requires
-- touching gameplay code.
local Config = {}

Config.GameName = "The Last Open Store"
Config.Debug = false -- true prints detailed [LOS] logs in the Output window

---------------------------------------------------------------------------
-- Saving
---------------------------------------------------------------------------
Config.DataStoreName = "LastOpenStore_Player_v1"
Config.LeaderboardEarned = "LastOpenStore_TopEarned_v1"
Config.LeaderboardRating = "LastOpenStore_TopRating_v1"
Config.SessionLockTimeout = 600 -- a lock older than this is considered abandoned
Config.AutosaveInterval = 90

---------------------------------------------------------------------------
-- Economy
---------------------------------------------------------------------------
Config.StartingCash = 150
Config.StartingInventory = { chips = 6, cola = 6, gummy = 4 } -- in the backroom (shelves start stocked too)
Config.MaxLevel = 50
Config.MaxOrderQuantity = 100

function Config.XpForLevel(level)
	-- XP needed to go from `level` to `level + 1`
	return math.floor(60 * level ^ 1.6)
end

---------------------------------------------------------------------------
-- World
---------------------------------------------------------------------------
Config.PlotCount = 6 -- set Max Players to 6 in Game Settings

-- Day/night: one full 24h cycle takes this many real minutes
Config.DayLengthMinutes = 12
Config.NightStart = 18.5
Config.NightEnd = 5.5
Config.StartClockTime = 17.2
Config.NightEventChance = 0.7

---------------------------------------------------------------------------
-- Customers
---------------------------------------------------------------------------
Config.CustomerSpawnInterval = 8 -- seconds between customers per store, before bonuses
Config.NightCustomerBonus = 1.25 -- it's the last open store: nights are busier
Config.MaxCustomersPerStore = 3
Config.GlobalCustomerCap = 30
Config.MysteryCustomerChance = 0.07
Config.ReviewChance = 0.4
Config.Pedestrians = 4
Config.NPCWalkSpeed = 11

-- Roblox's default R15 animations (owned by Roblox, usable in any game)
Config.NPCAnimations = {
	Walk = "rbxassetid://507777826",
	Idle = "rbxassetid://507766388",
}

---------------------------------------------------------------------------
-- Shelves
---------------------------------------------------------------------------
Config.SlotsPerUnit = 4
Config.BaseSlotCapacity = 8
Config.StockInteractDistance = 16

---------------------------------------------------------------------------
-- Daily rewards (7-day streak). Day 7 also unlocks the Hearts checkout effect.
---------------------------------------------------------------------------
Config.DailyRewards = { 100, 150, 250, 350, 500, 700, 1200 }
Config.DailyChallengesPerDay = 3
Config.FriendVisitBonus = 75

---------------------------------------------------------------------------
-- Optional audio. Paste sound asset IDs you own (or free ones from the
-- Creator Store) to enable ambience. Empty = no sound and no volume setting.
---------------------------------------------------------------------------
Config.Audio = {
	Rain = "",
	NightAmbience = "",
	DayAmbience = "",
	Register = "",
}

---------------------------------------------------------------------------
-- Optional Robux cosmetics. Create Developer Products in the Creator
-- Dashboard and paste their IDs. ProductId 0 = not for sale (the item is
-- still earnable through gameplay). Nothing here affects gameplay power.
---------------------------------------------------------------------------
Config.RobuxProducts = {
	{ Key = "ThemeGalaxy", ProductId = 0, Name = "Galaxy Store Theme", Grant = { Kind = "Theme", Id = "Galaxy" } },
	{ Key = "ThemeSnowfall", ProductId = 0, Name = "Snowfall Store Theme", Grant = { Kind = "Theme", Id = "Snowfall" } },
	{ Key = "UniformStarlight", ProductId = 0, Name = "Starlight Uniform", Grant = { Kind = "Uniform", Id = "Starlight" } },
	{ Key = "UniformRoyal", ProductId = 0, Name = "Royal Uniform", Grant = { Kind = "Uniform", Id = "Royal" } },
	{ Key = "EffectRainbow", ProductId = 0, Name = "Rainbow Checkout Effect", Grant = { Kind = "Effect", Id = "Rainbow" } },
	{ Key = "DecorKoi", ProductId = 0, Name = "Neon Koi Sign", Grant = { Kind = "Decor", Id = "KoiSign" } },
}

return Config
