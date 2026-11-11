-- The mystery system. Clue definitions live in ServerStorage so they can't
-- be read by clients ahead of time; the client only ever receives clues the
-- player has found plus a hint for the next one.
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local ServerStorage = game:GetService("ServerStorage")

local Shared = ReplicatedStorage:WaitForChild("Shared")
local Products = require(Shared:WaitForChild("Products"))
local Util = require(Shared:WaitForChild("Util"))
local Mysteries = require(ServerStorage:WaitForChild("ServerData"):WaitForChild("Mysteries"))

local Log = require(script.Parent.Log)
local Bus = require(script.Parent.Bus)
local Net = require(script.Parent.Net)
local DataService = require(script.Parent.DataService)
local EconomyService = require(script.Parent.EconomyService)
local CycleService = require(script.Parent.CycleService)

local MysteryService = {}

-- Notes found on counters during the Mysterious Message event
local MESSAGES = {
	"The lighthouse keeper never missed a single night.",
	"Some letters take fifty years to arrive.",
	"Count the buttons. Cats can't sew.",
	"When the clock moves again, the town will remember.",
	"The first light on this street was a little store, just like yours.",
	"Look where the grass grows tallest after midnight.",
}

local zoneRefs = {}
local objectRefs = {}

---------------------------------------------------------------------------
-- Clue rules
---------------------------------------------------------------------------
local function solvedCount(data)
	return Util.Count(data.Solved)
end

-- Can this clue be found right now? Returns ok, reason ("newday" when only
-- the "come back another day" rule blocks it)
local function prerequisitesMet(data, clue)
	if data.Clues[clue.Id] then
		return false, "found"
	end
	if clue.RequiresSolved and solvedCount(data) < clue.RequiresSolved then
		return false, "locked"
	end
	local latest = 0
	for _, req in ipairs(clue.Requires or {}) do
		local day = data.Clues[req]
		if not day then
			return false, "locked"
		end
		latest = math.max(latest, day)
	end
	if clue.NewDay and Util.DayNumber() <= latest then
		return false, "newday"
	end
	return true
end

local function award(player, data, clue)
	data.Clues[clue.Id] = Util.DayNumber()
	Net.Notify(player, "New clue! " .. clue.Text, "clue")
	if clue.UnlockProduct then
		data.Secrets[clue.UnlockProduct] = true
		local product = Products.ById[clue.UnlockProduct]
		Net.Notify(player, ("Secret product unlocked: %s. Order it from the Order menu!"):format(product and product.Name or clue.UnlockProduct), "good")
	end
	Bus.Fire("ClueFound", player, clue.Id)

	local mystery = Mysteries.ById[clue.Mystery]
	local all = true
	for _, c in ipairs(mystery.Clues) do
		if not data.Clues[c.Id] then
			all = false
			break
		end
	end
	if all and not data.Solved[mystery.Id] then
		data.Solved[mystery.Id] = Util.DayNumber()
		EconomyService.AddCash(player, mystery.Reward, "Mystery")
		EconomyService.AddXp(player, 300)
		if mystery.Id == "founder" then
			data.Title = "Keeper of the Last Light"
		end
		Net.Notify(player, ("MYSTERY SOLVED: %s! +%s. %s"):format(mystery.Name, Util.Money(mystery.Reward), mystery.RewardText), "level")
		Bus.Fire("MysterySolved", player, mystery.Id)
		Log.Info("Mystery", player.Name, "solved", mystery.Id)
	end
	Bus.Fire("Dirty", player)
end

local function timeOk(clue)
	if clue.Night and not CycleService.IsNight() then
		return false
	end
	if clue.HourMin then
		local clock = CycleService.Clock()
		if clock < clue.HourMin or clock >= clue.HourMax then
			return false
		end
	end
	return true
end

---------------------------------------------------------------------------
-- Triggers
---------------------------------------------------------------------------
local function onObject(player, objectId)
	local data = DataService.Get(player)
	if not data then
		return
	end
	local blockedByDay = false
	local any = false
	for _, mystery in ipairs(Mysteries.List) do
		for _, clue in ipairs(mystery.Clues) do
			if clue.Type == "Object" and clue.Object == objectId then
				any = true
				local ok, reason = prerequisitesMet(data, clue)
				if ok then
					award(player, data, clue)
					return
				elseif reason == "newday" then
					blockedByDay = true
				end
			end
		end
	end
	local info = Mysteries.Objects[objectId]
	if objectId == "messageNote" and not blockedByDay then
		Net.Notify(player, "The note says: \"" .. MESSAGES[math.random(1, #MESSAGES)] .. "\"", "clue")
		return
	end
	if blockedByDay then
		Net.Notify(player, "It won't budge tonight. Maybe try again tomorrow...", "info")
	elseif info and info.Flavor ~= "" then
		Net.Notify(player, info.Flavor, "info")
	elseif any then
		Net.Notify(player, "You've already learned what this can tell you.", "info")
	end
end

local function onServe(player, customerId, cart)
	local data = DataService.Get(player)
	if not data then
		return
	end
	local bought = {}
	for _, line in ipairs(cart or {}) do
		bought[line.P] = true
	end
	for _, mystery in ipairs(Mysteries.List) do
		for _, clue in ipairs(mystery.Clues) do
			if clue.Customer == customerId then
				local ok = prerequisitesMet(data, clue)
				if ok and clue.Type == "Serve" and (not clue.Product or bought[clue.Product]) then
					award(player, data, clue)
				elseif ok and clue.Type == "Pattern" and CycleService.IsNight() then
					local nights = data.ClueCounters[clue.Id] or {}
					local nightId = CycleService.NightId()
					if not table.find(nights, nightId) then
						table.insert(nights, nightId)
						data.ClueCounters[clue.Id] = nights
						if #nights >= clue.Nights then
							award(player, data, clue)
						else
							Net.Notify(player, ("You notice a pattern... (%d/%d nights)"):format(#nights, clue.Nights), "clue")
						end
					end
				end
			end
		end
	end
end

local function checkZones()
	for _, player in ipairs(Players:GetPlayers()) do
		local data = DataService.Get(player)
		local root = player.Character and player.Character:FindFirstChild("HumanoidRootPart")
		if data and root then
			for _, mystery in ipairs(Mysteries.List) do
				for _, clue in ipairs(mystery.Clues) do
					if clue.Type == "Zone" and not data.Clues[clue.Id] then
						local zone = zoneRefs[clue.Zone]
						if zone and (root.Position - zone.Position).Magnitude <= zone.Radius and timeOk(clue) and prerequisitesMet(data, clue) then
							award(player, data, clue)
						end
					end
				end
			end
		end
	end
end

local function updateObjects()
	local night = CycleService.IsNight()
	for id, ref in pairs(objectRefs) do
		local info = Mysteries.Objects[id]
		local visible = not (info and info.Night) or night
		ref.Prompt.Enabled = visible
		ref.Part.Transparency = visible and 0 or 1
	end
end

---------------------------------------------------------------------------
-- Journal data for the client (only what the player has earned)
---------------------------------------------------------------------------
function MysteryService.Journal(data)
	local list = {}
	local solved = solvedCount(data)
	for _, mystery in ipairs(Mysteries.List) do
		local entry = { Id = mystery.Id, Name = mystery.Name, Solved = data.Solved[mystery.Id] ~= nil, Clues = {}, Found = 0, Total = #mystery.Clues }
		local hinted = false
		for _, clue in ipairs(mystery.Clues) do
			if data.Clues[clue.Id] then
				entry.Found = entry.Found + 1
				table.insert(entry.Clues, { Found = true, Text = clue.Text })
			else
				local ok, reason = prerequisitesMet(data, clue)
				if not hinted and (ok or reason == "newday") then
					hinted = true
					table.insert(entry.Clues, { Found = false, Hint = clue.Hint })
				else
					table.insert(entry.Clues, { Found = false })
				end
			end
		end
		if mystery.RequiresSolved and solved < mystery.RequiresSolved then
			entry.Locked = "Solve any other mystery to begin this one."
		end
		if entry.Solved then
			entry.Reward = mystery.RewardText
		end
		table.insert(list, entry)
	end
	return list
end

---------------------------------------------------------------------------
-- Init
---------------------------------------------------------------------------
function MysteryService.Init(worldRefs)
	zoneRefs = worldRefs.Zones
	objectRefs = worldRefs.MysteryObjects
	for id, ref in pairs(objectRefs) do
		ref.Prompt.Triggered:Connect(function(player)
			Bus.Fire("MysteryObject", player, id)
		end)
	end
	updateObjects()

	Bus.On("MysteryObject", onObject)
	Bus.On("CustomerServed", onServe)
	Bus.On("NightStarted", updateObjects)
	Bus.On("DayStarted", updateObjects)

	task.spawn(function()
		while true do
			task.wait(1)
			checkZones()
		end
	end)
end

return MysteryService
