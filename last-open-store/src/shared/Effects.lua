-- Turns a set of owned upgrades into the store's live stats.
local Config = require(script.Parent.Config)
local Upgrades = require(script.Parent.Upgrades)

local Effects = {}

function Effects.Defaults()
	return {
		SlotCapacity = Config.BaseSlotCapacity,
		Expansion = 1,
		Patience = 1,
		CheckoutDelay = nil, -- nil = you must ring customers up yourself
		RestockInterval = nil, -- nil = no stock clerk
		CustomerRate = 1,
		MaxCustomers = Config.MaxCustomersPerStore,
		PriceMult = 1,
		StockDiscount = 0,
		NightRate = 1,
		NightPrice = 1,
		RareChance = 1,
		TipChance = 0,
	}
end

function Effects.Compute(owned)
	local stats = Effects.Defaults()
	for id in pairs(owned or {}) do
		local upgrade = Upgrades.ById[id]
		if upgrade then
			for _, e in ipairs(upgrade.Effects) do
				local current = stats[e.Stat]
				if e.Op == "Add" then
					stats[e.Stat] = (current or 0) + e.Value
				elseif e.Op == "Max" then
					stats[e.Stat] = math.max(current or e.Value, e.Value)
				elseif e.Op == "Min" then
					stats[e.Stat] = current and math.min(current, e.Value) or e.Value
				end
			end
		end
	end
	return stats
end

return Effects
