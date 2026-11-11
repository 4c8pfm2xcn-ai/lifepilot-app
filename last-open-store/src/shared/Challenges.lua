-- Daily challenge pool. Each UTC day every player gets 3, picked with a
-- per-player seed. Keys are progress events fired by the server.
local Challenges = {}
Challenges.List = {
	{ Id = "serve15", Desc = "Serve 15 customers", Key = "Served", Goal = 15, Reward = 300 },
	{ Id = "serve40", Desc = "Serve 40 customers", Key = "Served", Goal = 40, Reward = 800 },
	{ Id = "snacks10", Desc = "Sell 10 snacks", Key = "Sold_Snacks", Goal = 10, Reward = 250 },
	{ Id = "drinks12", Desc = "Sell 12 drinks", Key = "Sold_Drinks", Goal = 12, Reward = 250 },
	{ Id = "sweets10", Desc = "Sell 10 sweets", Key = "Sold_Sweets", Goal = 10, Reward = 250 },
	{ Id = "instant8", Desc = "Sell 8 instant foods", Key = "Sold_Instant", Goal = 8, Reward = 300 },
	{ Id = "earn1500", Desc = "Earn $1,500 in sales", Key = "Earned", Goal = 1500, Reward = 400 },
	{ Id = "stock60", Desc = "Stock 60 items on shelves", Key = "Stocked", Goal = 60, Reward = 300 },
	{ Id = "fivestar3", Desc = "Get 3 five-star reviews", Key = "FiveStars", Goal = 3, Reward = 350 },
	{ Id = "night20", Desc = "Make 20 sales at night", Key = "NightSales", Goal = 20, Reward = 400 },
	{ Id = "visit1", Desc = "Visit another player's store", Key = "Visits", Goal = 1, Reward = 200 },
	{ Id = "fast5", Desc = "Ring up 5 customers within 4 seconds", Key = "FastCheckout", Goal = 5, Reward = 350 },
}
Challenges.ById = {}
for _, c in ipairs(Challenges.List) do
	Challenges.ById[c.Id] = c
end
return Challenges
