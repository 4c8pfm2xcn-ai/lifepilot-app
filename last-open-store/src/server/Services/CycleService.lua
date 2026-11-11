-- Day/night cycle, weather, lighting moods, nightly random events and the
-- weekly event. Shared by the whole server; state is mirrored to clients via
-- attributes on ReplicatedStorage.WorldState.
local Lighting = game:GetService("Lighting")
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local TweenService = game:GetService("TweenService")

local Shared = ReplicatedStorage:WaitForChild("Shared")
local Config = require(Shared:WaitForChild("Config"))
local Events = require(Shared:WaitForChild("Events"))
local Products = require(Shared:WaitForChild("Products"))
local Util = require(Shared:WaitForChild("Util"))

local Log = require(script.Parent.Log)
local Bus = require(script.Parent.Bus)
local Net = require(script.Parent.Net)

local CycleService = {}

local state = {
	Night = false,
	EventId = nil,
	Event = nil,
	Mods = {},
	Weather = "Clear",
	NightId = 0,
	LastEventId = nil,
	Hour = -1,
}

local worldState = Instance.new("Folder")
worldState.Name = "WorldState"
worldState.Parent = ReplicatedStorage

local atmosphere, colorCorrection, bloom
local refs
local stars = {}

function CycleService.IsNight()
	return state.Night
end
function CycleService.EventId()
	return state.EventId
end
function CycleService.Event()
	return state.Event
end
function CycleService.Weather()
	return state.Weather
end
function CycleService.Mods()
	return state.Mods
end
function CycleService.NightId()
	return state.NightId
end
function CycleService.Clock()
	return Lighting.ClockTime
end
function CycleService.Weekly()
	local list = Events.Weekly
	return list[(Util.WeekNumber() % #list) + 1]
end

---------------------------------------------------------------------------
-- Lighting moods
---------------------------------------------------------------------------
local function tween(object, props, seconds)
	TweenService:Create(object, TweenInfo.new(seconds or 6, Enum.EasingStyle.Sine), props):Play()
end

local function applyMood()
	local night = state.Night
	local weather = state.Weather
	local eventId = state.EventId
	local lightingProps = {
		Ambient = night and Color3.fromRGB(35, 35, 55) or Color3.fromRGB(80, 80, 90),
		OutdoorAmbient = night and Color3.fromRGB(55, 60, 90) or Color3.fromRGB(130, 130, 140),
		Brightness = night and 1.2 or 2.2,
	}
	local atmoProps = {
		Density = night and 0.36 or 0.28,
		Haze = night and 1.6 or 1,
		Color = night and Color3.fromRGB(95, 105, 150) or Color3.fromRGB(200, 185, 165),
		Decay = night and Color3.fromRGB(50, 60, 100) or Color3.fromRGB(110, 110, 120),
	}
	local ccProps = {
		TintColor = night and Color3.fromRGB(215, 222, 255) or Color3.fromRGB(255, 250, 245),
		Contrast = night and 0.12 or 0.05,
		Saturation = night and 0.12 or 0.05,
	}
	if weather == "Rain" or weather == "Storm" then
		atmoProps.Density = atmoProps.Density + (weather == "Storm" and 0.12 or 0.06)
		lightingProps.Brightness = lightingProps.Brightness * 0.75
		ccProps.Saturation = ccProps.Saturation - 0.1
	elseif weather == "Fog" then
		atmoProps.Density = 0.62
		atmoProps.Haze = 3
		atmoProps.Color = Color3.fromRGB(170, 175, 190)
	end
	if eventId == "Aurora" then
		ccProps.TintColor = Color3.fromRGB(205, 255, 230)
		atmoProps.Color = Color3.fromRGB(110, 230, 170)
		atmoProps.Decay = Color3.fromRGB(70, 160, 200)
	end
	tween(Lighting, lightingProps)
	tween(atmosphere, atmoProps)
	tween(colorCorrection, ccProps)

	-- Wet streets shine in the rain
	local wet = weather == "Rain" or weather == "Storm"
	for _, p in ipairs(refs.WetParts) do
		p.Reflectance = wet and 0.18 or 0
	end
	-- Street lamps: on at night unless there's a blackout
	local lampsOn = night and eventId ~= "Blackout"
	for _, lamp in ipairs(refs.Lamps) do
		lamp.Light.Enabled = lampsOn
		lamp.Head.Material = lampsOn and Enum.Material.Neon or Enum.Material.SmoothPlastic
		lamp.Head.Color = lampsOn and Color3.fromRGB(255, 225, 170) or Color3.fromRGB(90, 90, 95)
	end
end

local function publish()
	local e = state.Event
	worldState:SetAttribute("Night", state.Night)
	worldState:SetAttribute("Weather", state.Weather)
	worldState:SetAttribute("EventId", state.EventId or "")
	worldState:SetAttribute("EventName", e and e.Name or "")
	worldState:SetAttribute("EventDesc", e and state.EventDesc or "")
	worldState:SetAttribute("EventColor", e and e.Color or Color3.new(1, 1, 1))
	local weekly = CycleService.Weekly()
	worldState:SetAttribute("WeeklyName", weekly.Name)
	worldState:SetAttribute("WeeklyDesc", weekly.Desc)
	-- products orderable only right now (for the order menu)
	local limited = {}
	for _, product in ipairs(Products.List) do
		if (product.Event and product.Event == state.EventId) or (product.Weather and (state.Weather == "Rain" or state.Weather == "Storm")) then
			table.insert(limited, product.Id)
		end
	end
	worldState:SetAttribute("Limited", table.concat(limited, ","))
end

---------------------------------------------------------------------------
-- Shooting stars
---------------------------------------------------------------------------
local function clearStars()
	for _, star in ipairs(stars) do
		if star.Parent then
			star:Destroy()
		end
	end
	stars = {}
end

local function spawnStars()
	clearStars()
	local lanes = { 18, -18, 105, -105, 178, -158 }
	local folder = workspace:FindFirstChild("Town")
	for _ = 1, 16 do
		local star = Instance.new("Part")
		star.Name = "ShootingStar"
		star.Shape = Enum.PartType.Ball
		star.Size = Vector3.new(2, 2, 2)
		star.Anchored = true
		star.CanCollide = false
		star.Material = Enum.Material.Neon
		star.Color = Color3.fromRGB(255, 245, 170)
		star.Position = Vector3.new(math.random(-340, 340), 3.5, lanes[math.random(1, #lanes)] + math.random(-4, 4))
		local light = Instance.new("PointLight")
		light.Range = 14
		light.Brightness = 3
		light.Color = star.Color
		light.Parent = star
		local sparkle = Instance.new("Sparkles")
		sparkle.SparkleColor = star.Color
		sparkle.Parent = star
		star:SetAttribute("Bob", true)
		star.Parent = folder
		table.insert(stars, star)
	end
	task.spawn(function()
		while state.EventId == "ShootingStars" and #stars > 0 do
			task.wait(0.3)
			for i = #stars, 1, -1 do
				local star = stars[i]
				for _, player in ipairs(Players:GetPlayers()) do
					local root = player.Character and player.Character:FindFirstChild("HumanoidRootPart")
					if root and star.Parent and (root.Position - star.Position).Magnitude < 7 then
						star:Destroy()
						table.remove(stars, i)
						Bus.Fire("StarCaught", player)
						break
					end
				end
			end
		end
	end)
end

---------------------------------------------------------------------------
-- Phase changes
---------------------------------------------------------------------------
local function rollWeather(chanceRain)
	if math.random() < chanceRain then
		return "Rain"
	end
	return "Clear"
end

local function startNight()
	state.Night = true
	state.NightId = os.time()
	state.Event = nil
	state.EventId = nil
	state.Mods = {}
	state.EventDesc = nil
	if math.random() < Config.NightEventChance then
		local total = 0
		for _, e in ipairs(Events.Night) do
			if e.Id ~= state.LastEventId then
				total = total + e.Weight
			end
		end
		local roll = math.random() * total
		for _, e in ipairs(Events.Night) do
			if e.Id ~= state.LastEventId then
				roll = roll - e.Weight
				if roll <= 0 then
					state.Event = e
					break
				end
			end
		end
	end
	local e = state.Event
	if e then
		state.EventId = e.Id
		state.LastEventId = e.Id
		local mods = table.clone(e.Mods)
		state.EventDesc = e.Desc
		if e.Id == "Craving" then
			mods.Category = Products.Categories[math.random(1, #Products.Categories)]
			state.EventDesc = e.Desc:format(mods.Category:lower())
		end
		state.Mods = mods
		state.Weather = e.Weather or rollWeather(0.35)
	else
		state.Weather = rollWeather(0.4)
	end
	publish()
	applyMood()
	if e then
		Net.NotifyAll(("Tonight: %s. %s"):format(e.Name, state.EventDesc), "event")
		if e.Id == "ShootingStars" then
			spawnStars()
		end
		Bus.Fire("EventStarted", e.Id)
	else
		Net.NotifyAll("Night falls. Every other store in town has closed. Yours is the last one open.", "event")
	end
	Log.Info("Cycle", "night", state.NightId, state.EventId, state.Weather)
	Bus.Fire("NightStarted", state.NightId)
end

local function startDay()
	local endedEvent = state.EventId
	state.Night = false
	state.Event = nil
	state.EventId = nil
	state.EventDesc = nil
	state.Mods = {}
	state.Weather = rollWeather(0.2)
	clearStars()
	publish()
	applyMood()
	Net.NotifyAll("The sun is up. A new day on the block!", "event")
	if endedEvent then
		Bus.Fire("EventEnded", endedEvent)
	end
	Bus.Fire("DayStarted")
end

function CycleService.Init(worldRefs)
	refs = worldRefs
	atmosphere = Lighting:FindFirstChildOfClass("Atmosphere") or Instance.new("Atmosphere")
	atmosphere.Parent = Lighting
	colorCorrection = Lighting:FindFirstChild("LOSColor") or Instance.new("ColorCorrectionEffect")
	colorCorrection.Name = "LOSColor"
	colorCorrection.Parent = Lighting
	bloom = Lighting:FindFirstChild("LOSBloom") or Instance.new("BloomEffect")
	bloom.Name = "LOSBloom"
	bloom.Intensity = 0.9
	bloom.Size = 28
	bloom.Threshold = 0.88
	bloom.Parent = Lighting
	Lighting.EnvironmentDiffuseScale = 0.6
	Lighting.EnvironmentSpecularScale = 0.8
	Lighting.GlobalShadows = true
	Lighting.ClockTime = Config.StartClockTime

	state.Night = Util.IsNight(Lighting.ClockTime, Config.NightStart, Config.NightEnd)
	state.Weather = "Rain" -- the game opens on a rainy evening
	publish()
	applyMood()

	local hoursPerSecond = 24 / (Config.DayLengthMinutes * 60)
	task.spawn(function()
		local last = os.clock()
		while true do
			task.wait(0.5)
			local now = os.clock()
			local dt = now - last
			last = now
			Lighting.ClockTime = (Lighting.ClockTime + dt * hoursPerSecond) % 24
			local night = Util.IsNight(Lighting.ClockTime, Config.NightStart, Config.NightEnd)
			if night ~= state.Night then
				if night then
					startNight()
				else
					startDay()
				end
			end
			local hour = math.floor(Lighting.ClockTime)
			if hour ~= state.Hour then
				state.Hour = hour
				Bus.Fire("Hour", hour)
			end
		end
	end)
end

return CycleService
