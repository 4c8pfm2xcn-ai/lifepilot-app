-- Store customization: themes, shelf layouts, uniforms, decor, checkout
-- effects and the store sign. Robux buttons only appear for items that have
-- a Developer Product ID configured (and every item is earnable anyway).
local MarketplaceService = game:GetService("MarketplaceService")
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage:WaitForChild("Shared")
local Config = require(Shared:WaitForChild("Config"))
local Cosmetics = require(Shared:WaitForChild("Cosmetics"))
local Unlocks = require(Shared:WaitForChild("Unlocks"))
local Util = require(Shared:WaitForChild("Util"))

local Customize = {}

local robuxIds = {}
for _, product in ipairs(Config.RobuxProducts) do
	if product.ProductId ~= 0 then
		robuxIds[product.Key] = product.ProductId
	end
end

function Customize.Build(Kit, State)
	local C = Kit.Colors
	local new = Kit.new
	local player = Players.LocalPlayer
	local panel = Kit.Panel("Customize", "CUSTOMIZE YOUR STORE", 740, 540)
	local list = Kit.Scroll(panel.Body, UDim2.new(1, 0, 1, -48), UDim2.new(0, 0, 0, 48))
	local tab = "Themes"
	local signColor = nil

	-- card(title, swatches, statusText, buttons = { {Text, Style, OnClick} })
	local function card(order, title, titleColor, swatches, status, buttons)
		local c = Kit.Card(list, order)
		local x = 0
		for i, color in ipairs(swatches or {}) do
			new("Frame", { Parent = c, Size = UDim2.new(0, 22, 0, 22), Position = UDim2.new(0, (i - 1) * 26, 0, 2), BackgroundColor3 = color }, { Kit.Corner(6), Kit.Stroke(Color3.new(1, 1, 1), 0.7) })
			x = i * 26 + 8
		end
		Kit.Text({ Parent = c, Text = title, Font = Kit.Fonts.Bold, TextSize = 17, TextColor3 = titleColor or C.Text, Position = UDim2.new(0, x, 0, 0), Size = UDim2.new(1, -x - 300, 0, 22), TextWrapped = false, TextTruncate = Enum.TextTruncate.AtEnd })
		Kit.Text({ Parent = c, Text = status, TextSize = 13, TextColor3 = C.Muted, Position = UDim2.new(0, x, 0, 24), Size = UDim2.new(1, -x - 300, 0, 0), AutoY = true })
		for i, b in ipairs(buttons) do
			Kit.Button({ Parent = c, Text = b[1], Size = UDim2.new(0, 140, 0, 38), Position = UDim2.new(1, -146 * i, 0, 0), TextSize = 14 }, b[3], b[2])
		end
		new("Frame", { Parent = c, Size = UDim2.new(0, 0, 0, 40), BackgroundTransparency = 1 })
	end

	local function robuxButton(rules, buttons)
		local key = Unlocks.RobuxKey(rules)
		local id = key and robuxIds[key]
		if id then
			table.insert(buttons, { "Robux", Color3.fromRGB(40, 160, 90), function()
				MarketplaceService:PromptProductPurchase(player, id)
			end })
		end
	end

	-- Standard equip-able list (themes, layouts, uniforms, effects)
	local function equipList(items, current, action, swatchFn)
		for i, item in ipairs(items) do
			local unlocked, reason = State.IsUnlocked(item.Unlock)
			local buttons = {}
			local status
			if current == item.Id then
				status = "Equipped"
				table.insert(buttons, { "Equipped ✓", "good", nil })
			elseif unlocked then
				status = "Unlocked"
				table.insert(buttons, { "Equip", nil, function()
					State.Act(action, { Id = item.Id }, Kit)
				end })
			else
				status = "🔒 " .. reason
				table.insert(buttons, { "Locked", "locked", nil })
				robuxButton(item.Unlock, buttons)
			end
			card(i, item.Name, unlocked and C.Text or C.Muted, swatchFn and swatchFn(item) or nil, status, buttons)
		end
	end

	local function render()
		local data = State.Data
		if not data then
			return
		end
		Kit.Clear(list)
		local store = data.Store
		if tab == "Themes" then
			equipList(Cosmetics.Themes, store.Theme, "SetTheme", function(t)
				return { t.Wall, t.Floor, t.Trim, t.Neon }
			end)
		elseif tab == "Layouts" then
			equipList(Cosmetics.Layouts, store.Layout, "SetLayout", nil)
		elseif tab == "Uniforms" then
			equipList(Cosmetics.Uniforms, store.Uniform, "SetUniform", function(u)
				return { u.Color }
			end)
		elseif tab == "Effects" then
			equipList(Cosmetics.Effects, store.Effect, "SetEffect", function(e)
				return e.Colors
			end)
		elseif tab == "Decor" then
			for i, d in ipairs(Cosmetics.Decor) do
				local unlocked, reason = State.IsUnlocked(d.Unlock)
				local owned = data.Owned.Decor[d.Id] or (d.Price == 0 and unlocked)
				local buttons = {}
				local status
				if owned then
					local on = store.DecorOn[d.Id]
					status = on and "Placed in your store" or "In storage"
					table.insert(buttons, { on and "Put away" or "Place", on and "secondary" or nil, function()
						State.Act("ToggleDecor", { Id = d.Id }, Kit)
					end })
				elseif unlocked then
					status = "Available"
					table.insert(buttons, { "Buy " .. Util.Money(d.Price), data.Cash >= d.Price and nil or "locked", function()
						State.Act("BuyDecor", { Id = d.Id }, Kit)
					end })
				else
					status = "🔒 " .. reason
					table.insert(buttons, { "Locked", "locked", nil })
					robuxButton(d.Unlock, buttons)
				end
				card(i, d.Name, owned and C.Text or C.Muted, nil, status, buttons)
			end
		elseif tab == "Sign" then
			local c = Kit.Card(list, 1)
			Kit.List(nil, 10).Parent = c
			Kit.Text({ Parent = c, LayoutOrder = 1, Text = "Store name (shown on your sign, filtered for everyone)", Font = Kit.Fonts.Bold, Size = UDim2.new(1, 0, 0, 20) })
			local box = new("TextBox", {
				Parent = c, LayoutOrder = 2, Size = UDim2.new(1, 0, 0, 44), BackgroundColor3 = C.Panel, TextColor3 = C.Text,
				Font = Kit.Fonts.Bold, TextSize = 18, ClearTextOnFocus = false, PlaceholderText = player.DisplayName .. "'s Mart",
				Text = store.Name, TextXAlignment = Enum.TextXAlignment.Left,
			}, { Kit.Corner(10), new("UIPadding", { PaddingLeft = UDim.new(0, 12) }) })
			box:GetPropertyChangedSignal("Text"):Connect(function()
				if #box.Text > 24 then
					box.Text = box.Text:sub(1, 24)
				end
			end)
			Kit.Text({ Parent = c, LayoutOrder = 3, Text = "Sign color", Font = Kit.Fonts.Bold, Size = UDim2.new(1, 0, 0, 20) })
			local swatches = new("Frame", { Parent = c, LayoutOrder = 4, Size = UDim2.new(1, 0, 0, 40), BackgroundTransparency = 1 }, { Kit.List(Enum.FillDirection.Horizontal, 8) })
			signColor = signColor or store.SignColor
			for i, color in ipairs(Cosmetics.SignColors) do
				local b = Kit.Button({ Parent = swatches, LayoutOrder = i, Text = i == signColor and "✓" or "", Size = UDim2.new(0, 40, 0, 40), TextColor3 = Color3.new(1, 1, 1) }, function()
					signColor = i
					render()
				end, color)
				Kit.Stroke(Color3.new(1, 1, 1), i == signColor and 0 or 0.8, 2).Parent = b
			end
			Kit.Button({ Parent = c, LayoutOrder = 5, Text = "Save sign", Size = UDim2.new(0, 160, 0, 40) }, function()
				State.Act("SetSign", { Name = box.Text, Color = signColor }, Kit)
			end)
		end
	end

	local tabs = Kit.Tabs(panel.Body, {
		{ "Themes", "Themes" }, { "Layouts", "Layout" }, { "Decor", "Decor" },
		{ "Uniforms", "Uniform" }, { "Effects", "Checkout FX" }, { "Sign", "Sign" },
	}, function(id)
		tab = id
		render()
	end)
	panel.OnOpen = function()
		signColor = nil
		tabs.Select(tab)
	end

	local queued = false
	State.On(function()
		if Kit.IsOpen("Customize") and tab ~= "Sign" and not queued then
			queued = true
			task.delay(0.6, function()
				queued = false
				if Kit.IsOpen("Customize") and tab ~= "Sign" then
					render()
				end
			end)
		end
	end)
end

return Customize
