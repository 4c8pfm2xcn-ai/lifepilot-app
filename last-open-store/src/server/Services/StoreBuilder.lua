-- Builds and restyles one player store. Pure visuals + markers: all store
-- logic lives in StoreService.
--
-- Store-local space: origin = interior floor center, the door faces local -Z
-- (toward the street). Interior is 60 x 40 (x: -30..30, z: -20..20).
-- A stockroom partition hides the back of the store until it's expanded.
local CollectionService = game:GetService("CollectionService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage:WaitForChild("Shared")
local Config = require(Shared:WaitForChild("Config"))
local Products = require(Shared:WaitForChild("Products"))
local Cosmetics = require(Shared:WaitForChild("Cosmetics"))

local StoreBuilder = {}

local C = Color3.fromRGB
local M = Enum.Material

StoreBuilder.UnitCount = 12
StoreBuilder.ShelfSize = Vector3.new(12, 6, 3)
StoreBuilder.CoolerSize = Vector3.new(8, 8, 3.5)

function StoreBuilder.IsCooler(unitIndex)
	return unitIndex % 3 == 0
end

-- Which expansion level unlocks each unit (3 units per level)
function StoreBuilder.UnitTier(unitIndex)
	return math.ceil(unitIndex / 3)
end

-- Partition position for each expansion level (nil = fully open)
local PARTITION_Z = { -0.5, 6.75, 13.75 }

-- Layout presets: { x, z, yawDegrees } per unit. All keep the checkout lane
-- (x > 12, z < -1) clear and every unit inside its tier's open area.
StoreBuilder.Layouts = {
	Classic = {
		{ -14, -5, 0 }, { 2, -5, 0 }, { -28.25, -5.5, -90 },
		{ -14, 3, 0 }, { 2, 3, 0 }, { -28.25, 2.2, -90 },
		{ -14, 10.5, 0 }, { 2, 10.5, 0 }, { -28.25, 9, -90 },
		{ -14, 17.5, 0 }, { 2, 17.5, 0 }, { 14, 18.25, 0 },
	},
	TwinAisles = {
		{ -8, -5, 0 }, { 6, -5, 0 }, { -28.25, -5.5, -90 },
		{ -8, 3, 0 }, { 6, 3, 0 }, { 28.25, 2.2, 90 },
		{ -8, 10.5, 0 }, { 6, 10.5, 0 }, { 28.25, 9, 90 },
		{ -8, 17.5, 0 }, { 6, 17.5, 0 }, { -26, 18.25, 0 },
	},
	MarketHall = {
		{ -15, -5, 0 }, { 1, -5, 0 }, { -28.25, -5.5, -90 },
		{ -6, 3, 0 }, { 10, 3, 0 }, { -28.25, 2.2, -90 },
		{ -6, 10.5, 0 }, { 10, 10.5, 0 }, { 28.25, 9, 90 },
		{ -18, 17.5, 0 }, { -2, 17.5, 0 }, { 14, 18.25, 0 },
	},
}

StoreBuilder.QueuePoints = {
	Vector3.new(25.5, 0, -8.2), Vector3.new(21, 0, -8.2), Vector3.new(16.5, 0, -8.2),
	Vector3.new(25.5, 0, -4.6), Vector3.new(21, 0, -4.6), Vector3.new(16.5, 0, -4.6),
}
StoreBuilder.DoorOutside = Vector3.new(0, 0, -25)
StoreBuilder.DoorInside = Vector3.new(0, 0, -16)
StoreBuilder.Sidewalk = { Vector3.new(-24, 0, -52), Vector3.new(24, 0, -52) }
StoreBuilder.OwnerSpawn = Vector3.new(22, 3, -17)

local function part(parent, name, size, cframe, color, material, extra)
	local p = Instance.new("Part")
	p.Anchored = true
	p.Name = name
	p.Size = size
	p.CFrame = cframe
	p.Color = color
	p.Material = material or M.SmoothPlastic
	p.TopSurface = Enum.SurfaceType.Smooth
	p.BottomSurface = Enum.SurfaceType.Smooth
	for k, v in pairs(extra or {}) do
		p[k] = v
	end
	p.Parent = parent
	return p
end

local function surfaceText(target, face, text, color, ppS)
	local gui = Instance.new("SurfaceGui")
	gui.Face = face
	gui.SizingMode = Enum.SurfaceGuiSizingMode.PixelsPerStud
	gui.PixelsPerStud = ppS or 30
	gui.LightInfluence = 0
	gui.Parent = target
	local t = Instance.new("TextLabel")
	t.Size = UDim2.fromScale(1, 1)
	t.BackgroundTransparency = 1
	t.Font = Enum.Font.GothamBlack
	t.TextScaled = true
	t.TextColor3 = color
	t.Text = text
	t.Parent = gui
	return t
end

local function prompt(parent, action, object, distance)
	local p = Instance.new("ProximityPrompt")
	p.ActionText = action
	p.ObjectText = object or ""
	p.HoldDuration = 0
	p.MaxActivationDistance = distance or 10
	p.RequiresLineOfSight = false
	p.Parent = parent
	return p
end

---------------------------------------------------------------------------
-- Units (shelves and coolers)
---------------------------------------------------------------------------
local function buildUnit(store, index)
	local cooler = StoreBuilder.IsCooler(index)
	local model = Instance.new("Model")
	model.Name = "Unit" .. index
	local shelfParts = {}
	local size = cooler and StoreBuilder.CoolerSize or StoreBuilder.ShelfSize
	local hx, hz = size.X / 2, size.Z / 2
	local origin = CFrame.new()

	local back = part(model, "Back", Vector3.new(size.X, size.Y, 0.4), origin * CFrame.new(0, size.Y / 2, hz - 0.2), C(230, 230, 235))
	table.insert(shelfParts, back)
	table.insert(shelfParts, part(model, "Base", Vector3.new(size.X, 0.6, size.Z), origin * CFrame.new(0, 0.3, 0), C(230, 230, 235)))
	table.insert(shelfParts, part(model, "SideL", Vector3.new(0.3, size.Y, size.Z), origin * CFrame.new(-hx + 0.15, size.Y / 2, 0), C(230, 230, 235)))
	table.insert(shelfParts, part(model, "SideR", Vector3.new(0.3, size.Y, size.Z), origin * CFrame.new(hx - 0.15, size.Y / 2, 0), C(230, 230, 235)))
	local rows
	if cooler then
		table.insert(shelfParts, part(model, "Top", Vector3.new(size.X, 0.4, size.Z), origin * CFrame.new(0, size.Y - 0.2, 0), C(230, 230, 235)))
		table.insert(shelfParts, part(model, "Board", Vector3.new(size.X - 0.6, 0.2, size.Z - 0.6), origin * CFrame.new(0, 3.6, 0.1), C(200, 220, 235), M.Glass))
		part(model, "GlassDoor", Vector3.new(size.X - 0.6, size.Y - 1, 0.15), origin * CFrame.new(0, size.Y / 2, -hz + 0.1), C(200, 230, 255), M.Glass, { Transparency = 0.7, CanCollide = false })
		local glow = part(model, "ColdGlow", Vector3.new(size.X - 0.8, 0.2, 0.4), origin * CFrame.new(0, size.Y - 0.6, -hz + 0.6), C(170, 220, 255), M.Neon, { CanCollide = false })
		local light = Instance.new("SurfaceLight")
		light.Face = Enum.NormalId.Bottom
		light.Range = 8
		light.Brightness = 1.5
		light.Color = C(190, 225, 255)
		light.Parent = glow
		rows = { 1.2, 4.2 }
	else
		table.insert(shelfParts, part(model, "Board1", Vector3.new(size.X - 0.6, 0.25, size.Z - 0.4), origin * CFrame.new(0, 2.3, 0.1), C(230, 230, 235)))
		table.insert(shelfParts, part(model, "Board2", Vector3.new(size.X - 0.6, 0.25, size.Z - 0.4), origin * CFrame.new(0, 4.3, 0.1), C(230, 230, 235)))
		rows = { 1.2, 3.05 }
	end
	local strip = part(model, "TagStrip", Vector3.new(size.X - 0.4, 0.5, 0.1), origin * CFrame.new(0, 0.65, -hz - 0.05), C(255, 255, 255), M.SmoothPlastic, { CanCollide = false })
	local tagGui = Instance.new("SurfaceGui")
	tagGui.Face = Enum.NormalId.Front
	tagGui.SizingMode = Enum.SurfaceGuiSizingMode.PixelsPerStud
	tagGui.PixelsPerStud = 40
	tagGui.LightInfluence = 0
	tagGui.Parent = strip
	local layout = Instance.new("UIListLayout")
	layout.FillDirection = Enum.FillDirection.Horizontal
	layout.Parent = tagGui
	local tags = {}
	for slot = 1, Config.SlotsPerUnit do
		local t = Instance.new("TextLabel")
		t.Size = UDim2.new(1 / Config.SlotsPerUnit, 0, 1, 0)
		t.BackgroundTransparency = 1
		t.Font = Enum.Font.GothamBold
		t.TextScaled = true
		t.TextColor3 = C(30, 30, 40)
		t.Text = "empty"
		t.Parent = tagGui
		tags[slot] = t
	end
	local items = Instance.new("Folder")
	items.Name = "Items"
	items.Parent = model
	model.WorldPivot = CFrame.new()
	model.Parent = store.Model

	local p = prompt(back, cooler and "Stock Cooler" or "Stock Shelf", cooler and "Cooler" or "Shelf", 10)
	return {
		Index = index, Model = model, Cooler = cooler, Size = size, Rows = rows,
		ShelfParts = shelfParts, Tags = tags, Items = items, Prompt = p, CFrame = CFrame.new(),
	}
end

---------------------------------------------------------------------------
-- Decorations (fixed spots)
---------------------------------------------------------------------------
local DECOR_BUILDERS = {
	Plant = function(f, cf)
		part(f, "Pot", Vector3.new(2, 2, 2), cf * CFrame.new(-27, 1, -17.5), C(170, 90, 60), M.Slate)
		local leaves = part(f, "Leaves", Vector3.new(3.5, 3.5, 3.5), cf * CFrame.new(-27, 3.6, -17.5), C(60, 150, 80), M.LeafyGrass)
		leaves.Shape = Enum.PartType.Ball
	end,
	Calendar = function(f, cf)
		local cal = part(f, "Calendar", Vector3.new(0.1, 4, 3), cf * CFrame.new(-29.9, 8, -12), C(255, 250, 240))
		surfaceText(cal, Enum.NormalId.Right, "=^.^=\nCAT\nCALENDAR", C(230, 110, 150), 40)
	end,
	Bench = function(f, cf)
		part(f, "Bench", Vector3.new(8, 0.6, 2.4), cf * CFrame.new(-14, 2, -23.5), C(120, 80, 50), M.WoodPlanks)
		part(f, "BenchLegs", Vector3.new(7, 1.7, 1.6), cf * CFrame.new(-14, 0.85, -23.5), C(60, 60, 65), M.Metal)
	end,
	StringLights = function(f, cf)
		for i = -12, 12 do
			local bulb = part(f, "Bulb", Vector3.new(0.5, 0.5, 0.5), cf * CFrame.new(i * 2.3, 12.6 - math.abs(math.sin(i * 0.5)) * 0.6, -19.6), C(255, 210 - (i % 3) * 40, 120 + (i % 2) * 80), M.Neon, { CanCollide = false })
			bulb.Shape = Enum.PartType.Ball
		end
	end,
	Gumball = function(f, cf)
		part(f, "Stand", Vector3.new(1.2, 3, 1.2), cf * CFrame.new(-11, 1.5, -18), C(200, 40, 40), M.Metal)
		local globe = part(f, "Globe", Vector3.new(2.4, 2.4, 2.4), cf * CFrame.new(-11, 4.1, -18), C(255, 255, 255), M.Glass, { Transparency = 0.4 })
		globe.Shape = Enum.PartType.Ball
		for i = 1, 6 do
			local g = part(f, "Gum", Vector3.new(0.5, 0.5, 0.5), cf * CFrame.new(-11 + math.sin(i) * 0.6, 3.6 + (i % 3) * 0.3, -18 + math.cos(i) * 0.6), Color3.fromHSV(i / 6, 0.7, 1), M.Neon, { CanCollide = false })
			g.Shape = Enum.PartType.Ball
		end
	end,
	FishTank = function(f, cf)
		part(f, "Tank", Vector3.new(2.6, 1.8, 1.4), cf * CFrame.new(26.6, 4.9, -12), C(120, 200, 255), M.Glass, { Transparency = 0.5 })
		part(f, "Fish", Vector3.new(0.5, 0.3, 0.2), cf * CFrame.new(26.4, 5, -12), C(255, 140, 40), M.Neon, { CanCollide = false })
	end,
	LuckyCat = function(f, cf)
		part(f, "CatBody", Vector3.new(1.2, 1.4, 1), cf * CFrame.new(17.2, 4.7, -12), C(255, 250, 245))
		local paw = part(f, "Paw", Vector3.new(0.35, 0.8, 0.35), cf * CFrame.new(17.8, 5.6, -12.3), C(255, 250, 245), M.SmoothPlastic, { CanCollide = false })
		CollectionService:AddTag(paw, "Wave")
		part(f, "Collar", Vector3.new(1.25, 0.2, 1.05), cf * CFrame.new(17.2, 5.1, -12), C(220, 40, 40))
	end,
	Arcade = function(f, cf)
		part(f, "Cabinet", Vector3.new(3, 7, 3), cf * CFrame.new(-20, 3.5, -18), C(40, 30, 70))
		local screen = part(f, "Screen", Vector3.new(2.4, 2, 0.1), cf * CFrame.new(-20, 5, -19.55), C(80, 255, 200), M.Neon, { CanCollide = false })
		CollectionService:AddTag(screen, "Flicker")
	end,
	RoofSign = function(f, cf)
		local s = part(f, "RoofSign", Vector3.new(22, 4, 0.5), cf * CFrame.new(0, 19.5, -12), C(20, 20, 25))
		local t = surfaceText(s, Enum.NormalId.Front, "OPEN 24/7", C(255, 70, 90), 40)
		t.TextStrokeColor3 = C(255, 70, 90)
		t.TextStrokeTransparency = 0.3
		part(f, "RoofSignLegs", Vector3.new(16, 3, 0.4), cf * CFrame.new(0, 16, -12), C(60, 60, 65), M.Metal)
	end,
	Portrait = function(f, cf)
		part(f, "Frame", Vector3.new(0.2, 5, 4), cf * CFrame.new(29.8, 8, -16), C(150, 110, 50), M.Wood)
		local pic = part(f, "Picture", Vector3.new(0.1, 4.2, 3.2), cf * CFrame.new(29.65, 8, -16), C(240, 220, 180))
		surfaceText(pic, Enum.NormalId.Left, "FIRST LIGHT\nOPENING NIGHT", C(90, 60, 30), 40)
	end,
	KoiSign = function(f, cf)
		local s = part(f, "KoiSign", Vector3.new(0.2, 4, 7), cf * CFrame.new(-29.85, 9, 4), C(20, 20, 30))
		local t = surfaceText(s, Enum.NormalId.Right, "><(((°>", C(255, 140, 60), 40)
		t.TextStrokeColor3 = C(255, 140, 60)
		t.TextStrokeTransparency = 0.2
		CollectionService:AddTag(s, "Flicker")
	end,
}

---------------------------------------------------------------------------
-- Build
---------------------------------------------------------------------------
function StoreBuilder.Build(index, plotCFrame, parent)
	local cf = plotCFrame
	local model = Instance.new("Model")
	model.Name = "Store" .. index
	model:SetAttribute("PlotIndex", index)
	model.Parent = parent

	local store = { Index = index, CFrame = cf, Model = model, Themed = { Wall = {}, Floor = {}, Trim = {}, Neon = {}, Roof = {}, Sign = {}, Exterior = {} } }
	local T = store.Themed
	local W = C(235, 232, 222)

	-- Lot, floor and walls
	local lot = part(model, "ParkingLot", Vector3.new(66, 0.2, 28), cf * CFrame.new(0, 0.12, -35), C(48, 48, 54), M.Asphalt, { CanCollide = false })
	for _, x in ipairs({ -24, -12, 12, 24 }) do
		part(model, "ParkingLine", Vector3.new(0.5, 0.05, 10), cf * CFrame.new(x, 0.25, -38), C(220, 220, 220), M.SmoothPlastic, { CanCollide = false })
	end
	store.Lot = lot
	table.insert(T.Floor, part(model, "Floor", Vector3.new(60, 0.2, 40), cf * CFrame.new(0, 0.12, 0), C(200, 200, 205), M.Marble, { CanCollide = false }))
	table.insert(T.Wall, part(model, "BackWall", Vector3.new(62, 14, 1), cf * CFrame.new(0, 7, 20.5), W))
	table.insert(T.Wall, part(model, "LeftWall", Vector3.new(1, 14, 42), cf * CFrame.new(-30.5, 7, 0), W))
	table.insert(T.Wall, part(model, "RightWall", Vector3.new(1, 14, 42), cf * CFrame.new(30.5, 7, 0), W))
	for _, side in ipairs({ -1, 1 }) do
		local x = side * 18
		table.insert(T.Exterior, part(model, "FrontLow", Vector3.new(25, 3, 1), cf * CFrame.new(x, 1.5, -20.5), W))
		table.insert(T.Exterior, part(model, "FrontHigh", Vector3.new(25, 5, 1), cf * CFrame.new(x, 11.5, -20.5), W))
		part(model, "Window", Vector3.new(25, 6, 0.3), cf * CFrame.new(x, 6, -20.5), C(180, 220, 255), M.Glass, { Transparency = 0.6 })
	end
	table.insert(T.Exterior, part(model, "Lintel", Vector3.new(11, 4, 1), cf * CFrame.new(0, 12, -20.5), W))
	table.insert(T.Roof, part(model, "Roof", Vector3.new(63, 1, 43), cf * CFrame.new(0, 14.5, 0), C(70, 75, 85)))
	-- Door trim + automatic sliding doors (animated on each client)
	for _, x in ipairs({ -5.6, 5.6 }) do
		table.insert(T.Trim, part(model, "DoorFrame", Vector3.new(0.6, 10, 1.2), cf * CFrame.new(x, 5, -20.5), C(40, 110, 200), M.Metal))
	end
	for _, side in ipairs({ -1, 1 }) do
		local door = part(model, "AutoDoor", Vector3.new(5, 9.6, 0.2), cf * CFrame.new(side * 2.5, 4.8, -20.6), C(190, 225, 255), M.Glass, { Transparency = 0.55, CanCollide = false })
		door:SetAttribute("Side", side)
		CollectionService:AddTag(door, "AutoDoor")
	end
	-- Sign band
	local signBoard = part(model, "SignBoard", Vector3.new(36, 4, 0.8), cf * CFrame.new(0, 16.6, -21), C(40, 110, 200))
	table.insert(T.Sign, signBoard)
	store.SignLabel = surfaceText(signBoard, Enum.NormalId.Front, "FOR RENT", C(255, 255, 255), 30)
	local signGlow = part(model, "SignGlow", Vector3.new(37, 0.4, 0.4), cf * CFrame.new(0, 14.4, -21.3), C(255, 200, 80), M.Neon, { CanCollide = false })
	table.insert(T.Neon, signGlow)
	-- Ceiling lights
	for _, z in ipairs({ -10, 2, 14 }) do
		local panel = part(model, "CeilingLight", Vector3.new(40, 0.2, 2), cf * CFrame.new(0, 13.9, z), C(255, 250, 235), M.Neon, { CanCollide = false })
		local light = Instance.new("SurfaceLight")
		light.Face = Enum.NormalId.Bottom
		light.Range = 16
		light.Brightness = 1.2
		light.Color = C(255, 245, 225)
		light.Parent = panel
	end
	-- Warm light spilling into the parking lot at night
	local spill = Instance.new("SurfaceLight")
	spill.Face = Enum.NormalId.Front
	spill.Range = 24
	spill.Brightness = 1.5
	spill.Color = C(255, 230, 190)
	spill.Parent = signBoard

	-- Counter + register
	table.insert(T.Trim, part(model, "Counter", Vector3.new(12, 4, 3), cf * CFrame.new(22, 2, -12), C(40, 110, 200)))
	part(model, "CounterTop", Vector3.new(12.4, 0.3, 3.4), cf * CFrame.new(22, 4.15, -12), C(240, 240, 240), M.Marble)
	local register = part(model, "Register", Vector3.new(2.4, 1.2, 2), cf * CFrame.new(22, 4.9, -12.3), C(50, 50, 60), M.Metal)
	part(model, "RegisterScreen", Vector3.new(1.6, 0.9, 0.1), cf * CFrame.new(22, 5.9, -12.9) * CFrame.Angles(math.rad(-15), 0, 0), C(80, 255, 160), M.Neon, { CanCollide = false })
	store.Register = register
	store.RegisterPrompt = prompt(register, "Ring Up", "Register", 12)
	store.RegisterPrompt.KeyboardKeyCode = Enum.KeyCode.E
	store.RegisterPrompt.Enabled = false

	-- Guestbook for visitors
	part(model, "Podium", Vector3.new(2, 3.6, 2), cf * CFrame.new(-9, 1.8, -17), C(120, 85, 55), M.Wood)
	local book = part(model, "Guestbook", Vector3.new(1.8, 0.3, 1.4), cf * CFrame.new(-9, 3.75, -17), C(150, 40, 40))
	store.GuestbookPrompt = prompt(book, "Rate Store", "Guestbook", 8)

	-- Stockroom partition
	local partition = part(model, "Partition", Vector3.new(60, 14, 1), cf * CFrame.new(0, 7, PARTITION_Z[1]), W)
	table.insert(T.Wall, partition)
	surfaceText(partition, Enum.NormalId.Front, "STOCKROOM\nexpand your store to unlock this space", C(120, 120, 130), 20)
	store.Partition = partition

	-- Units
	store.Units = {}
	for i = 1, StoreBuilder.UnitCount do
		store.Units[i] = buildUnit(store, i)
	end

	-- Decor folder
	store.Decor = Instance.new("Folder")
	store.Decor.Name = "Decor"
	store.Decor.Parent = model

	StoreBuilder.ApplyTheme(store, Cosmetics.ThemeById.Classic)
	StoreBuilder.ApplyLayout(store, "Classic", 1)
	return store
end

---------------------------------------------------------------------------
-- Restyling
---------------------------------------------------------------------------
function StoreBuilder.ApplyTheme(store, theme)
	local T = store.Themed
	for _, p in ipairs(T.Wall) do
		p.Color = theme.Wall
		p.Material = theme.WallMat
	end
	for _, p in ipairs(T.Floor) do
		p.Color = theme.Floor
		p.Material = theme.FloorMat
	end
	for _, p in ipairs(T.Trim) do
		p.Color = theme.Trim
	end
	for _, p in ipairs(T.Neon) do
		p.Color = theme.Neon
	end
	for _, p in ipairs(T.Roof) do
		p.Color = theme.Roof
	end
	for _, p in ipairs(T.Sign) do
		p.Color = theme.Sign
	end
	for _, p in ipairs(T.Exterior) do
		p.Color = theme.Exterior
		p.Material = theme.WallMat
	end
	for _, unit in ipairs(store.Units or {}) do
		for _, p in ipairs(unit.ShelfParts) do
			p.Color = theme.Shelf
		end
	end
	store.ThemeId = theme.Id
end

function StoreBuilder.ApplyLayout(store, layoutId, expansion)
	local layout = StoreBuilder.Layouts[layoutId] or StoreBuilder.Layouts.Classic
	for i, unit in ipairs(store.Units) do
		local info = layout[i]
		unit.CFrame = store.CFrame * CFrame.new(info[1], 0, info[2]) * CFrame.Angles(0, math.rad(info[3]), 0)
		unit.Model:PivotTo(unit.CFrame)
		local open = StoreBuilder.UnitTier(i) <= expansion
		unit.Model.Parent = open and store.Model or nil
		unit.Prompt.Enabled = open
		unit.Open = open
		-- where customers stand to browse this unit
		unit.Front = (unit.CFrame * CFrame.new(0, 0, -(unit.Size.Z / 2 + 2.5))).Position
	end
	local z = PARTITION_Z[expansion]
	if z then
		store.Partition.Parent = store.Model
		store.Partition.CFrame = store.CFrame * CFrame.new(0, 7, z)
	else
		store.Partition.Parent = nil
	end
	store.Expansion = expansion
	store.LayoutId = layoutId
end

local SHAPES = {
	Can = { Vector3.new(0.8, 1.1, 0.8), Enum.PartType.Cylinder },
	Bottle = { Vector3.new(0.6, 1.5, 0.6), Enum.PartType.Cylinder },
	Box = { Vector3.new(0.9, 1.2, 0.6), Enum.PartType.Block },
	Bag = { Vector3.new(1, 1.3, 0.5), Enum.PartType.Block },
	Jar = { Vector3.new(0.8, 0.9, 0.8), Enum.PartType.Cylinder },
}

-- slots: array [1..4] of { P = productId, Q = qty } or nil
function StoreBuilder.UpdateUnit(store, unitIndex, slots, capacity)
	local unit = store.Units[unitIndex]
	unit.Items:ClearAllChildren()
	local slotWidth = unit.Size.X / Config.SlotsPerUnit
	for slot = 1, Config.SlotsPerUnit do
		local entry = slots[slot]
		local tag = unit.Tags[slot]
		if entry and entry.P and entry.Q > 0 then
			local product = Products.ById[entry.P]
			tag.Text = ("%s %d/%d"):format(product and product.Name or "?", entry.Q, capacity)
			tag.TextColor3 = entry.Q <= 2 and C(220, 60, 60) or C(30, 30, 40)
			local shown = math.clamp(math.ceil(entry.Q / capacity * 4), 1, 4)
			local shape = SHAPES[product and product.Shape or "Box"]
			local x = -unit.Size.X / 2 + slotWidth * (slot - 0.5)
			for n = 1, shown do
				local row = unit.Rows[(n - 1) // 2 + 1]
				local dx = ((n - 1) % 2 == 0) and -slotWidth * 0.22 or slotWidth * 0.22
				local size = shape[1]
				local item = Instance.new("Part")
				item.Name = entry.P
				item.Anchored = true
				item.CanCollide = false
				item.CanQuery = false
				item.CanTouch = false
				item.Color = product and product.Color or C(200, 200, 200)
				item.Material = M.SmoothPlastic
				if shape[2] == Enum.PartType.Cylinder then
					item.Shape = Enum.PartType.Cylinder
					item.Size = Vector3.new(size.Y, size.X, size.Z)
					item.CFrame = unit.CFrame * CFrame.new(x + dx, row + size.Y / 2 - 0.55, -0.2) * CFrame.Angles(0, 0, math.rad(90))
				else
					item.Size = size
					item.CFrame = unit.CFrame * CFrame.new(x + dx, row + size.Y / 2 - 0.55, -0.2)
				end
				item.Parent = unit.Items
			end
		else
			tag.Text = "empty"
			tag.TextColor3 = C(150, 150, 160)
		end
	end
end

function StoreBuilder.SetSign(store, text, color)
	store.SignLabel.Text = text
	for _, p in ipairs(store.Themed.Sign) do
		p.Color = color
	end
end

function StoreBuilder.ApplyDecor(store, decorOn)
	store.Decor:ClearAllChildren()
	for id, on in pairs(decorOn or {}) do
		local build = DECOR_BUILDERS[id]
		if on and build then
			build(store.Decor, store.CFrame)
		end
	end
end

-- A glowing note on the counter (Mysterious Message event / founder clue)
function StoreBuilder.SetNote(store, visible)
	if visible and not store.Note then
		local note = part(store.Model, "MysteryNote", Vector3.new(1, 0.1, 0.8), store.CFrame * CFrame.new(18, 4.35, -12), C(255, 245, 220), M.Neon, { CanCollide = false })
		store.Note = note
		store.NotePrompt = prompt(note, "Read note", "Folded note", 8)
		return store.NotePrompt
	elseif not visible and store.Note then
		store.Note:Destroy()
		store.Note = nil
		store.NotePrompt = nil
	end
	return nil
end

function StoreBuilder.WorldPoint(store, localPoint)
	return (store.CFrame * CFrame.new(localPoint)).Position
end

return StoreBuilder
