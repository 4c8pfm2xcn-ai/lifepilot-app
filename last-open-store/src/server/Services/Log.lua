-- Tagged logging. Info only prints when Config.Debug is on.
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Config = require(ReplicatedStorage:WaitForChild("Shared"):WaitForChild("Config"))

local Log = {}

function Log.Info(tag, ...)
	if Config.Debug then
		print("[LOS][" .. tag .. "]", ...)
	end
end

function Log.Warn(tag, ...)
	warn("[LOS][" .. tag .. "]", ...)
end

-- Runs fn in a protected call and logs failures with context
function Log.Try(tag, fn, ...)
	local ok, err = pcall(fn, ...)
	if not ok then
		Log.Warn(tag, err)
	end
	return ok, err
end

return Log
