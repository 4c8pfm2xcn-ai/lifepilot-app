-- Player data: loading/saving with DataStores, leaderstats, XP/levels,
-- daily rewards and the global top-cash leaderboard.
local DataStoreService = game:GetService("DataStoreService")
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")

local Config = require(ReplicatedStorage:WaitForChild("Shared"):WaitForChild("Config"))
local Remotes = require(script.Parent.Remotes)

local DataService = {}

local store, board
pcall(function()
	store = DataStoreService:GetDataStore(Config.DataStoreName)
	board = DataStoreService:GetOrderedDataStore(Config.LeaderboardStoreName)
end)

local profiles = {} -- [Player] = { Data = table, CanSave = bool, Vip = bool }

local function defaultData()
	return {
		Cash = Config.StartingCash,
		Xp = 0,
		Arrests = 0,
		Robberies = 0,
		Escapes = 0,
		OwnedVehicles = { Sedan = true, Cruiser = true },
		LastDaily = 0,
		DailyStreak = 0,
		Receipts = {},
	}
end

local function reconcile(data)
	local defaults = defaultData()
	for key, value in pairs(defaults) do
		if data[key] == nil then
			data[key] = value
		end
	end
	return data
end

function DataService.LevelFromXp(xp)
	return math.floor(math.sqrt(xp / 100)) + 1
end

local function key(player)
	return "u_" .. player.UserId
end

local function refreshStats(player)
	local profile = profiles[player]
	local stats = player:FindFirstChild("leaderstats")
	if not profile or not stats then
		return
	end
	stats.Cash.Value = profile.Data.Cash
	stats.Level.Value = DataService.LevelFromXp(profile.Data.Xp)
end

function DataService.Get(player)
	return profiles[player]
end

function DataService.GetLevel(player)
	local profile = profiles[player]
	return profile and DataService.LevelFromXp(profile.Data.Xp) or 1
end

function DataService.IsVip(player)
	local profile = profiles[player]
	return profile ~= nil and profile.Vip
end

function DataService.SetVip(player, isVip)
	local profile = profiles[player]
	if profile then
		profile.Vip = isVip
		player:SetAttribute("VIP", isVip)
	end
end

function DataService.Multiplier(player)
	return DataService.IsVip(player) and Config.VipMultiplier or 1
end

function DataService.MaxBag(player)
	return DataService.IsVip(player) and Config.VipMaxBag or Config.MaxBag
end

function DataService.AddCash(player, amount)
	local profile = profiles[player]
	if not profile then
		return
	end
	profile.Data.Cash = math.max(0, profile.Data.Cash + math.floor(amount))
	refreshStats(player)
end

function DataService.SpendCash(player, amount)
	local profile = profiles[player]
	if not profile or profile.Data.Cash < amount then
		return false
	end
	profile.Data.Cash = profile.Data.Cash - amount
	refreshStats(player)
	return true
end

function DataService.AddXp(player, amount)
	local profile = profiles[player]
	if not profile then
		return
	end
	local before = DataService.LevelFromXp(profile.Data.Xp)
	profile.Data.Xp = profile.Data.Xp + amount
	local after = DataService.LevelFromXp(profile.Data.Xp)
	refreshStats(player)
	if after > before then
		Remotes.Notify(player, "LEVEL UP! You are now level " .. after, "good")
	end
end

function DataService.Increment(player, field, amount)
	local profile = profiles[player]
	if profile and type(profile.Data[field]) == "number" then
		profile.Data[field] = profile.Data[field] + (amount or 1)
	end
end

function DataService.Save(player)
	local profile = profiles[player]
	if not profile or not profile.CanSave or not store then
		return false
	end
	local ok = pcall(function()
		store:SetAsync(key(player), profile.Data)
	end)
	if ok and board then
		pcall(function()
			board:SetAsync(tostring(player.UserId), profile.Data.Cash)
		end)
	end
	return ok
end

local function giveDaily(player)
	local profile = profiles[player]
	local now = os.time()
	local data = profile.Data
	if now - data.LastDaily < 86400 then
		return
	end
	if now - data.LastDaily < 172800 then
		data.DailyStreak = math.min(data.DailyStreak + 1, Config.DailyStreakCap)
	else
		data.DailyStreak = 1
	end
	data.LastDaily = now
	local reward = Config.DailyReward * data.DailyStreak
	DataService.AddCash(player, reward)
	task.delay(6, function()
		if player.Parent then
			Remotes.Notify(player, ("Daily reward: $%d (day %d streak). Come back tomorrow for more!"):format(reward, data.DailyStreak), "good")
		end
	end)
end

local function onPlayerAdded(player)
	local data, success = nil, false
	if store then
		for attempt = 1, 3 do
			success = pcall(function()
				data = store:GetAsync(key(player))
			end)
			if success then
				break
			end
			task.wait(attempt * 2)
		end
	end
	if not player.Parent then
		return
	end
	if type(data) ~= "table" then
		data = defaultData()
	end
	profiles[player] = { Data = reconcile(data), CanSave = success, Vip = false }
	if not success then
		warn("[DataService] Could not load data for " .. player.Name .. "; progress will NOT be saved this session.")
	end

	local stats = Instance.new("Folder")
	stats.Name = "leaderstats"
	local cash = Instance.new("IntValue")
	cash.Name = "Cash"
	cash.Parent = stats
	local level = Instance.new("IntValue")
	level.Name = "Level"
	level.Parent = stats
	stats.Parent = player

	player:SetAttribute("Bag", 0)
	player:SetAttribute("Bounty", 0)
	refreshStats(player)
	giveDaily(player)
	player:SetAttribute("DataLoaded", true)
end

local function onPlayerRemoving(player)
	DataService.Save(player)
	profiles[player] = nil
end

-- Waits until a player's profile exists (or they leave)
function DataService.WaitForProfile(player)
	while player.Parent and not profiles[player] do
		task.wait(0.1)
	end
	return profiles[player]
end

---------------------------------------------------------------------------
-- Global leaderboard (top cash), drawn on a board in the hideout
---------------------------------------------------------------------------
local nameCache = {}
local function nameFor(userId)
	if nameCache[userId] then
		return nameCache[userId]
	end
	local ok, name = pcall(function()
		return Players:GetNameFromUserIdAsync(userId)
	end)
	nameCache[userId] = ok and name or ("Player " .. userId)
	return nameCache[userId]
end

local function updateBoard(list)
	if not board or not list then
		return
	end
	local ok, page = pcall(function()
		return board:GetSortedAsync(false, 10):GetCurrentPage()
	end)
	if not ok then
		return
	end
	for _, child in ipairs(list:GetChildren()) do
		if child:IsA("TextLabel") then
			child:Destroy()
		end
	end
	for rank, entry in ipairs(page) do
		local label = Instance.new("TextLabel")
		label.Size = UDim2.new(1, 0, 0, 40)
		label.BackgroundTransparency = 1
		label.TextColor3 = rank == 1 and Color3.fromRGB(255, 215, 80) or Color3.new(1, 1, 1)
		label.Font = Enum.Font.GothamBold
		label.TextScaled = true
		label.TextXAlignment = Enum.TextXAlignment.Left
		label.LayoutOrder = rank
		label.Text = ("%d. %s  -  $%d"):format(rank, nameFor(tonumber(entry.key)), entry.value)
		label.Parent = list
	end
end

function DataService.Init(map)
	Players.PlayerAdded:Connect(onPlayerAdded)
	Players.PlayerRemoving:Connect(onPlayerRemoving)
	for _, player in ipairs(Players:GetPlayers()) do
		task.spawn(onPlayerAdded, player)
	end

	-- Autosave + leaderboard refresh
	task.spawn(function()
		while true do
			task.wait(120)
			for _, player in ipairs(Players:GetPlayers()) do
				DataService.Save(player)
			end
			updateBoard(map.LeaderboardList)
		end
	end)
	task.delay(5, function()
		updateBoard(map.LeaderboardList)
	end)

	game:BindToClose(function()
		if RunService:IsStudio() and not store then
			return
		end
		local pending = 0
		for _, player in ipairs(Players:GetPlayers()) do
			pending = pending + 1
			task.spawn(function()
				DataService.Save(player)
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
