-- Multiplayer: visiting stores, rating them, friend bonuses.
--
-- Trading is intentionally NOT implemented: a safe trade needs both
-- inventories to commit atomically across saves, and a half-applied trade is
-- the classic duplication exploit. Gifting/visiting gives the social loop
-- without that risk.
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage:WaitForChild("Shared")
local Config = require(Shared:WaitForChild("Config"))
local Util = require(Shared:WaitForChild("Util"))

local Bus = require(script.Parent.Bus)
local Net = require(script.Parent.Net)
local DataService = require(script.Parent.DataService)
local EconomyService = require(script.Parent.EconomyService)
local StoreService = require(script.Parent.StoreService)
local StoreBuilder = require(script.Parent.StoreBuilder)

local SocialService = {}

local friendCache = {} -- [a][b] = bool
local lastStore = {} -- [player] = owner userId currently inside
local visitedThisSession = {} -- [player] = { [ownerId] = true }

local function areFriends(a, b)
	friendCache[a] = friendCache[a] or {}
	if friendCache[a][b.UserId] == nil then
		local ok, result = pcall(function()
			return a:IsFriendsWith(b.UserId)
		end)
		friendCache[a][b.UserId] = ok and result or false
	end
	return friendCache[a][b.UserId]
end

local function onEnteredStore(visitor, owner)
	visitedThisSession[visitor] = visitedThisSession[visitor] or {}
	if visitedThisSession[visitor][owner.UserId] then
		return
	end
	visitedThisSession[visitor][owner.UserId] = true
	local vData = DataService.Get(visitor)
	local oData = DataService.Get(owner)
	if not vData or not oData then
		return
	end
	vData.Stats.Visits = vData.Stats.Visits + 1
	Net.Notify(owner, visitor.DisplayName .. " is visiting your store!", "info")
	Bus.Fire("Visit", visitor, owner)

	if areFriends(visitor, owner) then
		local today = Util.DayNumber()
		local key = tostring(owner.UserId)
		if vData.FriendBonus[key] ~= today then
			vData.FriendBonus[key] = today
			oData.FriendBonus[tostring(visitor.UserId)] = today
			EconomyService.AddCash(visitor, Config.FriendVisitBonus, "Friend")
			EconomyService.AddCash(owner, Config.FriendVisitBonus, "Friend")
			Net.Notify(visitor, ("Friendly visit bonus! You and %s both got %s."):format(owner.DisplayName, Util.Money(Config.FriendVisitBonus)), "good")
			Net.Notify(owner, ("Friendly visit bonus from %s! +%s"):format(visitor.DisplayName, Util.Money(Config.FriendVisitBonus)), "good")
		end
	end
	Bus.Fire("Dirty", visitor)
end

function SocialService.Init()
	Net.Handle("GetStores", { Rate = 1, Burst = 3 }, function(player)
		local list = {}
		for _, store in pairs(StoreService.All()) do
			local owner = store.Owner
			local data = owner and DataService.Get(owner)
			if data then
				table.insert(list, {
					UserId = owner.UserId,
					Name = owner.DisplayName,
					StoreName = store.Model:GetAttribute("StoreName") or "",
					Rating = data.Rating.Value,
					Reviews = data.Rating.Count,
					Level = data.Level,
					Title = data.Title,
					Friend = owner ~= player and areFriends(player, owner) or false,
					Mine = owner == player,
				})
			end
		end
		table.sort(list, function(a, b)
			return a.Rating > b.Rating
		end)
		return { ok = true, Stores = list }
	end)

	Net.Handle("Visit", { Rate = 0.3, Burst = 2 }, function(player, payload)
		local userId = Net.Int(payload.UserId, -(2 ^ 53), 2 ^ 53) -- Studio test players have negative ids
		local target = userId and Players:GetPlayerByUserId(userId)
		local store = target and StoreService.ForPlayer(target)
		local character = player.Character
		if not store or not character then
			return Net.Fail("That store isn't open right now.")
		end
		local spot = StoreBuilder.WorldPoint(store, StoreBuilder.DoorOutside - Vector3.new(0, 0, 6))
		character:PivotTo(CFrame.lookAt(spot + Vector3.new(0, 3, 0), store.CFrame.Position + Vector3.new(0, 3, 0)))
		return Net.Ok(target == player and "Welcome back to your store." or ("Welcome to " .. (store.Model:GetAttribute("StoreName") or "the store") .. "!"))
	end)

	Net.Handle("RateStore", { Rate = 0.5, Burst = 2 }, function(player, payload)
		local data = DataService.Get(player)
		local userId = Net.Int(payload.Owner, -(2 ^ 53), 2 ^ 53)
		local stars = Net.Int(payload.Stars, 1, 5)
		local owner = userId and Players:GetPlayerByUserId(userId)
		local store = owner and StoreService.ForPlayer(owner)
		if not data or not stars or not store then
			return Net.Fail("That store isn't open.")
		end
		if owner == player then
			return Net.Fail("You can't rate your own store!")
		end
		local root = player.Character and player.Character:FindFirstChild("HumanoidRootPart")
		if not root or StoreService.StoreAt(root.Position) ~= store then
			return Net.Fail("Rate a store while you're inside it.")
		end
		local today = Util.DayNumber()
		local key = tostring(owner.UserId)
		if data.RatedStores[key] == today then
			return Net.Fail("You already rated this store today.")
		end
		data.RatedStores[key] = today
		local text = stars >= 4 and "Great store, I'll be back!" or (stars == 3 and "Pretty nice store." or "Could use some work.")
		StoreService.AddReview(owner, player.DisplayName .. " (player)", stars, text)
		Bus.Fire("Dirty", player)
		return Net.Ok("Thanks for rating! The shopkeeper will see your review.")
	end)

	-- Who is inside whose store
	task.spawn(function()
		while true do
			task.wait(1)
			for _, player in ipairs(Players:GetPlayers()) do
				local root = player.Character and player.Character:FindFirstChild("HumanoidRootPart")
				local store = root and StoreService.StoreAt(root.Position)
				local owner = store and store.Owner
				local ownerId = owner and owner.UserId or 0
				if ownerId ~= (lastStore[player] or 0) then
					lastStore[player] = ownerId
					if owner and owner ~= player then
						task.spawn(onEnteredStore, player, owner)
					end
				end
			end
		end
	end)

	Players.PlayerRemoving:Connect(function(player)
		friendCache[player] = nil
		lastStore[player] = nil
		visitedThisSession[player] = nil
	end)
end

return SocialService
