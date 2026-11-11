-- Player saves with session locking.
--
-- * Load uses UpdateAsync to claim a lock { JobId, Time } on the save. If
--   another live server holds it (player hopped servers and the old server
--   hasn't saved yet), we wait and retry instead of loading stale data. This
--   is what prevents cross-server item/cash duplication.
-- * Save uses UpdateAsync and refuses to write if another server took the lock.
-- * If loading fails (DataStores down / Studio without API access), the player
--   can still play, but nothing is saved, so good data is never overwritten.
local DataStoreService = game:GetService("DataStoreService")
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Config = require(ReplicatedStorage:WaitForChild("Shared"):WaitForChild("Config"))
local Log = require(script.Parent.Log)
local Bus = require(script.Parent.Bus)

local DataService = {}

local store
do
	local ok, err = pcall(function()
		store = DataStoreService:GetDataStore(Config.DataStoreName)
	end)
	if not ok then
		Log.Warn("Data", "DataStores unavailable; progress will not save.", err)
	end
end

local profiles = {} -- [Player] = { Data, CanSave, Key }
local saveHooks = {}
local releaseHooks = {}

local VERSION = 1

local function defaults()
	return {
		Version = VERSION,
		Cash = Config.StartingCash,
		Xp = 0,
		Level = 1,
		Inventory = table.clone(Config.StartingInventory),
		-- ["u<unit>s<slot>"] = { P = productId, Q = qty }. New stores open
		-- pre-stocked so the first customers arrive within seconds.
		Shelves = {
			u1s1 = { P = "chips", Q = 8 }, u1s2 = { P = "gummy", Q = 8 },
			u2s1 = { P = "puffs", Q = 6 }, u3s1 = { P = "cola", Q = 8 }, u3s2 = { P = "water", Q = 6 },
		},
		Upgrades = {},
		Store = { Name = "", SignColor = 1, Theme = "Classic", Uniform = "Classic", Layout = "Classic", Effect = "Coins", DecorOn = {} },
		Owned = { Decor = {}, Robux = {} },
		Rating = { Value = 3.5, Count = 0, Recent = {} },
		Stats = { Served = 0, Earned = 0, Stocked = 0, FiveStars = 0, Nights = 0, Stars = 0, Visits = 0, Angry = 0, Sold = 0 },
		Products = {}, -- discovered: [productId] = number sold
		Customers = {}, -- met: [typeId] = number served
		EventsSeen = {},
		Achievements = {},
		Secrets = {},
		Clues = {}, -- [clueId] = UTC day found
		ClueCounters = {}, -- [clueId] = { nightId, ... }
		Solved = {},
		Title = "",
		Daily = { LastDay = 0, Streak = 0, BestStreak = 0 },
		Challenges = { Day = 0, List = {} },
		SeasonUnlocks = {},
		Settings = { Rain = true, LowGraphics = false, Bubbles = true, UIScale = 1, Volume = 0.5 },
		RatedStores = {}, -- [ownerUserId] = day
		FriendBonus = {}, -- [userId] = day
		Tutorial = 1,
		Receipts = {},
	}
end

-- Structural tables get new sub-fields filled in. Maps of player content
-- (Shelves, Inventory, ...) are never merged, or empty slots would refill.
local DEEP_RECONCILE = { Store = true, Owned = true, Rating = true, Stats = true, Daily = true, Challenges = true, Settings = true }

-- Fill in any fields added in later versions
local function reconcile(data)
	local base = defaults()
	for key, value in pairs(base) do
		if data[key] == nil then
			data[key] = value
		elseif DEEP_RECONCILE[key] and type(data[key]) == "table" then
			for subKey, subValue in pairs(value) do
				if data[key][subKey] == nil and type(subKey) == "string" then
					data[key][subKey] = subValue
				end
			end
		end
	end
	data.Version = VERSION
	return data
end

local function keyFor(player)
	return "p_" .. player.UserId
end

local function claim(key)
	local lockedByOther = false
	local loaded = nil
	local ok, err = pcall(function()
		store:UpdateAsync(key, function(old)
			local now = os.time()
			if old and old.Lock and old.Lock.JobId ~= game.JobId and now - (old.Lock.Time or 0) < Config.SessionLockTimeout then
				lockedByOther = true
				return nil -- cancel the write
			end
			local data = old and old.Data or nil
			loaded = data
			return { Data = data, Lock = { JobId = game.JobId, Time = now } }
		end)
	end)
	return ok, lockedByOther, loaded, err
end

local function load(player)
	if not store then
		return reconcile(defaults()), false
	end
	local key = keyFor(player)
	for attempt = 1, 8 do
		local ok, locked, data, err = claim(key)
		if ok and not locked then
			return reconcile(type(data) == "table" and data or defaults()), true
		end
		if not player.Parent then
			return nil, false
		end
		if locked then
			Log.Info("Data", player.Name, "save is locked by another server, retrying", attempt)
		else
			Log.Warn("Data", "load failed for", player.Name, err)
		end
		task.wait(math.min(2 * attempt, 8))
	end
	return nil, false
end

function DataService.Get(player)
	local profile = profiles[player]
	return profile and profile.Data
end

function DataService.Profile(player)
	return profiles[player]
end

function DataService.WaitFor(player)
	while player.Parent and not profiles[player] do
		task.wait(0.1)
	end
	return profiles[player]
end

-- hook(player, data) runs right before each successful save (leaderboards)
function DataService.OnSave(hook)
	table.insert(saveHooks, hook)
end

-- hook(player, data) runs synchronously when a player leaves, BEFORE the
-- final save (used to put customers' carts back on the shelves)
function DataService.BeforeRelease(hook)
	table.insert(releaseHooks, hook)
end

-- release = true on leave/shutdown: clears the session lock
function DataService.Save(player, release)
	local profile = profiles[player]
	if not profile or not profile.CanSave or not store then
		return false
	end
	if profile.Saving then
		-- wait for the in-flight save so we don't race
		local started = os.clock()
		while profile.Saving and os.clock() - started < 15 do
			task.wait(0.1)
		end
	end
	profile.Saving = true
	local lostLock = false
	local ok, err = pcall(function()
		store:UpdateAsync(profile.Key, function(old)
			if old and old.Lock and old.Lock.JobId ~= game.JobId then
				lostLock = true
				return nil
			end
			return { Data = profile.Data, Lock = (not release) and { JobId = game.JobId, Time = os.time() } or nil }
		end)
	end)
	profile.Saving = false
	if lostLock then
		Log.Warn("Data", "another server took over", player.Name, "- this copy will not be saved")
		profile.CanSave = false
		return false
	end
	if not ok then
		Log.Warn("Data", "save failed for", player.Name, err)
		return false
	end
	for _, hook in ipairs(saveHooks) do
		pcall(hook, player, profile.Data)
	end
	Log.Info("Data", "saved", player.Name)
	return true
end

local function onPlayerAdded(player)
	local data, canSave = load(player)
	if not player.Parent then
		return
	end
	if not data then
		player:Kick("Your save is still being written by another server. Please rejoin in a minute.")
		return
	end
	if not canSave then
		Log.Warn("Data", "running", player.Name, "without saving (Studio needs API access enabled)")
	end
	profiles[player] = { Data = data, CanSave = canSave, Key = keyFor(player) }

	local stats = Instance.new("Folder")
	stats.Name = "leaderstats"
	local cash = Instance.new("IntValue")
	cash.Name = "Cash"
	cash.Value = data.Cash
	cash.Parent = stats
	local level = Instance.new("IntValue")
	level.Name = "Level"
	level.Value = data.Level
	level.Parent = stats
	stats.Parent = player

	player:SetAttribute("Saving", canSave)
	Bus.Fire("ProfileLoaded", player, data)
end

local function onPlayerRemoving(player)
	if profiles[player] then
		for _, hook in ipairs(releaseHooks) do
			local ok, err = pcall(hook, player, profiles[player].Data)
			if not ok then
				Log.Warn("Data", "release hook failed", err)
			end
		end
		DataService.Save(player, true)
		profiles[player] = nil
	end
end

function DataService.Init()
	Players.PlayerAdded:Connect(onPlayerAdded)
	Players.PlayerRemoving:Connect(onPlayerRemoving)
	for _, player in ipairs(Players:GetPlayers()) do
		task.spawn(onPlayerAdded, player)
	end

	task.spawn(function()
		while true do
			task.wait(Config.AutosaveInterval)
			for _, player in ipairs(Players:GetPlayers()) do
				task.spawn(DataService.Save, player, false)
			end
		end
	end)

	game:BindToClose(function()
		local pending = 0
		for _, player in ipairs(Players:GetPlayers()) do
			pending = pending + 1
			task.spawn(function()
				DataService.Save(player, true)
				pending = pending - 1
			end)
		end
		local started = os.clock()
		while pending > 0 and os.clock() - started < 25 do
			task.wait(0.1)
		end
	end)
end

return DataService
