-- The five town mysteries (server-only, so clients can't read ahead).
-- Clue types:
--   Serve   serve a customer type (optionally while they buy Product)
--   Object  interact with a hidden object in town (MysteryObjects)
--   Zone    stand in a town location (optionally at night / within hours)
--   Pattern serve a customer type on N different nights
-- Requires   clue ids that must be found first
-- NewDay     must be found on a later (UTC) day than the required clues,
--            so a mystery spans several sessions
-- UnlockProduct  unlocks a secret product to order
local Mysteries = {}

Mysteries.List = {
	{
		Id = "letters", Name = "Letters to Nowhere", Reward = 2000,
		RewardText = "Unlocked the Old Post Office theme.",
		Clues = {
			{ Id = "l1", Type = "Serve", Customer = "courier", Hint = "Someone delivers letters on rainy nights...",
				Text = "The Midnight Courier is looking for \"Willow Lane, number zero\". But Willow Lane starts at number one." },
			{ Id = "l2", Type = "Object", Object = "lostLetter", Requires = { "l1" }, Hint = "Maybe the courier dropped something in an alley behind the stores. Look at night.",
				Text = "A damp envelope in the alley: \"To whoever keeps the last light on. Under the oak at the end of the lane.\"" },
			{ Id = "l3", Type = "Zone", Zone = "willowEnd", Night = true, Requires = { "l2" }, Hint = "Visit the far end of Willow Lane at night.",
				Text = "At the end of Willow Lane stands an old oak with a rusty mailbox nailed to it. Its flag is up." },
			{ Id = "l4", Type = "Object", Object = "oakMailbox", Requires = { "l3" }, NewDay = true, UnlockProduct = "stamp",
				Hint = "The mailbox is jammed tonight. Try again tomorrow.",
				Text = "Inside the mailbox: a sheet of vintage stamps and a note: \"Sell these to the courier so the letters can finally go home.\" (Vintage Stamp unlocked!)" },
			{ Id = "l5", Type = "Serve", Customer = "courier", Product = "stamp", Requires = { "l4" }, Hint = "Stock Vintage Stamps and sell one to the Midnight Courier.",
				Text = "The courier smiles: the letters were the founder's thank-you notes to the town, delayed for fifty years. Now they're delivered." },
		},
	},
	{
		Id = "lighthouse", Name = "The Lighthouse Hum", Reward = 2500,
		RewardText = "Unlocked the Fish Tank decoration.",
		Clues = {
			{ Id = "h1", Type = "Serve", Customer = "fisherman", Hint = "An old fisherman shops here at night.",
				Text = "The Old Fisherman keeps humming a tune he hears near the pier at night." },
			{ Id = "h2", Type = "Zone", Zone = "pierEnd", Night = true, Requires = { "h1" }, Hint = "Walk to the end of the pier at night and listen.",
				Text = "At the end of the pier you hear it too: a soft music-box melody drifting from the lighthouse." },
			{ Id = "h3", Type = "Object", Object = "musicBox", Requires = { "h2" }, UnlockProduct = "lemonade", Hint = "Something on the lighthouse steps glows at night.",
				Text = "A tiny music box on the lighthouse steps, with a lemonade recipe tucked inside. (Lighthouse Lemonade unlocked!)" },
			{ Id = "h4", Type = "Pattern", Customer = "fisherman", Nights = 3, Requires = { "h3" }, Hint = "Serve the Old Fisherman on 3 different nights.",
				Text = "Night after night, the fisherman hums a little more of the song. It's a lullaby the lighthouse keeper played for passing ships." },
			{ Id = "h5", Type = "Serve", Customer = "fisherman", Product = "lemonade", Requires = { "h4" }, Hint = "Sell Lighthouse Lemonade to the Old Fisherman.",
				Text = "One sip and he remembers: he WAS the lighthouse keeper's apprentice. He promises to wind the music box every night." },
		},
	},
	{
		Id = "buttons", Name = "The Cat Who Pays in Buttons", Reward = 1500,
		RewardText = "Unlocked the Tailor's Vest uniform.",
		Clues = {
			{ Id = "b1", Type = "Serve", Customer = "buttons", Hint = "A very small, very fluffy customer visits at night.",
				Text = "Mr. Buttons paid with a shiny brass button, then trotted toward the tailor's shop. Where does a cat get buttons?" },
			{ Id = "b2", Type = "Object", Object = "buttonPark", Requires = { "b1" }, Hint = "Cats love park benches.",
				Text = "A brass button under the park bench, engraved with a tiny needle and thread." },
			{ Id = "b3", Type = "Object", Object = "buttonTailor", Requires = { "b1" }, Hint = "Check the tailor's window ledge.",
				Text = "Another button on the tailor's window ledge. Same engraving." },
			{ Id = "b4", Type = "Object", Object = "buttonGas", Requires = { "b1" }, NewDay = true, Hint = "One more button... somewhere near the gas station's ice machine. (Look on a new day.)",
				Text = "The third button, hidden behind the ice machine. It's warm, as if someone was just holding it." },
			{ Id = "b5", Type = "Zone", Zone = "tailorDoor", Requires = { "b2", "b3", "b4" }, UnlockProduct = "buttoncookie", Hint = "Bring the three buttons to the tailor's door.",
				Text = "The retired tailor laughs: Mr. Buttons has been 'paying' for treats with her button jar for years. She gives you her cookie recipe. (Button Cookies unlocked!)" },
		},
	},
	{
		Id = "clock", Name = "The Stopped Clock", Reward = 3000,
		RewardText = "Unlocked the Clockwork theme.",
		Clues = {
			{ Id = "c1", Type = "Object", Object = "clockPlaque", Hint = "Read the plaque on the town clock tower.",
				Text = "The plaque reads: \"This clock will run as long as the town's last store stays open.\" The hands are stuck at 11:11." },
			{ Id = "c2", Type = "Serve", Customer = "clockmaker", Requires = { "c1" }, Hint = "Someone shops only around 11 PM.",
				Text = "The Clockmaker says one gear went missing from the tower years ago. \"Gears roll downhill... into alleys.\"" },
			{ Id = "c3", Type = "Object", Object = "gearAlley", Requires = { "c2" }, UnlockProduct = "toffee", Hint = "Search the west alley at night.",
				Text = "A small brass gear glinting in the west alley, wrapped in an old toffee wrapper with a recipe. (Clockwork Toffee unlocked!)" },
			{ Id = "c4", Type = "Serve", Customer = "clockmaker", Product = "toffee", Requires = { "c3" }, NewDay = true, Hint = "On another day, sell Clockwork Toffee to the Clockmaker.",
				Text = "The Clockmaker accepts the toffee and the gear. \"Meet me at the tower at eleven.\"" },
			{ Id = "c5", Type = "Zone", Zone = "clockTower", Night = true, HourMin = 22.5, HourMax = 24, Requires = { "c4" }, Hint = "Be at the clock tower between 10:30 PM and midnight.",
				Text = "With a click the hands start moving again. 11:12. The whole town seems to breathe out." },
		},
	},
	{
		Id = "founder", Name = "The Store That Was Here Before", Reward = 10000, RequiresSolved = 1,
		RewardText = "Unlocked the Founder's Portrait and the title \"Keeper of the Last Light\".",
		Clues = {
			{ Id = "f1", Type = "Object", Object = "oldReceipt", RequiresSolved = 1, Hint = "Solve any other mystery first, then look inside the boarded-up First Light Mart.",
				Text = "A faded receipt from the First Light Mart, dated opening night. On the back: \"Keep one light on, always.\"" },
			{ Id = "f2", Type = "Object", Object = "messageNote", Requires = { "f1" }, Hint = "A note will appear on your counter one night. Read it.",
				Text = "The note on your counter: \"Thank you for keeping the light on. My grandchild is coming to find you.\"" },
			{ Id = "f3", Type = "Serve", Customer = "grandkid", Requires = { "f2" }, Hint = "Someone special will visit your store at night.",
				Text = "The Founder's Grandkid says there was a photo from opening night, lost somewhere in the empty lot by the gas station." },
			{ Id = "f4", Type = "Object", Object = "founderPhoto", Requires = { "f3" }, NewDay = true, UnlockProduct = "foundersoda", Hint = "Search the empty lot at night (on another day).",
				Text = "The photo: the founder behind a tiny counter, holding a bottle of their homemade soda. The recipe is on the back. (Founder's Soda unlocked!)" },
			{ Id = "f5", Type = "Serve", Customer = "grandkid", Product = "foundersoda", Requires = { "f4" }, Hint = "Sell Founder's Soda to the Founder's Grandkid.",
				Text = "They taste it and laugh through happy tears: \"It's exactly like the stories. The last open store is in good hands.\"" },
		},
	},
}

-- Hidden objects placed by WorldBuilder. Night = only visible after dark.
-- Flavor = what you see before you know what you're looking for.
Mysteries.Objects = {
	lostLetter = { Night = true, Flavor = "A soggy envelope. The address is smudged." },
	oakMailbox = { Night = false, Flavor = "An old mailbox nailed to the oak. It's rusted shut." },
	musicBox = { Night = true, Flavor = "A tiny wooden box. It's quiet... for now." },
	buttonPark = { Night = false, Flavor = "Something shiny under the bench. Just a button." },
	buttonTailor = { Night = false, Flavor = "A button on the window ledge." },
	buttonGas = { Night = false, Flavor = "There's something behind the ice machine, but you can't reach it." },
	clockPlaque = { Night = false, Flavor = "" },
	gearAlley = { Night = true, Flavor = "A bit of brass in the gutter." },
	oldReceipt = { Night = false, Flavor = "Dusty shelves, a dark counter. The First Light Mart closed long ago." },
	founderPhoto = { Night = true, Flavor = "Tall grass and an old fence. Nothing else." },
	messageNote = { Night = false, Flavor = "A blank folded note." },
}

Mysteries.ById = {}
Mysteries.ClueById = {}
for _, m in ipairs(Mysteries.List) do
	Mysteries.ById[m.Id] = m
	for _, clue in ipairs(m.Clues) do
		clue.Mystery = m.Id
		Mysteries.ClueById[clue.Id] = clue
	end
end

return Mysteries
