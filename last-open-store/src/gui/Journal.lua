-- The collection book: mysteries, products, customers, events, achievements.
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage:WaitForChild("Shared")
local Products = require(Shared:WaitForChild("Products"))
local CustomerTypes = require(Shared:WaitForChild("CustomerTypes"))
local Events = require(Shared:WaitForChild("Events"))
local Achievements = require(Shared:WaitForChild("Achievements"))
local Util = require(Shared:WaitForChild("Util"))

local Journal = {}

function Journal.Build(Kit, State)
	local C = Kit.Colors
	local new = Kit.new
	local panel = Kit.Panel("Journal", "MYSTERY JOURNAL", 760, 540)
	local list = Kit.Scroll(panel.Body, UDim2.new(1, 0, 1, -48), UDim2.new(0, 0, 0, 48))
	local tab = "Mysteries"

	local function header(text, sub, order)
		local card = Kit.Card(list, order or 0)
		Kit.Text({ Parent = card, Text = text, Font = Kit.Fonts.Display, TextSize = 18, TextColor3 = C.Amber, Size = UDim2.new(1, 0, 0, 0), AutoY = true })
		if sub then
			Kit.Text({ Parent = card, Text = sub, TextSize = 14, TextColor3 = C.Muted, Position = UDim2.new(0, 0, 0, 26), Size = UDim2.new(1, 0, 0, 0), AutoY = true })
			new("Frame", { Parent = card, Size = UDim2.new(0, 0, 0, 44), BackgroundTransparency = 1 })
		end
	end

	local function grid(order, cellHeight)
		local frame = new("Frame", { Parent = list, LayoutOrder = order, Size = UDim2.new(1, 0, 0, 0), AutomaticSize = Enum.AutomaticSize.Y, BackgroundTransparency = 1 })
		new("UIGridLayout", { Parent = frame, CellSize = UDim2.new(0.5, -6, 0, cellHeight), CellPadding = UDim2.new(0, 8, 0, 8), SortOrder = Enum.SortOrder.LayoutOrder })
		return frame
	end

	local function tile(parent, order, title, titleColor, sub, swatch)
		local card = new("Frame", { Parent = parent, LayoutOrder = order, BackgroundColor3 = C.Card }, { Kit.Corner(10), Kit.Pad(8), Kit.Stroke(C.Stroke, 0.75) })
		local x = 0
		if swatch then
			new("Frame", { Parent = card, Size = UDim2.new(0, 28, 0, 28), BackgroundColor3 = swatch }, { Kit.Corner(6) })
			x = 36
		end
		Kit.Text({ Parent = card, Text = title, Font = Kit.Fonts.Bold, TextSize = 15, TextColor3 = titleColor, Position = UDim2.new(0, x, 0, 0), Size = UDim2.new(1, -x, 0, 18), TextWrapped = false, TextTruncate = Enum.TextTruncate.AtEnd })
		Kit.Text({ Parent = card, Text = sub, TextSize = 12, TextColor3 = C.Muted, Position = UDim2.new(0, x, 0, 20), Size = UDim2.new(1, -x, 1, -20) })
		return card
	end

	local function line(order, swatch, title, titleColor, sub)
		local card = Kit.Card(list, order)
		new("Frame", { Parent = card, Size = UDim2.new(0, 32, 0, 32), BackgroundColor3 = swatch }, { Kit.Corner(8) })
		Kit.Text({ Parent = card, Text = title, Font = Kit.Fonts.Bold, TextSize = 16, TextColor3 = titleColor, Position = UDim2.new(0, 44, 0, 0), Size = UDim2.new(1, -44, 0, 20) })
		Kit.Text({ Parent = card, Text = sub, TextSize = 13, TextColor3 = C.Muted, Position = UDim2.new(0, 44, 0, 22), Size = UDim2.new(1, -44, 0, 0), AutoY = true })
		new("Frame", { Parent = card, Size = UDim2.new(0, 0, 0, 40), BackgroundTransparency = 1 })
	end

	local function num(n)
		return Util.Money(n):sub(2)
	end

	local function render()
		local data = State.Data
		if not data then
			return
		end
		Kit.Clear(list)
		if tab == "Mysteries" then
			local solved = 0
			for _, m in ipairs(data.Journal) do
				if m.Solved then
					solved = solved + 1
				end
			end
			header(("Mysteries solved: %d / %d"):format(solved, #data.Journal), "Clues come from customer chats, odd objects around town (some only at night), places at special times, and patterns over many nights. Some take several days.", 0)
			for i, m in ipairs(data.Journal) do
				local card = Kit.Card(list, i)
				Kit.List(nil, 6).Parent = card
				local status = m.Solved and "  ✓ SOLVED" or ("  %d/%d clues"):format(m.Found, m.Total)
				Kit.Text({ Parent = card, LayoutOrder = 0, Text = m.Name .. status, Font = Kit.Fonts.Display, TextSize = 18, TextColor3 = m.Solved and C.Good or (m.Found > 0 and C.Teal or C.Text), Size = UDim2.new(1, 0, 0, 0), AutoY = true })
				if m.Locked then
					Kit.Text({ Parent = card, LayoutOrder = 1, Text = "🔒 " .. m.Locked, TextSize = 14, TextColor3 = C.Muted, Size = UDim2.new(1, 0, 0, 0), AutoY = true })
				else
					for j, clue in ipairs(m.Clues) do
						local text, color
						if clue.Found then
							text, color = "✓  " .. clue.Text, C.Text
						elseif clue.Hint then
							text, color = "→  Next lead: " .. clue.Hint, C.Teal
						else
							text, color = "•  ???", C.Locked
						end
						Kit.Text({ Parent = card, LayoutOrder = j, Text = text, TextSize = 14, TextColor3 = color, Size = UDim2.new(1, 0, 0, 0), AutoY = true })
					end
				end
				if m.Reward then
					Kit.Text({ Parent = card, LayoutOrder = 99, Text = "Reward: " .. m.Reward, TextSize = 14, Font = Kit.Fonts.Bold, TextColor3 = C.Amber, Size = UDim2.new(1, 0, 0, 0), AutoY = true })
				end
			end
		elseif tab == "Products" then
			local found = Util.Count(data.Products)
			header(("Products discovered: %d / %d"):format(found, #Products.List), "Order a product for the first time to add it here. Rare ones only appear during special nights, rain, or mysteries.", 0)
			local g = grid(1, 58)
			for _, p in ipairs(Products.List) do
				local sold = data.Products[p.Id]
				if sold ~= nil then
					tile(g, p.Order, p.Name, Products.RarityColors[p.Rarity], ("%s · %s · sold %d"):format(p.Rarity, p.Category, sold), p.Color)
				else
					tile(g, p.Order, "???", C.Locked, p.Rarity == "Secret" and "Secret product" or (p.Event and "Appears on a special night" or (p.Weather and "Appears in the rain" or ("Unlocks at level " .. p.Level))), Color3.fromRGB(45, 48, 65))
				end
			end
		elseif tab == "Customers" then
			header(("Customers met: %d / %d"):format(Util.Count(data.Customers), #CustomerTypes.List), "Serve someone to learn who they are. Some only appear at night, in the rain, or when a story begins.", 0)
			local g = grid(1, 74)
			for i, t in ipairs(CustomerTypes.List) do
				local served = data.Customers[t.Id]
				if served then
					tile(g, i, t.Name .. (t.Mystery and "  ✦" or ""), t.Mystery and C.Purple or C.Text, ("%s  Served %d."):format(t.Desc, served), t.Shirt)
				else
					tile(g, i, "???", C.Locked, CustomerTypes.Hint(t), Color3.fromRGB(45, 48, 65))
				end
			end
		elseif tab == "Events" then
			header(("Night events seen: %d / %d"):format(Util.Count(data.EventsSeen), #Events.Night), "A random event may roll every night for the whole server.", 0)
			for i, e in ipairs(Events.Night) do
				if data.EventsSeen[e.Id] then
					local desc = (e.Desc:gsub("%%s", "a random category"))
					line(i, e.Color, e.Name, e.Color, desc)
				else
					line(i, Color3.fromRGB(45, 48, 65), "??? Unknown event", C.Locked, "Keep your store open at night to witness it.")
				end
			end
		elseif tab == "Achievements" then
			local got = Util.Count(data.Achievements)
			header(("Achievements: %d / %d"):format(got, #Achievements.List), nil, 0)
			for i, a in ipairs(Achievements.List) do
				local card = Kit.Card(list, i)
				local value = data.StatValues[a.Stat] or 0
				local done = data.Achievements[a.Id] ~= nil
				Kit.Text({ Parent = card, Text = (done and "✓ " or "") .. a.Name, Font = Kit.Fonts.Bold, TextSize = 16, TextColor3 = done and C.Good or C.Text, Size = UDim2.new(1, -120, 0, 20) })
				Kit.Text({ Parent = card, Text = Util.Money(a.Reward), Font = Kit.Fonts.Bold, TextSize = 15, TextColor3 = C.Amber, Position = UDim2.new(1, -110, 0, 0), Size = UDim2.new(0, 110, 0, 20), TextXAlignment = Enum.TextXAlignment.Right })
				Kit.Text({ Parent = card, Text = a.Desc, TextSize = 13, TextColor3 = C.Muted, Position = UDim2.new(0, 0, 0, 22), Size = UDim2.new(1, 0, 0, 18) })
				local bar = Kit.Bar(card, value / a.Goal, done and C.Good or C.Amber, 8)
				bar.Position = UDim2.new(0, 0, 0, 46)
				bar.Size = UDim2.new(1, -110, 0, 8)
				Kit.Text({ Parent = card, Text = ("%s / %s"):format(num(math.min(value, a.Goal)), num(a.Goal)), TextSize = 12, TextColor3 = C.Muted, Position = UDim2.new(1, -100, 0, 40), Size = UDim2.new(0, 100, 0, 18), TextXAlignment = Enum.TextXAlignment.Right })
				new("Frame", { Parent = card, Size = UDim2.new(0, 0, 0, 58), BackgroundTransparency = 1 })
			end
		end
	end

	local tabs = Kit.Tabs(panel.Body, {
		{ "Mysteries", "Mysteries" }, { "Products", "Products" }, { "Customers", "Customers" },
		{ "Events", "Night Events" }, { "Achievements", "Achievements" },
	}, function(id)
		tab = id
		render()
	end)
	panel.OnOpen = function()
		tabs.Select(tab)
	end

	local queued = false
	State.On(function()
		if Kit.IsOpen("Journal") and not queued then
			queued = true
			task.delay(1, function()
				queued = false
				if Kit.IsOpen("Journal") then
					render()
				end
			end)
		end
	end)
end

return Journal
