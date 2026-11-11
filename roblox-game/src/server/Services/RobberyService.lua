-- The core criminal loop: stand inside an open store to fill your bag,
-- survive the alarm, then bring the bag to the Hideout to turn it into cash.
--
-- Store states (mirrored to ReplicatedStorage.RobberyStatus for the HUD):
--   OPEN   -> can be robbed
--   ALARM  -> someone started robbing it; police are alerted; closes soon
--   CLOSED -> cooling down until ReopenAt
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Config = require(ReplicatedStorage:WaitForChild("Shared"):WaitForChild("Config"))
local Remotes = require(script.Parent.Remotes)
local DataService = require(script.Parent.DataService)
local TeamService = require(script.Parent.TeamService)

local RobberyService = {}

local states = {} -- [id] = { Status, AlarmEnds, ReopenAt, Value, Completed = {[player]=true} }
local progress = {} -- [player] = { [id] = seconds }
local warned = {} -- [player] = os.clock() of last "level too low" / "bag full" hint

local function inside(zone, position)
	local localPos = zone.CFrame:PointToObjectSpace(position)
	local half = zone.Size / 2
	return math.abs(localPos.X) <= half.X and math.abs(localPos.Y) <= half.Y and math.abs(localPos.Z) <= half.Z
end

-- Footprint check for flat pads: inside the X/Z area and within 8 studs above it
local function onPad(pad, position)
	local localPos = pad.CFrame:PointToObjectSpace(position)
	local half = pad.Size / 2
	return math.abs(localPos.X) <= half.X and math.abs(localPos.Z) <= half.Z and localPos.Y >= -1 and localPos.Y <= 8
end

local function formatTime(seconds)
	seconds = math.max(0, math.ceil(seconds))
	return ("%d:%02d"):format(math.floor(seconds / 60), seconds % 60)
end

local function hint(player, text)
	local now = os.clock()
	if not warned[player] or now - warned[player] > 6 then
		warned[player] = now
		Remotes.Notify(player, text, "bad")
	end
end

local function setStatus(rob, status, now)
	local state = states[rob.Id]
	state.Status = status
	state.Value.Value = status
	if status == "ALARM" then
		state.AlarmEnds = now + rob.Duration + Config.AlarmGrace
		Remotes.NotifyTeam(TeamService.Teams.Police, ("ALARM! %s is being robbed!"):format(rob.Name), "alarm")
	elseif status == "CLOSED" then
		state.ReopenAt = now + rob.Cooldown
		state.Value:SetAttribute("ReopenAt", state.ReopenAt)
		state.Completed = {}
		for _, perPlayer in pairs(progress) do
			perPlayer[rob.Id] = nil
		end
	elseif status == "OPEN" then
		Remotes.NotifyAll(("%s is open for business..."):format(rob.Name), "info")
	end
end

local function updateSign(rob, label, now)
	local state = states[rob.Id]
	if state.Status == "OPEN" then
		label.Text = rob.Name .. " - OPEN"
		label.TextColor3 = Color3.fromRGB(110, 255, 130)
	elseif state.Status == "ALARM" then
		label.Text = "ALARM! " .. rob.Name
		label.TextColor3 = (math.floor(now * 2) % 2 == 0) and Color3.fromRGB(255, 70, 70) or Color3.new(1, 1, 1)
	else
		label.Text = rob.Name .. " - CLOSED " .. formatTime(state.ReopenAt - now)
		label.TextColor3 = Color3.fromRGB(170, 170, 170)
	end
end

local function complete(player, rob)
	local state = states[rob.Id]
	state.Completed[player] = true
	progress[player][rob.Id] = nil

	local bag = player:GetAttribute("Bag") or 0
	local space = DataService.MaxBag(player) - bag
	local loot = math.min(rob.Payout * DataService.Multiplier(player), space)
	player:SetAttribute("Bag", bag + loot)
	player:SetAttribute("Bounty", (player:GetAttribute("Bounty") or 0) + math.floor(rob.Payout * Config.BountyPerPayout))
	DataService.AddXp(player, rob.Xp)
	DataService.Increment(player, "Robberies")
	Remotes.Notify(player, ("You grabbed $%d! Get it to the Hideout before the cops catch you!"):format(loot), "good")
end

local function tickPlayer(player, map, now, dt)
	local root = player.Character and player.Character:FindFirstChild("HumanoidRootPart")
	local robbing = nil

	if root and player.Team == TeamService.Teams.Criminal then
		for _, rob in ipairs(Config.Robberies) do
			local state = states[rob.Id]
			if state.Status ~= "CLOSED" and not state.Completed[player] and inside(map.RobZones[rob.Id], root.Position) then
				robbing = rob
				break
			end
		end

		-- Cash in at the hideout
		local bag = player:GetAttribute("Bag") or 0
		if bag > 0 and onPad(map.CashZone, root.Position) then
			DataService.AddCash(player, bag)
			player:SetAttribute("Bag", 0)
			Remotes.Notify(player, ("Cashed in $%d! Nice getaway."):format(bag), "good")
		end
	end

	if robbing then
		if DataService.GetLevel(player) < robbing.MinLevel then
			hint(player, ("You need level %d to rob %s."):format(robbing.MinLevel, robbing.Name))
			robbing = nil
		elseif (player:GetAttribute("Bag") or 0) >= DataService.MaxBag(player) then
			hint(player, "Your bag is full! Cash it in at the Hideout.")
			robbing = nil
		end
	end

	if robbing then
		local state = states[robbing.Id]
		if state.Status == "OPEN" then
			setStatus(robbing, "ALARM", now)
		end
		progress[player] = progress[player] or {}
		local seconds = (progress[player][robbing.Id] or 0) + dt
		progress[player][robbing.Id] = seconds
		player:SetAttribute("RobName", robbing.Name)
		player:SetAttribute("RobProgress", math.clamp(seconds / robbing.Duration, 0, 1))
		if seconds >= robbing.Duration then
			complete(player, robbing)
		end
	elseif player:GetAttribute("RobName") and player.Team ~= TeamService.Teams.Prisoner then
		player:SetAttribute("RobName", nil)
		player:SetAttribute("RobProgress", nil)
	end
end

function RobberyService.Init(map)
	local statusFolder = Instance.new("Folder")
	statusFolder.Name = "RobberyStatus"
	for order, rob in ipairs(Config.Robberies) do
		local value = Instance.new("StringValue")
		value.Name = rob.Id
		value.Value = "OPEN"
		value:SetAttribute("DisplayName", rob.Name)
		value:SetAttribute("Order", order)
		value:SetAttribute("MinLevel", rob.MinLevel)
		value.Parent = statusFolder
		states[rob.Id] = { Status = "OPEN", AlarmEnds = 0, ReopenAt = 0, Value = value, Completed = {} }
	end
	statusFolder.Parent = ReplicatedStorage

	Players.PlayerRemoving:Connect(function(player)
		progress[player] = nil
		warned[player] = nil
		for _, state in pairs(states) do
			state.Completed[player] = nil
		end
	end)

	task.spawn(function()
		local last = os.clock()
		while true do
			task.wait(0.25)
			local clock = os.clock()
			local dt = clock - last
			last = clock
			local now = workspace:GetServerTimeNow()

			for _, rob in ipairs(Config.Robberies) do
				local state = states[rob.Id]
				if state.Status == "ALARM" and now >= state.AlarmEnds then
					setStatus(rob, "CLOSED", now)
				elseif state.Status == "CLOSED" and now >= state.ReopenAt then
					setStatus(rob, "OPEN", now)
				end
			end

			for _, player in ipairs(Players:GetPlayers()) do
				tickPlayer(player, map, now, dt)
			end

			for _, rob in ipairs(Config.Robberies) do
				updateSign(rob, map.Signs[rob.Id], now)
			end
		end
	end)
end

return RobberyService
