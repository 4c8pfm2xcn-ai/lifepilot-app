-- Getaway City - all player UI: team menu, HUD, store status, robbery bar,
-- notifications and the shop. Built in code so there are no assets to import.
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local MarketplaceService = game:GetService("MarketplaceService")
local TweenService = game:GetService("TweenService")

local player = Players.LocalPlayer
local Config = require(ReplicatedStorage:WaitForChild("Shared"):WaitForChild("Config"))
local Remotes = ReplicatedStorage:WaitForChild("Remotes")

local WHITE = Color3.new(1, 1, 1)
local PANEL = Color3.fromRGB(20, 22, 30)
local GREEN = Color3.fromRGB(90, 230, 120)
local RED = Color3.fromRGB(240, 70, 70)
local BLUE = Color3.fromRGB(70, 140, 255)
local ORANGE = Color3.fromRGB(255, 160, 60)
local GOLD = Color3.fromRGB(255, 210, 80)

local function new(className, props, children)
	local inst = Instance.new(className)
	for k, v in pairs(props or {}) do
		if k ~= "Parent" then
			inst[k] = v
		end
	end
	for _, child in ipairs(children or {}) do
		child.Parent = inst
	end
	if props and props.Parent then
		inst.Parent = props.Parent
	end
	return inst
end

local function corner(radius)
	return new("UICorner", { CornerRadius = UDim.new(0, radius or 10) })
end

local function padding(px)
	return new("UIPadding", {
		PaddingTop = UDim.new(0, px), PaddingBottom = UDim.new(0, px),
		PaddingLeft = UDim.new(0, px), PaddingRight = UDim.new(0, px),
	})
end

local function money(n)
	local s = tostring(math.floor(n or 0))
	local formatted = s:reverse():gsub("(%d%d%d)", "%1,"):reverse()
	if formatted:sub(1, 1) == "," then
		formatted = formatted:sub(2)
	end
	return "$" .. formatted
end

local function label(props)
	props.BackgroundTransparency = props.BackgroundTransparency or 1
	props.TextColor3 = props.TextColor3 or WHITE
	props.Font = props.Font or Enum.Font.GothamBold
	props.TextScaled = props.TextScaled ~= false
	return new("TextLabel", props)
end

local function button(props, onClick)
	props.AutoButtonColor = true
	props.TextColor3 = props.TextColor3 or WHITE
	props.Font = props.Font or Enum.Font.GothamBlack
	props.TextScaled = true
	local b = new("TextButton", props, { corner(10), padding(6) })
	b.Activated:Connect(onClick)
	return b
end

local gui = new("ScreenGui", {
	Name = "GetawayUI", ResetOnSpawn = false, ZIndexBehavior = Enum.ZIndexBehavior.Sibling,
	Parent = player:WaitForChild("PlayerGui"),
})

---------------------------------------------------------------------------
-- HUD (left side)
---------------------------------------------------------------------------
local hud = new("Frame", {
	Parent = gui, Name = "HUD", Position = UDim2.new(0, 12, 0.28, 0), Size = UDim2.new(0, 210, 0, 0),
	AutomaticSize = Enum.AutomaticSize.Y, BackgroundColor3 = PANEL, BackgroundTransparency = 0.25,
}, { corner(12), padding(10), new("UIListLayout", { Padding = UDim.new(0, 4), SortOrder = Enum.SortOrder.LayoutOrder }) })

local teamLabel = label({ Parent = hud, Size = UDim2.new(1, 0, 0, 20), LayoutOrder = 1, Text = "" })
local cashLabel = label({ Parent = hud, Size = UDim2.new(1, 0, 0, 34), LayoutOrder = 2, Text = "$0", TextColor3 = GREEN, Font = Enum.Font.GothamBlack })
local levelLabel = label({ Parent = hud, Size = UDim2.new(1, 0, 0, 20), LayoutOrder = 3, Text = "Level 1" })
local bagLabel = label({ Parent = hud, Size = UDim2.new(1, 0, 0, 20), LayoutOrder = 4, Text = "", TextColor3 = GOLD })
local bountyLabel = label({ Parent = hud, Size = UDim2.new(1, 0, 0, 20), LayoutOrder = 5, Text = "", TextColor3 = RED })
local jailLabel = label({ Parent = hud, Size = UDim2.new(1, 0, 0, 40), LayoutOrder = 6, Text = "", TextColor3 = ORANGE, TextWrapped = true })

local buttonRow = new("Frame", { Parent = hud, Size = UDim2.new(1, 0, 0, 36), LayoutOrder = 7, BackgroundTransparency = 1 }, {
	new("UIListLayout", { FillDirection = Enum.FillDirection.Horizontal, Padding = UDim.new(0, 6) }),
})

---------------------------------------------------------------------------
-- Team selection menu
---------------------------------------------------------------------------
local menu = new("Frame", {
	Parent = gui, Name = "TeamMenu", Size = UDim2.fromScale(1, 1), BackgroundColor3 = Color3.new(0, 0, 0),
	BackgroundTransparency = 0.35, ZIndex = 10,
})
label({
	Parent = menu, Text = string.upper(Config.GameName), Size = UDim2.new(0.8, 0, 0.12, 0), Position = UDim2.new(0.1, 0, 0.08, 0),
	Font = Enum.Font.GothamBlack, TextColor3 = GOLD, ZIndex = 11,
})
label({
	Parent = menu, Text = "Pick a side", Size = UDim2.new(0.6, 0, 0.05, 0), Position = UDim2.new(0.2, 0, 0.21, 0), ZIndex = 11,
})
local cards = new("Frame", {
	Parent = menu, Size = UDim2.new(0.8, 0, 0.5, 0), Position = UDim2.new(0.1, 0, 0.3, 0), BackgroundTransparency = 1, ZIndex = 11,
}, {
	new("UIListLayout", {
		FillDirection = Enum.FillDirection.Horizontal, HorizontalAlignment = Enum.HorizontalAlignment.Center,
		Padding = UDim.new(0.04, 0),
	}),
})

local function teamCard(teamKey, title, blurb, color)
	local card = button({
		Parent = cards, Size = UDim2.new(0.4, 0, 1, 0), BackgroundColor3 = color, Text = "", ZIndex = 12,
	}, function()
		Remotes:WaitForChild("ChooseTeam"):FireServer(teamKey)
		if player.Character then
			-- already spawned: close the menu (the server respawns us if the team changes)
			menu.Visible = false
			hud.Visible = true
		end
	end)
	label({ Parent = card, Text = title, Size = UDim2.new(1, 0, 0.3, 0), Font = Enum.Font.GothamBlack, ZIndex = 13 })
	label({
		Parent = card, Text = blurb, Size = UDim2.new(1, 0, 0.55, 0), Position = UDim2.new(0, 0, 0.38, 0),
		Font = Enum.Font.GothamMedium, TextWrapped = true, ZIndex = 13,
	})
end
teamCard("Police", "POLICE", "Respond to alarms, chase robbers and cuff them to collect their bounty.", Color3.fromRGB(35, 80, 190))
teamCard("Criminal", "CRIMINAL", "Rob stores, outrun the cops and stash your loot at the Hideout.", Color3.fromRGB(180, 40, 40))

local function setMenuVisible(visible)
	menu.Visible = visible
	hud.Visible = not visible
end

---------------------------------------------------------------------------
-- Store status panel (right side)
---------------------------------------------------------------------------
local statusPanel = new("Frame", {
	Parent = gui, Name = "Stores", AnchorPoint = Vector2.new(1, 0), Position = UDim2.new(1, -12, 0.28, 0),
	Size = UDim2.new(0, 230, 0, 0), AutomaticSize = Enum.AutomaticSize.Y, BackgroundColor3 = PANEL, BackgroundTransparency = 0.25,
}, { corner(12), padding(10), new("UIListLayout", { Padding = UDim.new(0, 4), SortOrder = Enum.SortOrder.LayoutOrder }) })
label({ Parent = statusPanel, Text = "STORES", Size = UDim2.new(1, 0, 0, 20), LayoutOrder = 0, TextColor3 = GOLD })
local statusRows = {}
local statusFolder = ReplicatedStorage:WaitForChild("RobberyStatus")

---------------------------------------------------------------------------
-- Robbery progress bar (above the hotbar)
---------------------------------------------------------------------------
local robBar = new("Frame", {
	Parent = gui, AnchorPoint = Vector2.new(0.5, 1), Position = UDim2.new(0.5, 0, 1, -110), Size = UDim2.new(0, 360, 0, 46),
	BackgroundColor3 = PANEL, BackgroundTransparency = 0.2, Visible = false,
}, { corner(10) })
local robFill = new("Frame", {
	Parent = robBar, Size = UDim2.new(0, 0, 1, 0), BackgroundColor3 = GOLD, BorderSizePixel = 0,
}, { corner(10) })
local robText = label({ Parent = robBar, Size = UDim2.new(1, -16, 1, -12), Position = UDim2.new(0, 8, 0, 6), Text = "", ZIndex = 2 })

---------------------------------------------------------------------------
-- Notifications (top center)
---------------------------------------------------------------------------
local notifyList = new("Frame", {
	Parent = gui, AnchorPoint = Vector2.new(0.5, 0), Position = UDim2.new(0.5, 0, 0, 8), Size = UDim2.new(0.6, 0, 0, 0),
	AutomaticSize = Enum.AutomaticSize.Y, BackgroundTransparency = 1, ZIndex = 30,
}, { new("UIListLayout", { Padding = UDim.new(0, 4), HorizontalAlignment = Enum.HorizontalAlignment.Center }) })

local kindColors = { info = WHITE, good = GREEN, bad = ORANGE, alarm = RED }
local function notify(text, kind)
	local items = {}
	for _, child in ipairs(notifyList:GetChildren()) do
		if child:IsA("TextLabel") then
			table.insert(items, child)
		end
	end
	if #items >= 4 then
		items[1]:Destroy()
	end
	local item = label({
		Parent = notifyList, Text = text, Size = UDim2.new(1, 0, 0, 32), BackgroundTransparency = 0.25,
		BackgroundColor3 = PANEL, TextColor3 = kindColors[kind] or WHITE, TextWrapped = true,
	})
	corner(8).Parent = item
	padding(4).Parent = item
	task.delay(kind == "alarm" and 7 or 5, function()
		if item.Parent then
			local tween = TweenService:Create(item, TweenInfo.new(0.4), { TextTransparency = 1, BackgroundTransparency = 1 })
			tween:Play()
			tween.Completed:Wait()
			item:Destroy()
		end
	end)
end
Remotes:WaitForChild("Notify").OnClientEvent:Connect(notify)

---------------------------------------------------------------------------
-- Shop
---------------------------------------------------------------------------
local shop = new("Frame", {
	Parent = gui, Name = "Shop", AnchorPoint = Vector2.new(0.5, 0.5), Position = UDim2.fromScale(0.5, 0.5),
	Size = UDim2.new(0, 340, 0, 0), AutomaticSize = Enum.AutomaticSize.Y, BackgroundColor3 = PANEL, Visible = false, ZIndex = 20,
}, { corner(14), padding(14), new("UIListLayout", { Padding = UDim.new(0, 8), SortOrder = Enum.SortOrder.LayoutOrder }) })
label({ Parent = shop, Text = "SHOP", Size = UDim2.new(1, 0, 0, 34), TextColor3 = GOLD, LayoutOrder = 0, ZIndex = 21 })

local function shopButton(order, text, color, enabled, onClick)
	button({
		Parent = shop, LayoutOrder = order, Size = UDim2.new(1, 0, 0, 44), ZIndex = 21,
		BackgroundColor3 = enabled and color or Color3.fromRGB(70, 70, 75),
		Text = enabled and text or (text .. " (coming soon)"),
	}, function()
		if enabled then
			onClick()
		end
	end)
end

local vipId = Config.GamePasses.VIP
shopButton(1, "VIP: 2x Cash + Big Bag", GOLD, vipId ~= 0, function()
	MarketplaceService:PromptGamePassPurchase(player, vipId)
end)
for i, product in ipairs(Config.CashProducts) do
	shopButton(1 + i, product.Label .. " Cash", Color3.fromRGB(40, 150, 70), product.Id ~= 0, function()
		MarketplaceService:PromptProductPurchase(player, product.Id)
	end)
end
shopButton(10, "Close", Color3.fromRGB(90, 90, 100), true, function()
	shop.Visible = false
end)

---------------------------------------------------------------------------
-- HUD buttons
---------------------------------------------------------------------------
local function teamKey()
	if not player.Team then
		return nil
	end
	for key, info in pairs(Config.Teams) do
		if player.Team.Name == info.Name then
			return key
		end
	end
	return nil
end

button({ Parent = buttonRow, Size = UDim2.new(0.5, -3, 1, 0), BackgroundColor3 = Color3.fromRGB(60, 60, 75), Text = "TEAM" }, function()
	if teamKey() == "Prisoner" then
		notify("You can't switch teams while in jail!", "bad")
		return
	end
	setMenuVisible(true)
end)
button({ Parent = buttonRow, Size = UDim2.new(0.5, -3, 1, 0), BackgroundColor3 = Color3.fromRGB(40, 150, 70), Text = "SHOP" }, function()
	shop.Visible = not shop.Visible
end)

---------------------------------------------------------------------------
-- Menu camera + showing/hiding the menu
---------------------------------------------------------------------------
local camera = workspace.CurrentCamera
local function menuCamera()
	camera.CameraType = Enum.CameraType.Scriptable
	camera.CFrame = CFrame.lookAt(Vector3.new(-260, 140, 320), Vector3.new(0, 0, -40))
end

setMenuVisible(true)
menuCamera()

player.CharacterAdded:Connect(function(character)
	camera.CameraType = Enum.CameraType.Custom
	camera.CameraSubject = character:WaitForChild("Humanoid")
	setMenuVisible(false)
end)

---------------------------------------------------------------------------
-- Refresh loop
---------------------------------------------------------------------------
local teamText = {
	Police = { "POLICE OFFICER", BLUE },
	Criminal = { "CRIMINAL", RED },
	Prisoner = { "PRISONER", ORANGE },
}

local function refreshStatus(now, myLevel)
	for _, value in ipairs(statusFolder:GetChildren()) do
		local row = statusRows[value]
		if not row then
			row = label({
				Parent = statusPanel, Size = UDim2.new(1, 0, 0, 20), LayoutOrder = value:GetAttribute("Order") or 99,
				TextXAlignment = Enum.TextXAlignment.Left, Font = Enum.Font.GothamMedium,
			})
			statusRows[value] = row
		end
		local name = value:GetAttribute("DisplayName") or value.Name
		local minLevel = value:GetAttribute("MinLevel") or 1
		if value.Value == "OPEN" then
			row.Text = name .. ": OPEN"
			row.TextColor3 = GREEN
		elseif value.Value == "ALARM" then
			row.Text = name .. ": ALARM!"
			row.TextColor3 = RED
		else
			local left = math.max(0, math.ceil((value:GetAttribute("ReopenAt") or now) - now))
			row.Text = ("%s: closed %d:%02d"):format(name, math.floor(left / 60), left % 60)
			row.TextColor3 = Color3.fromRGB(160, 160, 160)
		end
		if myLevel < minLevel then
			row.Text = row.Text .. " (Lv " .. minLevel .. ")"
		end
	end
end

while true do
	task.wait(0.2)
	local now = workspace:GetServerTimeNow()
	local key = teamKey()
	local stats = player:FindFirstChild("leaderstats")
	local cash = stats and stats:FindFirstChild("Cash")
	local level = stats and stats:FindFirstChild("Level")
	local myLevel = level and level.Value or 1

	cashLabel.Text = money(cash and cash.Value or 0)
	levelLabel.Text = "Level " .. myLevel .. (player:GetAttribute("VIP") and "  |  VIP" or "")
	local info = key and teamText[key]
	teamLabel.Text = info and info[1] or ""
	teamLabel.TextColor3 = info and info[2] or WHITE

	local isCriminal = key == "Criminal"
	bagLabel.Visible = isCriminal
	bountyLabel.Visible = isCriminal
	bagLabel.Text = "Bag: " .. money(player:GetAttribute("Bag"))
	bountyLabel.Text = "Bounty: " .. money(player:GetAttribute("Bounty"))

	local release = player:GetAttribute("JailRelease")
	jailLabel.Visible = key == "Prisoner" and release ~= nil
	if release then
		jailLabel.Text = ("Released in %ds... or find a way out"):format(math.max(0, math.ceil(release - now)))
	end

	local robName = player:GetAttribute("RobName")
	robBar.Visible = robName ~= nil
	if robName then
		local p = player:GetAttribute("RobProgress") or 0
		robFill.Size = UDim2.new(p, 0, 1, 0)
		robText.Text = (key == "Prisoner" and "Unscrewing %s... %d%%" or "Robbing %s... %d%%"):format(robName, math.floor(p * 100))
	end

	refreshStatus(now, myLevel)
end
