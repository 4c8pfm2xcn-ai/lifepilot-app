-- Builds drivable vehicles from parts and handles buying/spawning them at pads.
--
-- Physics: an invisible-ish "Body" slab slides on the ground with zero friction.
-- A LinearVelocity drives it (Plane mode = ground car; Vector mode = flying)
-- and an AngularVelocity handles steering while keeping the car level, so cars
-- never flip and fly flat off ramps. Everything else is welded decoration.
-- The driver's client sets the movers (see client/Driving.client.lua) because
-- the driver owns the car's physics.
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Config = require(ReplicatedStorage:WaitForChild("Shared"):WaitForChild("Config"))
local Remotes = require(script.Parent.Remotes)
local DataService = require(script.Parent.DataService)
local TeamService = require(script.Parent.TeamService)

local VehicleService = {}

local spawned = {} -- [player] = Model
local lastSpawn = {}
local lastNitro = {}

local DARK = Color3.fromRGB(25, 25, 28)
local GLASS = Color3.fromRGB(150, 200, 230)
local NEON = Enum.Material.Neon

-- Piece list entry: { name, size, offset (relative to body center), color, material?, extra? }
-- Seats: { className, offset }. Exhausts: offsets where nitro flames come out.
local function styleSpec(def)
	local main = def.Color
	local glow = def.Glow or main
	local style = def.Style or "Car"

	if style == "Hyper" then
		local pieces = {
			{ "Cabin", Vector3.new(6, 1.4, 5.5), Vector3.new(0, 1.5, 1), Color3.fromRGB(40, 40, 60), Enum.Material.Glass, { Transparency = 0.35 } },
			{ "Nose", Vector3.new(7.6, 0.6, 4), Vector3.new(0, 1.0, -5), main },
			{ "Wing", Vector3.new(8.4, 0.3, 1.6), Vector3.new(0, 2.6, 6.8), main },
			{ "WingPostL", Vector3.new(0.4, 1.6, 0.4), Vector3.new(-2.5, 1.6, 6.8), DARK },
			{ "WingPostR", Vector3.new(0.4, 1.6, 0.4), Vector3.new(2.5, 1.6, 6.8), DARK },
			{ "StripeL", Vector3.new(0.2, 0.4, 13), Vector3.new(-4.05, 0, 0), glow, NEON },
			{ "StripeR", Vector3.new(0.2, 0.4, 13), Vector3.new(4.05, 0, 0), glow, NEON },
			{ "HeadL", Vector3.new(2, 0.3, 0.2), Vector3.new(-2.6, 0.3, -7.55), Color3.new(1, 1, 1), NEON },
			{ "HeadR", Vector3.new(2, 0.3, 0.2), Vector3.new(2.6, 0.3, -7.55), Color3.new(1, 1, 1), NEON },
			{ "Tail", Vector3.new(7, 0.3, 0.2), Vector3.new(0, 0.4, 7.55), Color3.fromRGB(255, 30, 30), NEON },
		}
		for _, x in ipairs({ -4.1, 4.1 }) do
			for _, z in ipairs({ -5, 5 }) do
				table.insert(pieces, { "Wheel", Vector3.new(1.4, 2.6, 2.6), Vector3.new(x, 0.5, z), DARK, Enum.Material.Rubber, { Shape = Enum.PartType.Cylinder } })
			end
		end
		return {
			Body = Vector3.new(8, 1.6, 15), Pieces = pieces, RoofY = 2.45,
			Seats = { { "VehicleSeat", Vector3.new(-1.4, 0.95, 1) }, { "Seat", Vector3.new(1.4, 0.95, 1) } },
			Exhausts = { Vector3.new(-1.2, -0.2, 7.7), Vector3.new(1.2, -0.2, 7.7) },
		}
	elseif style == "Monster" then
		local pieces = {
			{ "Frame", Vector3.new(8, 1.2, 14), Vector3.new(0, 3.6, 0), DARK, Enum.Material.Metal },
			{ "Cab", Vector3.new(8, 4, 6.5), Vector3.new(0, 6.3, -1.5), main, nil, { Transparency = 0.15 } },
			{ "Hood", Vector3.new(8, 1.8, 4.5), Vector3.new(0, 5.1, -6.5), main },
			{ "Grille", Vector3.new(7, 1.2, 0.3), Vector3.new(0, 5.1, -8.8), glow, NEON },
			{ "BedBack", Vector3.new(8, 2, 0.5), Vector3.new(0, 5.2, 6.8), main },
			{ "BedL", Vector3.new(0.5, 2, 7), Vector3.new(-3.75, 5.2, 3.5), main },
			{ "BedR", Vector3.new(0.5, 2, 7), Vector3.new(3.75, 5.2, 3.5), main },
			{ "LightBar", Vector3.new(7, 0.5, 0.6), Vector3.new(0, 8.6, -3.5), Color3.fromRGB(255, 250, 220), NEON },
		}
		for _, x in ipairs({ -5.3, 5.3 }) do
			for _, z in ipairs({ -5.5, 5.5 }) do
				table.insert(pieces, { "Wheel", Vector3.new(2.6, 7, 7), Vector3.new(x, 3, z), DARK, Enum.Material.Rubber, { Shape = Enum.PartType.Cylinder } })
			end
		end
		return {
			Body = Vector3.new(9, 1, 15), HideBody = true, Pieces = pieces, RoofY = 8.55,
			Seats = {
				{ "VehicleSeat", Vector3.new(-1.5, 4.6, -1.5) }, { "Seat", Vector3.new(1.5, 4.6, -1.5) },
				{ "Seat", Vector3.new(-2, 4.6, 4) }, { "Seat", Vector3.new(2, 4.6, 4) },
			},
			Exhausts = { Vector3.new(-3, 8.5, 1.9), Vector3.new(3, 8.5, 1.9) },
		}
	elseif style == "Kart" then
		local pieces = {
			{ "Engine", Vector3.new(3, 1.5, 1.8), Vector3.new(0, 1.2, 3.2), DARK, Enum.Material.Metal },
			{ "Bumper", Vector3.new(5.2, 0.4, 0.4), Vector3.new(0, 0, -4.1), glow, NEON },
			{ "RollBar", Vector3.new(3, 0.3, 0.3), Vector3.new(0, 3.2, 1.8), DARK, Enum.Material.Metal },
			{ "RollL", Vector3.new(0.3, 2.4, 0.3), Vector3.new(-1.35, 2, 1.8), DARK, Enum.Material.Metal },
			{ "RollR", Vector3.new(0.3, 2.4, 0.3), Vector3.new(1.35, 2, 1.8), DARK, Enum.Material.Metal },
			{ "Fin", Vector3.new(0.3, 2, 2), Vector3.new(0, 1.8, 3.4), main },
		}
		for _, x in ipairs({ -2.9, 2.9 }) do
			for _, z in ipairs({ -3, 3 }) do
				table.insert(pieces, { "Wheel", Vector3.new(1.2, 2, 2), Vector3.new(x, 0.5, z), DARK, Enum.Material.Rubber, { Shape = Enum.PartType.Cylinder } })
			end
		end
		return {
			Body = Vector3.new(5, 1, 8), Pieces = pieces, RoofY = 3.5,
			Seats = { { "VehicleSeat", Vector3.new(0, 0.8, 0.6) } },
			Exhausts = { Vector3.new(-0.9, 1.4, 4.6), Vector3.new(0.9, 1.4, 4.6) },
		}
	elseif style == "Flyer" then
		local pieces = {
			{ "Wings", Vector3.new(18, 0.4, 4), Vector3.new(0, 0.2, 1.5), main },
			{ "TipL", Vector3.new(0.4, 0.6, 1), Vector3.new(-9, 0.3, 1.5), Color3.fromRGB(255, 40, 40), NEON },
			{ "TipR", Vector3.new(0.4, 0.6, 1), Vector3.new(9, 0.3, 1.5), Color3.fromRGB(40, 255, 80), NEON },
			{ "Canopy", Vector3.new(5, 1.8, 6.5), Vector3.new(0, 1.6, -0.5), GLASS, Enum.Material.Glass, { Transparency = 0.45 } },
			{ "Tail", Vector3.new(0.4, 3, 2.5), Vector3.new(0, 2.2, 5.6), main },
			{ "ThrusterL", Vector3.new(2, 2, 1), Vector3.new(-2, 0.2, 6.8), glow, NEON },
			{ "ThrusterR", Vector3.new(2, 2, 1), Vector3.new(2, 0.2, 6.8), glow, NEON },
		}
		return {
			Body = Vector3.new(7, 1.6, 13), Pieces = pieces, RoofY = 2.75,
			Seats = {
				{ "VehicleSeat", Vector3.new(-1.4, 1.1, -1.5) }, { "Seat", Vector3.new(1.4, 1.1, -1.5) },
				{ "Seat", Vector3.new(-1.4, 1.1, 1.8) }, { "Seat", Vector3.new(1.4, 1.1, 1.8) },
			},
			Exhausts = { Vector3.new(-2, 0.2, 7.6), Vector3.new(2, 0.2, 7.6) },
		}
	end

	-- Default "Car"
	local pieces = {
		{ "Cabin", Vector3.new(6.4, 2.6, 7), Vector3.new(0, 2.3, 1), GLASS, Enum.Material.Glass, { Transparency = 0.5 } },
		{ "Hood", Vector3.new(6.8, 0.6, 4.5), Vector3.new(0, 1.3, -4.6), main },
		{ "HeadL", Vector3.new(1.2, 0.6, 0.2), Vector3.new(-2.6, -0.2, -7.05), Color3.fromRGB(255, 250, 220), NEON },
		{ "HeadR", Vector3.new(1.2, 0.6, 0.2), Vector3.new(2.6, -0.2, -7.05), Color3.fromRGB(255, 250, 220), NEON },
		{ "TailL", Vector3.new(1.2, 0.6, 0.2), Vector3.new(-2.6, -0.2, 7.05), Color3.fromRGB(255, 40, 40), NEON },
		{ "TailR", Vector3.new(1.2, 0.6, 0.2), Vector3.new(2.6, -0.2, 7.05), Color3.fromRGB(255, 40, 40), NEON },
	}
	if def.Police then
		table.insert(pieces, { "Stripe", Vector3.new(7.05, 0.5, 8), Vector3.new(0, -0.4, 1), Color3.new(1, 1, 1) })
	end
	for _, x in ipairs({ -3.8, 3.8 }) do
		for _, z in ipairs({ -4.5, 4.5 }) do
			table.insert(pieces, { "Wheel", Vector3.new(1.2, 3, 3), Vector3.new(x, 0.5, z), DARK, Enum.Material.Rubber, { Shape = Enum.PartType.Cylinder } })
		end
	end
	return {
		Body = Vector3.new(7, 2, 14), Pieces = pieces, RoofY = 3.85,
		Seats = {
			{ "VehicleSeat", Vector3.new(-1.5, 1.3, 0) }, { "Seat", Vector3.new(1.5, 1.3, 0) },
			{ "Seat", Vector3.new(-1.5, 1.3, 3) }, { "Seat", Vector3.new(1.5, 1.3, 3) },
		},
		Exhausts = { Vector3.new(-1.8, -0.5, 7.3), Vector3.new(1.8, -0.5, 7.3) },
	}
end

local function buildCar(vehicleKey)
	local def = Config.Vehicles[vehicleKey]
	local spec = styleSpec(def)
	local half = spec.Body.Y / 2

	local model = Instance.new("Model")
	model.Name = def.Display
	model:SetAttribute("VehicleKey", vehicleKey)
	model:SetAttribute("MaxSpeed", def.MaxSpeed)
	model:SetAttribute("TurnRate", def.TurnRate)
	model:SetAttribute("Fly", def.Fly == true)
	model:SetAttribute("RideHeight", half)

	local body = Instance.new("Part")
	body.Name = "Body"
	body.Size = spec.Body
	body.CFrame = CFrame.new(0, half, 0)
	body.Color = def.Color
	body.Material = Enum.Material.SmoothPlastic
	body.TopSurface = Enum.SurfaceType.Smooth
	body.BottomSurface = Enum.SurfaceType.Smooth
	body.Transparency = spec.HideBody and 1 or 0
	body.CustomPhysicalProperties = PhysicalProperties.new(0.6, 0, 0, 100, 100)
	body.Parent = model
	model.PrimaryPart = body

	local function weld(p)
		p.Massless = true
		p.Parent = model
		local w = Instance.new("WeldConstraint")
		w.Part0 = body
		w.Part1 = p
		w.Parent = p
	end

	local function piece(className, name, size, offset, color, material, props)
		local p = Instance.new(className)
		p.Name = name
		p.Size = size
		p.CFrame = body.CFrame * CFrame.new(offset)
		p.Color = color
		p.Material = material or Enum.Material.SmoothPlastic
		p.TopSurface = Enum.SurfaceType.Smooth
		p.BottomSurface = Enum.SurfaceType.Smooth
		p.CanCollide = false
		for k, v in pairs(props or {}) do
			p[k] = v
		end
		weld(p)
		return p
	end

	for _, info in ipairs(spec.Pieces) do
		piece("Part", info[1], info[2], info[3], info[4], info[5], info[6])
	end

	if def.Police then
		piece("Part", "LightRed", Vector3.new(2, 0.5, 1), Vector3.new(-1, spec.RoofY, 1), Color3.fromRGB(255, 30, 30), NEON)
		piece("Part", "LightBlue", Vector3.new(2, 0.5, 1), Vector3.new(1, spec.RoofY, 1), Color3.fromRGB(30, 80, 255), NEON)
	end

	-- Seats (first one is the driver's VehicleSeat)
	local driveSeat
	for i, info in ipairs(spec.Seats) do
		local seat = piece(info[1], i == 1 and "DriveSeat" or ("Seat" .. i), Vector3.new(2, 0.6, 2), info[2], DARK)
		seat.CanCollide = true
		if i == 1 then
			seat.HeadsUpDisplay = false
			driveSeat = seat
		end
	end

	-- Exhaust flames (nitro). Rocket karts keep them lit all the time.
	for _, offset in ipairs(spec.Exhausts) do
		local pipe = piece("Part", "Exhaust", Vector3.new(0.6, 0.6, 0.6), offset, DARK, Enum.Material.Metal)
		local fire = Instance.new("Fire")
		fire.Name = "NitroFire"
		fire.Size = 4
		fire.Heat = 12
		fire.Color = Color3.fromRGB(80, 160, 255)
		fire.SecondaryColor = Color3.fromRGB(255, 120, 30)
		fire.Enabled = def.AlwaysFlames == true
		fire.Parent = pipe
	end

	-- Underglow
	local glow = Instance.new("PointLight")
	glow.Color = def.Glow or def.Color
	glow.Range = 18
	glow.Brightness = 3
	glow.Parent = body

	-- Movers
	local attachment = Instance.new("Attachment")
	attachment.Name = "Root"
	attachment.Parent = body

	local drive = Instance.new("LinearVelocity")
	drive.Name = "Drive"
	drive.Attachment0 = attachment
	drive.RelativeTo = Enum.ActuatorRelativeTo.World
	drive.VelocityConstraintMode = Enum.VelocityConstraintMode.Plane
	drive.PrimaryTangentAxis = Vector3.xAxis
	drive.SecondaryTangentAxis = Vector3.zAxis
	drive.PlaneVelocity = Vector2.zero
	drive.VectorVelocity = Vector3.zero
	drive.MaxForce = 150000
	drive.Parent = body

	local steer = Instance.new("AngularVelocity")
	steer.Name = "Steer"
	steer.Attachment0 = attachment
	steer.RelativeTo = Enum.ActuatorRelativeTo.World
	steer.AngularVelocity = Vector3.zero
	steer.MaxTorque = 5000000
	steer.Parent = body

	return model, body, driveSeat, half
end

local function setFlames(car, on)
	local def = Config.Vehicles[car:GetAttribute("VehicleKey") or ""]
	if def and def.AlwaysFlames then
		on = true
	end
	for _, d in ipairs(car:GetDescendants()) do
		if d:IsA("Fire") and d.Name == "NitroFire" then
			d.Enabled = on
		end
	end
end

function VehicleService.Despawn(player)
	local car = spawned[player]
	if car then
		car:Destroy()
		spawned[player] = nil
	end
end

-- All spawned cars: { [player] = Model }
function VehicleService.GetCars()
	return spawned
end

local function spawnFor(player, vehicleKey, padCFrame)
	local def = Config.Vehicles[vehicleKey]
	local model, body, seat, half = buildCar(vehicleKey)
	local drive = body.Drive
	model:SetAttribute("Owner", player.UserId)

	seat:GetPropertyChangedSignal("Occupant"):Connect(function()
		local occupant = seat.Occupant
		if occupant then
			local driver = Players:GetPlayerFromCharacter(occupant.Parent)
			if not driver or (def.Team and TeamService.GetKey(driver) ~= def.Team) then
				occupant.Sit = false
				if driver then
					Remotes.Notify(driver, "Only " .. def.Team .. " can drive this.", "bad")
				end
				return
			end
			if def.Fly then
				drive.VelocityConstraintMode = Enum.VelocityConstraintMode.Vector
			end
			pcall(function()
				body:SetNetworkOwner(driver)
			end)
		else
			-- No driver: stop, drop to the ground, flames off
			drive.VelocityConstraintMode = Enum.VelocityConstraintMode.Plane
			drive.PlaneVelocity = Vector2.zero
			drive.VectorVelocity = Vector3.zero
			setFlames(model, false)
			pcall(function()
				body:SetNetworkOwner(nil)
			end)
		end
	end)

	VehicleService.Despawn(player)
	model:PivotTo(padCFrame * CFrame.new(0, half + 0.3, 0))
	model.Parent = workspace
	spawned[player] = model
	pcall(function()
		body:SetNetworkOwner(nil)
	end)
end

local function onPadTriggered(player, vehicleKey, pad)
	local def = Config.Vehicles[vehicleKey]
	local profile = DataService.Get(player)
	if not profile then
		return
	end
	local now = os.clock()
	if lastSpawn[player] and now - lastSpawn[player] < 3 then
		return
	end
	local teamKey = TeamService.GetKey(player)
	if not teamKey or teamKey == "Prisoner" then
		return
	end
	if def.Team and teamKey ~= def.Team then
		Remotes.Notify(player, "This vehicle is for " .. def.Team .. " only.", "bad")
		return
	end
	if not profile.Data.OwnedVehicles[vehicleKey] then
		if not DataService.SpendCash(player, def.Price) then
			Remotes.Notify(player, ("You need $%d to buy the %s. Rob stores, grab cash drops and hit stunt jumps!"):format(def.Price, def.Display), "bad")
			return
		end
		profile.Data.OwnedVehicles[vehicleKey] = true
		Remotes.NotifyAll(("%s just bought the %s!"):format(player.Name, def.Display), "good")
	end
	lastSpawn[player] = now
	spawnFor(player, vehicleKey, pad.CFrame)
end

local function onNitro(player, on)
	if type(on) ~= "boolean" then
		return
	end
	local now = os.clock()
	if on and lastNitro[player] and now - lastNitro[player] < 0.2 then
		return
	end
	lastNitro[player] = now
	local humanoid = player.Character and player.Character:FindFirstChildOfClass("Humanoid")
	local seat = humanoid and humanoid.SeatPart
	if seat and seat.Name == "DriveSeat" and seat.Parent then
		local body = seat.Parent:FindFirstChild("Body")
		local spiked = body and (body:GetAttribute("SpikedUntil") or 0) > workspace:GetServerTimeNow()
		setFlames(seat.Parent, on and not spiked)
	end
end

function VehicleService.Init(map)
	for _, info in ipairs(map.VehiclePads) do
		local def = Config.Vehicles[info.VehicleKey]
		local prompt = Instance.new("ProximityPrompt")
		prompt.ActionText = "Spawn"
		prompt.ObjectText = def.Price > 0 and ("%s ($%d to unlock)"):format(def.Display, def.Price) or (def.Display .. " (free)")
		prompt.HoldDuration = 0.3
		prompt.MaxActivationDistance = 12
		prompt.RequiresLineOfSight = false
		prompt.Parent = info.Kiosk
		prompt.Triggered:Connect(function(player)
			onPadTriggered(player, info.VehicleKey, info.Pad)
		end)
	end

	Remotes.Events.Nitro.OnServerEvent:Connect(onNitro)

	TeamService.OnTeamChanged(function(player)
		VehicleService.Despawn(player)
	end)
	Players.PlayerRemoving:Connect(function(player)
		VehicleService.Despawn(player)
		lastSpawn[player] = nil
		lastNitro[player] = nil
	end)
end

return VehicleService
