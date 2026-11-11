-- Local-only atmosphere: rain that follows the camera, lightning flashes in
-- storms, flickering neon, sliding automatic doors, the spinning lighthouse,
-- bobbing shooting stars, the lucky cat's wave, optional ambience audio, and
-- the player's graphics settings. Nothing here affects gameplay.
local CollectionService = game:GetService("CollectionService")
local Lighting = game:GetService("Lighting")
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")
local SoundService = game:GetService("SoundService")
local TweenService = game:GetService("TweenService")

local Config = require(ReplicatedStorage:WaitForChild("Shared"):WaitForChild("Config"))
local Remotes = ReplicatedStorage:WaitForChild("Remotes")
local WorldState = ReplicatedStorage:WaitForChild("WorldState")

local settings = { Rain = true, LowGraphics = false, Bubbles = true, Volume = 0.5 }

Remotes:WaitForChild("State").OnClientEvent:Connect(function(state)
	if state and state.Settings then
		settings = state.Settings
	end
end)

---------------------------------------------------------------------------
-- Rain
---------------------------------------------------------------------------
local rainPart = Instance.new("Part")
rainPart.Name = "LocalRain"
rainPart.Anchored = true
rainPart.CanCollide = false
rainPart.CanQuery = false
rainPart.CanTouch = false
rainPart.Transparency = 1
rainPart.Size = Vector3.new(150, 1, 150)
rainPart.Parent = workspace.Terrain

local rain = Instance.new("ParticleEmitter")
rain.Texture = "rbxasset://textures/particles/sparkles_main.dds"
rain.EmissionDirection = Enum.NormalId.Bottom
rain.Orientation = Enum.ParticleOrientation.VelocityParallel
rain.Speed = NumberRange.new(90, 110)
rain.Lifetime = NumberRange.new(0.7, 0.9)
rain.Size = NumberSequence.new(0.12)
rain.Squash = NumberSequence.new(2.5)
rain.Transparency = NumberSequence.new(0.35)
rain.Color = ColorSequence.new(Color3.fromRGB(190, 210, 240))
rain.LightEmission = 0.2
rain.LightInfluence = 1
rain.Rate = 0
rain.Parent = rainPart

local flash = Instance.new("ColorCorrectionEffect")
flash.Name = "LocalLightning"
flash.Brightness = 0
flash.Parent = Lighting

local function weather()
	return WorldState:GetAttribute("Weather")
end

RunService.RenderStepped:Connect(function()
	local camera = workspace.CurrentCamera
	if camera then
		rainPart.CFrame = CFrame.new(camera.CFrame.Position + Vector3.new(0, 45, 0))
	end
end)

task.spawn(function()
	while true do
		local w = weather()
		local enabled = settings.Rain and not settings.LowGraphics
		local rate = 0
		if enabled and w == "Rain" then
			rate = 450
		elseif enabled and w == "Storm" then
			rate = 1000
		end
		rain.Rate = rate
		if enabled and w == "Storm" and math.random() < 0.06 then
			flash.Brightness = 0.55
			TweenService:Create(flash, TweenInfo.new(0.35), { Brightness = 0 }):Play()
			task.wait(0.12)
			flash.Brightness = 0.35
			TweenService:Create(flash, TweenInfo.new(0.5), { Brightness = 0 }):Play()
		end
		-- graphics setting: glow effects
		local bloom = Lighting:FindFirstChild("LOSBloom")
		if bloom then
			bloom.Enabled = not settings.LowGraphics
		end
		task.wait(1)
	end
end)

---------------------------------------------------------------------------
-- Flickering neon (tagged by the server)
---------------------------------------------------------------------------
task.spawn(function()
	while true do
		task.wait(0.15)
		if not settings.LowGraphics then
			local tagged = CollectionService:GetTagged("Flicker")
			if #tagged > 0 and math.random() < 0.35 then
				local target = tagged[math.random(1, #tagged)]
				local light = target:FindFirstChildOfClass("SurfaceLight")
				local original = target.Transparency
				target.Transparency = math.min(1, original + 0.6)
				if light then
					light.Enabled = false
				end
				task.wait(math.random(4, 12) / 100)
				target.Transparency = original
				if light then
					light.Enabled = true
				end
			end
		end
	end
end)

---------------------------------------------------------------------------
-- Automatic sliding doors
---------------------------------------------------------------------------
local doors = {} -- [part] = { Closed = CFrame, Open = bool }
local function trackDoor(door)
	doors[door] = { Closed = door.CFrame, Open = false }
end
for _, d in ipairs(CollectionService:GetTagged("AutoDoor")) do
	trackDoor(d)
end
CollectionService:GetInstanceAddedSignal("AutoDoor"):Connect(trackDoor)
CollectionService:GetInstanceRemovedSignal("AutoDoor"):Connect(function(d)
	doors[d] = nil
end)

task.spawn(function()
	while true do
		task.wait(0.2)
		local positions = {}
		for _, p in ipairs(Players:GetPlayers()) do
			local root = p.Character and p.Character:FindFirstChild("HumanoidRootPart")
			if root then
				table.insert(positions, root.Position)
			end
		end
		local customers = workspace:FindFirstChild("Customers")
		if customers then
			for _, npc in ipairs(customers:GetChildren()) do
				local root = npc:FindFirstChild("HumanoidRootPart")
				if root then
					table.insert(positions, root.Position)
				end
			end
		end
		for door, info in pairs(doors) do
			if door.Parent then
				local near = false
				for _, pos in ipairs(positions) do
					if (pos - info.Closed.Position).Magnitude < 10 then
						near = true
						break
					end
				end
				if near ~= info.Open then
					info.Open = near
					local side = door:GetAttribute("Side") or 1
					local goal = near and (info.Closed * CFrame.new(side * 4.4, 0, 0)) or info.Closed
					TweenService:Create(door, TweenInfo.new(0.4, Enum.EasingStyle.Quad), { CFrame = goal }):Play()
				end
			end
		end
	end
end)

---------------------------------------------------------------------------
-- Spinning lighthouse, bobbing stars, waving lucky cat
---------------------------------------------------------------------------
local spinners = {}
for _, p in ipairs(CollectionService:GetTagged("Spin")) do
	spinners[p] = p.CFrame
end
CollectionService:GetInstanceAddedSignal("Spin"):Connect(function(p)
	spinners[p] = p.CFrame
end)

local wavers = {}
local function trackWave(p)
	wavers[p] = p.CFrame
end
for _, p in ipairs(CollectionService:GetTagged("Wave")) do
	trackWave(p)
end
CollectionService:GetInstanceAddedSignal("Wave"):Connect(trackWave)
CollectionService:GetInstanceRemovedSignal("Wave"):Connect(function(p)
	wavers[p] = nil
end)

local stars = {}
local function watchTown(town)
	town.ChildAdded:Connect(function(child)
		if child:GetAttribute("Bob") then
			stars[child] = child.Position
		end
	end)
end
local town = workspace:WaitForChild("Town", 30)
if town then
	watchTown(town)
end

RunService.RenderStepped:Connect(function()
	local t = os.clock()
	for part, base in pairs(spinners) do
		if part.Parent then
			part.CFrame = base * CFrame.Angles(0, t * 0.8, 0)
		else
			spinners[part] = nil
		end
	end
	for part, base in pairs(stars) do
		if part.Parent then
			part.CFrame = CFrame.new(base + Vector3.new(0, math.sin(t * 3) * 0.6, 0)) * CFrame.Angles(0, t * 2, 0)
		else
			stars[part] = nil
		end
	end
	for part, base in pairs(wavers) do
		if part.Parent then
			part.CFrame = base * CFrame.Angles(math.sin(t * 6) * 0.5, 0, 0)
		else
			wavers[part] = nil
		end
	end
end)

---------------------------------------------------------------------------
-- Customer speech bubbles setting
---------------------------------------------------------------------------
task.spawn(function()
	while true do
		task.wait(1)
		local customers = workspace:FindFirstChild("Customers")
		if customers then
			for _, gui in ipairs(customers:GetDescendants()) do
				if gui:IsA("BillboardGui") and gui.Name == "CustomerGui" then
					local bubble = gui:FindFirstChild("Bubble")
					if bubble and not settings.Bubbles then
						bubble.Visible = false
					end
				end
			end
		end
	end
end)

---------------------------------------------------------------------------
-- Optional ambience (only if sound IDs are configured)
---------------------------------------------------------------------------
local sounds = {}
for key, id in pairs(Config.Audio) do
	if id ~= "" and key ~= "Register" then
		local s = Instance.new("Sound")
		s.Name = "Ambience_" .. key
		s.SoundId = id
		s.Looped = true
		s.Volume = 0
		s.Parent = SoundService
		pcall(function()
			s:Play()
		end)
		sounds[key] = s
	end
end
if next(sounds) then
	task.spawn(function()
		while true do
			local night = WorldState:GetAttribute("Night")
			local w = weather()
			local volume = settings.Volume or 0.5
			local targets = {
				Rain = (w == "Rain" or w == "Storm") and volume or 0,
				NightAmbience = night and volume * 0.6 or 0,
				DayAmbience = (not night) and volume * 0.6 or 0,
			}
			for key, s in pairs(sounds) do
				TweenService:Create(s, TweenInfo.new(2), { Volume = targets[key] or 0 }):Play()
			end
			task.wait(2)
		end
	end)
end

