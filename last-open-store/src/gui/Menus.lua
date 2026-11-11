-- Order Stock, Backroom inventory and Upgrades panels.
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage:WaitForChild("Shared")
local Products = require(Shared:WaitForChild("Products"))
local Upgrades = require(Shared:WaitForChild("Upgrades"))
local Util = require(Shared:WaitForChild("Util"))
local WorldState = ReplicatedStorage:WaitForChild("WorldState")

local Menus = {}

function Menus.Build(Kit, State)
	local C = Kit.Colors
	local new = Kit.new

	-- A list row: color swatch, title, subtitle, action button
	local function row(parent, order, swatch, title, titleColor, subtitle, buttonText, buttonStyle, onClick)
		local card = Kit.Card(parent, order)
		if swatch then
			new("Frame", { Parent = card, Size = UDim2.new(0, 36, 0, 36), BackgroundColor3 = swatch }, { Kit.Corner(8) })
		end
		local x = swatch and 48 or 0
		Kit.Text({ Parent = card, Text = title, Font = Kit.Fonts.Bold, TextSize = 17, TextColor3 = titleColor or C.Text, Position = UDim2.new(0, x, 0, 0), Size = UDim2.new(1, -x - 170, 0, 20), TextWrapped = false, TextTruncate = Enum.TextTruncate.AtEnd })
		Kit.Text({ Parent = card, Text = subtitle, TextSize = 13, TextColor3 = C.Muted, Position = UDim2.new(0, x, 0, 22), Size = UDim2.new(1, -x - 170, 0, 0), AutoY = true })
		if buttonText then
			Kit.Button({ Parent = card, Text = buttonText, Size = UDim2.new(0, 156, 0, 38), Position = UDim2.new(1, -156, 0, 0), TextSize = 14, TextWrapped = true }, onClick, buttonStyle)
		end
		new("Frame", { Parent = card, Size = UDim2.new(0, 0, 0, 38), BackgroundTransparency = 1 })
		return card
	end
	Menus.Row = row

	---------------------------------------------------------------------
	-- ORDER STOCK
	---------------------------------------------------------------------
	local order = Kit.Panel("Order", "ORDER STOCK", 720, 520)
	local qty = 10
	local qtyRow = new("Frame", { Parent = order.Body, Size = UDim2.new(1, 0, 0, 36), Position = UDim2.new(0, 0, 0, 46), BackgroundTransparency = 1 }, { Kit.List(Enum.FillDirection.Horizontal, 6) })
	Kit.Text({ Parent = qtyRow, LayoutOrder = 0, Text = "Quantity:", Font = Kit.Fonts.Bold, Size = UDim2.new(0, 80, 1, 0), TextYAlignment = Enum.TextYAlignment.Center })
	local qtyButtons = {}
	local orderList
	local renderOrder
	for i, n in ipairs({ 1, 5, 10, 25, 50 }) do
		qtyButtons[n] = Kit.Button({ Parent = qtyRow, LayoutOrder = i, Text = "x" .. n, Size = UDim2.new(0, 56, 1, 0) }, function()
			qty = n
			renderOrder()
		end, "secondary")
	end
	local hint = Kit.Text({ Parent = qtyRow, LayoutOrder = 10, Text = "", TextSize = 13, TextColor3 = C.Muted, Size = UDim2.new(0, 260, 1, 0), TextYAlignment = Enum.TextYAlignment.Center })
	orderList = Kit.Scroll(order.Body, UDim2.new(1, 0, 1, -92), UDim2.new(0, 0, 0, 92))

	local category = "All"
	local function inTab(p)
		if category == "All" then
			return true
		elseif category == "Special" then
			return p.Rarity == "Rare" or p.Rarity == "Legendary" or p.Rarity == "Secret"
		end
		return p.Category == category and p.Rarity ~= "Secret"
	end

	renderOrder = function()
		local data = State.Data
		if not data then
			return
		end
		for n, b in pairs(qtyButtons) do
			b.BackgroundColor3 = n == qty and C.Amber or C.PanelLight
			b.TextColor3 = n == qty and Color3.fromRGB(30, 22, 10) or C.Text
		end
		local discount = data.Effects.StockDiscount or 0
		hint.Text = discount > 0 and ("Bulk discount: -%d%%"):format(math.floor(discount * 100 + 0.5)) or ""
		Kit.Clear(orderList)
		local ctx = { Level = data.Level, Secrets = data.Secrets, EventId = WorldState:GetAttribute("EventId"), Weather = WorldState:GetAttribute("Weather") }
		local n = 0
		for _, p in ipairs(Products.List) do
			if inTab(p) then
				n = n + 1
				local ok, reason = Products.CanOrder(p, ctx)
				if p.Secret and not ok then
					row(orderList, 1000 + n, Color3.fromRGB(60, 50, 80), "??? Secret product", Products.RarityColors.Secret, "Uncover a mystery to unlock this.", nil)
				else
					local cost = math.ceil(p.Cost * qty * (1 - discount))
					local have = data.Inventory[p.Id] or 0
					local limited = (p.Event or p.Weather) and "  ·  LIMITED TIME" or ""
					local sub = ("%s  ·  Wholesale %s → Sells %s  ·  Backroom: %d  ·  %s%s"):format(p.Rarity, Util.Money(p.Cost), Util.Money(p.Price), have, p.Cold and "Cooler" or "Shelf", limited)
					local title = p.Name .. (data.Products[p.Id] == nil and "  (new!)" or "")
					if ok then
						row(orderList, n, p.Color, title, Products.RarityColors[p.Rarity], sub, ("Buy x%d  %s"):format(qty, Util.Money(cost)), data.Cash >= cost and nil or "locked", function()
							State.Act("BuyStock", { Product = p.Id, Qty = qty }, Kit)
						end)
					else
						row(orderList, 500 + n, p.Color, title, C.Muted, sub, reason, "locked", nil)
					end
				end
			end
		end
	end

	local tabs = Kit.Tabs(order.Body, {
		{ "All", "All" }, { "Snacks", "Snacks" }, { "Drinks", "Drinks" }, { "Instant", "Instant" },
		{ "Sweets", "Sweets" }, { "Household", "Household" }, { "Special", "Rare & Secret" },
	}, function(id)
		category = id
		renderOrder()
	end)
	order.OnOpen = function()
		tabs.Select(category)
	end

	---------------------------------------------------------------------
	-- BACKROOM (inventory)
	---------------------------------------------------------------------
	local inv = Kit.Panel("Inventory", "BACKROOM STOCK", 620, 480)
	local invList = Kit.Scroll(inv.Body)
	local function renderInventory()
		local data = State.Data
		if not data then
			return
		end
		Kit.Clear(invList)
		local stockedSlots, openSlots = 0, 0
		for unit = 1, 12 do
			if math.ceil(unit / 3) <= data.Effects.Expansion then
				for slot = 1, 4 do
					openSlots = openSlots + 1
					local e = data.Shelves["u" .. unit .. "s" .. slot]
					if e and e.Q > 0 then
						stockedSlots = stockedSlots + 1
					end
				end
			end
		end
		local summary = Kit.Card(invList, 0)
		Kit.Text({ Parent = summary, Text = ("Shelf slots stocked: %d / %d   ·   Items per slot: %d"):format(stockedSlots, openSlots, data.Effects.SlotCapacity), Font = Kit.Fonts.Bold, Size = UDim2.new(1, 0, 0, 0), AutoY = true })
		Kit.Text({ Parent = summary, Text = "Walk to a shelf or cooler and press E to stock it from here.", TextColor3 = C.Muted, TextSize = 14, Position = UDim2.new(0, 0, 0, 24), Size = UDim2.new(1, -150, 0, 0), AutoY = true })
		Kit.Button({ Parent = summary, Text = "Order more", Size = UDim2.new(0, 130, 0, 34), Position = UDim2.new(1, -130, 0, 20) }, function()
			Kit.Open("Order")
		end)
		new("Frame", { Parent = summary, Size = UDim2.new(0, 0, 0, 56), BackgroundTransparency = 1 })
		local ids = {}
		for id, count in pairs(data.Inventory) do
			if count > 0 and Products.ById[id] then
				table.insert(ids, id)
			end
		end
		table.sort(ids, function(a, b)
			return Products.ById[a].Order < Products.ById[b].Order
		end)
		if #ids == 0 then
			row(invList, 1, nil, "Your backroom is empty", C.Muted, "Order stock to keep your shelves full.", nil)
		end
		for i, id in ipairs(ids) do
			local p = Products.ById[id]
			row(invList, i, p.Color, ("%s  x%d"):format(p.Name, data.Inventory[id]), Products.RarityColors[p.Rarity], ("Goes on a %s  ·  Sells for %s"):format(p.Cold and "cooler" or "shelf", Util.Money(p.Price)), nil)
		end
	end
	inv.OnOpen = renderInventory

	---------------------------------------------------------------------
	-- UPGRADES
	---------------------------------------------------------------------
	local up = Kit.Panel("Upgrades", "STORE UPGRADES", 720, 520)
	local upList = Kit.Scroll(up.Body, UDim2.new(1, 0, 1, -48), UDim2.new(0, 0, 0, 48))
	local branch = "Shelves"
	local function renderUpgrades()
		local data = State.Data
		if not data then
			return
		end
		Kit.Clear(upList)
		local owned = Util.Count(data.Upgrades)
		local head = Kit.Card(upList, 0)
		Kit.Text({ Parent = head, Text = ("Installed: %d / %d upgrades"):format(owned, #Upgrades.List), Font = Kit.Fonts.Bold, Size = UDim2.new(1, 0, 0, 20) })
		for _, u in ipairs(Upgrades.List) do
			if u.Branch == branch then
				local sub = ("%s  ·  Level %d  ·  %s%s"):format(u.Desc, u.Level, Util.Money(u.Cost), u.Requires and ("  ·  Needs " .. Upgrades.ById[u.Requires].Name) or "")
				if data.Upgrades[u.Id] then
					row(upList, u.Order, nil, u.Name, C.Good, sub, "Installed ✓", "good", nil)
				elseif u.Requires and not data.Upgrades[u.Requires] then
					row(upList, u.Order, nil, u.Name, C.Muted, sub, "Locked", "locked", nil)
				elseif data.Level < u.Level then
					row(upList, u.Order, nil, u.Name, C.Muted, sub, "Level " .. u.Level, "locked", nil)
				else
					row(upList, u.Order, nil, u.Name, C.Amber, sub, "Buy " .. Util.Money(u.Cost), data.Cash >= u.Cost and nil or "locked", function()
						State.Act("BuyUpgrade", { Id = u.Id }, Kit)
					end)
				end
			end
		end
	end
	local upTabs = {}
	for _, b in ipairs(Upgrades.Branches) do
		table.insert(upTabs, { b, b })
	end
	local upgradeTabs = Kit.Tabs(up.Body, upTabs, function(id)
		branch = id
		renderUpgrades()
	end)
	up.OnOpen = function()
		upgradeTabs.Select(branch)
	end

	-- Live refresh while open (throttled so lists don't flicker during rushes)
	local queued = false
	State.On(function()
		if queued then
			return
		end
		queued = true
		task.delay(0.8, function()
			queued = false
			if Kit.IsOpen("Order") then
				renderOrder()
			elseif Kit.IsOpen("Inventory") then
				renderInventory()
			elseif Kit.IsOpen("Upgrades") then
				renderUpgrades()
			end
		end)
	end)
	WorldState.AttributeChanged:Connect(function()
		if Kit.IsOpen("Order") then
			renderOrder()
		end
	end)
end

return Menus
