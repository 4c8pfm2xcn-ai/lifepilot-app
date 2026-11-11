-- Creates the RemoteEvents shared with clients (ReplicatedStorage.Remotes).
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local folder = ReplicatedStorage:FindFirstChild("Remotes")
if not folder then
	folder = Instance.new("Folder")
	folder.Name = "Remotes"
	folder.Parent = ReplicatedStorage
end

local Remotes = { Events = {} }

local function event(name)
	local remote = folder:FindFirstChild(name)
	if not remote then
		remote = Instance.new("RemoteEvent")
		remote.Name = name
		remote.Parent = folder
	end
	Remotes.Events[name] = remote
	return remote
end

event("ChooseTeam") -- client -> server: ("Police" | "Criminal")
event("Notify") -- server -> client: (text, kind) kind = "info" | "good" | "bad" | "alarm"

function Remotes.Notify(player, text, kind)
	Remotes.Events.Notify:FireClient(player, text, kind or "info")
end

function Remotes.NotifyAll(text, kind)
	Remotes.Events.Notify:FireAllClients(text, kind or "info")
end

function Remotes.NotifyTeam(team, text, kind)
	for _, player in ipairs(team:GetPlayers()) do
		Remotes.Events.Notify:FireClient(player, text, kind or "info")
	end
end

return Remotes
