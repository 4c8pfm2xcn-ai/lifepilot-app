-- Context dialogs opened by the server from in-world prompts:
--   Stock dialog (shelf/cooler prompt) and Rate dialog (guestbook prompt).
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage:WaitForChild("Shared")
local Products = require(Shared:WaitForChild("Products"))
local Remotes = ReplicatedStorage:WaitForChild("Remotes")

local Dialogs = {}

function Dialogs.Build(Kit, State)
	local C = Kit.Colors
	local new = Kit.new
	local player = Players.LocalPlayer

	---------------------------------------------------------------------
	-- STOCK
	---------------------------------------------------------------------
	local stock = Kit.Panel("Stock", "STOCK SHELF", 620, 500)
	local stockList = Kit.Scroll(stock.Body)
	local unitIndex, isCooler = 1, false
	local picking = nil -- slot we're choosing a product for

	local function render()
		local data = State.Data
		if not data then
			return
		end
		Kit.Clear(stockList)
		local cap = data.Effects.SlotCapacity
		if picking then
			local head = Kit.Card(stockList, 0)
			Kit.Text({ Parent = head, Text = ("Choose a product for slot %d"):format(picking), Font = Kit.Fonts.Bold, Size = UDim2.new(1, -130, 0, 22) })
			Kit.Button({ Parent = head, Text = "Back", Size = UDim2.new(0, 110, 0, 34), Position = UDim2.new(1, -110, 0, -6) }, function()
				picking = nil
				render()
			end, "secondary")
			local ids = {}
			for id, count in pairs(data.Inventory) do
				local p = Products.ById[id]
				if p and count > 0 and p.Cold == isCooler then
					table.insert(ids, id)
				end
			end
			table.sort(ids, function(a, b)
				return Products.ById[a].Order < Products.ById[b].Order
			end)
			if #ids == 0 then
				local c = Kit.Card(stockList, 1)
				Kit.Text({ Parent = c, Text = isCooler and "No drinks in your backroom. Order some!" or "No shelf products in your backroom. Order some!", TextColor3 = C.Muted, Size = UDim2.new(1, -150, 0, 22) })
				Kit.Button({ Parent = c, Text = "Order stock", Size = UDim2.new(0, 140, 0, 34), Position = UDim2.new(1, -140, 0, -6) }, function()
					Kit.Open("Order")
				end)
			end
			for i, id in ipairs(ids) do
				local p = Products.ById[id]
				local c = Kit.Card(stockList, i)
				new("Frame", { Parent = c, Size = UDim2.new(0, 30, 0, 30), BackgroundColor3 = p.Color }, { Kit.Corner(6) })
				Kit.Text({ Parent = c, Text = ("%s  x%d"):format(p.Name, data.Inventory[id]), Font = Kit.Fonts.Bold, Position = UDim2.new(0, 40, 0, 0), Size = UDim2.new(1, -190, 0, 30), TextYAlignment = Enum.TextYAlignment.Center })
				local slot = picking
				Kit.Button({ Parent = c, Text = "Put here", Size = UDim2.new(0, 130, 0, 34), Position = UDim2.new(1, -130, 0, -2) }, function()
					local result = State.Act("StockSlot", { Unit = unitIndex, Slot = slot, Product = id }, Kit)
					if result.ok then
						picking = nil
						task.delay(0.3, render)
					end
				end)
			end
			return
		end
		local head = Kit.Card(stockList, 0)
		Kit.Text({ Parent = head, Text = ("%s #%d  ·  up to %d per slot"):format(isCooler and "Cooler" or "Shelf", unitIndex, cap), Font = Kit.Fonts.Bold, Size = UDim2.new(1, -150, 0, 22) })
		Kit.Button({ Parent = head, Text = "Refill all", Size = UDim2.new(0, 140, 0, 34), Position = UDim2.new(1, -140, 0, -6) }, function()
			State.Act("RestockUnit", { Unit = unitIndex }, Kit)
			task.delay(0.3, render)
		end)
		for slot = 1, 4 do
			local entry = data.Shelves["u" .. unitIndex .. "s" .. slot]
			local p = entry and Products.ById[entry.P]
			local c = Kit.Card(stockList, slot)
			new("Frame", { Parent = c, Size = UDim2.new(0, 30, 0, 30), BackgroundColor3 = p and p.Color or C.Panel }, { Kit.Corner(6) })
			local text = p and ("%s  %d/%d  (backroom: %d)"):format(p.Name, entry.Q, cap, data.Inventory[entry.P] or 0) or "Empty slot"
			Kit.Text({ Parent = c, Text = ("Slot %d: %s"):format(slot, text), Font = Kit.Fonts.Bold, TextSize = 15, TextColor3 = p and C.Text or C.Muted, Position = UDim2.new(0, 40, 0, 0), Size = UDim2.new(1, -330, 0, 30), TextYAlignment = Enum.TextYAlignment.Center })
			Kit.Button({ Parent = c, Text = p and "Change" or "Stock", Size = UDim2.new(0, 90, 0, 34), Position = UDim2.new(1, -280, 0, -2) }, function()
				picking = slot
				render()
			end, p and "secondary" or nil)
			if p then
				Kit.Button({ Parent = c, Text = "Refill", Size = UDim2.new(0, 90, 0, 34), Position = UDim2.new(1, -185, 0, -2) }, function()
					State.Act("StockSlot", { Unit = unitIndex, Slot = slot, Product = entry.P }, Kit)
					task.delay(0.3, render)
				end)
				Kit.Button({ Parent = c, Text = "Clear", Size = UDim2.new(0, 90, 0, 34), Position = UDim2.new(1, -90, 0, -2) }, function()
					State.Act("ClearSlot", { Unit = unitIndex, Slot = slot }, Kit)
					task.delay(0.3, render)
				end, "secondary")
			end
		end
		local tip = Kit.Card(stockList, 10)
		Kit.Text({ Parent = tip, Text = isCooler and "Coolers hold drinks. Customers grab from the front, so keep popular items full!" or "Shelves hold snacks, food, sweets and household goods.", TextColor3 = C.Muted, TextSize = 13, Size = UDim2.new(1, 0, 0, 0), AutoY = true })
	end

	Remotes:WaitForChild("OpenStock").OnClientEvent:Connect(function(index, cooler)
		unitIndex, isCooler = index, cooler
		picking = nil
		if not Kit.IsOpen("Stock") then
			Kit.Open("Stock")
		end
		render()
	end)
	stock.OnOpen = render
	local queued = false
	State.On(function()
		if queued then
			return
		end
		queued = true
		task.delay(0.5, function()
			queued = false
			if Kit.IsOpen("Stock") and not picking then
				render()
			end
		end)
	end)
	-- Close the stock dialog if you walk away from the shelf
	task.spawn(function()
		while true do
			task.wait(0.5)
			if Kit.IsOpen("Stock") and State.Data then
				local stores = workspace:FindFirstChild("Stores")
				local model = stores and stores:FindFirstChild("Store" .. State.Data.PlotIndex)
				local unit = model and model:FindFirstChild("Unit" .. unitIndex)
				local back = unit and unit:FindFirstChild("Back")
				local root = player.Character and player.Character:FindFirstChild("HumanoidRootPart")
				if back and root and (back.Position - root.Position).Magnitude > 18 then
					Kit.Close()
				end
			end
		end
	end)

	---------------------------------------------------------------------
	-- RATE
	---------------------------------------------------------------------
	local rate = Kit.Panel("Rate", "SIGN THE GUESTBOOK", 460, 300)
	local ownerId, stars = nil, 5
	local storeLabel = Kit.Text({ Parent = rate.Body, Text = "", Font = Kit.Fonts.Bold, TextSize = 17, Size = UDim2.new(1, 0, 0, 24), TextXAlignment = Enum.TextXAlignment.Center })
	local starRow = new("Frame", { Parent = rate.Body, Position = UDim2.new(0, 0, 0, 40), Size = UDim2.new(1, 0, 0, 60), BackgroundTransparency = 1 }, { Kit.List(Enum.FillDirection.Horizontal, 8, Enum.HorizontalAlignment.Center) })
	local starButtons = {}
	local function paintStars()
		for i, b in ipairs(starButtons) do
			b.Text = i <= stars and "★" or "☆"
			b.TextColor3 = i <= stars and C.Amber or C.Muted
		end
	end
	for i = 1, 5 do
		starButtons[i] = Kit.Button({ Parent = starRow, LayoutOrder = i, Text = "★", TextSize = 34, Size = UDim2.new(0, 60, 0, 60) }, function()
			stars = i
			paintStars()
		end, "secondary")
	end
	Kit.Button({ Parent = rate.Body, Text = "Submit rating", Size = UDim2.new(0, 200, 0, 44), Position = UDim2.new(0.5, -100, 0, 120) }, function()
		local result = State.Act("RateStore", { Owner = ownerId, Stars = stars }, Kit)
		if result.ok then
			Kit.Close()
		end
	end)
	Kit.Text({ Parent = rate.Body, Text = "You can rate each store once per day.", TextColor3 = C.Muted, TextSize = 13, Position = UDim2.new(0, 0, 0, 176), Size = UDim2.new(1, 0, 0, 20), TextXAlignment = Enum.TextXAlignment.Center })
	Remotes:WaitForChild("OpenRate").OnClientEvent:Connect(function(id, name)
		ownerId = id
		stars = 5
		storeLabel.Text = "How was " .. (name ~= "" and name or "this store") .. "?"
		paintStars()
		Kit.Open("Rate")
	end)
end

return Dialogs
