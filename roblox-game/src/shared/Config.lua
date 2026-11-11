-- Getaway City: every tunable number lives here so you can balance the game
-- without touching gameplay code. Shared by server and client.

local Config = {}

Config.GameName = "Getaway City"
Config.DataStoreName = "GetawayCity_PlayerData_v1"
Config.LeaderboardStoreName = "GetawayCity_TopCash_v1"

---------------------------------------------------------------------------
-- Players
---------------------------------------------------------------------------
Config.StartingCash = 500
Config.WalkSpeed = 16
Config.JumpHeight = 7.2
Config.RespawnDelay = 4

-- Daily login reward: DailyReward * streak (streak capped at DailyStreakCap)
Config.DailyReward = 250
Config.DailyStreakCap = 7

---------------------------------------------------------------------------
-- Teams
---------------------------------------------------------------------------
Config.Teams = {
	Police = { Name = "Police", Color = BrickColor.new("Bright blue") },
	Criminal = { Name = "Criminals", Color = BrickColor.new("Really red") },
	Prisoner = { Name = "Prisoners", Color = BrickColor.new("Neon orange") },
}
-- Police may make up at most this share of the server (always at least 1 slot)
Config.MaxPoliceShare = 0.4

---------------------------------------------------------------------------
-- Robberies
-- Position = center of the building on the ground. Door is on the +Z side.
---------------------------------------------------------------------------
Config.Robberies = {
	{
		Id = "GasStation", Name = "Fuel Stop",
		Position = Vector3.new(-170, 0, -40), Size = Vector3.new(30, 14, 24),
		Color = Color3.fromRGB(235, 200, 90),
		Duration = 10, Payout = 350, Cooldown = 90, Xp = 30, MinLevel = 1,
	},
	{
		Id = "Jewelry", Name = "Sparkle Jewelers",
		Position = Vector3.new(160, 0, 100), Size = Vector3.new(40, 18, 32),
		Color = Color3.fromRGB(170, 120, 210),
		Duration = 20, Payout = 1200, Cooldown = 180, Xp = 80, MinLevel = 1,
	},
	{
		Id = "Bank", Name = "City Bank",
		Position = Vector3.new(0, 0, -60), Size = Vector3.new(60, 24, 44),
		Color = Color3.fromRGB(200, 190, 160),
		Duration = 30, Payout = 2000, Cooldown = 240, Xp = 120, MinLevel = 2,
	},
	{
		Id = "Museum", Name = "City Museum",
		Position = Vector3.new(-40, 0, 220), Size = Vector3.new(56, 26, 40),
		Color = Color3.fromRGB(150, 160, 175),
		Duration = 40, Payout = 3500, Cooldown = 300, Xp = 180, MinLevel = 4,
	},
}
-- After the first robber triggers the alarm, the store stays robbable for
-- Duration + AlarmGrace seconds, then closes for its Cooldown.
Config.AlarmGrace = 25
-- Bounty added = Payout * BountyPerPayout
Config.BountyPerPayout = 0.5
Config.MaxBag = 5000
Config.VipMaxBag = 10000

---------------------------------------------------------------------------
-- Police
---------------------------------------------------------------------------
Config.ArrestRange = 9
Config.ArrestBaseReward = 150
Config.ArrestBountyShare = 0.75 -- cop earns this share of the robber's bounty
Config.ArrestXp = 60
Config.TaserRange = 40
Config.TaserCooldown = 6
Config.TaserStun = 2.5

---------------------------------------------------------------------------
-- Criminals / Jail
---------------------------------------------------------------------------
Config.BoostSpeed = 30
Config.BoostDuration = 4
Config.BoostCooldown = 20
Config.JailTime = 60
Config.EscapeBounty = 150
Config.EscapeXp = 40
Config.VentTime = 8 -- seconds a prisoner must stay at the vent to escape

---------------------------------------------------------------------------
-- Key map locations (ground-level centers)
---------------------------------------------------------------------------
Config.Locations = {
	PoliceStation = Vector3.new(0, 0, -260),
	Jail = Vector3.new(260, 0, -260),
	Hideout = Vector3.new(-300, 0, 260),
	Dealership = Vector3.new(-300, 0, -300),
}
Config.MapSize = 900

---------------------------------------------------------------------------
-- Vehicles (speeds in studs/second; players walk at 16)
---------------------------------------------------------------------------
-- Style picks the body shape: Car, Hyper, Monster, Kart or Flyer.
-- Glow is the underglow color (looks amazing at night).
-- Fly = true makes it a flying car (E = up, Q = down).
Config.Vehicles = {
	-- Everyone (Hideout)
	Sedan = { Display = "Street Sedan", Price = 0, MaxSpeed = 70, TurnRate = 1.9, Style = "Car", Color = Color3.fromRGB(80, 85, 95), Glow = Color3.fromRGB(120, 160, 255) },
	Muscle = { Display = "Muscle Car", Price = 4000, MaxSpeed = 95, TurnRate = 1.8, Style = "Car", Color = Color3.fromRGB(200, 60, 40), Glow = Color3.fromRGB(255, 120, 40) },
	Supercar = { Display = "Supercar", Price = 15000, MaxSpeed = 125, TurnRate = 1.7, Style = "Hyper", Color = Color3.fromRGB(250, 200, 30), Glow = Color3.fromRGB(255, 230, 80) },
	-- Insane Motors dealership
	Monster = { Display = "Monster Truck", Price = 20000, MaxSpeed = 95, TurnRate = 1.6, Style = "Monster", Color = Color3.fromRGB(60, 200, 80), Glow = Color3.fromRGB(80, 255, 120) },
	Rocket = { Display = "Rocket Kart", Price = 30000, MaxSpeed = 150, TurnRate = 2.5, Style = "Kart", Color = Color3.fromRGB(255, 90, 20), Glow = Color3.fromRGB(255, 60, 0), AlwaysFlames = true },
	Hyperion = { Display = "Hyperion X", Price = 50000, MaxSpeed = 180, TurnRate = 1.6, Style = "Hyper", Color = Color3.fromRGB(150, 40, 255), Glow = Color3.fromRGB(200, 80, 255) },
	SkyRider = { Display = "SkyRider (flies!)", Price = 75000, MaxSpeed = 120, TurnRate = 1.8, Style = "Flyer", Color = Color3.fromRGB(30, 200, 230), Glow = Color3.fromRGB(0, 255, 255), Fly = true },
	-- Police only (Police Station)
	Cruiser = { Display = "Police Cruiser", Price = 0, MaxSpeed = 95, TurnRate = 1.9, Style = "Car", Color = Color3.fromRGB(30, 50, 120), Glow = Color3.fromRGB(60, 100, 255), Team = "Police", Police = true },
	Interceptor = { Display = "Police Interceptor", Price = 8000, MaxSpeed = 125, TurnRate = 1.8, Style = "Car", Color = Color3.fromRGB(20, 20, 25), Glow = Color3.fromRGB(60, 100, 255), Team = "Police", Police = true },
	Thunder = { Display = "Thunder Pursuit", Price = 40000, MaxSpeed = 175, TurnRate = 1.7, Style = "Hyper", Color = Color3.fromRGB(15, 25, 60), Glow = Color3.fromRGB(80, 140, 255), Team = "Police", Police = true },
	SkyPatrol = { Display = "Sky Patrol (flies!)", Price = 60000, MaxSpeed = 120, TurnRate = 1.8, Style = "Flyer", Color = Color3.fromRGB(240, 240, 250), Glow = Color3.fromRGB(80, 140, 255), Team = "Police", Police = true, Fly = true },
}

-- Nitro: hold F (or the NITRO button). Fuel drains while used, then recharges.
Config.Nitro = { Multiplier = 1.6, Duration = 3, Recharge = 7 }
Config.BoostPadMultiplier = 1.8
Config.FlySpeedVertical = 45
Config.FlyMaxAltitude = 300

-- Airtime off ramps pays cash: StuntCashPerSecond per second in the air
Config.StuntMinAirtime = 0.7
Config.StuntCashPerSecond = 80
Config.StuntMaxCash = 400

-- Police spike strips slow criminal cars that drive over them
Config.SpikeCooldown = 12
Config.SpikeLifetime = 25
Config.SpikeSlowdown = 0.35 -- car top speed multiplier while spiked
Config.SpikeDuration = 6

-- Cash drops fall from the sky; first player to reach the crate wins
Config.CashDrop = { Interval = 150, FallTime = 12, Lifetime = 90, Min = 400, Max = 1200 }

-- Full day/night cycle length (neon and underglow shine at night)
Config.DayLengthMinutes = 12

---------------------------------------------------------------------------
-- Monetization. Create these in the Creator Dashboard, then paste the IDs.
-- An ID of 0 means "not set up yet" and the button is hidden/disabled.
---------------------------------------------------------------------------
Config.GamePasses = {
	VIP = 0, -- 2x robbery & arrest cash, bigger bag
}
Config.VipMultiplier = 2
Config.CashProducts = {
	{ Id = 0, Cash = 2500, Label = "$2,500" },
	{ Id = 0, Cash = 10000, Label = "$10,000" },
	{ Id = 0, Cash = 35000, Label = "$35,000" },
}

return Config
