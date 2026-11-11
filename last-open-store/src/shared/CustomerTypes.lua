-- 20 customer personalities. 15 everyday types + 5 mysterious ones whose
-- visits feed the mystery system.
--
-- Patience   seconds they'll wait in line (before upgrades)
-- Budget     {min, max} dollars they'll spend
-- Items      {min, max} different products they want
-- Prefers    categories they look for (Collector looks for rarities instead)
-- Flexible   buys something else if their favorites are missing
-- PriceMult  how much extra they pay; TipChance / Tip = tipping habits
-- Spawn      Time ("Any"/"Day"/"Night"), Weather, HourMin/HourMax, RequiresClue
local CustomerTypes = {}
local C = Color3.fromRGB

CustomerTypes.List = {
	{ Id = "neighbor", Name = "Friendly Neighbor", Desc = "Pops in every day for a little of everything.",
		Shirt = C(90, 140, 200), Pants = C(60, 60, 80), Patience = 30, Budget = { 10, 40 }, Items = { 1, 3 },
		Prefers = { "Snacks", "Drinks", "Sweets", "Instant" }, Flexible = true, PriceMult = 1, TipChance = 0.1, Tip = 0.1,
		Spawn = { Time = "Any" }, Weight = 14, Speed = 1,
		Lines = { Enter = { "Evening! Just grabbing a few things.", "Hi again!" }, Happy = { "Thanks, see you tomorrow!", "Always a pleasure." }, Sad = { "Maybe next time...", "Hmm, out of stock." }, Good = { "My favorite little shop.", "Friendly and quick!" }, Bad = { "Took a while today.", "Shelves were a bit empty." } } },
	{ Id = "office", Name = "Office Worker", Desc = "Needs caffeine and a quick lunch, fast.",
		Shirt = C(240, 240, 245), Pants = C(40, 45, 60), Patience = 20, Budget = { 15, 45 }, Items = { 1, 2 },
		Prefers = { "Drinks", "Instant" }, Flexible = false, PriceMult = 1.05, TipChance = 0.05, Tip = 0.1,
		Spawn = { Time = "Day" }, Weight = 10, Speed = 1.15,
		Lines = { Enter = { "Five minutes till my meeting!", "Coffee. Please." }, Happy = { "Lifesaver!", "Back to work..." }, Sad = { "No time for this.", "I'll try the gas station." }, Good = { "Fast service, great coffee.", "Perfect lunch stop." }, Bad = { "Too slow for a lunch break.", "Didn't have what I needed." } } },
	{ Id = "student", Name = "Student", Desc = "Tight budget, big appetite for snacks.",
		Shirt = C(255, 180, 60), Pants = C(70, 90, 140), Patience = 30, Budget = { 6, 18 }, Items = { 1, 3 },
		Prefers = { "Snacks", "Sweets", "Instant" }, Flexible = true, PriceMult = 1, TipChance = 0.03, Tip = 0.05,
		Spawn = { Time = "Any" }, Weight = 10, Speed = 1.05,
		Lines = { Enter = { "Study snacks, go!", "Is there a student discount? Kidding." }, Happy = { "Fuel for the exam!", "Thanks!!" }, Sad = { "Guess it's plain rice tonight.", "Aww." }, Good = { "Cheap snacks, cool vibes.", "Best late-night study stop." }, Bad = { "Waited forever.", "Nothing in my budget." } } },
	{ Id = "commuter", Name = "Impatient Commuter", Desc = "Hates waiting. Tips big if you're quick.",
		Shirt = C(120, 120, 130), Pants = C(30, 30, 35), Patience = 12, Budget = { 10, 35 }, Items = { 1, 2 },
		Prefers = { "Drinks", "Snacks" }, Flexible = true, PriceMult = 1, TipChance = 0.5, Tip = 0.3, FastTipOnly = true,
		Spawn = { Time = "Any" }, Weight = 8, Speed = 1.3,
		Lines = { Enter = { "My train leaves in three minutes!", "Quick quick quick." }, Happy = { "Made it! Keep the change.", "Speedy, love it." }, Sad = { "Forget it, I'm late!", "Too slow!" }, Good = { "In and out in seconds!", "Fastest store in town." }, Bad = { "Missed my train.", "Way too slow." } } },
	{ Id = "nightowl", Name = "Night Owl", Desc = "Only comes out after dark. Loves ramen and cold drinks.",
		Shirt = C(60, 50, 110), Pants = C(30, 30, 50), Patience = 35, Budget = { 15, 50 }, Items = { 1, 3 },
		Prefers = { "Instant", "Drinks" }, Flexible = true, PriceMult = 1.1, TipChance = 0.15, Tip = 0.15,
		Spawn = { Time = "Night" }, Weight = 12, Speed = 0.95,
		Lines = { Enter = { "Glad someone's still open.", "The night's just getting started." }, Happy = { "You're a legend.", "See you at 3 AM." }, Sad = { "Even the last open store is empty...", "Hm." }, Good = { "The only light on this street.", "Perfect midnight ramen." }, Bad = { "Lonely shelves tonight.", "Slow queue." } } },
	{ Id = "collector", Name = "Collector", Desc = "Hunts rare products and pays double for them.",
		Shirt = C(110, 80, 60), Pants = C(60, 50, 40), Patience = 40, Budget = { 40, 160 }, Items = { 1, 2 },
		Prefers = {}, Rarities = { "Rare", "Legendary", "Secret" }, Flexible = false, PriceMult = 2, TipChance = 0.2, Tip = 0.2,
		Spawn = { Time = "Any" }, Weight = 4, Speed = 0.9,
		Lines = { Enter = { "Any rare finds today?", "I heard rumors about this shop." }, Happy = { "A fine addition to my collection!", "Exquisite." }, Sad = { "Nothing rare... pity.", "Only common goods." }, Good = { "A treasure trove!", "Rare goods, fair prices." }, Bad = { "Nothing worth collecting.", "Disappointing selection." } } },
	{ Id = "healthnut", Name = "Health Nut", Desc = "Water, tea and nothing with sprinkles.",
		Shirt = C(120, 220, 120), Pants = C(240, 240, 240), Patience = 28, Budget = { 8, 30 }, Items = { 1, 2 },
		Prefers = { "Drinks" }, Flexible = false, PriceMult = 1, TipChance = 0.1, Tip = 0.1,
		Spawn = { Time = "Day" }, Weight = 7, Speed = 1.2,
		Lines = { Enter = { "Just finished my run!", "Hydration time." }, Happy = { "Refreshing!", "Stay healthy!" }, Sad = { "No water?!", "Guess I'll drink from the fountain." }, Good = { "Great cold drinks.", "Clean and bright!" }, Bad = { "Coolers were empty.", "Slow line." } } },
	{ Id = "sweettooth", Name = "Sweet Tooth", Desc = "Can't resist candy and pudding.",
		Shirt = C(255, 150, 200), Pants = C(150, 100, 200), Patience = 30, Budget = { 10, 40 }, Items = { 1, 3 },
		Prefers = { "Sweets" }, Flexible = false, PriceMult = 1.05, TipChance = 0.1, Tip = 0.1,
		Spawn = { Time = "Any" }, Weight = 8, Speed = 1,
		Lines = { Enter = { "Something sweet, please!", "I can smell the chocolate." }, Happy = { "Sugar rush incoming!", "Yummy!" }, Sad = { "No sweets? Tragic.", "My sweet tooth is sad." }, Good = { "Candy heaven!", "So many sweets!" }, Bad = { "Sweets sold out.", "Long wait for a candy bar." } } },
	{ Id = "grandma", Name = "Grandma Hana", Desc = "Slow, kind and very patient. Always tips.",
		Shirt = C(200, 160, 200), Pants = C(120, 90, 120), Patience = 60, Budget = { 10, 35 }, Items = { 1, 2 },
		Prefers = { "Sweets", "Instant", "Household" }, Flexible = true, PriceMult = 1, TipChance = 0.8, Tip = 0.25,
		Spawn = { Time = "Day" }, Weight = 6, Speed = 0.7,
		Lines = { Enter = { "Hello dear!", "My, how this place has grown." }, Happy = { "Here's a little something extra, dear.", "You remind me of my grandson." }, Sad = { "Oh well, I'll come back tomorrow.", "Never mind, dear." }, Good = { "Such a polite young shopkeeper!", "Lovely little shop." }, Bad = { "My legs got tired waiting.", "Couldn't find my mochi." } } },
	{ Id = "critic", Name = "Store Critic", Desc = "Always writes a review. Very hard to impress.",
		Shirt = C(30, 30, 30), Pants = C(30, 30, 30), Patience = 22, Budget = { 20, 60 }, Items = { 2, 3 },
		Prefers = { "Snacks", "Drinks", "Instant", "Sweets", "Household" }, Flexible = false, PriceMult = 1.1, TipChance = 0, Tip = 0, Strict = true, AlwaysReview = true,
		Spawn = { Time = "Any" }, Weight = 4, Speed = 1,
		Lines = { Enter = { "Hmm. Let's see what we have here.", "*takes notes*" }, Happy = { "Adequate. Quite adequate.", "I'll be writing about this." }, Sad = { "Disappointing.", "Noted." }, Good = { "A hidden gem. Five stars.", "Impeccable service." }, Bad = { "Mediocre at best.", "The shelves tell a sad story." } } },
	{ Id = "gamer", Name = "Gamer", Desc = "Late-night energy drinks and chips.",
		Shirt = C(40, 200, 120), Pants = C(30, 30, 40), Patience = 25, Budget = { 10, 40 }, Items = { 1, 3 },
		Prefers = { "Drinks", "Snacks" }, Flexible = true, PriceMult = 1, TipChance = 0.1, Tip = 0.1,
		Spawn = { Time = "Night" }, Weight = 8, Speed = 1.1,
		Lines = { Enter = { "Gotta restock before the raid.", "BRB, buying snacks." }, Happy = { "GG, thanks!", "Back to the game!" }, Sad = { "No energy drinks? Lag.", "Rage quitting this store." }, Good = { "10/10 snack loadout.", "Speedrun-tier checkout." }, Bad = { "Massive lag at checkout.", "Out of my drink." } } },
	{ Id = "rider", Name = "Delivery Rider", Desc = "Grabs instant food between deliveries.",
		Shirt = C(255, 200, 40), Pants = C(40, 40, 40), Patience = 15, Budget = { 10, 35 }, Items = { 1, 2 },
		Prefers = { "Instant", "Drinks" }, Flexible = true, PriceMult = 1, TipChance = 0.2, Tip = 0.15,
		Spawn = { Time = "Any" }, Weight = 7, Speed = 1.35,
		Lines = { Enter = { "Quick stop between orders!", "Engine's still running!" }, Happy = { "Five stars for you!", "Back on the road!" }, Sad = { "No time to wait.", "Gotta go!" }, Good = { "My favorite pit stop.", "Super quick." }, Bad = { "Too slow, late delivery.", "Nothing hot to eat." } } },
	{ Id = "wanderer", Name = "Rainy Day Wanderer", Desc = "Only appears in the rain. Needs an umbrella and cocoa.",
		Shirt = C(60, 120, 160), Pants = C(50, 60, 80), Patience = 40, Budget = { 15, 60 }, Items = { 1, 2 },
		Prefers = { "Household", "Instant" }, Flexible = true, PriceMult = 1.2, TipChance = 0.25, Tip = 0.2,
		Spawn = { Time = "Any", Weather = "Rain" }, Weight = 8, Speed = 0.9,
		Lines = { Enter = { "Phew, finally somewhere dry.", "It's pouring out there!" }, Happy = { "You saved my evening.", "Warm and dry, thanks!" }, Sad = { "No umbrellas...?", "Back into the rain." }, Good = { "A cozy shelter from the storm.", "Warm cocoa on a rainy night!" }, Bad = { "Stood dripping in line.", "Nothing for the rain." } } },
	{ Id = "kid", Name = "Kid with Allowance", Desc = "Counting coins for the perfect candy.",
		Shirt = C(255, 90, 90), Pants = C(80, 120, 220), Patience = 25, Budget = { 3, 12 }, Items = { 1, 2 },
		Prefers = { "Sweets", "Snacks" }, Flexible = true, PriceMult = 1, TipChance = 0.05, Tip = 0.05,
		Spawn = { Time = "Day" }, Weight = 6, Speed = 1.2, Scale = 0.8,
		Lines = { Enter = { "I have exactly five dollars!", "Candy candy candy!" }, Happy = { "Yay! Thank you!", "Best day ever!" }, Sad = { "Aww...", "Mom said no anyway." }, Good = { "THE BEST CANDY STORE", "So much candy!!" }, Bad = { "No gummy worms :(", "Waited sooo long." } } },
	{ Id = "tourist", Name = "Tourist", Desc = "Buys random souvenirs and always takes a photo.",
		Shirt = C(255, 120, 180), Pants = C(230, 210, 170), Patience = 35, Budget = { 20, 80 }, Items = { 2, 3 },
		Prefers = { "Snacks", "Drinks", "Sweets", "Household" }, Flexible = true, PriceMult = 1.15, TipChance = 0.2, Tip = 0.15, AlwaysReview = true,
		Spawn = { Time = "Any" }, Weight = 6, Speed = 0.95,
		Lines = { Enter = { "Ooh, a local shop! *click*", "Is this the famous last open store?" }, Happy = { "Souvenirs for everyone!", "Perfect for my travel blog." }, Sad = { "Nothing local to bring home.", "Hmm, oh well." }, Good = { "A must-visit spot in town!", "So charming! *photo*" }, Bad = { "Not worth the detour.", "Long line, tired feet." } } },

	-- Mysterious customers (each tied to a mystery)
	{ Id = "courier", Name = "The Midnight Courier", Desc = "Delivers letters on rainy nights. To which address?",
		Shirt = C(40, 50, 80), Pants = C(30, 30, 40), Patience = 45, Budget = { 20, 80 }, Items = { 1, 2 },
		Prefers = { "Household", "Drinks" }, Flexible = true, PriceMult = 1.3, TipChance = 0.5, Tip = 0.3,
		Spawn = { Time = "Night", Weather = "Rain" }, Mystery = "letters", Speed = 0.9,
		Lines = { Enter = { "Have you seen Willow Lane number zero? I have letters for it." }, Happy = { "The letters must arrive before sunrise." }, Sad = { "I'll keep searching for the address." }, Good = { "A warm light on a wet night." }, Bad = { "I had to wait. The letters must not wait." } } },
	{ Id = "fisherman", Name = "Old Fisherman", Desc = "Hums a strange tune he heard at the pier.",
		Shirt = C(200, 170, 60), Pants = C(60, 70, 90), Patience = 50, Budget = { 15, 50 }, Items = { 1, 2 },
		Prefers = { "Instant", "Drinks" }, Flexible = true, PriceMult = 1.2, TipChance = 0.4, Tip = 0.2,
		Spawn = { Time = "Night" }, Mystery = "lighthouse", Speed = 0.8,
		Lines = { Enter = { "Hmm-hm-hmm... that tune from the lighthouse won't leave my head." }, Happy = { "Listen near the pier at night. You'll hear it too." }, Sad = { "Nothing for an old sailor tonight." }, Good = { "Reminds me of the old days." }, Bad = { "The tide moves faster than this line." } } },
	{ Id = "buttons", Name = "Mr. Buttons (a cat?)", Desc = "A very polite cat who pays in shiny buttons.",
		Shirt = C(240, 160, 60), Pants = C(240, 160, 60), Patience = 40, Budget = { 10, 30 }, Items = { 1, 1 },
		Prefers = { "Sweets", "Snacks" }, Flexible = true, PriceMult = 1.1, TipChance = 0.6, Tip = 0.2,
		Spawn = { Time = "Night" }, Mystery = "buttons", Speed = 1.1, Scale = 0.55,
		Lines = { Enter = { "Mrrp. *places a shiny button on the counter*" }, Happy = { "Mrow! *leaves another button, then trots toward the tailor's shop*" }, Sad = { "Mrrp... *flicks tail*" }, Good = { "*purrs approvingly*" }, Bad = { "*hisses at the long line*" } } },
	{ Id = "clockmaker", Name = "The Clockmaker", Desc = "Appears only around 11 PM. Always checks the time.",
		Shirt = C(120, 90, 50), Pants = C(70, 50, 30), Patience = 45, Budget = { 20, 70 }, Items = { 1, 2 },
		Prefers = { "Sweets", "Household" }, Flexible = true, PriceMult = 1.25, TipChance = 0.5, Tip = 0.25,
		Spawn = { Time = "Night", HourMin = 22.5, HourMax = 24 }, Mystery = "clock", Speed = 0.9,
		Lines = { Enter = { "The town clock is stuck at 11:11 again. Tick, tock." }, Happy = { "Every gear needs a little sweetness to turn." }, Sad = { "Time waits for no one. Neither do I." }, Good = { "Punctual service. Rare these days." }, Bad = { "I counted every second in that line." } } },
	{ Id = "grandkid", Name = "The Founder's Grandkid", Desc = "Searching for the story of the town's very first store.",
		Shirt = C(255, 150, 90), Pants = C(80, 60, 50), Patience = 50, Budget = { 20, 90 }, Items = { 1, 2 },
		Prefers = { "Drinks", "Sweets" }, Flexible = true, PriceMult = 1.3, TipChance = 0.6, Tip = 0.3,
		Spawn = { Time = "Night", RequiresClue = "f2" }, Mystery = "founder", Speed = 1,
		Lines = { Enter = { "My grandparent ran the first store here, before it closed. Did you know?" }, Happy = { "There was a photo of the opening night, somewhere in the empty lot..." }, Sad = { "Maybe another night." }, Good = { "This place feels just like the old stories." }, Bad = { "I hoped it would feel more welcoming." } } },
}

CustomerTypes.ById = {}
for _, t in ipairs(CustomerTypes.List) do
	CustomerTypes.ById[t.Id] = t
end

-- Hint shown in the journal before you've met a customer type
function CustomerTypes.Hint(t)
	local s = t.Spawn
	if s.RequiresClue then
		return "Appears once a certain story begins..."
	elseif s.HourMin then
		return "Only appears late at night, around 11 PM."
	elseif s.Weather then
		return s.Time == "Night" and "Only on rainy nights." or "Only when it rains."
	elseif s.Time == "Night" then
		return "Only comes out at night."
	elseif s.Time == "Day" then
		return "Only visits during the day."
	end
	return "Visits any time."
end

return CustomerTypes
