-- Upgrades, achievements, daily rewards & challenges, collections, seasonal
-- unlocks, global leaderboards and the first-time tutorial.
local DataStoreService = game:GetService("DataStoreService")
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage:WaitForChild("Shared")
local Config = require(Shared:WaitForChild("Config"))
local Upgrades = require(Shared:WaitForChild("Upgrades"))
local Effects = require(Shared:WaitForChild("Effects"))
local Achievements = require(Shared:WaitForChild("Achievements"))
local Challenges = require(Shared:WaitForChild("Challenges"))
local Events = require(Shared:WaitForChild("Events"))
local Util = require(Shared:WaitForChild("Util"))

local Log = require(script.Parent.Log)
local Bus = require(script.Parent.Bus)
local Net = require(script.Parent.Net)
local DataService = require(script.Parent.DataService)
local EconomyService = require(script.Parent.EconomyService)

local ProgressionService = {}

-- Tutorial steps (client shows the text; server decides when each is done)
ProgressionService.TutorialSteps = { "RingUp", "Order", "Stock", "Upgrade" }

---------------------------------------------------------------------------
-- Daily challenges
---------------------------------------------------------------------------
local function ensureChallenges(player, data)
	local today = Util.DayNumber()
	if data.Challenges.Day == today then
		return
	end
	local picks = Util.SeededPick(Challenges.List, Config.DailyChallengesPerDay, today * 7919 + player.UserId % 100003)
	local list = {}
	for _, def in ipairs(picks) do
		table.insert(list, { Id = def.Id, Progress = 0, Claimed = false })
	end
	data.Challenges = { Day = today, List = list }
end

local function progress(player, key, amount)
	local data = DataService.Get(player)
	if not data or amount <= 0 then
		return
	end
	ensureChallenges(player, data)
	for _, entry in ipairs(data.Challenges.List) do
		local def = Challenges.ById[entry.Id]
		if def and def.Key == key and entry.Progress < def.Goal then
			entry.Progress = math.min(def.Goal, entry.Progress + amount)
			if entry.Progress >= def.Goal then
				Net.Notify(player, ("Daily challenge complete: %s! Claim it in the Daily menu."):format(def.Desc), "good")
			end
		end
	end
end

---------------------------------------------------------------------------
-- Achievements
---------------------------------------------------------------------------
function ProgressionService.StatValues(data)
	return {
		Served = data.Stats.Served,
		Earned = data.Stats.Earned,
		Stocked = data.Stats.Stocked,
		FiveStars = data.Stats.FiveStars,
		ProductsFound = Util.Count(data.Products),
		CustomersMet = Util.Count(data.Customers),
		Clues = Util.Count(data.Clues),
		Mysteries = Util.Count(data.Solved),
		Nights = data.Stats.Nights,
		Expansion = Effects.Compute(data.Upgrades).Expansion,
		Stars = data.Stats.Stars,
		Visits = data.Stats.Visits,
	}
end

local pendingCheck = {}
local function checkAchievements(player)
	if pendingCheck[player] then
		return
	end
	pendingCheck[player] = true
	task.delay(1.5, function()
		pendingCheck[player] = nil
		local data = DataService.Get(player)
		if not data then
			return
		end
		local values = ProgressionService.StatValues(data)
		for _, a in ipairs(Achievements.List) do
			if not data.Achievements[a.Id] and (values[a.Stat] or 0) >= a.Goal then
				data.Achievements[a.Id] = Util.DayNumber()
				-- AddCash marks the state dirty, which re-checks once and finds nothing new
				EconomyService.AddCash(player, a.Reward, "Achievement")
				Net.Notify(player, ("Achievement unlocked: %s (+%s)"):format(a.Name, Util.Money(a.Reward)), "level")
			end
		end
	end)
end

---------------------------------------------------------------------------
-- Tutorial
---------------------------------------------------------------------------
local function tutorialDone(player, step)
	local data = DataService.Get(player)
	if not data or data.Tutorial > #ProgressionService.TutorialSteps then
		return
	end
	if ProgressionService.TutorialSteps[data.Tutorial] == step then
		data.Tutorial = data.Tutorial + 1
		if data.Tutorial > #ProgressionService.TutorialSteps then
			EconomyService.AddCash(player, 250, "Tutorial")
			Net.Notify(player, "Tutorial complete! +$250. The night is yours, shopkeeper.", "level")
		end
		Bus.Fire("Dirty", player)
	end
end

---------------------------------------------------------------------------
-- Leaderboards
---------------------------------------------------------------------------
local earnedStore, ratingStore
pcall(function()
	earnedStore = DataStoreService:GetOrderedDataStore(Config.LeaderboardEarned)
	ratingStore = DataStoreService:GetOrderedDataStore(Config.LeaderboardRating)
end)
local boardCache = { Earned = {}, Rating = {} }
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

local function fetchBoard(store, isRating)
	if not store then
		return {}
	end
	local ok, page = pcall(function()
		return store:GetSortedAsync(false, 10):GetCurrentPage()
	end)
	if not ok then
		return nil
	end
	local list = {}
	for rank, entry in ipairs(page) do
		local value = isRating and (entry.value / 100) or entry.value
		table.insert(list, { Rank = rank, Name = nameFor(tonumber(entry.key)), Value = value })
	end
	return list
end

local function drawBoard(frame, list, isRating)
	if not frame then
		return
	end
	for _, child in ipairs(frame:GetChildren()) do
		if child:IsA("TextLabel") then
			child:Destroy()
		end
	end
	for _, entry in ipairs(list) do
		local label = Instance.new("TextLabel")
		label.Size = UDim2.new(1, 0, 0.1, 0)
		label.BackgroundTransparency = 1
		label.Font = Enum.Font.GothamBold
		label.TextScaled = true
		label.TextXAlignment = Enum.TextXAlignment.Left
		label.TextColor3 = entry.Rank == 1 and Color3.fromRGB(255, 210, 90) or Color3.new(1, 1, 1)
		label.LayoutOrder = entry.Rank
		label.Text = ("%d. %s  %s"):format(entry.Rank, entry.Name, isRating and ("%.2f ★"):format(entry.Value) or Util.Money(entry.Value))
		label.Parent = frame
	end
end

function ProgressionService.Leaderboards()
	return boardCache
end

---------------------------------------------------------------------------
-- Init
---------------------------------------------------------------------------
function ProgressionService.Init(worldRefs)
	Net.Handle("BuyUpgrade", { Rate = 2, Burst = 4 }, function(player, payload)
		local data = DataService.Get(player)
		local id = data and Net.Key(payload.Id, Upgrades.ById)
		if not id then
			return Net.Fail("Unknown upgrade.")
		end
		local u = Upgrades.ById[id]
		if data.Upgrades[id] then
			return Net.Fail("Already owned.")
		end
		if u.Requires and not data.Upgrades[u.Requires] then
			return Net.Fail("Requires " .. Upgrades.ById[u.Requires].Name .. " first.")
		end
		if data.Level < u.Level then
			return Net.Fail("Reach level " .. u.Level .. " first.")
		end
		if not EconomyService.Spend(player, u.Cost) then
			return Net.Fail("You need " .. Util.Money(u.Cost) .. ".")
		end
		data.Upgrades[id] = true
		Bus.Fire("UpgradesChanged", player)
		Bus.Fire("UpgradeBought", player, id)
		Bus.Fire("Dirty", player)
		return Net.Ok(u.Name .. " installed!")
	end)

	Net.Handle("ClaimDaily", { Rate = 0.5, Burst = 2 }, function(player)
		local data = DataService.Get(player)
		if not data then
			return Net.Fail("Still loading.")
		end
		local today = Util.DayNumber()
		local d = data.Daily
		if d.LastDay == today then
			return Net.Fail("Already claimed today. Come back tomorrow!")
		end
		d.Streak = (d.LastDay == today - 1) and (d.Streak + 1) or 1
		d.LastDay = today
		d.BestStreak = math.max(d.BestStreak, d.Streak)
		local index = (d.Streak - 1) % #Config.DailyRewards + 1
		local reward = Config.DailyRewards[index]
		EconomyService.AddCash(player, reward, "Daily")
		local extra = ""
		if d.BestStreak == 7 and index == 7 then
			extra = " You unlocked the Hearts checkout effect and Sakura Night theme!"
		end
		Bus.Fire("Dirty", player)
		return Net.Ok(("Day %d reward: %s!%s"):format(d.Streak, Util.Money(reward), extra))
	end)

	Net.Handle("ClaimChallenge", { Rate = 2, Burst = 4 }, function(player, payload)
		local data = DataService.Get(player)
		local index = Net.Int(payload.Index, 1, Config.DailyChallengesPerDay)
		if not data or not index then
			return Net.Fail("Invalid challenge.")
		end
		ensureChallenges(player, data)
		local entry = data.Challenges.List[index]
		local def = entry and Challenges.ById[entry.Id]
		if not def then
			return Net.Fail("Invalid challenge.")
		end
		if entry.Claimed then
			return Net.Fail("Already claimed.")
		end
		if entry.Progress < def.Goal then
			return Net.Fail("Not finished yet.")
		end
		entry.Claimed = true
		local reward = def.Reward + data.Level * 15
		EconomyService.AddCash(player, reward, "Challenge")
		EconomyService.AddXp(player, 40 + data.Level * 5)
		Bus.Fire("Dirty", player)
		return Net.Ok("Challenge reward: " .. Util.Money(reward) .. "!")
	end)

	Net.Handle("SkipTutorial", { Rate = 0.5, Burst = 1 }, function(player)
		local data = DataService.Get(player)
		if data then
			data.Tutorial = #ProgressionService.TutorialSteps + 1
			Bus.Fire("Dirty", player)
		end
		return Net.Ok()
	end)

	Net.Handle("RestartTutorial", { Rate = 0.5, Burst = 1 }, function(player)
		local data = DataService.Get(player)
		if data then
			data.Tutorial = 1
			Bus.Fire("Dirty", player)
		end
		return Net.Ok()
	end)

	Net.Handle("GetLeaderboards", { Rate = 0.5, Burst = 2 }, function()
		return { ok = true, Boards = boardCache }
	end)

	-- Progress hooks ------------------------------------------------------
	Bus.On("ProfileLoaded", function(player, data)
		ensureChallenges(player, data)
		local month = os.date("!*t").month
		if month == 10 or month == 12 then
			data.SeasonUnlocks[tostring(month)] = true
		end
		checkAchievements(player)
	end)

	Bus.On("Sale", function(player, info)
		progress(player, "Served", 1)
		progress(player, "Earned", info.Revenue)
		for category, count in pairs(info.Categories) do
			progress(player, "Sold_" .. category, count)
		end
		if info.Night then
			progress(player, "NightSales", 1)
		end
		if info.ByHand and info.WaitTime <= 4 then
			progress(player, "FastCheckout", 1)
		end
		if info.ByHand then
			tutorialDone(player, "RingUp")
		end
		checkAchievements(player)
	end)
	Bus.On("BoughtStock", function(player)
		tutorialDone(player, "Order")
		checkAchievements(player)
	end)
	Bus.On("Stocked", function(player, amount)
		progress(player, "Stocked", amount)
		tutorialDone(player, "Stock")
		checkAchievements(player)
	end)
	Bus.On("UpgradeBought", function(player)
		tutorialDone(player, "Upgrade")
		checkAchievements(player)
	end)
	Bus.On("Review", function(player, stars)
		if stars == 5 then
			progress(player, "FiveStars", 1)
		end
		checkAchievements(player)
	end)
	Bus.On("Visit", function(player)
		progress(player, "Visits", 1)
		checkAchievements(player)
	end)
	Bus.On("ClueFound", checkAchievements)
	Bus.On("MysterySolved", checkAchievements)
	Bus.On("UpgradesChanged", checkAchievements)

	Bus.On("NightStarted", function()
		for _, player in ipairs(Players:GetPlayers()) do
			checkAchievements(player)
		end
	end)

	Bus.On("StarCaught", function(player)
		local data = DataService.Get(player)
		if not data then
			return
		end
		data.Stats.Stars = data.Stats.Stars + 1
		local reward = 40 + data.Level * 5
		EconomyService.AddCash(player, reward, "Star")
		Net.Notify(player, ("You caught a shooting star! +%s (%d caught)"):format(Util.Money(reward), data.Stats.Stars), "good")
		checkAchievements(player)
	end)

	Bus.On("EventStarted", function(eventId)
		for _, player in ipairs(Players:GetPlayers()) do
			local data = DataService.Get(player)
			if data and not data.EventsSeen[eventId] then
				data.EventsSeen[eventId] = true
				local e = Events.NightById[eventId]
				Net.Notify(player, ("New event discovered: %s (logged in your Journal)"):format(e and e.Name or eventId), "good")
				Bus.Fire("Dirty", player)
			end
		end
	end)

	-- Leaderboards: written on save, read every 2 minutes
	DataService.OnSave(function(player, data)
		if earnedStore then
			pcall(function()
				earnedStore:SetAsync(tostring(player.UserId), math.floor(data.Stats.Earned))
			end)
		end
		if ratingStore and data.Rating.Count >= 5 then
			pcall(function()
				ratingStore:SetAsync(tostring(player.UserId), math.floor(data.Rating.Value * 100))
			end)
		end
	end)
	task.spawn(function()
		task.wait(8)
		while true do
			local earned = fetchBoard(earnedStore, false)
			local rating = fetchBoard(ratingStore, true)
			if earned then
				boardCache.Earned = earned
			end
			if rating then
				boardCache.Rating = rating
			end
			drawBoard(worldRefs.Leaderboards.Earned, boardCache.Earned, false)
			drawBoard(worldRefs.Leaderboards.Rating, boardCache.Rating, true)
			Log.Info("Progression", "leaderboards refreshed")
			task.wait(120)
		end
	end)

	Players.PlayerRemoving:Connect(function(player)
		pendingCheck[player] = nil
	end)
end

ProgressionService.EnsureChallenges = ensureChallenges
return ProgressionService
