-- Builds the town from code: main street with 6 store plots, back alleys,
-- Willow Lane homes, a tailor and a park, the gas station, an empty lot,
-- the town square with its clock tower, the boarded-up First Light Mart, and
-- a waterfront with a pier and lighthouse. Returns the markers other
-- services need (plot frames, mystery objects, zones, lamps, waypoints).
--
-- Layout (studs): main street runs along X at z = 0. Plots 1-3 sit north
-- (z = +70, facing the street), plots 4-6 south (z = -70, rotated 180).
local CollectionService = game:GetService("CollectionService")

local WorldBuilder = {}

local C = Color3.fromRGB
local M = Enum.Material

local world -- Folder in workspace

local function part(props)
	local p = Instance.new(props.ClassName or "Part")
	p.Anchored = true
	p.TopSurface = Enum.SurfaceType.Smooth
	p.BottomSurface = Enum.SurfaceType.Smooth
	p.Material = M.SmoothPlastic
	for k, v in pairs(props) do
		if k ~= "Parent" and k ~= "ClassName" then
			p[k] = v
		end
	end
	p.Parent = props.Parent or world
	return p
end
WorldBuilder.Part = part

local function box(parent, name, size, position, color, material, extra)
	local props = { Parent = parent, Name = name, Size = size, Color = color, Material = material or M.SmoothPlastic }
	if typeof(position) == "CFrame" then
		props.CFrame = position
	else
		props.Position = position
	end
	for k, v in pairs(extra or {}) do
		props[k] = v
	end
	return part(props)
end

local function folder(name, parent)
	local f = Instance.new("Folder")
	f.Name = name
	f.Parent = parent or world
	return f
end

-- Flat ground decoration (non-colliding so NPC pathing stays simple)
local function flat(parent, name, center, sizeX, sizeZ, color, material, yOffset)
	return box(parent, name, Vector3.new(sizeX, 0.2, sizeZ), center + Vector3.new(0, 0.1 + (yOffset or 0), 0), color, material, { CanCollide = false })
end

local function label(parentPart, face, text, color, bg, pixels)
	local gui = Instance.new("SurfaceGui")
	gui.Face = face
	gui.SizingMode = Enum.SurfaceGuiSizingMode.PixelsPerStud
	gui.PixelsPerStud = pixels or 30
	gui.LightInfluence = 0
	gui.Parent = parentPart
	local t = Instance.new("TextLabel")
	t.Size = UDim2.fromScale(1, 1)
	t.BackgroundTransparency = bg and 0 or 1
	t.BackgroundColor3 = bg or C(0, 0, 0)
	t.TextColor3 = color
	t.Font = Enum.Font.GothamBlack
	t.TextScaled = true
	t.Text = text
	t.Parent = gui
	return t
end
WorldBuilder.Label = label

local function neonSign(parent, text, cframe, size, color, flicker)
	local backing = box(parent, "NeonSign", size, cframe, C(20, 20, 25), M.SmoothPlastic)
	local glow = label(backing, Enum.NormalId.Front, text, color, nil, 40)
	glow.TextStrokeColor3 = color
	glow.TextStrokeTransparency = 0.4
	local light = Instance.new("SurfaceLight")
	light.Face = Enum.NormalId.Front
	light.Color = color
	light.Range = 14
	light.Brightness = 2
	light.Parent = backing
	if flicker then
		CollectionService:AddTag(backing, "Flicker")
	end
	return backing
end
WorldBuilder.NeonSign = neonSign

local lamps = {}
local function streetLamp(parent, position, armDirection)
	box(parent, "Pole", Vector3.new(0.8, 18, 0.8), position + Vector3.new(0, 9, 0), C(45, 45, 50), M.Metal)
	box(parent, "Arm", Vector3.new(0.5, 0.5, 4), CFrame.lookAt(position + Vector3.new(0, 17.8, 0) + armDirection * 2, position + Vector3.new(0, 17.8, 0) + armDirection * 4), C(45, 45, 50), M.Metal)
	local head = box(parent, "LampHead", Vector3.new(1.6, 0.6, 1.6), position + Vector3.new(0, 17.4, 0) + armDirection * 4, C(255, 225, 170), M.Neon, { CanCollide = false })
	local light = Instance.new("PointLight")
	light.Range = 34
	light.Brightness = 1.6
	light.Color = C(255, 215, 160)
	light.Shadows = false
	light.Parent = head
	table.insert(lamps, { Head = head, Light = light })
end

local function tree(parent, position, scale)
	scale = scale or 1
	box(parent, "Trunk", Vector3.new(1.6, 9, 1.6) * scale, position + Vector3.new(0, 4.5 * scale, 0), C(90, 65, 45), M.Wood)
	local leaves = box(parent, "Leaves", Vector3.new(9, 9, 9) * scale, position + Vector3.new(0, 11 * scale, 0), C(45, 95, 60), M.LeafyGrass)
	leaves.Shape = Enum.PartType.Ball
end

local function parkedCar(parent, cframe, color)
	local body = box(parent, "Car", Vector3.new(6, 2, 12), cframe * CFrame.new(0, 1.4, 0), color, M.SmoothPlastic)
	box(parent, "CarTop", Vector3.new(5.4, 1.8, 6), cframe * CFrame.new(0, 3.3, 0.6), C(150, 180, 200), M.Glass, { Transparency = 0.3 })
	for _, x in ipairs({ -3, 3 }) do
		for _, z in ipairs({ -4, 4 }) do
			local w = box(parent, "Wheel", Vector3.new(1, 2.4, 2.4), cframe * CFrame.new(x, 1.2, z), C(25, 25, 25), M.Rubber)
			w.Shape = Enum.PartType.Cylinder
		end
	end
	return body
end

local function house(parent, position, facing, color, roofColor)
	local cf = CFrame.lookAt(position, position + facing)
	box(parent, "House", Vector3.new(26, 14, 20), cf * CFrame.new(0, 7, 0), color, M.Brick)
	local roof = box(parent, "Roof", Vector3.new(28, 2, 22), cf * CFrame.new(0, 15, 0), roofColor, M.Slate)
	roof.Name = "Roof"
	box(parent, "Door", Vector3.new(4, 8, 0.4), cf * CFrame.new(0, 4, -10.1), C(90, 60, 40), M.Wood)
	for _, x in ipairs({ -8, 8 }) do
		local window = box(parent, "Window", Vector3.new(5, 4, 0.3), cf * CFrame.new(x, 8, -10.1), C(255, 210, 140), M.Neon)
		window.Transparency = 0.25
	end
	return cf
end

local function mysteryObject(parent, id, size, position, color, material, actionText)
	local p = box(parent, id, size, position, color, material)
	p.CanCollide = false
	local prompt = Instance.new("ProximityPrompt")
	prompt.ActionText = actionText or "Inspect"
	prompt.ObjectText = ""
	prompt.HoldDuration = 0.4
	prompt.MaxActivationDistance = 9
	prompt.RequiresLineOfSight = false
	prompt.Parent = p
	return { Part = p, Prompt = prompt }
end

function WorldBuilder.Build()
	for _, name in ipairs({ "Baseplate", "SpawnLocation" }) do
		local old = workspace:FindFirstChild(name)
		if old then
			old:Destroy()
		end
	end
	local existing = workspace:FindFirstChild("Town")
	if existing then
		existing:Destroy()
	end
	world = folder("Town", workspace)
	lamps = {}

	local refs = { Plots = {}, MysteryObjects = {}, Zones = {}, Lamps = lamps, WetParts = {}, Waypoints = {} }

	-- Ground
	local ground = box(world, "Ground", Vector3.new(900, 4, 640), Vector3.new(0, -2, 20), C(55, 70, 55), M.Grass)
	ground.CanCollide = true

	local roads = folder("Roads")
	local function road(center, sx, sz)
		local r = flat(roads, "Road", center, sx, sz, C(38, 38, 44), M.Asphalt)
		table.insert(refs.WetParts, r)
		return r
	end
	local function sidewalk(center, sx, sz)
		local s = flat(roads, "Sidewalk", center, sx, sz, C(120, 120, 125), M.Concrete, 0.02)
		table.insert(refs.WetParts, s)
		return s
	end

	-- Main street + sidewalks + lane markings
	road(Vector3.new(0, 0, 0), 820, 30)
	sidewalk(Vector3.new(0, 0, 18), 820, 6)
	sidewalk(Vector3.new(0, 0, -18), 820, 6)
	for x = -380, 380, 40 do
		flat(roads, "Lane", Vector3.new(x, 0, 0), 14, 0.8, C(230, 220, 160), M.SmoothPlastic, 0.03)
	end
	-- Back alleys
	road(Vector3.new(0, 0, 105), 700, 14)
	road(Vector3.new(0, 0, -105), 700, 14)
	-- Side alleys between plots
	for _, x in ipairs({ -85, 85 }) do
		road(Vector3.new(x, 0, 63), 14, 84)
		road(Vector3.new(x, 0, -63), 14, 84)
	end
	-- Connector streets to Willow Lane (north) and the waterfront (south)
	road(Vector3.new(-255, 0, 95), 20, 150)
	road(Vector3.new(260, 0, 95), 20, 150)
	road(Vector3.new(-255, 0, -85), 20, 130)
	road(Vector3.new(260, 0, -85), 20, 130)
	-- Willow Lane
	road(Vector3.new(-20, 0, 178), 600, 20)
	sidewalk(Vector3.new(-20, 0, 192), 600, 6)
	sidewalk(Vector3.new(-20, 0, 164), 600, 6)
	-- Waterfront boardwalk
	local boardwalk = box(world, "Boardwalk", Vector3.new(760, 1, 26), Vector3.new(0, 0, -158), C(120, 90, 60), M.WoodPlanks)
	table.insert(refs.WetParts, boardwalk)

	-- Street lamps
	local lampFolder = folder("Lamps")
	for x = -360, 360, 60 do
		streetLamp(lampFolder, Vector3.new(x, 0, 19.5), Vector3.new(0, 0, -1))
		streetLamp(lampFolder, Vector3.new(x + 30, 0, -19.5), Vector3.new(0, 0, 1))
	end
	for x = -300, 260, 70 do
		streetLamp(lampFolder, Vector3.new(x, 0, 165), Vector3.new(0, 0, 1))
	end
	for x = -330, 330, 80 do
		streetLamp(lampFolder, Vector3.new(x, 0, -147), Vector3.new(0, 0, -1))
	end

	-- Store plots (StoreBuilder builds the stores themselves)
	local plotXs = { -170, 0, 170 }
	for i, x in ipairs(plotXs) do
		refs.Plots[i] = CFrame.new(x, 0, 70)
		refs.Plots[i + 3] = CFrame.new(x, 0, -70) * CFrame.Angles(0, math.pi, 0)
	end

	-- Puddles that shine under lamps
	local puddles = folder("Puddles")
	local rng = Random.new(7)
	for _ = 1, 40 do
		local x = rng:NextInteger(-380, 380)
		local z = rng:NextInteger(-12, 12)
		local p = flat(puddles, "Puddle", Vector3.new(x, 0, z), rng:NextInteger(4, 9), rng:NextInteger(3, 6), C(20, 25, 35), M.Glass, 0.05)
		p.Reflectance = 0.35
		p.Transparency = 0.2
	end

	-- Parked cars along the street
	local cars = folder("ParkedCars")
	local carColors = { C(180, 40, 40), C(40, 80, 160), C(230, 230, 230), C(40, 40, 45), C(60, 140, 90), C(200, 160, 50) }
	for i, x in ipairs({ -330, -250, -90, 90, 250, 330 }) do
		parkedCar(cars, CFrame.new(x, 0, 11) * CFrame.Angles(0, math.rad(90), 0), carColors[i])
	end

	---------------------------------------------------------------------
	-- Alleys: dumpsters, crates, steam and a laundromat sign
	---------------------------------------------------------------------
	local alleys = folder("Alleys")
	-- Tall brick walls make the side alleys feel tucked away
	for _, x in ipairs({ -85, 85 }) do
		for _, side in ipairs({ 1, -1 }) do
			for _, dx in ipairs({ -8, 8 }) do
				box(alleys, "AlleyWall", Vector3.new(1, 18, 76), Vector3.new(x + dx, 9, side * 62), C(95, 70, 60), M.Brick)
			end
		end
	end
	for _, info in ipairs({ { 85, 60 }, { -85, 60 }, { 85, -60 }, { -85, -60 } }) do
		local x, z = info[1], info[2]
		box(alleys, "Dumpster", Vector3.new(4, 5, 8), Vector3.new(x + 4, 2.5, z + 12), C(40, 90, 60), M.Metal)
		box(alleys, "Crate", Vector3.new(3, 3, 3), Vector3.new(x - 4.5, 1.5, z - 8), C(140, 100, 60), M.WoodPlanks)
		box(alleys, "Crate", Vector3.new(2.5, 2.5, 2.5), Vector3.new(x - 4.5, 4.25, z - 8), C(150, 110, 70), M.WoodPlanks)
		local vent = box(alleys, "SteamVent", Vector3.new(3, 0.3, 3), Vector3.new(x, 0.15, z), C(60, 60, 60), M.DiamondPlate)
		local steam = Instance.new("ParticleEmitter")
		steam.Texture = "rbxasset://textures/particles/smoke_main.dds"
		steam.Rate = 6
		steam.Lifetime = NumberRange.new(2, 4)
		steam.Speed = NumberRange.new(2, 4)
		steam.Size = NumberSequence.new({ NumberSequenceKeypoint.new(0, 1.5), NumberSequenceKeypoint.new(1, 5) })
		steam.Transparency = NumberSequence.new({ NumberSequenceKeypoint.new(0, 0.6), NumberSequenceKeypoint.new(1, 1) })
		steam.Color = ColorSequence.new(C(200, 200, 210))
		steam.EmissionDirection = Enum.NormalId.Top
		steam.Parent = vent
	end
	neonSign(alleys, "LAUNDRY 24H", CFrame.new(-92.4, 12, 40) * CFrame.Angles(0, math.rad(-90), 0), Vector3.new(12, 3, 0.4), C(90, 220, 255), true)
	neonSign(alleys, "NOODLES", CFrame.new(77.6, 12, -40) * CFrame.Angles(0, math.rad(-90), 0), Vector3.new(10, 3, 0.4), C(255, 120, 80), true)

	---------------------------------------------------------------------
	-- Background buildings that frame the street
	---------------------------------------------------------------------
	local blocks = folder("Buildings")
	local function backdrop(x, z, w, d, h, color, sign, signColor, facing)
		local b = box(blocks, "Building", Vector3.new(w, h, d), Vector3.new(x, h / 2, z), color, M.Concrete)
		for row = 1, math.floor(h / 8) - 1 do
			local win = box(blocks, "Windows", Vector3.new(w - 4, 2, 0.2), Vector3.new(x, row * 8, z + facing * (d / 2 + 0.1)), C(255, 200, 120), M.Neon)
			win.Transparency = rng:NextNumber(0.3, 0.8)
		end
		if sign then
			neonSign(blocks, sign, CFrame.new(x, 10, z + facing * (d / 2 + 0.3)) * CFrame.Angles(0, facing > 0 and math.pi or 0, 0), Vector3.new(math.min(w - 4, 18), 3.2, 0.4), signColor, true)
		end
		return b
	end
	backdrop(-400, 70, 50, 40, 34, C(70, 70, 85), "HOTEL", C(255, 90, 140), -1)
	backdrop(-400, -70, 50, 40, 26, C(90, 75, 70), "KARAOKE", C(200, 120, 255), 1)
	backdrop(420, -70, 50, 40, 30, C(70, 80, 90), "ARCADE", C(80, 255, 200), 1)

	---------------------------------------------------------------------
	-- Gas station (northeast)
	---------------------------------------------------------------------
	local gas = folder("GasStation")
	local gp = Vector3.new(335, 0, 70)
	flat(gas, "Lot", gp, 80, 70, C(60, 60, 66), M.Concrete, 0.03)
	box(gas, "Canopy", Vector3.new(44, 2, 26), gp + Vector3.new(0, 15, -8), C(230, 230, 235), M.SmoothPlastic)
	local canopyLight = box(gas, "CanopyGlow", Vector3.new(40, 0.3, 22), gp + Vector3.new(0, 13.9, -8), C(255, 255, 240), M.Neon)
	local glow = Instance.new("SurfaceLight")
	glow.Face = Enum.NormalId.Bottom
	glow.Range = 20
	glow.Brightness = 2
	glow.Parent = canopyLight
	for _, x in ipairs({ -15, 15 }) do
		box(gas, "Pillar", Vector3.new(1.5, 14, 1.5), gp + Vector3.new(x, 7, -8), C(200, 40, 40), M.Metal)
		box(gas, "Pump", Vector3.new(3, 6, 2), gp + Vector3.new(x * 0.5, 3, -8), C(220, 50, 50), M.SmoothPlastic)
	end
	neonSign(gas, "FUEL", CFrame.new(gp + Vector3.new(0, 15, -21.2)), Vector3.new(14, 2, 0.4), C(255, 70, 70), false)
	box(gas, "GasShop", Vector3.new(30, 12, 18), gp + Vector3.new(0, 6, 22), C(200, 200, 205), M.Concrete)
	box(gas, "IceMachine", Vector3.new(5, 7, 3), gp + Vector3.new(20, 3.5, 22), C(180, 220, 255), M.SmoothPlastic)
	refs.MysteryObjects.buttonGas = mysteryObject(gas, "buttonGas", Vector3.new(0.8, 0.2, 0.8), gp + Vector3.new(23.5, 0.3, 22), C(190, 150, 70), M.Metal, "Reach behind")

	---------------------------------------------------------------------
	-- Empty lot (southeast) - founder's photo
	---------------------------------------------------------------------
	local lot = folder("EmptyLot")
	local lp = Vector3.new(335, 0, -75)
	flat(lot, "Dirt", lp, 70, 60, C(90, 75, 55), M.Ground, 0.03)
	for i = -3, 3 do
		box(lot, "Fence", Vector3.new(10, 6, 0.4), lp + Vector3.new(i * 10, 3, 30), C(110, 100, 90), M.WoodPlanks)
	end
	for _ = 1, 25 do
		local g = box(lot, "TallGrass", Vector3.new(1, rng:NextNumber(2, 4), 1), lp + Vector3.new(rng:NextInteger(-30, 30), 1.5, rng:NextInteger(-25, 25)), C(110, 140, 70), M.Grass, { CanCollide = false })
		g.Transparency = 0.1
	end
	refs.MysteryObjects.founderPhoto = mysteryObject(lot, "founderPhoto", Vector3.new(1.4, 0.2, 1), lp + Vector3.new(12, 0.3, -14), C(240, 230, 200), M.SmoothPlastic, "Pick up")

	---------------------------------------------------------------------
	-- Town square + clock tower (southwest)
	---------------------------------------------------------------------
	local square = folder("TownSquare")
	local sq = Vector3.new(-320, 0, -72)
	flat(square, "Plaza", sq, 70, 60, C(150, 140, 130), M.Cobblestone, 0.03)
	box(square, "ClockTower", Vector3.new(12, 50, 12), sq + Vector3.new(0, 25, -10), C(150, 120, 100), M.Brick)
	local face = box(square, "ClockFace", Vector3.new(9, 9, 0.4), CFrame.new(sq + Vector3.new(0, 42, -3.8)) * CFrame.Angles(0, math.pi, 0), C(240, 235, 220), M.SmoothPlastic)
	label(face, Enum.NormalId.Front, "11:11", C(40, 30, 20), nil, 40)
	local faceLight = Instance.new("SurfaceLight")
	faceLight.Face = Enum.NormalId.Front
	faceLight.Range = 12
	faceLight.Color = C(255, 230, 180)
	faceLight.Parent = face
	refs.ClockFace = face
	refs.MysteryObjects.clockPlaque = mysteryObject(square, "clockPlaque", Vector3.new(3, 2, 0.3), sq + Vector3.new(0, 3, -3.9), C(190, 150, 70), M.Metal, "Read plaque")
	refs.Zones.clockTower = { Position = sq, Radius = 28 }
	box(square, "Fountain", Vector3.new(14, 2, 14), sq + Vector3.new(0, 1, 16), C(170, 170, 175), M.Marble)
	box(square, "FountainWater", Vector3.new(12, 0.4, 12), sq + Vector3.new(0, 2, 16), C(80, 140, 200), M.Glass, { Transparency = 0.3 })
	-- Leaderboards
	local boards = {}
	for i, info in ipairs({ { "TOP EARNERS", -20 }, { "BEST RATED", 20 } }) do
		local b = box(square, "Leaderboard", Vector3.new(16, 20, 1), CFrame.new(sq + Vector3.new(info[2], 11, 22)) * CFrame.Angles(0, math.pi, 0), C(25, 25, 35), M.SmoothPlastic)
		local gui = Instance.new("SurfaceGui")
		gui.Face = Enum.NormalId.Front
		gui.SizingMode = Enum.SurfaceGuiSizingMode.PixelsPerStud
		gui.PixelsPerStud = 25
		gui.LightInfluence = 0
		gui.Parent = b
		local title = Instance.new("TextLabel")
		title.Size = UDim2.new(1, 0, 0.14, 0)
		title.BackgroundTransparency = 1
		title.Font = Enum.Font.GothamBlack
		title.TextScaled = true
		title.TextColor3 = C(255, 200, 90)
		title.Text = info[1]
		title.Parent = gui
		local list = Instance.new("Frame")
		list.Name = "List"
		list.BackgroundTransparency = 1
		list.Position = UDim2.new(0.05, 0, 0.16, 0)
		list.Size = UDim2.new(0.9, 0, 0.82, 0)
		list.Parent = gui
		local layout = Instance.new("UIListLayout")
		layout.SortOrder = Enum.SortOrder.LayoutOrder
		layout.Parent = list
		boards[i] = list
	end
	refs.Leaderboards = { Earned = boards[1], Rating = boards[2] }
	local spawn = Instance.new("SpawnLocation")
	spawn.Anchored = true
	spawn.Size = Vector3.new(8, 1, 8)
	spawn.Position = sq + Vector3.new(0, 0.5, 4)
	spawn.Transparency = 1
	spawn.CanCollide = false
	spawn.Neutral = true
	spawn.Parent = square

	---------------------------------------------------------------------
	-- The First Light Mart: the boarded-up original store (northwest)
	---------------------------------------------------------------------
	local first = folder("FirstLightMart")
	local fp = CFrame.new(-325, 0, 70)
	local fw = C(120, 110, 100)
	box(first, "Back", Vector3.new(40, 14, 1), fp * CFrame.new(0, 7, 15), fw, M.Brick)
	box(first, "Left", Vector3.new(1, 14, 30), fp * CFrame.new(-20, 7, 0), fw, M.Brick)
	box(first, "Right", Vector3.new(1, 14, 30), fp * CFrame.new(20, 7, 0), fw, M.Brick)
	box(first, "FrontL", Vector3.new(16, 14, 1), fp * CFrame.new(-12, 7, -15), fw, M.Brick)
	box(first, "FrontR", Vector3.new(16, 14, 1), fp * CFrame.new(12, 7, -15), fw, M.Brick)
	box(first, "Lintel", Vector3.new(8, 4, 1), fp * CFrame.new(0, 12, -15), fw, M.Brick)
	box(first, "Roof", Vector3.new(42, 1, 32), fp * CFrame.new(0, 14.5, 0), C(60, 55, 50), M.Slate)
	flat(first, "Floor", fp.Position, 40, 30, C(90, 80, 70), M.WoodPlanks, 0.03)
	for i = -1, 1 do
		box(first, "Plank", Vector3.new(14, 1, 0.3), fp * CFrame.new(-12, 6 + i * 2.5, -15.7) * CFrame.Angles(0, 0, math.rad(8 * i)), C(130, 100, 70), M.WoodPlanks)
		box(first, "Plank", Vector3.new(14, 1, 0.3), fp * CFrame.new(12, 6 + i * 2.5, -15.7) * CFrame.Angles(0, 0, math.rad(-8 * i)), C(130, 100, 70), M.WoodPlanks)
	end
	local oldSign = box(first, "OldSign", Vector3.new(24, 3, 0.4), fp * CFrame.new(0, 16.5, -15), C(60, 50, 45), M.Wood)
	label(oldSign, Enum.NormalId.Front, "FIRST LIGHT MART", C(200, 170, 120), nil, 30)
	box(first, "DustyCounter", Vector3.new(10, 4, 3), fp * CFrame.new(8, 2, 6), C(100, 80, 60), M.Wood)
	box(first, "EmptyShelf", Vector3.new(12, 6, 2), fp * CFrame.new(-10, 3, 8), C(90, 75, 60), M.Wood)
	refs.MysteryObjects.oldReceipt = mysteryObject(first, "oldReceipt", Vector3.new(1, 0.1, 1.4), (fp * CFrame.new(8, 4.1, 6)).Position, C(240, 235, 210), M.SmoothPlastic, "Read")

	---------------------------------------------------------------------
	-- Willow Lane: homes, the tailor, a park, the old oak
	---------------------------------------------------------------------
	local lane = folder("WillowLane")
	local houseColors = { C(200, 170, 150), C(160, 180, 200), C(210, 200, 160), C(170, 150, 190), C(180, 200, 170) }
	local hi = 0
	for _, x in ipairs({ -230, -170, -40, 30, 220 }) do
		hi = hi + 1
		house(lane, Vector3.new(x, 0, 140), Vector3.new(0, 0, 1), houseColors[hi], C(80, 60, 60))
	end
	for _, x in ipairs({ -240, -160, -60, 20, 250 }) do
		hi = hi % #houseColors + 1
		house(lane, Vector3.new(x, 0, 218), Vector3.new(0, 0, -1), houseColors[hi], C(60, 60, 80))
	end
	-- Tailor shop
	local tp = Vector3.new(-115, 0, 140)
	local tcf = house(lane, tp, Vector3.new(0, 0, 1), C(150, 110, 160), C(70, 50, 80))
	neonSign(lane, "TAILOR", tcf * CFrame.new(0, 12.5, -10.4), Vector3.new(10, 2.4, 0.4), C(230, 160, 255), false)
	refs.MysteryObjects.buttonTailor = mysteryObject(lane, "buttonTailor", Vector3.new(0.7, 0.2, 0.7), (tcf * CFrame.new(8, 5.9, -10.6)).Position, C(190, 150, 70), M.Metal, "Take button")
	box(lane, "Ledge", Vector3.new(6, 0.4, 1), tcf * CFrame.new(8, 5.6, -10.6), C(220, 220, 220), M.SmoothPlastic)
	refs.Zones.tailorDoor = { Position = (tcf * CFrame.new(0, 0, -14)).Position, Radius = 8 }
	-- Park
	local park = Vector3.new(130, 0, 222)
	flat(lane, "ParkGrass", park, 70, 40, C(70, 120, 70), M.Grass, 0.03)
	for _, offset in ipairs({ Vector3.new(-25, 0, -10), Vector3.new(25, 0, 10), Vector3.new(-20, 0, 12), Vector3.new(28, 0, -12) }) do
		tree(lane, park + offset, 1.1)
	end
	box(lane, "BenchSeat", Vector3.new(8, 0.6, 2.4), park + Vector3.new(0, 2, -8), C(120, 80, 50), M.WoodPlanks)
	box(lane, "BenchBack", Vector3.new(8, 2.4, 0.5), park + Vector3.new(0, 3.2, -6.9), C(120, 80, 50), M.WoodPlanks)
	refs.MysteryObjects.buttonPark = mysteryObject(lane, "buttonPark", Vector3.new(0.7, 0.2, 0.7), park + Vector3.new(1.5, 0.3, -8), C(190, 150, 70), M.Metal, "Take button")
	-- Old oak + mailbox at the far west end of the lane
	local oak = Vector3.new(-318, 0, 178)
	tree(lane, oak, 1.8)
	box(lane, "MailboxPost", Vector3.new(0.5, 4, 0.5), oak + Vector3.new(4, 2, -3), C(80, 60, 40), M.Wood)
	refs.MysteryObjects.oakMailbox = mysteryObject(lane, "oakMailbox", Vector3.new(1.6, 1.2, 2.4), oak + Vector3.new(4, 4.6, -3), C(120, 60, 50), M.Metal, "Open mailbox")
	refs.Zones.willowEnd = { Position = Vector3.new(-305, 0, 178), Radius = 24 }
	local streetSign = box(lane, "StreetSign", Vector3.new(8, 1.6, 0.3), Vector3.new(-290, 9, 188), C(40, 110, 60), M.SmoothPlastic)
	label(streetSign, Enum.NormalId.Front, "WILLOW LANE", C(255, 255, 255), nil, 30)
	label(streetSign, Enum.NormalId.Back, "WILLOW LANE", C(255, 255, 255), nil, 30)

	---------------------------------------------------------------------
	-- Hidden alley clues
	---------------------------------------------------------------------
	refs.MysteryObjects.lostLetter = mysteryObject(alleys, "lostLetter", Vector3.new(1.2, 0.1, 0.8), Vector3.new(88, 0.3, 82), C(235, 230, 210), M.SmoothPlastic, "Pick up")
	refs.MysteryObjects.gearAlley = mysteryObject(alleys, "gearAlley", Vector3.new(1, 0.3, 1), Vector3.new(-82, 0.3, -88), C(200, 160, 60), M.Metal, "Pick up")

	---------------------------------------------------------------------
	-- Waterfront: water, pier and lighthouse
	---------------------------------------------------------------------
	local water = folder("Waterfront")
	pcall(function()
		workspace.Terrain:FillBlock(CFrame.new(0, -6, -300), Vector3.new(900, 10, 270), Enum.Material.Water)
	end)
	ground.Size = Vector3.new(900, 4, 480)
	ground.Position = Vector3.new(0, -2, 70)
	for i = 0, 9 do
		box(water, "PierPlank", Vector3.new(10, 1, 10), Vector3.new(100, 0, -175 - i * 10), C(130, 100, 70), M.WoodPlanks)
	end
	for i = 0, 9, 3 do
		box(water, "PierPost", Vector3.new(1, 8, 1), Vector3.new(95, -3, -175 - i * 10), C(90, 70, 50), M.Wood)
		box(water, "PierPost", Vector3.new(1, 8, 1), Vector3.new(105, -3, -175 - i * 10), C(90, 70, 50), M.Wood)
	end
	refs.Zones.pierEnd = { Position = Vector3.new(100, 0, -258), Radius = 18 }
	local rock = box(water, "Rock", Vector3.new(6, 30, 30), CFrame.new(100, -1, -285) * CFrame.Angles(0, 0, math.rad(90)), C(90, 90, 95), M.Rock)
	rock.Shape = Enum.PartType.Cylinder
	for i = 0, 7 do
		local stripe = box(water, "Lighthouse", Vector3.new(5, 10, 10), CFrame.new(100, 4.5 + i * 5, -288) * CFrame.Angles(0, 0, math.rad(90)), i % 2 == 0 and C(240, 240, 240) or C(200, 50, 50), M.SmoothPlastic)
		stripe.Shape = Enum.PartType.Cylinder
		stripe.Size = Vector3.new(5, 10 - i * 0.4, 10 - i * 0.4)
	end
	local lamp = box(water, "LighthouseLamp", Vector3.new(5, 5, 5), Vector3.new(100, 44.5, -288), C(255, 240, 180), M.Neon)
	local beam = Instance.new("SpotLight")
	beam.Range = 60
	beam.Angle = 30
	beam.Brightness = 6
	beam.Color = C(255, 240, 200)
	beam.Parent = lamp
	CollectionService:AddTag(lamp, "Spin")
	box(water, "Steps", Vector3.new(6, 1, 4), Vector3.new(100, 2.5, -275), C(150, 150, 155), M.Concrete)
	refs.MysteryObjects.musicBox = mysteryObject(water, "musicBox", Vector3.new(1.2, 0.9, 0.9), Vector3.new(100, 3.5, -275), C(150, 90, 60), M.Wood, "Open music box")

	---------------------------------------------------------------------
	-- Trees + ambient pedestrians' routes
	---------------------------------------------------------------------
	local trees = folder("Trees")
	for x = -350, 350, 70 do
		tree(trees, Vector3.new(x + 15, 0, 125), 1)
		tree(trees, Vector3.new(x - 15, 0, -125), 1)
	end
	refs.Waypoints = {
		{ Vector3.new(-380, 0, 18), Vector3.new(380, 0, 18), Vector3.new(380, 0, -18), Vector3.new(-380, 0, -18) },
		{ Vector3.new(-300, 0, 192), Vector3.new(260, 0, 192), Vector3.new(260, 0, 164), Vector3.new(-300, 0, 164) },
		{ Vector3.new(-350, 0, -158), Vector3.new(350, 0, -158) },
	}

	return refs
end

return WorldBuilder
