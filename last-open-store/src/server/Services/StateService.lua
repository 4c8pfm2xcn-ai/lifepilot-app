-- Sends each player a snapshot of everything their UI needs. Changes are
-- batched: services call Bus.Fire("Dirty", player) and at most ~4 snapshots
-- per second go out per player.
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage:WaitForChild("Shared")
local Config = require(Shared:WaitForChild("Config"))
local Challenges = require(Shared:WaitForChild("Challenges"))
local Effects = require(Shared:WaitForChild("Effects"))
local Util = require(Shared:WaitForChild("Util"))

local Bus = require(script.Parent.Bus)
local Net = require(script.Parent.Net)
local DataService = require(script.Parent.DataService)
local MysteryService = require(script.Parent.MysteryService)
local ProgressionService = require(script.Parent.ProgressionService)

local StateService = {}

local dirty = {}

local function snapshot(player)
	local profile = DataService.Profile(player)
	local data = profile and profile.Data
	if not data then
		return nil
	end
	ProgressionService.EnsureChallenges(player, data)
	local challenges = {}
	for i, entry in ipairs(data.Challenges.List) do
		local def = Challenges.ById[entry.Id]
		if def then
			challenges[i] = { Desc = def.Desc, Goal = def.Goal, Progress = entry.Progress, Claimed = entry.Claimed, Reward = def.Reward + data.Level * 15 }
		end
	end
	return {
		Cash = data.Cash,
		Level = data.Level,
		Xp = data.Xp,
		XpNeed = Config.XpForLevel(data.Level),
		Inventory = data.Inventory,
		Shelves = data.Shelves,
		Upgrades = data.Upgrades,
		Effects = Effects.Compute(data.Upgrades),
		Store = data.Store,
		Rating = data.Rating,
		Stats = data.Stats,
		StatValues = ProgressionService.StatValues(data),
		Products = data.Products,
		Customers = data.Customers,
		EventsSeen = data.EventsSeen,
		Achievements = data.Achievements,
		Secrets = data.Secrets,
		Solved = data.Solved,
		Owned = data.Owned,
		SeasonUnlocks = data.SeasonUnlocks,
		Month = os.date("!*t").month,
		Daily = { LastDay = data.Daily.LastDay, Streak = data.Daily.Streak, BestStreak = data.Daily.BestStreak, Today = Util.DayNumber(), SecondsLeft = 86400 - os.time() % 86400 },
		Challenges = challenges,
		Journal = MysteryService.Journal(data),
		Settings = data.Settings,
		Tutorial = data.Tutorial,
		Title = data.Title,
		Saving = profile.CanSave,
		PlotIndex = player:GetAttribute("PlotIndex") or 0,
	}
end

function StateService.Push(player)
	local state = snapshot(player)
	if state then
		Net.Events.State:FireClient(player, state)
	end
end

local SETTINGS = {
	Rain = "boolean", LowGraphics = "boolean", Bubbles = "boolean",
	UIScale = "number", Volume = "number",
}

function StateService.Init()
	Bus.On("Dirty", function(player)
		if player then
			dirty[player] = true
		end
	end)
	Bus.On("ProfileLoaded", function(player)
		StateService.Push(player)
	end)

	Net.Handle("GetState", { Rate = 1, Burst = 3 }, function(player)
		return { ok = true, State = snapshot(player) }
	end)

	Net.Handle("SetSetting", { Rate = 4, Burst = 8 }, function(player, payload)
		local data = DataService.Get(player)
		local key = type(payload.Key) == "string" and payload.Key
		local kind = key and SETTINGS[key]
		if not data or not kind or type(payload.Value) ~= kind then
			return Net.Fail("Invalid setting.")
		end
		local value = payload.Value
		if kind == "number" then
			if value ~= value then
				return Net.Fail("Invalid setting.")
			end
			value = math.clamp(value, key == "UIScale" and 0.7 or 0, key == "UIScale" and 1.3 or 1)
		end
		data.Settings[key] = value
		dirty[player] = true
		return Net.Ok()
	end)

	task.spawn(function()
		while true do
			task.wait(0.25)
			for player in pairs(dirty) do
				dirty[player] = nil
				if player.Parent then
					StateService.Push(player)
				end
			end
		end
	end)

	-- the daily countdown and day rollover should stay fresh
	task.spawn(function()
		while true do
			task.wait(60)
			for _, player in ipairs(Players:GetPlayers()) do
				dirty[player] = true
			end
		end
	end)

	Players.PlayerRemoving:Connect(function(player)
		dirty[player] = nil
	end)
end

return StateService
