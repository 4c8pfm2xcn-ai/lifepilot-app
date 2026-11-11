-- A tiny in-server event bus so services can react to each other without
-- requiring each other (no circular dependencies).
--   Bus.On("Sale", function(player, info) ... end)
--   Bus.Fire("Sale", player, info)
-- Listeners run in their own thread; one failing listener never breaks others.
local Log = require(script.Parent.Log)

local Bus = {}
local listeners = {}

function Bus.On(name, callback)
	listeners[name] = listeners[name] or {}
	table.insert(listeners[name], callback)
end

function Bus.Fire(name, ...)
	local list = listeners[name]
	if not list then
		return
	end
	for _, callback in ipairs(list) do
		task.spawn(function(...)
			local ok, err = pcall(callback, ...)
			if not ok then
				Log.Warn("Bus", name, err)
			end
		end, ...)
	end
end

return Bus
