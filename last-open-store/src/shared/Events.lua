-- Night events (10, one may roll each night, shared by the whole server)
-- and weekly events (rotate every Monday 00:00 UTC).
local Events = {}

Events.Night = {
	{ Id = "Downpour", Name = "Downpour", Weight = 14, Weather = "Storm",
		Desc = "A storm rolls in. Soaked travelers flood into open stores: +40% customers.",
		Mods = { CustomerRate = 1.4, TypeBoost = { wanderer = 4 } }, Color = Color3.fromRGB(90, 150, 255) },
	{ Id = "Craving", Name = "Craving Wave", Weight = 14,
		Desc = "The whole town suddenly wants %s! Those sell for double tonight.",
		Mods = { CategoryMult = 2 }, Color = Color3.fromRGB(255, 150, 60) },
	{ Id = "Fog", Name = "Fog Night", Weight = 10, Weather = "Fog",
		Desc = "A thick fog. Mysterious customers are three times as likely to appear.",
		Mods = { MysteryMult = 3 }, Color = Color3.fromRGB(180, 190, 210) },
	{ Id = "MoonlightMarket", Name = "Moonlight Market", Weight = 9,
		Desc = "Limited time: Moonlight Mooncakes can be ordered tonight only.",
		Mods = { CustomerRate = 1.1 }, Color = Color3.fromRGB(240, 210, 140) },
	{ Id = "Message", Name = "Mysterious Message", Weight = 9,
		Desc = "A folded note appeared on every counter. Read yours.",
		Mods = {}, Color = Color3.fromRGB(220, 120, 255) },
	{ Id = "Blackout", Name = "Blackout", Weight = 9,
		Desc = "The streetlights went out, but your store is still glowing. Tips are doubled.",
		Mods = { TipMult = 2, CustomerRate = 1.15 }, Color = Color3.fromRGB(255, 220, 120) },
	{ Id = "ShootingStars", Name = "Shooting Stars", Weight = 10,
		Desc = "Stars are falling around town! Catch them, and order Shooting Star Candy tonight.",
		Mods = {}, Color = Color3.fromRGB(255, 250, 190) },
	{ Id = "NightOwls", Name = "Night Owl Parade", Weight = 10,
		Desc = "The night owls are out in force: +30% customers, mostly night owls and gamers.",
		Mods = { CustomerRate = 1.3, TypeBoost = { nightowl = 4, gamer = 4 } }, Color = Color3.fromRGB(150, 120, 255) },
	{ Id = "CollectorsNight", Name = "Collector's Night", Weight = 9,
		Desc = "Collectors are in town paying 3x for rare items. Vintage Comics can be ordered tonight.",
		Mods = { TypeBoost = { collector = 6 }, RareMult = 3 }, Color = Color3.fromRGB(90, 170, 255) },
	{ Id = "Aurora", Name = "Aurora", Weight = 4,
		Desc = "Very rare: the sky shimmers green. All sales +25% and Aurora Jelly is available!",
		Mods = { PriceMult = 1.25 }, Color = Color3.fromRGB(120, 255, 180) },
}
Events.NightById = {}
for _, e in ipairs(Events.Night) do
	Events.NightById[e.Id] = e
end

Events.Weekly = {
	{ Id = "SnackWeek", Name = "Snack Week", Desc = "Snacks sell for 20% more all week.", Category = "Snacks", Mult = 1.2 },
	{ Id = "DrinkWeek", Name = "Hydration Week", Desc = "Drinks sell for 20% more all week.", Category = "Drinks", Mult = 1.2 },
	{ Id = "SweetWeek", Name = "Sweet Tooth Week", Desc = "Sweets sell for 20% more all week.", Category = "Sweets", Mult = 1.2 },
	{ Id = "NoodleWeek", Name = "Noodle Week", Desc = "Instant food sells for 20% more all week.", Category = "Instant", Mult = 1.2 },
	{ Id = "HomeWeek", Name = "Home Essentials Week", Desc = "Household goods sell for 20% more all week.", Category = "Household", Mult = 1.2 },
}

return Events
