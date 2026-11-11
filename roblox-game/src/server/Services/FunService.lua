-- The extra-fun systems:
--   * Stunt cash: big air off ramps pays out (measured on the server)
--   * Cash drops: a crate parachutes into the city; first player to reach it wins
--   * Day/night cycle: neon, street lamps and car underglow shine at night
local Lighting = game:GetService("Lighting")
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local TweenService = game:GetService("TweenService")

local Config = require(ReplicatedStorage:WaitForChild("Shared"):WaitForChild("Config"))
local Remotes = require(script.Parent.Remotes)
local DataService = require(script.Parent.DataService)
local VehicleService = require(script.Parent.VehicleService)

local FunService = {}

---------------------------------------------------------------------------
-- Stunts
---------------------------------------------------------------------------
local air = {} -- [car Model] = { Start = clock, Driver = Player }

local function driverOf(car)
	local seat = car:FindFirstChild("DriveSeat")
	local occupant = seat and seat.Occupant
	return occupant and Players:GetPlayerFromCharacter(occupant.Parent)
end

local function tickStunts()
	local now = os.clock()
	for _, car in pairs(VehicleService.GetCars()) do
		local body = car.PrimaryPart
		if body and car.Parent and not car:GetAttribute("Fly") then
			local height = body.Position.Y - (car:GetAttribute("RideHeight") or 1)
			local state = air[car]
			if height > 4 then
				if not state then
					air[car] = { Start = now, Driver = driverOf(car) }
				end
			elseif state and height < 1.5 then
				air[car] = nil
				local airtime = now - state.Start
				local driver = state.Driver
				if driver and driver.Parent and driverOf(car) == driver and airtime >= Config.StuntMinAirtime then
					local cash = math.min(Config.StuntMaxCash, math.floor(airtime * Config.StuntCashPerSecond)) * DataService.Multiplier(driver)
					DataService.AddCash(driver, cash)
					local label = airtime >= 2 and "INSANE STUNT!" or (airtime >= 1.3 and "BIG AIR!" or "STUNT!")
					Remotes.Notify(driver, ("%s %.1fs airtime  +$%d"):format(label, airtime, cash), "good")
				end
			end
		end
	end
	for car in pairs(air) do
		if not car.Parent then
			air[car] = nil
		end
	end
end

---------------------------------------------------------------------------
-- Cash drops
---------------------------------------------------------------------------
local landmarks = {}
local dropSpots = {}

local function nearestLandmark(position)
	local bestName, bestDist = "the city", math.huge
	for _, mark in ipairs(landmarks) do
		local d = (mark.Position - position).Magnitude
		if d < bestDist then
			bestName, bestDist = mark.Name, d
		end
	end
	return bestName
end

local function spawnDrop()
	local spot = dropSpots[math.random(1, #dropSpots)] + Vector3.new(math.random(-12, 12), 0, math.random(-12, 12))
	local reward = math.random(Config.CashDrop.Min, Config.CashDrop.Max)

	local crate = Instance.new("Part")
	crate.Name = "CashDrop"
	crate.Size = Vector3.new(5, 5, 5)
	crate.Anchored = true
	crate.CanCollide = false
	crate.Material = Enum.Material.Neon
	crate.Color = Color3.fromRGB(255, 210, 60)
	crate.CFrame = CFrame.new(spot + Vector3.new(0, 220, 0))
	crate.Parent = workspace

	local chute = Instance.new("Part")
	chute.Name = "Parachute"
	chute.Size = Vector3.new(16, 1, 16)
	chute.Anchored = true
	chute.CanCollide = false
	chute.Color = Color3.fromRGB(240, 60, 60)
	chute.Material = Enum.Material.Fabric
	chute.CFrame = crate.CFrame * CFrame.new(0, 12, 0)
	chute.Parent = crate

	local beacon = Instance.new("PointLight")
	beacon.Range = 30
	beacon.Brightness = 4
	beacon.Color = Color3.fromRGB(255, 210, 60)
	beacon.Parent = crate

	local gui = Instance.new("BillboardGui")
	gui.Size = UDim2.new(0, 120, 0, 40)
	gui.StudsOffset = Vector3.new(0, 6, 0)
	gui.AlwaysOnTop = true
	gui.MaxDistance = 3000
	gui.Parent = crate
	local text = Instance.new("TextLabel")
	text.Size = UDim2.fromScale(1, 1)
	text.BackgroundTransparency = 1
	text.Text = "$" .. reward
	text.TextColor3 = Color3.fromRGB(255, 220, 80)
	text.TextStrokeTransparency = 0
	text.Font = Enum.Font.GothamBlack
	text.TextScaled = true
	text.Parent = gui

	local landing = CFrame.new(spot + Vector3.new(0, 2.5, 0))
	local info = TweenInfo.new(Config.CashDrop.FallTime, Enum.EasingStyle.Linear)
	TweenService:Create(crate, info, { CFrame = landing }):Play()
	TweenService:Create(chute, info, { CFrame = landing * CFrame.new(0, 12, 0) }):Play()
	task.delay(Config.CashDrop.FallTime, function()
		if chute.Parent then
			chute:Destroy()
		end
	end)

	Remotes.NotifyAll(("CASH DROP! $%d is falling near %s. Go go go!"):format(reward, nearestLandmark(spot)), "alarm")

	local expires = os.clock() + Config.CashDrop.FallTime + Config.CashDrop.Lifetime
	task.spawn(function()
		while crate.Parent and os.clock() < expires do
			task.wait(0.2)
			if crate.Position.Y < 14 then
				for _, player in ipairs(Players:GetPlayers()) do
					local root = player.Character and player.Character:FindFirstChild("HumanoidRootPart")
					if root and (root.Position - crate.Position).Magnitude < 10 then
						local amount = reward * DataService.Multiplier(player)
						DataService.AddCash(player, amount)
						Remotes.NotifyAll(("%s grabbed the cash drop (+$%d)!"):format(player.Name, amount), "good")
						crate:Destroy()
						return
					end
				end
			end
		end
		if crate.Parent then
			crate:Destroy()
		end
	end)
end

---------------------------------------------------------------------------
-- Init
---------------------------------------------------------------------------
function FunService.Init(map)
	local L = Config.Locations
	landmarks = {
		{ Name = "the Police Station", Position = L.PoliceStation },
		{ Name = "the Jail", Position = L.Jail },
		{ Name = "the Hideout", Position = L.Hideout },
		{ Name = "Insane Motors", Position = L.Dealership },
	}
	for _, rob in ipairs(Config.Robberies) do
		table.insert(landmarks, { Name = rob.Name, Position = rob.Position })
	end
	dropSpots = map.DropSpots

	-- Stunt tracking
	task.spawn(function()
		while true do
			task.wait(0.1)
			tickStunts()
		end
	end)

	-- Cash drops
	task.spawn(function()
		while true do
			task.wait(Config.CashDrop.Interval)
			if #Players:GetPlayers() > 0 then
				spawnDrop()
			end
		end
	end)

	-- Day/night: start at golden hour so new players see the neon kick in
	Lighting.ClockTime = 16.5
	local hoursPerSecond = 24 / (Config.DayLengthMinutes * 60)
	task.spawn(function()
		while true do
			local dt = task.wait(0.5)
			Lighting.ClockTime = (Lighting.ClockTime + dt * hoursPerSecond) % 24
		end
	end)
end

return FunService
