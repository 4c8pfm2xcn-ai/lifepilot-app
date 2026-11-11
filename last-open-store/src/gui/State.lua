-- Client-side copy of the player's state (sent by the server) + a helper to
-- make validated requests. The client never decides money or items; it only
-- asks the server and shows the answer.
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage:WaitForChild("Shared")
local Unlocks = require(Shared:WaitForChild("Unlocks"))
local Remotes = ReplicatedStorage:WaitForChild("Remotes")
local RequestRemote = Remotes:WaitForChild("Request")

local State = { Data = nil }
local listeners = {}

function State.On(callback)
	table.insert(listeners, callback)
	if State.Data then
		task.spawn(callback, State.Data)
	end
end

local function set(data)
	if not data then
		return
	end
	State.Data = data
	for _, callback in ipairs(listeners) do
		task.spawn(callback, data)
	end
end

Remotes:WaitForChild("State").OnClientEvent:Connect(set)

-- Returns { ok = bool, msg = string?, ... }
function State.Request(action, payload)
	local ok, result = pcall(function()
		return RequestRemote:InvokeServer(action, payload)
	end)
	if not ok or type(result) ~= "table" then
		return { ok = false, msg = "Connection hiccup. Try again." }
	end
	return result
end

-- Request + show the server's message as a toast
function State.Act(action, payload, Kit)
	local result = State.Request(action, payload)
	if result.msg and result.msg ~= "" and Kit then
		Kit.Toast(result.msg, result.ok and "good" or "bad")
	end
	return result
end

function State.UnlockContext()
	local d = State.Data
	if not d then
		return {}
	end
	return {
		Level = d.Level, Achievements = d.Achievements, Solved = d.Solved, Robux = d.Owned.Robux,
		Month = d.Month, SeasonUnlocks = d.SeasonUnlocks, BestStreak = d.Daily.BestStreak,
	}
end

function State.IsUnlocked(rules)
	return Unlocks.Check(rules, State.UnlockContext())
end

task.spawn(function()
	local result = State.Request("GetState", {})
	if result.ok and result.State and not State.Data then
		set(result.State)
	end
end)

return State
