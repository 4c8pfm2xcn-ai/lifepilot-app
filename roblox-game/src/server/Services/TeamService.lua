-- Teams, team selection, spawning and respawning.
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Teams = game:GetService("Teams")

local Config = require(ReplicatedStorage:WaitForChild("Shared"):WaitForChild("Config"))
local Remotes = require(script.Parent.Remotes)
local DataService = require(script.Parent.DataService)

local TeamService = { Teams = {} }

local spawns
local teamChangedListeners = {}
local characterListeners = {}
local lastRequest = {}

function TeamService.OnTeamChanged(callback)
	table.insert(teamChangedListeners, callback)
end

-- callback(player, character, teamKey)
function TeamService.OnCharacterSpawned(callback)
	table.insert(characterListeners, callback)
end

function TeamService.GetKey(player)
	for teamKey, team in pairs(TeamService.Teams) do
		if player.Team == team then
			return teamKey
		end
	end
	return nil
end

local function policeSlotsFree()
	local total = #Players:GetPlayers()
	local cap = math.max(1, math.floor(total * Config.MaxPoliceShare))
	return #TeamService.Teams.Police:GetPlayers() < cap
end

-- Moves a player to a team. respawn=true reloads their character at the team spawn.
function TeamService.SetTeam(player, teamKey, respawn)
	local team = TeamService.Teams[teamKey]
	if not team then
		return
	end
	local changed = player.Team ~= team
	player.Neutral = false
	player.Team = team
	if changed then
		for _, callback in ipairs(teamChangedListeners) do
			task.spawn(callback, player, teamKey)
		end
	end
	if respawn then
		player:LoadCharacter()
	end
end

local function onCharacterAdded(player, character)
	local humanoid = character:WaitForChild("Humanoid")
	local root = character:WaitForChild("HumanoidRootPart")
	humanoid.WalkSpeed = Config.WalkSpeed
	humanoid.UseJumpPower = false
	humanoid.JumpHeight = Config.JumpHeight

	local teamKey = TeamService.GetKey(player)
	if teamKey and spawns[teamKey] then
		if not character.Parent then
			character.AncestryChanged:Wait()
		end
		task.wait()
		local offset = Vector3.new(math.random(-6, 6), 0, math.random(-6, 6))
		character:PivotTo(spawns[teamKey] + offset)
		root.AssemblyLinearVelocity = Vector3.zero
	end

	for _, callback in ipairs(characterListeners) do
		task.spawn(callback, player, character, teamKey)
	end

	humanoid.Died:Connect(function()
		-- Dropping the loot bag on death keeps chases meaningful
		if (player:GetAttribute("Bag") or 0) > 0 then
			player:SetAttribute("Bag", 0)
			Remotes.Notify(player, "You died and dropped your loot bag!", "bad")
		end
		task.delay(Config.RespawnDelay, function()
			if player.Parent and player.Character == character then
				player:LoadCharacter()
			end
		end)
	end)
end

local function onChooseTeam(player, teamKey)
	if teamKey ~= "Police" and teamKey ~= "Criminal" then
		return
	end
	local now = os.clock()
	if lastRequest[player] and now - lastRequest[player] < 2 then
		return
	end
	lastRequest[player] = now

	if not DataService.WaitForProfile(player) then
		return
	end
	local current = TeamService.GetKey(player)
	if current == "Prisoner" then
		Remotes.Notify(player, "Nice try. You can't switch teams while in jail!", "bad")
		return
	end
	if current == teamKey and player.Character then
		return
	end
	if teamKey == "Police" and not policeSlotsFree() then
		Remotes.Notify(player, "The police force is full right now. Try again soon!", "bad")
		return
	end
	-- Switching sides forfeits any loot and bounty
	player:SetAttribute("Bag", 0)
	player:SetAttribute("Bounty", 0)
	TeamService.SetTeam(player, teamKey, true)

	if teamKey == "Police" then
		Remotes.Notify(player, "You're a cop! Use Handcuffs on criminals with a bounty. Watch for robbery alarms.", "info")
	else
		Remotes.Notify(player, "You're a criminal! Rob a store, then bring the loot back to the Hideout to cash in.", "info")
	end
end

function TeamService.Init(map)
	spawns = map.Spawns
	Players.CharacterAutoLoads = false

	for teamKey, info in pairs(Config.Teams) do
		local team = Teams:FindFirstChild(info.Name)
		if not team then
			team = Instance.new("Team")
			team.Name = info.Name
			team.TeamColor = info.Color
			team.AutoAssignable = false
			team.Parent = Teams
		end
		TeamService.Teams[teamKey] = team
	end

	local function setup(player)
		player.CharacterAdded:Connect(function(character)
			onCharacterAdded(player, character)
		end)
	end
	Players.PlayerAdded:Connect(setup)
	for _, player in ipairs(Players:GetPlayers()) do
		setup(player)
	end
	Players.PlayerRemoving:Connect(function(player)
		lastRequest[player] = nil
	end)

	Remotes.Events.ChooseTeam.OnServerEvent:Connect(onChooseTeam)
end

return TeamService
