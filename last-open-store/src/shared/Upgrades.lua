-- 30 store upgrades in 6 branches. Each has a cost, a level requirement, an
-- optional prerequisite and one or more effects that Effects.lua aggregates.
-- Effect ops: Add (numbers stack), Max (highest wins), Min (lowest wins).
local Upgrades = {}
Upgrades.List = {}
Upgrades.ById = {}
Upgrades.Branches = { "Shelves", "Service", "Marketing", "Pricing", "Night", "Special" }

local function add(id, branch, name, desc, cost, level, requires, effects)
	local u = { Id = id, Branch = branch, Name = name, Desc = desc, Cost = cost, Level = level, Requires = requires, Effects = effects, Order = #Upgrades.List + 1 }
	table.insert(Upgrades.List, u)
	Upgrades.ById[id] = u
end

local function fx(stat, op, value)
	return { Stat = stat, Op = op, Value = value }
end

-- Shelves & expansion
add("sturdyShelves", "Shelves", "Sturdy Shelves", "+4 items per shelf slot.", 150, 1, nil, { fx("SlotCapacity", "Add", 4) })
add("tallShelves", "Shelves", "Tall Shelves", "+4 more items per slot.", 900, 4, "sturdyShelves", { fx("SlotCapacity", "Add", 4) })
add("warehouseRacks", "Shelves", "Warehouse Racks", "+8 more items per slot.", 6000, 10, "tallShelves", { fx("SlotCapacity", "Add", 8) })
add("expandCorner", "Shelves", "Corner Store Expansion", "Knock down the back wall: +2 shelves, +1 cooler.", 1200, 3, nil, { fx("Expansion", "Max", 2) })
add("expandMiniMart", "Shelves", "Mini Mart Expansion", "Expand again: +2 shelves, +1 cooler.", 8000, 8, "expandCorner", { fx("Expansion", "Max", 3) })
add("expandNightMarket", "Shelves", "Night Market Expansion", "The full store: +2 shelves, +1 cooler.", 30000, 15, "expandMiniMart", { fx("Expansion", "Max", 4) })

-- Service
add("friendlyBell", "Service", "Friendly Door Bell", "Customers wait 15% longer.", 200, 2, nil, { fx("Patience", "Add", 0.15) })
add("queueMats", "Service", "Comfy Queue Mats", "Customers wait another 15% longer.", 1500, 5, "friendlyBell", { fx("Patience", "Add", 0.15) })
add("music", "Service", "Lo-fi Store Radio", "Customers wait 20% longer.", 5000, 9, "queueMats", { fx("Patience", "Add", 0.2) })
add("cashier", "Service", "Part-time Cashier", "Auto rings up customers after 6s.", 2500, 6, nil, { fx("CheckoutDelay", "Min", 6) })
add("scanner", "Service", "Speedy Scanner", "Auto checkout after 3s.", 9000, 11, "cashier", { fx("CheckoutDelay", "Min", 3) })
add("express", "Service", "Express Lane", "Auto checkout after 1.5s.", 25000, 16, "scanner", { fx("CheckoutDelay", "Min", 1.5) })
add("stockClerk", "Service", "Stock Clerk", "Refills one shelf slot from the backroom every 10s.", 4000, 7, nil, { fx("RestockInterval", "Min", 10) })
add("nightClerk", "Service", "Night Clerk", "Refills a slot every 4s.", 15000, 13, "stockClerk", { fx("RestockInterval", "Min", 4) })

-- Marketing
add("posters", "Marketing", "Window Posters", "+15% customers.", 300, 2, nil, { fx("CustomerRate", "Add", 0.15) })
add("neonSign", "Marketing", "Neon Sign", "+15% customers.", 1800, 5, "posters", { fx("CustomerRate", "Add", 0.15) })
add("flyers", "Marketing", "Street Flyers", "+20% customers.", 7000, 9, "neonSign", { fx("CustomerRate", "Add", 0.2) })
add("buzz", "Marketing", "Town Buzz", "+25% customers.", 20000, 14, "flyers", { fx("CustomerRate", "Add", 0.25) })
add("doorway", "Marketing", "Extra Doorway", "+1 customer in the store at once.", 1000, 4, nil, { fx("MaxCustomers", "Add", 1) })
add("aisles", "Marketing", "Wider Aisles", "+1 customer at once.", 6000, 9, "doorway", { fx("MaxCustomers", "Add", 1) })
add("entrance", "Marketing", "Grand Entrance", "+2 customers at once.", 22000, 15, "aisles", { fx("MaxCustomers", "Add", 2) })

-- Pricing
add("priceTags", "Pricing", "Neat Price Tags", "Products sell for 5% more.", 500, 3, nil, { fx("PriceMult", "Add", 0.05) })
add("displays", "Pricing", "Premium Displays", "Products sell for 10% more.", 4500, 8, "priceTags", { fx("PriceMult", "Add", 0.1) })
add("boutique", "Pricing", "Boutique Lighting", "Products sell for 10% more.", 18000, 13, "displays", { fx("PriceMult", "Add", 0.1) })
add("bulkCard", "Pricing", "Bulk Buyer Card", "Stock costs 10% less.", 800, 4, nil, { fx("StockDiscount", "Add", 0.1) })
add("wholesale", "Pricing", "Wholesale Contract", "Stock costs another 10% less.", 10000, 12, "bulkCard", { fx("StockDiscount", "Add", 0.1) })

-- Night
add("nightLamps", "Night", "Cozy Night Lamps", "+25% customers at night.", 2000, 6, nil, { fx("NightRate", "Add", 0.25) })
add("lateMenu", "Night", "Late-Night Menu", "Night sales earn 15% more.", 12000, 12, "nightLamps", { fx("NightPrice", "Add", 0.15) })

-- Special
add("luckyStatue", "Special", "Lucky Cat Statue", "Mysterious customers visit 50% more often.", 7500, 10, nil, { fx("RareChance", "Add", 0.5) })
add("tipJar", "Special", "Tip Jar", "+15% chance customers leave a tip.", 350, 2, nil, { fx("TipChance", "Add", 0.15) })

return Upgrades
