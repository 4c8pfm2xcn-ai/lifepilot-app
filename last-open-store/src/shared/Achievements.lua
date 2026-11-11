-- 25 achievements. Stat values are computed by ProgressionService:
-- Served, Earned, Stocked, FiveStars, ProductsFound, CustomersMet, Clues,
-- Mysteries, Nights, Expansion, UpgradesOwned, Stars, Visits, Level, BestRating
local Achievements = {}
Achievements.List = {
	{ Id = "served1", Name = "First Customer", Desc = "Serve your very first customer.", Stat = "Served", Goal = 1, Reward = 50 },
	{ Id = "served25", Name = "Regulars", Desc = "Serve 25 customers.", Stat = "Served", Goal = 25, Reward = 200 },
	{ Id = "served100", Name = "Local Favorite", Desc = "Serve 100 customers. Unlocks the Mint Fresh theme.", Stat = "Served", Goal = 100, Reward = 600 },
	{ Id = "served500", Name = "Neighborhood Hero", Desc = "Serve 500 customers.", Stat = "Served", Goal = 500, Reward = 2500 },
	{ Id = "served2000", Name = "Legend of the Night", Desc = "Serve 2,000 customers.", Stat = "Served", Goal = 2000, Reward = 10000 },
	{ Id = "earned1k", Name = "First Thousand", Desc = "Earn $1,000 in sales.", Stat = "Earned", Goal = 1000, Reward = 150 },
	{ Id = "earned10k", Name = "Small Business", Desc = "Earn $10,000. Unlocks the Confetti effect.", Stat = "Earned", Goal = 10000, Reward = 800 },
	{ Id = "earned100k", Name = "Tycoon of the Block", Desc = "Earn $100,000.", Stat = "Earned", Goal = 100000, Reward = 5000 },
	{ Id = "earned1m", Name = "Millionaire Mart", Desc = "Earn $1,000,000.", Stat = "Earned", Goal = 1000000, Reward = 25000 },
	{ Id = "stocked100", Name = "Shelf Stacker", Desc = "Stock 100 items.", Stat = "Stocked", Goal = 100, Reward = 150 },
	{ Id = "stocked2000", Name = "Restock Royalty", Desc = "Stock 2,000 items.", Stat = "Stocked", Goal = 2000, Reward = 3000 },
	{ Id = "fivestar10", Name = "Five Stars!", Desc = "Get 10 five-star reviews.", Stat = "FiveStars", Goal = 10, Reward = 300 },
	{ Id = "fivestar100", Name = "Critically Acclaimed", Desc = "Get 100 five-star reviews.", Stat = "FiveStars", Goal = 100, Reward = 4000 },
	{ Id = "products10", Name = "Collector's Start", Desc = "Discover 10 products.", Stat = "ProductsFound", Goal = 10, Reward = 200 },
	{ Id = "products30", Name = "Well Stocked", Desc = "Discover 30 products.", Stat = "ProductsFound", Goal = 30, Reward = 1500 },
	{ Id = "products50", Name = "Complete Catalog", Desc = "Discover all 50 products.", Stat = "ProductsFound", Goal = 50, Reward = 20000 },
	{ Id = "customers10", Name = "People Person", Desc = "Meet 10 types of customers.", Stat = "CustomersMet", Goal = 10, Reward = 500 },
	{ Id = "customers20", Name = "Everyone's Welcome", Desc = "Meet all 20 types of customers.", Stat = "CustomersMet", Goal = 20, Reward = 8000 },
	{ Id = "clue1", Name = "Something's Odd", Desc = "Find your first mystery clue.", Stat = "Clues", Goal = 1, Reward = 150 },
	{ Id = "mystery1", Name = "Case Closed", Desc = "Solve a mystery.", Stat = "Mysteries", Goal = 1, Reward = 1000 },
	{ Id = "mystery5", Name = "Keeper of Secrets", Desc = "Solve all 5 mysteries.", Stat = "Mysteries", Goal = 5, Reward = 15000 },
	{ Id = "nights10", Name = "Night Owl", Desc = "Keep your store open through 10 nights.", Stat = "Nights", Goal = 10, Reward = 800 },
	{ Id = "expansion4", Name = "Night Market", Desc = "Fully expand your store.", Stat = "Expansion", Goal = 4, Reward = 5000 },
	{ Id = "stars20", Name = "Star Catcher", Desc = "Catch 20 shooting stars.", Stat = "Stars", Goal = 20, Reward = 1500 },
	{ Id = "visits10", Name = "Good Neighbor", Desc = "Visit 10 other players' stores.", Stat = "Visits", Goal = 10, Reward = 1000 },
}
Achievements.ById = {}
for _, a in ipairs(Achievements.List) do
	Achievements.ById[a.Id] = a
end
return Achievements
