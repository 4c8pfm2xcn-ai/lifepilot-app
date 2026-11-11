-- All 50 products. Cost = wholesale price, Price = shelf price.
-- Cold products (drinks) must go in a Cooler; everything else on a Shelf.
-- Availability:
--   Level        normal products unlock as you level up
--   Event        only orderable during that night event (rare collectibles)
--   Weather      only orderable during that weather
--   Secret       unlocked by solving mystery clues
local Products = {}
Products.List = {}
Products.ById = {}

Products.Categories = { "Snacks", "Drinks", "Instant", "Sweets", "Household" }
Products.RarityColors = {
	Common = Color3.fromRGB(190, 196, 210),
	Uncommon = Color3.fromRGB(110, 220, 140),
	Rare = Color3.fromRGB(90, 170, 255),
	Legendary = Color3.fromRGB(255, 190, 70),
	Secret = Color3.fromRGB(220, 120, 255),
}

local function add(id, name, category, cost, price, level, rarity, color, shape, extra)
	local product = {
		Id = id, Name = name, Category = category, Cost = cost, Price = price,
		Level = level, Rarity = rarity, Color = color, Shape = shape,
		Cold = category == "Drinks",
		Order = #Products.List + 1,
	}
	for k, v in pairs(extra or {}) do
		product[k] = v
	end
	table.insert(Products.List, product)
	Products.ById[id] = product
end

local C = Color3.fromRGB

-- Snacks (8)
add("chips", "Salted Chips", "Snacks", 4, 7, 1, "Common", C(240, 200, 60), "Bag")
add("puffs", "Cheese Puffs", "Snacks", 4, 7, 1, "Common", C(255, 150, 40), "Bag")
add("pretzel", "Pretzel Twists", "Snacks", 5, 9, 2, "Common", C(180, 120, 60), "Bag")
add("seaweed", "Seaweed Crisps", "Snacks", 6, 11, 3, "Common", C(40, 120, 70), "Box")
add("curls", "Spicy Corn Curls", "Snacks", 7, 13, 4, "Uncommon", C(230, 60, 40), "Bag")
add("trailmix", "Trail Mix", "Snacks", 9, 16, 5, "Uncommon", C(150, 110, 70), "Jar")
add("ricecracker", "Rice Crackers", "Snacks", 10, 18, 6, "Uncommon", C(235, 225, 200), "Box")
add("popcorn", "Midnight Popcorn", "Snacks", 12, 22, 8, "Uncommon", C(60, 50, 120), "Bag")

-- Drinks (9) - need a cooler
add("cola", "Cola", "Drinks", 3, 6, 1, "Common", C(200, 30, 40), "Can")
add("lemonfizz", "Lemon Fizz", "Drinks", 3, 6, 1, "Common", C(250, 240, 90), "Can")
add("water", "Bottled Water", "Drinks", 2, 4, 1, "Common", C(150, 210, 255), "Bottle")
add("icedtea", "Iced Tea", "Drinks", 4, 8, 2, "Common", C(170, 90, 40), "Bottle")
add("energy", "Volt Energy", "Drinks", 7, 13, 4, "Uncommon", C(80, 255, 120), "Can")
add("coldbrew", "Cold Brew", "Drinks", 9, 16, 5, "Uncommon", C(60, 40, 30), "Bottle")
add("melonmilk", "Melon Milk", "Drinks", 10, 18, 6, "Uncommon", C(150, 230, 150), "Box")
add("yuzu", "Sparkling Yuzu", "Drinks", 13, 24, 9, "Rare", C(255, 210, 60), "Bottle")
add("bubbletea", "Bubble Tea Kit", "Drinks", 16, 30, 10, "Rare", C(210, 170, 140), "Bottle")

-- Instant food (7)
add("noodles", "Cup Noodles", "Instant", 5, 9, 2, "Common", C(240, 80, 60), "Jar")
add("riceball", "Rice Ball", "Instant", 6, 11, 3, "Common", C(245, 245, 245), "Box")
add("dumplings", "Frozen Dumplings", "Instant", 10, 18, 5, "Uncommon", C(220, 220, 255), "Box")
add("hotbun", "Steamed Bun", "Instant", 9, 17, 6, "Uncommon", C(250, 235, 210), "Box")
add("curry", "Instant Curry", "Instant", 12, 22, 7, "Uncommon", C(200, 140, 30), "Box")
add("ramen", "Late-Night Ramen", "Instant", 15, 28, 9, "Rare", C(255, 120, 60), "Jar")
add("pizza", "Microwave Pizza", "Instant", 20, 36, 11, "Rare", C(220, 60, 50), "Box")

-- Sweets (7)
add("gummy", "Gummy Worms", "Sweets", 3, 6, 1, "Common", C(255, 100, 180), "Bag")
add("choco", "Chocolate Bar", "Sweets", 4, 8, 2, "Common", C(110, 60, 40), "Box")
add("mints", "Mint Tin", "Sweets", 5, 9, 3, "Common", C(120, 230, 210), "Box")
add("mochi", "Strawberry Mochi", "Sweets", 10, 18, 6, "Uncommon", C(255, 170, 190), "Box")
add("pudding", "Caramel Pudding", "Sweets", 12, 22, 8, "Uncommon", C(230, 170, 70), "Jar")
add("starcandy", "Star Candy", "Sweets", 14, 26, 10, "Rare", C(255, 230, 120), "Jar")
add("marshmallow", "Cloud Marshmallows", "Sweets", 18, 32, 12, "Rare", C(250, 250, 255), "Bag")

-- Household (6)
add("umbrella", "Umbrella", "Household", 12, 22, 3, "Common", C(60, 90, 200), "Bottle")
add("batteries", "Batteries", "Household", 8, 15, 4, "Common", C(40, 40, 45), "Box")
add("charger", "Phone Charger", "Household", 18, 32, 7, "Uncommon", C(240, 240, 240), "Box")
add("flashlight", "Flashlight", "Household", 20, 36, 8, "Uncommon", C(255, 200, 40), "Bottle")
add("raincoat", "Raincoat", "Household", 26, 46, 10, "Rare", C(255, 220, 40), "Bag")
add("nightlight", "Moon Night-Light", "Household", 30, 55, 13, "Rare", C(200, 210, 255), "Jar")

-- Rare collectibles (8)
add("glowsoda", "Glow Soda", "Drinks", 25, 50, 12, "Rare", C(100, 255, 220), "Can")
add("goldsticks", "Golden Biscuit Sticks", "Snacks", 30, 60, 14, "Legendary", C(255, 200, 60), "Box")
add("luckycharm", "Lucky Cat Charm", "Household", 45, 90, 16, "Legendary", C(255, 240, 230), "Jar")
add("cocoa", "Rainy Day Cocoa", "Instant", 14, 30, 1, "Rare", C(120, 70, 50), "Jar", { Weather = "Rain" })
add("aurorajelly", "Aurora Jelly", "Sweets", 40, 95, 1, "Legendary", C(120, 255, 180), "Jar", { Event = "Aurora" })
add("shootingcandy", "Shooting Star Candy", "Sweets", 20, 48, 1, "Rare", C(255, 250, 200), "Bag", { Event = "ShootingStars" })
add("mooncake", "Moonlight Mooncake", "Sweets", 22, 50, 1, "Rare", C(240, 210, 140), "Box", { Event = "MoonlightMarket" })
add("comic", "Vintage Comic", "Household", 60, 140, 1, "Legendary", C(230, 80, 60), "Box", { Event = "CollectorsNight" })

-- Secret products (5), unlocked by mysteries
add("stamp", "Vintage Stamp", "Household", 15, 40, 1, "Secret", C(200, 90, 70), "Box", { Secret = true })
add("lemonade", "Lighthouse Lemonade", "Drinks", 12, 32, 1, "Secret", C(255, 250, 150), "Bottle", { Secret = true })
add("buttoncookie", "Button Cookies", "Sweets", 10, 28, 1, "Secret", C(210, 160, 110), "Jar", { Secret = true })
add("toffee", "Clockwork Toffee", "Sweets", 14, 36, 1, "Secret", C(190, 130, 50), "Box", { Secret = true })
add("foundersoda", "Founder's Soda", "Drinks", 20, 60, 1, "Secret", C(255, 150, 90), "Bottle", { Secret = true })

-- Can this product be ordered right now?
-- ctx = { Level, Secrets = {id=true}, EventId, Weather }
function Products.CanOrder(product, ctx)
	if product.Secret then
		if ctx.Secrets and ctx.Secrets[product.Id] then
			return true
		end
		return false, "Secret: solve a mystery"
	end
	if product.Event then
		if ctx.EventId == product.Event then
			return true
		end
		return false, "Only during a special night event"
	end
	if product.Weather then
		if ctx.Weather == product.Weather or (product.Weather == "Rain" and ctx.Weather == "Storm") then
			return true
		end
		return false, "Only when it rains"
	end
	if (ctx.Level or 1) < product.Level then
		return false, "Reach level " .. product.Level
	end
	return true
end

return Products
