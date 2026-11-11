-- Jail time, automatic release and secret-vent breakouts.
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Config = require(ReplicatedStorage:WaitForChild("Shared"):WaitForChild("Config"))
local Remotes = require(script.Parent.Remotes)
local DataService = require(script.Parent.DataService)
local TeamService = require(script.Parent.TeamService)

local JailService = {}

local ventProgress = {}

function JailService.Jail(player)
	player:SetAttribute("RobName", nil)
	player:SetAttribute("RobProgress", nil)
	player:SetAttribute("JailRelease", workspace:GetServerTimeNow() + Config.JailTime)
	TeamService.SetTeam(player, "Prisoner", true)
	Remotes.Notify(player, ("You've been arrested! Serve %ds... or find a way out."):format(Config.JailTime), "bad")
end

local function release(player)
	player:SetAttribute("JailRelease", nil)
	TeamService.SetTeam(player, "Criminal", true)
	Remotes.Notify(player, "You served your time. Back to the Hideout!", "info")
end

local function escape(player, map)
	player:SetAttribute("JailRelease", nil)
	TeamService.SetTeam(player, "Criminal", false)
	player:SetAttribute("Bounty", (player:GetAttribute("Bounty") or 0) + Config.EscapeBounty)
	DataService.Increment(player, "Escapes")
	DataService.AddXp(player, Config.EscapeXp)
	if player.Character then
		player.Character:PivotTo(map.EscapeExit)
	end
	Remotes.Notify(player, "You crawled through the vent and ESCAPED! Get out of here!", "good")
	Remotes.NotifyTeam(TeamService.Teams.Police, player.Name .. " has escaped from jail!", "alarm")
end

function JailService.Init(map)
	local prisonerTeam = TeamService.Teams.Prisoner
	task.spawn(function()
		while true do
			task.wait(0.5)
			local now = workspace:GetServerTimeNow()
			for _, player in ipairs(prisonerTeam:GetPlayers()) do
				local releaseAt = player:GetAttribute("JailRelease")
				local root = player.Character and player.Character:FindFirstChild("HumanoidRootPart")
				if not releaseAt or now >= releaseAt then
					ventProgress[player] = nil
					player:SetAttribute("RobName", nil)
					player:SetAttribute("RobProgress", nil)
					release(player)
				elseif root and (root.Position - map.Vent.Position).Magnitude < 6 then
					-- Stay at the vent long enough to unscrew it
					local seconds = (ventProgress[player] or 0) + 0.5
					ventProgress[player] = seconds
					player:SetAttribute("RobName", "the vent cover")
					player:SetAttribute("RobProgress", math.clamp(seconds / Config.VentTime, 0, 1))
					if seconds >= Config.VentTime then
						ventProgress[player] = nil
						player:SetAttribute("RobName", nil)
						player:SetAttribute("RobProgress", nil)
						escape(player, map)
					end
				elseif ventProgress[player] then
					ventProgress[player] = nil
					player:SetAttribute("RobName", nil)
					player:SetAttribute("RobProgress", nil)
				end
			end
		end
	end)

	-- Players who leave while jailed come back as criminals (jail is per-session)
	Players.PlayerRemoving:Connect(function(player)
		ventProgress[player] = nil
		player:SetAttribute("JailRelease", nil)
	end)
end

return JailService
