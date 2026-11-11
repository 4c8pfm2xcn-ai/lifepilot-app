-- Store customization catalog: 10 themes, uniforms, decor, checkout effects,
-- shelf layouts and sign colors. Every item is earnable through gameplay;
-- some can ALSO be bought with Robux (see Config.RobuxProducts).
-- Unlock rules are "any of" lists, checked by Unlocks.lua.
local Cosmetics = {}
local C = Color3.fromRGB
local M = Enum.Material

local FREE = { { Type = "Free" } }

Cosmetics.Themes = {
	{ Id = "Classic", Name = "Classic Mart", Unlock = FREE,
		Wall = C(235, 232, 222), WallMat = M.SmoothPlastic, Floor = C(200, 200, 205), FloorMat = M.Marble,
		Trim = C(40, 110, 200), Neon = C(255, 200, 80), Shelf = C(230, 230, 235), Exterior = C(220, 215, 205), Roof = C(70, 75, 85), Sign = C(40, 110, 200) },
	{ Id = "NeonNight", Name = "Midnight Neon", Unlock = { { Type = "Level", Level = 5 } },
		Wall = C(30, 30, 50), WallMat = M.SmoothPlastic, Floor = C(25, 25, 35), FloorMat = M.Glass,
		Trim = C(255, 60, 200), Neon = C(0, 240, 255), Shelf = C(45, 45, 70), Exterior = C(35, 35, 55), Roof = C(20, 20, 30), Sign = C(255, 60, 200) },
	{ Id = "CozyWood", Name = "Cozy Wood", Unlock = { { Type = "Level", Level = 8 } },
		Wall = C(190, 150, 110), WallMat = M.WoodPlanks, Floor = C(130, 90, 60), FloorMat = M.Wood,
		Trim = C(90, 60, 40), Neon = C(255, 180, 90), Shelf = C(150, 105, 70), Exterior = C(120, 85, 60), Roof = C(70, 50, 40), Sign = C(90, 60, 40) },
	{ Id = "Mint", Name = "Mint Fresh", Unlock = { { Type = "Achievement", Id = "served100" } },
		Wall = C(210, 245, 230), WallMat = M.SmoothPlastic, Floor = C(240, 250, 245), FloorMat = M.Marble,
		Trim = C(60, 190, 150), Neon = C(120, 255, 200), Shelf = C(250, 255, 252), Exterior = C(190, 235, 220), Roof = C(60, 130, 110), Sign = C(60, 190, 150) },
	{ Id = "Retro", Name = "Retro Diner", Unlock = { { Type = "Level", Level = 12 } },
		Wall = C(250, 240, 220), WallMat = M.SmoothPlastic, Floor = C(30, 30, 30), FloorMat = M.Pavement,
		Trim = C(220, 40, 50), Neon = C(255, 80, 90), Shelf = C(200, 210, 220), Exterior = C(240, 70, 70), Roof = C(60, 60, 70), Sign = C(220, 40, 50) },
	{ Id = "Sakura", Name = "Sakura Night", Unlock = { { Type = "Streak", Days = 7 }, { Type = "Level", Level = 18 } },
		Wall = C(255, 225, 235), WallMat = M.SmoothPlastic, Floor = C(220, 190, 200), FloorMat = M.Wood,
		Trim = C(230, 110, 150), Neon = C(255, 150, 200), Shelf = C(255, 240, 245), Exterior = C(240, 200, 215), Roof = C(120, 60, 80), Sign = C(230, 110, 150) },
	{ Id = "Postal", Name = "Old Post Office", Unlock = { { Type = "Mystery", Id = "letters" } },
		Wall = C(170, 60, 50), WallMat = M.Brick, Floor = C(110, 80, 60), FloorMat = M.WoodPlanks,
		Trim = C(30, 60, 40), Neon = C(255, 210, 120), Shelf = C(120, 90, 60), Exterior = C(150, 55, 45), Roof = C(40, 50, 45), Sign = C(30, 60, 40) },
	{ Id = "Clockwork", Name = "Clockwork", Unlock = { { Type = "Mystery", Id = "clock" } },
		Wall = C(90, 70, 50), WallMat = M.Metal, Floor = C(60, 50, 40), FloorMat = M.DiamondPlate,
		Trim = C(200, 150, 60), Neon = C(255, 190, 90), Shelf = C(150, 110, 60), Exterior = C(80, 65, 50), Roof = C(50, 40, 30), Sign = C(200, 150, 60) },
	{ Id = "Snowfall", Name = "Snowfall", Unlock = { { Type = "Season", Month = 12 }, { Type = "Level", Level = 22 }, { Type = "Robux", Key = "ThemeSnowfall" } },
		Wall = C(235, 245, 255), WallMat = M.Ice, Floor = C(220, 235, 250), FloorMat = M.Glacier,
		Trim = C(120, 170, 230), Neon = C(170, 220, 255), Shelf = C(250, 252, 255), Exterior = C(225, 235, 250), Roof = C(250, 250, 255), Sign = C(120, 170, 230) },
	{ Id = "Galaxy", Name = "Galaxy", Unlock = { { Type = "Level", Level = 26 }, { Type = "Robux", Key = "ThemeGalaxy" } },
		Wall = C(20, 15, 50), WallMat = M.Glass, Floor = C(10, 10, 30), FloorMat = M.Glass,
		Trim = C(140, 90, 255), Neon = C(200, 120, 255), Shelf = C(40, 30, 80), Exterior = C(25, 20, 60), Roof = C(10, 10, 25), Sign = C(140, 90, 255) },
}

-- Apron colors worn by the shopkeeper
Cosmetics.Uniforms = {
	{ Id = "Classic", Name = "Classic Blue", Color = C(40, 110, 200), Unlock = FREE },
	{ Id = "NightShift", Name = "Night Shift", Color = C(30, 30, 40), Unlock = { { Type = "Level", Level = 3 } } },
	{ Id = "Mint", Name = "Mint Apron", Color = C(90, 210, 170), Unlock = { { Type = "Level", Level = 6 } } },
	{ Id = "Retro", Name = "Retro Red", Color = C(210, 40, 50), Unlock = { { Type = "Level", Level = 10 } } },
	{ Id = "Tailor", Name = "Tailor's Vest", Color = C(120, 80, 140), Unlock = { { Type = "Mystery", Id = "buttons" } } },
	{ Id = "Harvest", Name = "Harvest Orange", Color = C(240, 140, 40), Unlock = { { Type = "Season", Month = 10 }, { Type = "Level", Level = 20 } } },
	{ Id = "Starlight", Name = "Starlight", Color = C(250, 240, 180), Neon = true, Unlock = { { Type = "Level", Level = 28 }, { Type = "Robux", Key = "UniformStarlight" } } },
	{ Id = "Royal", Name = "Royal Purple", Color = C(110, 50, 180), Neon = true, Unlock = { { Type = "Level", Level = 35 }, { Type = "Robux", Key = "UniformRoyal" } } },
}

-- Decorations live in fixed spots in the store. Cash ones are a cash sink;
-- buying one is permanent. Toggle them on/off any time.
Cosmetics.Decor = {
	{ Id = "Plant", Name = "Potted Plant", Price = 300, Unlock = FREE },
	{ Id = "Calendar", Name = "Cat Calendar", Price = 500, Unlock = FREE },
	{ Id = "Bench", Name = "Front Bench", Price = 900, Unlock = { { Type = "Level", Level = 3 } } },
	{ Id = "StringLights", Name = "String Lights", Price = 800, Unlock = { { Type = "Level", Level = 4 } } },
	{ Id = "Gumball", Name = "Gumball Machine", Price = 1200, Unlock = { { Type = "Level", Level = 5 } } },
	{ Id = "FishTank", Name = "Fish Tank", Price = 2500, Unlock = { { Type = "Level", Level = 8 }, { Type = "Mystery", Id = "lighthouse" } } },
	{ Id = "LuckyCat", Name = "Waving Lucky Cat", Price = 3000, Unlock = { { Type = "Level", Level = 10 } } },
	{ Id = "Arcade", Name = "Arcade Cabinet", Price = 4000, Unlock = { { Type = "Level", Level = 12 } } },
	{ Id = "RoofSign", Name = "Rooftop 'OPEN 24/7' Sign", Price = 6000, Unlock = { { Type = "Level", Level = 14 } } },
	{ Id = "Portrait", Name = "Founder's Portrait", Price = 0, Unlock = { { Type = "Mystery", Id = "founder" } } },
	{ Id = "KoiSign", Name = "Neon Koi Sign", Price = 0, Unlock = { { Type = "Level", Level = 30 }, { Type = "Robux", Key = "DecorKoi" } } },
}

-- Particle burst when you ring up a customer
Cosmetics.Effects = {
	{ Id = "None", Name = "None", Unlock = FREE, Colors = {} },
	{ Id = "Coins", Name = "Coin Shower", Unlock = FREE, Colors = { C(255, 210, 60), C(255, 240, 150) } },
	{ Id = "Sparkles", Name = "Sparkles", Unlock = { { Type = "Level", Level = 4 } }, Colors = { C(200, 230, 255), C(255, 255, 255) } },
	{ Id = "Hearts", Name = "Hearts", Unlock = { { Type = "Streak", Days = 7 } }, Colors = { C(255, 90, 140), C(255, 170, 200) } },
	{ Id = "Confetti", Name = "Confetti", Unlock = { { Type = "Achievement", Id = "earned10k" } }, Colors = { C(255, 80, 80), C(80, 200, 255), C(255, 220, 60), C(120, 255, 120) } },
	{ Id = "Rainbow", Name = "Rainbow Burst", Unlock = { { Type = "Level", Level = 24 }, { Type = "Robux", Key = "EffectRainbow" } }, Colors = { C(255, 60, 60), C(255, 160, 40), C(255, 240, 60), C(60, 220, 90), C(60, 140, 255), C(170, 80, 255) } },
}

-- Shelf arrangements (all keep the checkout lane clear)
Cosmetics.Layouts = {
	{ Id = "Classic", Name = "Classic Rows", Unlock = FREE },
	{ Id = "TwinAisles", Name = "Twin Aisles", Unlock = { { Type = "Level", Level = 4 } } },
	{ Id = "MarketHall", Name = "Market Hall", Unlock = { { Type = "Level", Level = 9 } } },
}

Cosmetics.SignColors = {
	C(40, 110, 200), C(220, 40, 50), C(60, 190, 150), C(255, 170, 40),
	C(170, 80, 255), C(255, 90, 160), C(30, 30, 40), C(240, 240, 240),
}

local function index(list)
	local map = {}
	for _, item in ipairs(list) do
		map[item.Id] = item
	end
	return map
end

Cosmetics.ThemeById = index(Cosmetics.Themes)
Cosmetics.UniformById = index(Cosmetics.Uniforms)
Cosmetics.DecorById = index(Cosmetics.Decor)
Cosmetics.EffectById = index(Cosmetics.Effects)
Cosmetics.LayoutById = index(Cosmetics.Layouts)

return Cosmetics
