-- Builds drivable cars from parts and handles buying/spawning them at pads.
-- Physics: the car body slides on the ground with zero friction; a
-- LinearVelocity (horizontal plane) and an AngularVelocity (yaw only, which also
-- keeps the car from flipping) are driven by the driver's client
-- (see client/Driving.client.lua), since the driver owns the car's physics.
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Config = require(ReplicatedStorage:WaitForChild("Shared"):WaitForChild("Config"))
local Remotes = require(script.Parent.Remotes)
local DataService = require(script.Parent.DataService)
local TeamService = require(script.Parent.TeamService)

local VehicleService = {}

local spawned = {} -- [player] = Model
local lastSpawn = {}

local function buildCar(vehicleKey)
	local def = Config.Vehicles[vehicleKey]
	local model = Instance.new("Model")
	model.Name = def.Display
	model:SetAttribute("VehicleKey", vehicleKey)
	model:SetAttribute("MaxSpeed", def.MaxSpeed)
	model:SetAttribute("TurnRate", def.TurnRate)

	local body = Instance.new("Part")
	body.Name = "Body"
	body.Size = Vector3.new(7, 2, 14)
	body.CFrame = CFrame.new(0, 1, 0)
	body.Color = def.Color
	body.Material = Enum.Material.SmoothPlastic
	body.TopSurface = Enum.SurfaceType.Smooth
	body.BottomSurface = Enum.SurfaceType.Smooth
	body.CustomPhysicalProperties = PhysicalProperties.new(0.6, 0, 0, 100, 100)
	body.Parent = model
	model.PrimaryPart = body

	local function piece(className, name, size, offset, color, material, extra)
		local p = Instance.new(className)
		p.Name = name
		p.Size = size
		p.CFrame = body.CFrame * offset
		p.Color = color
		p.Material = material or Enum.Material.SmoothPlastic
		p.TopSurface = Enum.SurfaceType.Smooth
		p.BottomSurface = Enum.SurfaceType.Smooth
		p.Massless = true
		if extra then
			extra(p)
		end
		p.Parent = model
		local weld = Instance.new("WeldConstraint")
		weld.Part0 = body
		weld.Part1 = p
		weld.Parent = p
		return p
	end

	-- Cabin (glass, non-collidable so players can sit inside)
	piece("Part", "Cabin", Vector3.new(6.4, 2.6, 7), CFrame.new(0, 2.3, 1), Color3.fromRGB(150, 200, 230), Enum.Material.Glass, function(p)
		p.Transparency = 0.5
		p.CanCollide = false
	end)
	piece("Part", "Hood", Vector3.new(6.8, 0.6, 4.5), CFrame.new(0, 1.3, -4.6), def.Color)
	-- Wheels (visual)
	for _, x in ipairs({ -3.8, 3.8 }) do
		for _, z in ipairs({ -4.5, 4.5 }) do
			piece("Part", "Wheel", Vector3.new(1.2, 3, 3), CFrame.new(x, 0.5, z), Color3.fromRGB(25, 25, 25), Enum.Material.Rubber, function(p)
				p.Shape = Enum.PartType.Cylinder
				p.CanCollide = false
			end)
		end
	end
	-- Headlights / taillights
	for _, x in ipairs({ -2.6, 2.6 }) do
		piece("Part", "Headlight", Vector3.new(1.2, 0.6, 0.2), CFrame.new(x, 0.8, -7.05), Color3.fromRGB(255, 250, 220), Enum.Material.Neon, function(p)
			p.CanCollide = false
		end)
		piece("Part", "Taillight", Vector3.new(1.2, 0.6, 0.2), CFrame.new(x, 0.8, 7.05), Color3.fromRGB(255, 40, 40), Enum.Material.Neon, function(p)
			p.CanCollide = false
		end)
	end
	if def.Police then
		piece("Part", "LightRed", Vector3.new(2, 0.5, 1), CFrame.new(-1, 3.85, 1), Color3.fromRGB(255, 30, 30), Enum.Material.Neon)
		piece("Part", "LightBlue", Vector3.new(2, 0.5, 1), CFrame.new(1, 3.85, 1), Color3.fromRGB(30, 80, 255), Enum.Material.Neon)
		piece("Part", "Stripe", Vector3.new(7.05, 0.5, 8), CFrame.new(0, 0.6, 1), Color3.new(1, 1, 1))
	end

	-- Seats
	local seat = piece("VehicleSeat", "DriveSeat", Vector3.new(2, 0.6, 2), CFrame.new(-1.5, 1.3, 0), Color3.fromRGB(40, 40, 40))
	seat.HeadsUpDisplay = false
	piece("Seat", "Passenger", Vector3.new(2, 0.6, 2), CFrame.new(1.5, 1.3, 0), Color3.fromRGB(40, 40, 40))
	piece("Seat", "RearLeft", Vector3.new(2, 0.6, 2), CFrame.new(-1.5, 1.3, 3), Color3.fromRGB(40, 40, 40))
	piece("Seat", "RearRight", Vector3.new(2, 0.6, 2), CFrame.new(1.5, 1.3, 3), Color3.fromRGB(40, 40, 40))

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
	drive.MaxForce = 150000
	drive.Parent = body

	local steer = Instance.new("AngularVelocity")
	steer.Name = "Steer"
	steer.Attachment0 = attachment
	steer.RelativeTo = Enum.ActuatorRelativeTo.World
	steer.AngularVelocity = Vector3.zero
	steer.MaxTorque = 5000000
	steer.Parent = body

	return model, body, seat
end

function VehicleService.Despawn(player)
	local car = spawned[player]
	if car then
		car:Destroy()
		spawned[player] = nil
	end
end

local function spawnFor(player, vehicleKey, padCFrame)
	local def = Config.Vehicles[vehicleKey]
	local model, body, seat = buildCar(vehicleKey)
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
			pcall(function()
				body:SetNetworkOwner(driver)
			end)
		else
			pcall(function()
				body:SetNetworkOwner(nil)
			end)
		end
	end)

	VehicleService.Despawn(player)
	model:PivotTo(padCFrame * CFrame.new(0, 1.3, 0))
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
	if def.Team and TeamService.GetKey(player) ~= def.Team then
		Remotes.Notify(player, "This vehicle is for " .. def.Team .. " only.", "bad")
		return
	end
	if not TeamService.GetKey(player) or TeamService.GetKey(player) == "Prisoner" then
		return
	end
	if not profile.Data.OwnedVehicles[vehicleKey] then
		if not DataService.SpendCash(player, def.Price) then
			Remotes.Notify(player, ("You need $%d to buy the %s."):format(def.Price, def.Display), "bad")
			return
		end
		profile.Data.OwnedVehicles[vehicleKey] = true
		Remotes.Notify(player, ("You bought the %s! It's yours forever."):format(def.Display), "good")
	end
	lastSpawn[player] = now
	spawnFor(player, vehicleKey, pad.CFrame)
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

	TeamService.OnTeamChanged(function(player)
		VehicleService.Despawn(player)
	end)
	Players.PlayerRemoving:Connect(function(player)
		VehicleService.Despawn(player)
		lastSpawn[player] = nil
	end)
end

return VehicleService
