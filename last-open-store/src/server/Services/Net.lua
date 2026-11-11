-- All client <-> server traffic goes through here.
--
-- Client -> server: ONE RemoteFunction "Request"(action, payload). Every action
-- is registered with Net.Handle, has its own rate limit (token bucket), gets
-- type-checked input, and runs inside pcall so a bad request can never crash
-- a service. The client never sends amounts of money - only intentions.
--
-- Server -> client: RemoteEvents (State, Notify, OpenStock, OpenRate, ...).
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Players = game:GetService("Players")
local Log = require(script.Parent.Log)

local Net = {}

local folder = Instance.new("Folder")
folder.Name = "Remotes"
folder.Parent = ReplicatedStorage

local request = Instance.new("RemoteFunction")
request.Name = "Request"
request.Parent = folder

Net.Events = {}
for _, name in ipairs({ "State", "Notify", "OpenStock", "OpenRate", "Floating", "Tutorial" }) do
	local remote = Instance.new("RemoteEvent")
	remote.Name = name
	remote.Parent = folder
	Net.Events[name] = remote
end

local handlers = {}
local buckets = {} -- [player][action] = { Tokens, Last }

-- opts = { Rate = tokens per second, Burst = max tokens }
function Net.Handle(action, opts, fn)
	handlers[action] = { Fn = fn, Rate = opts.Rate or 2, Burst = opts.Burst or 4 }
end

local function allow(player, action, handler)
	local perPlayer = buckets[player]
	if not perPlayer then
		perPlayer = {}
		buckets[player] = perPlayer
	end
	local now = os.clock()
	local bucket = perPlayer[action]
	if not bucket then
		bucket = { Tokens = handler.Burst, Last = now }
		perPlayer[action] = bucket
	end
	bucket.Tokens = math.min(handler.Burst, bucket.Tokens + (now - bucket.Last) * handler.Rate)
	bucket.Last = now
	if bucket.Tokens < 1 then
		return false
	end
	bucket.Tokens = bucket.Tokens - 1
	return true
end

request.OnServerInvoke = function(player, action, payload)
	if type(action) ~= "string" then
		return { ok = false, msg = "Bad request." }
	end
	local handler = handlers[action]
	if not handler then
		Log.Warn("Net", player.Name, "unknown action", action)
		return { ok = false, msg = "Unknown action." }
	end
	if payload ~= nil and type(payload) ~= "table" then
		return { ok = false, msg = "Bad request." }
	end
	if not allow(player, action, handler) then
		return { ok = false, msg = "Slow down a little!" }
	end
	local ok, result = pcall(handler.Fn, player, payload or {})
	if not ok then
		Log.Warn("Net", action, "failed for", player.Name, result)
		return { ok = false, msg = "Something went wrong. Please try again." }
	end
	return result or { ok = true }
end

Players.PlayerRemoving:Connect(function(player)
	buckets[player] = nil
end)

---------------------------------------------------------------------------
-- Input validation helpers (return nil when invalid)
---------------------------------------------------------------------------
function Net.Int(value, min, max)
	if type(value) ~= "number" or value ~= value or value % 1 ~= 0 then
		return nil
	end
	if value < min or value > max then
		return nil
	end
	return value
end

function Net.Str(value, maxLength)
	if type(value) ~= "string" or #value > maxLength then
		return nil
	end
	return value
end

function Net.Key(value, map)
	if type(value) ~= "string" or map[value] == nil then
		return nil
	end
	return value
end

function Net.Bool(value)
	if type(value) ~= "boolean" then
		return nil
	end
	return value
end

---------------------------------------------------------------------------
-- Server -> client helpers
---------------------------------------------------------------------------
-- kind: "info" | "good" | "bad" | "event" | "review" | "clue" | "level"
function Net.Notify(player, text, kind)
	Net.Events.Notify:FireClient(player, text, kind or "info")
end

function Net.NotifyAll(text, kind)
	Net.Events.Notify:FireAllClients(text, kind or "info")
end

function Net.Fail(msg)
	return { ok = false, msg = msg }
end

function Net.Ok(msg)
	return { ok = true, msg = msg }
end

return Net
