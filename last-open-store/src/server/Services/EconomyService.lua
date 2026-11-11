-- Cash, XP/levels, ordering stock and pricing sales. The ONLY place money
-- is created or spent. Every request is validated here on the server.
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage:WaitForChild("Shared")
local Config = require(Shared:WaitForChild("Config"))
local Products = require(Shared:WaitForChild("Products"))
local Events = require(Shared:WaitForChild("Events"))
local Util = require(Shared:WaitForChild("Util"))

local Log = require(script.Parent.Log)
local Bus = require(script.Parent.Bus)
local Net = require(script.Parent.Net)
local DataService = require(script.Parent.DataService)
local CycleService = require(script.Parent.CycleService)

local EconomyService = {}

local function refreshLeaderstats(player, data)
	local stats = player:FindFirstChild("leaderstats")
	if stats then
		stats.Cash.Value = data.Cash
		stats.Level.Value = data.Level
	end
end

function EconomyService.AddCash(player, amount, reason)
	local data = DataService.Get(player)
	amount = math.floor(amount)
	if not data or amount == 0 then
		return
	end
	data.Cash = math.max(0, data.Cash + amount)
	if reason == "Sale" and amount > 0 then
		data.Stats.Earned = data.Stats.Earned + amount
	end
	refreshLeaderstats(player, data)
	Log.Info("Economy", player.Name, reason or "?", amount, "->", data.Cash)
	Bus.Fire("Dirty", player)
end

function EconomyService.Spend(player, amount)
	local data = DataService.Get(player)
	amount = math.floor(amount)
	if not data or amount < 0 or data.Cash < amount then
		return false
	end
	data.Cash = data.Cash - amount
	refreshLeaderstats(player, data)
	Bus.Fire("Dirty", player)
	return true
end

function EconomyService.AddXp(player, xp)
	local data = DataService.Get(player)
	if not data or xp <= 0 then
		return
	end
	data.Xp = data.Xp + math.floor(xp)
	local leveled = false
	while data.Level < Config.MaxLevel and data.Xp >= Config.XpForLevel(data.Level) do
		data.Xp = data.Xp - Config.XpForLevel(data.Level)
		data.Level = data.Level + 1
		leveled = true
	end
	if leveled then
		refreshLeaderstats(player, data)
		Net.Notify(player, ("Level up! You're now level %d. New products and upgrades may be unlocked."):format(data.Level), "level")
		Bus.Fire("LevelUp", player, data.Level)
	end
	Bus.Fire("Dirty", player)
end

-- Context used to check whether a product can be ordered right now
function EconomyService.OrderContext(player)
	local data = DataService.Get(player)
	return {
		Level = data and data.Level or 1,
		Secrets = data and data.Secrets or {},
		EventId = CycleService.EventId(),
		Weather = CycleService.Weather(),
	}
end

function EconomyService.StockCost(product, qty, effects)
	local discount = math.clamp(effects and effects.StockDiscount or 0, 0, 0.5)
	return math.ceil(product.Cost * qty * (1 - discount))
end

-- Prices a sale. cart = { { P = id, Q = n }, ... }
-- info = { Customer = typeDef, Effects = storeEffects, WaitTime = seconds }
-- Returns revenue (int), tip (int), and per-category counts
function EconomyService.PriceSale(cart, info)
	local mods = CycleService.Mods()
	local weekly = CycleService.Weekly()
	local effects = info.Effects
	local customer = info.Customer
	local night = CycleService.IsNight()
	local revenue = 0
	local categories = {}
	for _, line in ipairs(cart) do
		local product = Products.ById[line.P]
		if product then
			local mult = effects.PriceMult * (customer.PriceMult or 1) * (mods.PriceMult or 1)
			if night then
				mult = mult * effects.NightPrice
			end
			if mods.CategoryMult and mods.Category == product.Category then
				mult = mult * mods.CategoryMult
			end
			if weekly and weekly.Category == product.Category then
				mult = mult * weekly.Mult
			end
			if mods.RareMult and customer.Id == "collector" and product.Rarity ~= "Common" and product.Rarity ~= "Uncommon" then
				mult = mult * mods.RareMult
			end
			revenue = revenue + product.Price * line.Q * mult
			categories[product.Category] = (categories[product.Category] or 0) + line.Q
		end
	end
	revenue = math.floor(revenue + 0.5)
	local tip = 0
	local tipChance = (customer.TipChance or 0) + (effects.TipChance or 0)
	local fastEnough = not customer.FastTipOnly or (info.WaitTime or 99) <= 4
	if fastEnough and math.random() < tipChance then
		tip = math.max(1, math.floor(revenue * (customer.Tip or 0.1) * (mods.TipMult or 1)))
	end
	return revenue, tip, categories
end

---------------------------------------------------------------------------
-- Requests
---------------------------------------------------------------------------
function EconomyService.Init(getEffects)
	-- getEffects(player) -> store effects (provided by StoreService)
	Net.Handle("BuyStock", { Rate = 4, Burst = 8 }, function(player, payload)
		local data = DataService.Get(player)
		if not data then
			return Net.Fail("Still loading...")
		end
		local productId = Net.Key(payload.Product, Products.ById)
		local qty = Net.Int(payload.Qty, 1, Config.MaxOrderQuantity)
		if not productId or not qty then
			return Net.Fail("Invalid order.")
		end
		local product = Products.ById[productId]
		local ok, reason = Products.CanOrder(product, EconomyService.OrderContext(player))
		if not ok then
			return Net.Fail(reason)
		end
		local cost = EconomyService.StockCost(product, qty, getEffects(player))
		if not EconomyService.Spend(player, cost) then
			return Net.Fail(("You need %s for that order."):format(Util.Money(cost)))
		end
		data.Inventory[productId] = (data.Inventory[productId] or 0) + qty
		local firstTime = data.Products[productId] == nil
		if firstTime then
			data.Products[productId] = 0
			Net.Notify(player, ("New product discovered: %s!"):format(product.Name), "good")
		end
		Bus.Fire("BoughtStock", player, productId, qty)
		Bus.Fire("Dirty", player)
		return Net.Ok(("Ordered %d x %s for %s. Stock it on a %s!"):format(qty, product.Name, Util.Money(cost), product.Cold and "cooler" or "shelf"))
	end)
end

EconomyService.WeeklyList = Events.Weekly
return EconomyService
