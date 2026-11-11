-- Builds the whole city from code so the game works in an empty place.
-- Feel free to replace any of this with a hand-built map later: the rest of
-- the game only needs the markers returned by MapBuilder.Build().
local Lighting = game:GetService("Lighting")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Config = require(ReplicatedStorage:WaitForChild("Shared"):WaitForChild("Config"))

local MapBuilder = {}

local function part(props)
	local p = Instance.new("Part")
	p.Anchored = true
	p.TopSurface = Enum.SurfaceType.Smooth
	p.BottomSurface = Enum.SurfaceType.Smooth
	p.Material = Enum.Material.SmoothPlastic
	for k, v in pairs(props) do
		if k ~= "Parent" then
			p[k] = v
		end
	end
	p.Parent = props.Parent
	return p
end

-- Flat decoration lying on the ground. Not collidable, so cars glide over it.
local function decal(parent, name, center, sizeX, sizeZ, color, material)
	return part({
		Parent = parent, Name = name,
		Size = Vector3.new(sizeX, 0.2, sizeZ),
		Position = center + Vector3.new(0, 0.05, 0),
		Color = color, Material = material or Enum.Material.SmoothPlastic,
		CanCollide = false,
	})
end

-- Box building with a doorway on the +Z side (doorWidth 0 = solid walls)
local function building(parent, name, center, size, color, doorWidth, wallMaterial)
	local model = Instance.new("Model")
	model.Name = name
	model.Parent = parent
	local t = 2
	local h = size.Y
	local cx, cz = center.X, center.Z
	local mat = wallMaterial or Enum.Material.Concrete

	local function wall(n, s, pos)
		return part({ Parent = model, Name = n, Size = s, Position = pos, Color = color, Material = mat })
	end

	decal(model, "Floor", center, size.X, size.Z, Color3.fromRGB(120, 115, 110), Enum.Material.Slate)
	wall("Back", Vector3.new(size.X, h, t), Vector3.new(cx, h / 2, cz - size.Z / 2 + t / 2))
	wall("Left", Vector3.new(t, h, size.Z), Vector3.new(cx - size.X / 2 + t / 2, h / 2, cz))
	wall("Right", Vector3.new(t, h, size.Z), Vector3.new(cx + size.X / 2 - t / 2, h / 2, cz))
	local frontZ = cz + size.Z / 2 - t / 2
	if doorWidth and doorWidth > 0 then
		local seg = (size.X - doorWidth) / 2
		wall("FrontL", Vector3.new(seg, h, t), Vector3.new(cx - size.X / 2 + seg / 2, h / 2, frontZ))
		wall("FrontR", Vector3.new(seg, h, t), Vector3.new(cx + size.X / 2 - seg / 2, h / 2, frontZ))
		local doorH = math.min(12, h - 2)
		wall("Lintel", Vector3.new(doorWidth, h - doorH, t), Vector3.new(cx, doorH + (h - doorH) / 2, frontZ))
	else
		wall("Front", Vector3.new(size.X, h, t), Vector3.new(cx, h / 2, frontZ))
	end
	part({
		Parent = model, Name = "Roof", Size = Vector3.new(size.X, 1, size.Z),
		Position = Vector3.new(cx, h + 0.5, cz), Color = color:Lerp(Color3.new(0, 0, 0), 0.3), Material = mat,
	})
	return model
end

-- Big floating sign above a building; returns the TextLabel so it can be updated
local function sign(parent, position, text, color)
	local anchor = part({
		Parent = parent, Name = "SignAnchor", Size = Vector3.new(1, 1, 1),
		Position = position, Transparency = 1, CanCollide = false, CanQuery = false, CanTouch = false,
	})
	local gui = Instance.new("BillboardGui")
	gui.Size = UDim2.new(28, 0, 6, 0)
	gui.MaxDistance = 600
	gui.LightInfluence = 0
	gui.Parent = anchor
	local label = Instance.new("TextLabel")
	label.Size = UDim2.fromScale(1, 1)
	label.BackgroundTransparency = 0.35
	label.BackgroundColor3 = Color3.fromRGB(20, 20, 25)
	label.TextColor3 = color or Color3.new(1, 1, 1)
	label.Font = Enum.Font.GothamBlack
	label.TextScaled = true
	label.Text = text
	label.Parent = gui
	local corner = Instance.new("UICorner")
	corner.CornerRadius = UDim.new(0.2, 0)
	corner.Parent = label
	return label
end

local function vehiclePad(parent, position, yaw, vehicleKey, pads)
	local def = Config.Vehicles[vehicleKey]
	local pad = part({
		Parent = parent, Name = "Pad_" .. vehicleKey,
		Size = Vector3.new(14, 0.2, 22),
		CFrame = CFrame.new(position + Vector3.new(0, 0.05, 0)) * CFrame.Angles(0, math.rad(yaw), 0),
		Color = def.Color, Material = Enum.Material.Neon, Transparency = 0.6, CanCollide = false,
	})
	local kiosk = part({
		Parent = parent, Name = "Kiosk_" .. vehicleKey, Size = Vector3.new(3, 5, 3),
		CFrame = pad.CFrame * CFrame.new(9, 2.5, 0), Color = Color3.fromRGB(40, 40, 45),
	})
	table.insert(pads, { Pad = pad, Kiosk = kiosk, VehicleKey = vehicleKey })
end

local function tree(parent, position)
	part({
		Parent = parent, Name = "Trunk", Size = Vector3.new(2, 10, 2), Position = position + Vector3.new(0, 5, 0),
		Color = Color3.fromRGB(110, 75, 45), Material = Enum.Material.Wood,
	})
	local leaves = part({
		Parent = parent, Name = "Leaves", Size = Vector3.new(10, 10, 10), Position = position + Vector3.new(0, 13, 0),
		Color = Color3.fromRGB(60, 140, 60), Material = Enum.Material.Grass,
	})
	leaves.Shape = Enum.PartType.Ball
end

function MapBuilder.Build()
	-- Remove the default Studio template parts so they don't clash with the city
	for _, name in ipairs({ "Baseplate", "SpawnLocation" }) do
		local old = workspace:FindFirstChild(name)
		if old then
			old:Destroy()
		end
	end

	local existing = workspace:FindFirstChild("City")
	if existing then
		existing:Destroy()
	end
	local city = Instance.new("Folder")
	city.Name = "City"
	city.Parent = workspace

	local map = { Spawns = {}, RobZones = {}, Signs = {}, VehiclePads = {} }
	local L = Config.Locations
	local half = Config.MapSize / 2

	Lighting.ClockTime = 14.5
	Lighting.Brightness = 2
	Lighting.OutdoorAmbient = Color3.fromRGB(140, 140, 150)

	-- Ground + invisible border walls
	part({
		Parent = city, Name = "Ground", Size = Vector3.new(Config.MapSize, 2, Config.MapSize),
		Position = Vector3.new(0, -1, 0), Color = Color3.fromRGB(90, 140, 75), Material = Enum.Material.Grass,
	})
	for _, info in ipairs({
		{ Vector3.new(Config.MapSize, 80, 4), Vector3.new(0, 40, half) },
		{ Vector3.new(Config.MapSize, 80, 4), Vector3.new(0, 40, -half) },
		{ Vector3.new(4, 80, Config.MapSize), Vector3.new(half, 40, 0) },
		{ Vector3.new(4, 80, Config.MapSize), Vector3.new(-half, 40, 0) },
	}) do
		part({ Parent = city, Name = "Border", Size = info[1], Position = info[2], Transparency = 1 })
	end

	-- Roads (visual only)
	local roads = Instance.new("Folder")
	roads.Name = "Roads"
	roads.Parent = city
	local asphalt = Color3.fromRGB(45, 45, 50)
	local roadXs = { -120, 100 }
	local roadZs = { -150, 40, 160 }
	for _, x in ipairs(roadXs) do
		decal(roads, "Road", Vector3.new(x, 0, 0), 30, Config.MapSize, asphalt, Enum.Material.Asphalt)
	end
	for _, z in ipairs(roadZs) do
		decal(roads, "Road", Vector3.new(0, 0.01, z), Config.MapSize, 30, asphalt, Enum.Material.Asphalt)
	end

	-- Robbery targets
	for _, rob in ipairs(Config.Robberies) do
		local model = building(city, rob.Name, rob.Position, rob.Size, rob.Color, 14)
		local zone = part({
			Parent = model, Name = "RobZone",
			Size = Vector3.new(rob.Size.X - 6, 12, rob.Size.Z - 6),
			Position = rob.Position + Vector3.new(0, 6, 0),
			Transparency = 1, CanCollide = false, CanQuery = false, CanTouch = false,
		})
		-- loot props so the inside doesn't look empty
		for i = -1, 1 do
			part({
				Parent = model, Name = "Loot", Size = Vector3.new(4, 3, 4),
				Position = rob.Position + Vector3.new(i * 10, 1.5, -rob.Size.Z / 4),
				Color = Color3.fromRGB(240, 200, 60), Material = Enum.Material.Neon,
			})
		end
		map.RobZones[rob.Id] = zone
		map.Signs[rob.Id] = sign(model, rob.Position + Vector3.new(0, rob.Size.Y + 6, 0), rob.Name, Color3.new(1, 1, 1))
	end

	-- Police station
	local ps = L.PoliceStation
	local station = building(city, "Police Station", ps, Vector3.new(50, 20, 36), Color3.fromRGB(70, 90, 140), 14)
	sign(station, ps + Vector3.new(0, 26, 0), "POLICE", Color3.fromRGB(120, 170, 255))
	map.Spawns.Police = CFrame.new(ps + Vector3.new(0, 3, 0))
	vehiclePad(city, ps + Vector3.new(-20, 0, 45), 0, "Cruiser", map.VehiclePads)
	vehiclePad(city, ps + Vector3.new(20, 0, 45), 0, "Interceptor", map.VehiclePads)

	-- Jail: tall solid walls, cells inside, and a secret vent for breakouts
	local jp = L.Jail
	local jailSize = Vector3.new(80, 30, 70)
	local jail = building(city, "Jail", jp, jailSize, Color3.fromRGB(110, 110, 115), 0)
	sign(jail, jp + Vector3.new(0, 36, 0), "CITY JAIL", Color3.fromRGB(255, 160, 60))
	for i = -2, 2 do
		part({
			Parent = jail, Name = "CellWall", Size = Vector3.new(1, 12, 20),
			Position = jp + Vector3.new(i * 14, 6, -jailSize.Z / 2 + 11), Color = Color3.fromRGB(80, 80, 85),
		})
	end
	map.Spawns.Prisoner = CFrame.new(jp + Vector3.new(0, 3, 10))
	map.Vent = part({
		Parent = jail, Name = "Vent", Size = Vector3.new(4, 3, 0.4),
		Position = jp + Vector3.new(-jailSize.X / 2 + 6, 1.5, -jailSize.Z / 2 + 2.3),
		Color = Color3.fromRGB(40, 40, 40), Material = Enum.Material.DiamondPlate,
	})
	map.EscapeExit = CFrame.new(jp + Vector3.new(-jailSize.X / 2 - 12, 3, -jailSize.Z / 2 + 4))

	-- Criminal hideout
	local hp = L.Hideout
	local hideout = building(city, "Hideout", hp, Vector3.new(50, 16, 40), Color3.fromRGB(90, 60, 50), 16, Enum.Material.Brick)
	sign(hideout, hp + Vector3.new(0, 22, 0), "HIDEOUT", Color3.fromRGB(255, 90, 90))
	map.Spawns.Criminal = CFrame.new(hp + Vector3.new(0, 3, -8))
	map.CashZone = part({
		Parent = hideout, Name = "CashZone", Size = Vector3.new(16, 0.3, 12),
		Position = hp + Vector3.new(0, 0.1, 6), Color = Color3.fromRGB(60, 220, 90),
		Material = Enum.Material.Neon, Transparency = 0.4, CanCollide = false,
	})
	sign(hideout, hp + Vector3.new(0, 7, 6), "CASH IN HERE", Color3.fromRGB(120, 255, 140)).Parent.Size = UDim2.new(14, 0, 3, 0)
	vehiclePad(city, hp + Vector3.new(-40, 0, 50), 0, "Sedan", map.VehiclePads)
	vehiclePad(city, hp + Vector3.new(-15, 0, 50), 0, "Muscle", map.VehiclePads)
	vehiclePad(city, hp + Vector3.new(10, 0, 50), 0, "Supercar", map.VehiclePads)

	-- Global leaderboard board next to the hideout
	local boardPart = part({
		Parent = city, Name = "Leaderboard", Size = Vector3.new(24, 16, 1),
		CFrame = CFrame.new(hp + Vector3.new(40, 9, 10)) * CFrame.Angles(0, math.rad(-90), 0),
		Color = Color3.fromRGB(25, 25, 30),
	})
	local surface = Instance.new("SurfaceGui")
	surface.Face = Enum.NormalId.Front
	surface.SizingMode = Enum.SurfaceGuiSizingMode.PixelsPerStud
	surface.PixelsPerStud = 25
	surface.Parent = boardPart
	local title = Instance.new("TextLabel")
	title.Size = UDim2.new(1, 0, 0.15, 0)
	title.BackgroundTransparency = 1
	title.Text = "RICHEST IN THE CITY"
	title.TextColor3 = Color3.fromRGB(255, 215, 80)
	title.Font = Enum.Font.GothamBlack
	title.TextScaled = true
	title.Parent = surface
	local list = Instance.new("Frame")
	list.Size = UDim2.new(0.9, 0, 0.8, 0)
	list.Position = UDim2.new(0.05, 0, 0.17, 0)
	list.BackgroundTransparency = 1
	list.Parent = surface
	local layout = Instance.new("UIListLayout")
	layout.SortOrder = Enum.SortOrder.LayoutOrder
	layout.Parent = list
	map.LeaderboardList = list

	-- Filler buildings + trees for a city feel (deterministic layout)
	local rng = Random.new(1337)
	local keyPoints = { L.PoliceStation, L.Jail, L.Hideout }
	for _, rob in ipairs(Config.Robberies) do
		table.insert(keyPoints, rob.Position)
	end
	local function clear(pos, radius)
		for _, p in ipairs(keyPoints) do
			if (p - pos).Magnitude < radius then
				return false
			end
		end
		for _, x in ipairs(roadXs) do
			if math.abs(pos.X - x) < 35 then
				return false
			end
		end
		for _, z in ipairs(roadZs) do
			if math.abs(pos.Z - z) < 35 then
				return false
			end
		end
		return true
	end
	local filler = Instance.new("Folder")
	filler.Name = "Filler"
	filler.Parent = city
	local placed = 0
	for _ = 1, 300 do
		if placed >= 30 then
			break
		end
		local pos = Vector3.new(rng:NextInteger(-400, 400), 0, rng:NextInteger(-400, 400))
		if clear(pos, 90) then
			placed = placed + 1
			local h = rng:NextInteger(20, 70)
			part({
				Parent = filler, Name = "Tower", Size = Vector3.new(rng:NextInteger(20, 34), h, rng:NextInteger(20, 34)),
				Position = pos + Vector3.new(0, h / 2, 0),
				Color = Color3.fromHSV(rng:NextNumber(), 0.15, rng:NextNumber(0.55, 0.85)), Material = Enum.Material.Concrete,
			})
		end
	end
	for _ = 1, 60 do
		local pos = Vector3.new(rng:NextInteger(-430, 430), 0, rng:NextInteger(-430, 430))
		if clear(pos, 85) then
			tree(filler, pos)
		end
	end

	return map
end

return MapBuilder
