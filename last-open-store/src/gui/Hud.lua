-- Always-visible HUD: cash, level, rating, clock/weather/event, nav bar,
-- toasts, tutorial guide (with a beam to the target), floating sale text.
local Lighting = game:GetService("Lighting")
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Debris = game:GetService("Debris")

local Shared = ReplicatedStorage:WaitForChild("Shared")
local Util = require(Shared:WaitForChild("Util"))
local Remotes = ReplicatedStorage:WaitForChild("Remotes")
local WorldState = ReplicatedStorage:WaitForChild("WorldState")

local Hud = {}

local TUTORIAL = {
	{ Title = "Ring up your first customer", Text = "Customers grab items and line up at the register. Walk behind the counter and press E on the register (or tap Ring Up).", Target = "Register" },
	{ Title = "Order more stock", Text = "Shelves run low fast. Open Order and buy something new for your backroom.", Nav = "Order" },
	{ Title = "Stock a shelf", Text = "Walk up to a shelf or cooler and press E to put items from your backroom on it.", Target = "Unit" },
	{ Title = "Buy an upgrade", Text = "Open Upgrades and install your first one. Sturdy Shelves is a great start!", Nav = "Upgrades" },
}

function Hud.Build(Kit, State)
	local C = Kit.Colors
	local new = Kit.new
	local root = Kit.Root
	local player = Players.LocalPlayer
	local hud = {}

	---------------------------------------------------------------------
	-- Top-left: cash, level, rating
	---------------------------------------------------------------------
	local stats = new("Frame", {
		Parent = root, Position = UDim2.new(0, 14, 0, 10), Size = UDim2.new(0, 260, 0, 0), AutomaticSize = Enum.AutomaticSize.Y,
		BackgroundColor3 = C.Panel, BackgroundTransparency = 0.15,
	}, { Kit.Corner(16), Kit.Pad(12), Kit.List(nil, 6), Kit.Stroke(C.Amber, 0.7) })
	local cashLabel = Kit.Text({ Parent = stats, LayoutOrder = 1, Text = "$0", Font = Kit.Fonts.Display, TextSize = 30, TextColor3 = C.Good, Size = UDim2.new(1, 0, 0, 32), TextWrapped = false })
	local levelLabel = Kit.Text({ Parent = stats, LayoutOrder = 2, Text = "Level 1", Font = Kit.Fonts.Bold, TextSize = 15, Size = UDim2.new(1, 0, 0, 18) })
	local xpBack, xpFill = Kit.Bar(stats, 0, C.Amber, 8)
	xpBack.LayoutOrder = 3
	local ratingLabel = Kit.Text({ Parent = stats, LayoutOrder = 4, Text = "", Font = Kit.Fonts.Bold, TextSize = 15, TextColor3 = C.Amber, Size = UDim2.new(1, 0, 0, 18) })

	local shownCash = 0
	local targetCash = 0
	task.spawn(function()
		while true do
			task.wait(0.03)
			if shownCash ~= targetCash then
				local diff = targetCash - shownCash
				local step = math.max(1, math.floor(math.abs(diff) * 0.2))
				shownCash = shownCash + (diff > 0 and math.min(step, diff) or math.max(-step, diff))
				cashLabel.Text = Util.Money(shownCash)
			end
		end
	end)

	---------------------------------------------------------------------
	-- Top-center: clock, weather, tonight's event
	---------------------------------------------------------------------
	local clockPill = new("Frame", {
		Parent = root, AnchorPoint = Vector2.new(0.5, 0), Position = UDim2.new(0.5, 0, 0, 10), Size = UDim2.new(0, 230, 0, 40),
		BackgroundColor3 = C.Panel, BackgroundTransparency = 0.15,
	}, { Kit.Corner(20), Kit.Stroke(C.Stroke, 0.6) })
	local clockLabel = Kit.Text({ Parent = clockPill, Size = UDim2.fromScale(1, 1), TextXAlignment = Enum.TextXAlignment.Center, Font = Kit.Fonts.Bold, TextSize = 18, Text = "" })
	local eventChip = Kit.Button({
		Parent = root, AnchorPoint = Vector2.new(0.5, 0), Position = UDim2.new(0.5, 0, 0, 56), Size = UDim2.new(0, 0, 0, 30),
		AutomaticSize = Enum.AutomaticSize.X, Text = "", TextSize = 14, Visible = false,
	}, function()
		Kit.Toast(WorldState:GetAttribute("EventDesc") or "", "event")
	end, C.PanelLight)
	new("UIPadding", { Parent = eventChip, PaddingLeft = UDim.new(0, 14), PaddingRight = UDim.new(0, 14) })

	local function weatherIcon(night)
		local w = WorldState:GetAttribute("Weather")
		if w == "Rain" then
			return "🌧"
		elseif w == "Storm" then
			return "⛈"
		elseif w == "Fog" then
			return "🌫"
		end
		return night and "☾" or "☀"
	end
	local function refreshEvent()
		local name = WorldState:GetAttribute("EventName") or ""
		eventChip.Visible = name ~= ""
		eventChip.Text = "✦ " .. name .. "  (tap for details)"
		eventChip.TextColor3 = WorldState:GetAttribute("EventColor") or C.Text
	end
	WorldState:GetAttributeChangedSignal("EventName"):Connect(refreshEvent)
	refreshEvent()
	task.spawn(function()
		while true do
			local night = WorldState:GetAttribute("Night")
			clockLabel.Text = ("%s  %s  %s"):format(weatherIcon(night), Util.Clock(Lighting.ClockTime), night and "NIGHT" or "DAY")
			clockLabel.TextColor3 = night and Color3.fromRGB(190, 200, 255) or C.Text
			task.wait(0.5)
		end
	end)

	---------------------------------------------------------------------
	-- Toasts (right side)
	---------------------------------------------------------------------
	local toastList = new("Frame", {
		Parent = root, AnchorPoint = Vector2.new(1, 0), Position = UDim2.new(1, -14, 0, 120), Size = UDim2.new(0, 330, 0, 0),
		AutomaticSize = Enum.AutomaticSize.Y, BackgroundTransparency = 1, ZIndex = 40,
	}, { Kit.List(nil, 6, Enum.HorizontalAlignment.Right) })
	local kindColor = { info = C.Text, good = C.Good, bad = C.Bad, event = C.Purple, review = C.Amber, clue = C.Teal, level = C.Amber }
	local order = 0
	function hud.Toast(text, kind)
		order = order + 1
		local items = {}
		for _, child in ipairs(toastList:GetChildren()) do
			if child:IsA("Frame") then
				table.insert(items, child)
			end
		end
		if #items >= 5 then
			table.sort(items, function(a, b)
				return a.LayoutOrder < b.LayoutOrder
			end)
			items[1]:Destroy()
		end
		local long = (kind == "clue" or kind == "event" or kind == "level")
		local card = new("Frame", {
			Parent = toastList, LayoutOrder = order, Size = UDim2.new(1, 0, 0, 0), AutomaticSize = Enum.AutomaticSize.Y,
			BackgroundColor3 = C.Panel, BackgroundTransparency = 0.1, ZIndex = 40,
		}, { Kit.Corner(12), Kit.Pad(10), Kit.Stroke(kindColor[kind] or C.Text, 0.4) })
		local t = Kit.Text({ Parent = card, Text = text, TextColor3 = kindColor[kind] or C.Text, Size = UDim2.new(1, 0, 0, 0), AutoY = true, TextSize = 15, ZIndex = 41 })
		card.Position = UDim2.new(0, 40, 0, 0)
		t.TextTransparency = 1
		Kit.Tween(t, { TextTransparency = 0 }, 0.2)
		task.delay(long and 9 or 4.5, function()
			if card.Parent then
				Kit.Tween(t, { TextTransparency = 1 }, 0.3)
				Kit.Tween(card, { BackgroundTransparency = 1 }, 0.3).Completed:Wait()
				card:Destroy()
			end
		end)
	end
	Kit.Toast = hud.Toast
	Remotes:WaitForChild("Notify").OnClientEvent:Connect(hud.Toast)

	---------------------------------------------------------------------
	-- Nav bar (bottom)
	---------------------------------------------------------------------
	local nav = new("Frame", {
		Parent = root, AnchorPoint = Vector2.new(0.5, 1), Position = UDim2.new(0.5, 0, 1, -12), Size = UDim2.new(0, 0, 0, 72),
		AutomaticSize = Enum.AutomaticSize.X, BackgroundColor3 = C.Panel, BackgroundTransparency = 0.15,
	}, { Kit.Corner(20), Kit.Pad(8), Kit.List(Enum.FillDirection.Horizontal, 6), Kit.Stroke(C.Amber, 0.7) })
	hud.NavButtons = {}
	hud.Dots = {}
	local NAV = {
		{ "Order", "🛒", "Order", Enum.KeyCode.O },
		{ "Inventory", "📦", "Stock", Enum.KeyCode.I },
		{ "Upgrades", "⬆", "Upgrade", Enum.KeyCode.U },
		{ "Journal", "📖", "Journal", Enum.KeyCode.J },
		{ "Customize", "🎨", "Style", Enum.KeyCode.C },
		{ "Town", "🏙", "Town", Enum.KeyCode.T },
		{ "Daily", "🎁", "Daily", Enum.KeyCode.G },
		{ "Settings", "⚙", "Settings", nil },
	}
	hud.Keys = {}
	for i, info in ipairs(NAV) do
		local b = Kit.Button({ Parent = nav, LayoutOrder = i, Size = UDim2.new(0, 64, 1, 0), Text = "" }, function()
			Kit.Open(info[1])
		end, "secondary")
		Kit.Text({ Parent = b, Text = info[2], TextSize = 24, Size = UDim2.new(1, 0, 0, 30), Position = UDim2.new(0, 0, 0, 4), TextXAlignment = Enum.TextXAlignment.Center })
		Kit.Text({ Parent = b, Text = info[3], TextSize = 12, Font = Kit.Fonts.Bold, Size = UDim2.new(1, 0, 0, 16), Position = UDim2.new(0, 0, 1, -20), TextXAlignment = Enum.TextXAlignment.Center, TextColor3 = C.Muted })
		local dot = new("Frame", { Parent = b, Size = UDim2.new(0, 12, 0, 12), Position = UDim2.new(1, -14, 0, 2), BackgroundColor3 = C.Bad, Visible = false }, { Kit.Corner(6) })
		hud.NavButtons[info[1]] = b
		hud.Dots[info[1]] = dot
		if info[4] then
			hud.Keys[info[4]] = info[1]
		end
	end
	hud.Nav = nav

	---------------------------------------------------------------------
	-- Tutorial card + guide beam
	---------------------------------------------------------------------
	local tutorial = new("Frame", {
		Parent = root, AnchorPoint = Vector2.new(0, 0.5), Position = UDim2.new(0, 14, 0.55, 0), Size = UDim2.new(0, 280, 0, 0),
		AutomaticSize = Enum.AutomaticSize.Y, BackgroundColor3 = C.Panel, BackgroundTransparency = 0.1, Visible = false,
	}, { Kit.Corner(14), Kit.Pad(12), Kit.List(nil, 6), Kit.Stroke(C.Teal, 0.4) })
	local tutStep = Kit.Text({ Parent = tutorial, LayoutOrder = 1, Text = "", Font = Kit.Fonts.Bold, TextSize = 13, TextColor3 = C.Teal, Size = UDim2.new(1, 0, 0, 16) })
	local tutTitle = Kit.Text({ Parent = tutorial, LayoutOrder = 2, Text = "", Font = Kit.Fonts.Display, TextSize = 18, Size = UDim2.new(1, 0, 0, 0), AutoY = true })
	local tutText = Kit.Text({ Parent = tutorial, LayoutOrder = 3, Text = "", TextSize = 14, TextColor3 = C.Muted, Size = UDim2.new(1, 0, 0, 0), AutoY = true })
	Kit.Button({ Parent = tutorial, LayoutOrder = 4, Text = "Skip tutorial", Size = UDim2.new(0, 120, 0, 30), TextSize = 13 }, function()
		State.Act("SkipTutorial", {}, Kit)
	end, "secondary")

	local beamAttach0, beamAttach1, beam
	local function setBeamTarget(part)
		local character = player.Character
		local rootPart = character and character:FindFirstChild("HumanoidRootPart")
		if not part or not rootPart then
			if beam then
				beam.Enabled = false
			end
			return
		end
		if not beam then
			beamAttach0 = Instance.new("Attachment")
			beamAttach1 = Instance.new("Attachment")
			beam = Instance.new("Beam")
			beam.Width0 = 0.6
			beam.Width1 = 0.6
			beam.FaceCamera = true
			beam.LightEmission = 1
			beam.Color = ColorSequence.new(C.Teal)
			beam.Transparency = NumberSequence.new(0.3)
			beam.Texture = "rbxasset://textures/particles/sparkles_main.dds"
			beam.TextureSpeed = 2
			beam.TextureLength = 2
			beam.Parent = workspace.Terrain
		end
		beamAttach0.Parent = rootPart
		beamAttach1.Parent = part
		beam.Attachment0 = beamAttach0
		beam.Attachment1 = beamAttach1
		beam.Enabled = true
	end

	local lastStep = nil
	local pulseToken = 0
	function hud.UpdateTutorial(data, force)
		local key = data.Tutorial .. ":" .. (data.PlotIndex or 0)
		if key == lastStep and not force then
			return
		end
		lastStep = key
		pulseToken = pulseToken + 1
		for _, b in pairs(hud.NavButtons) do
			b.Rotation = 0
		end
		local step = TUTORIAL[data.Tutorial]
		tutorial.Visible = step ~= nil
		if not step then
			setBeamTarget(nil)
			return
		end
		tutStep.Text = ("GETTING STARTED  %d/%d"):format(data.Tutorial, #TUTORIAL)
		tutTitle.Text = step.Title
		tutText.Text = step.Text
		local target = nil
		local stores = workspace:FindFirstChild("Stores")
		local storeModel = stores and stores:FindFirstChild("Store" .. (data.PlotIndex or 0))
		if storeModel and step.Target == "Register" then
			target = storeModel:FindFirstChild("Register")
		elseif storeModel and step.Target == "Unit" then
			local unit = storeModel:FindFirstChild("Unit1")
			target = unit and unit:FindFirstChild("Back")
		end
		setBeamTarget(target)
		local navButton = step.Nav and hud.NavButtons[step.Nav]
		if navButton then
			local token = pulseToken
			task.spawn(function()
				local angle = 6
				while token == pulseToken do
					Kit.Tween(navButton, { Rotation = angle }, 0.35, Enum.EasingStyle.Sine)
					angle = -angle
					task.wait(0.35)
				end
				navButton.Rotation = 0
			end)
		end
	end
	player.CharacterAdded:Connect(function()
		task.wait(1)
		if State.Data then
			hud.UpdateTutorial(State.Data, true)
		end
	end)

	Remotes:WaitForChild("Tutorial").OnClientEvent:Connect(function(kind)
		if kind == "CustomerWaiting" and State.Data and State.Data.Tutorial == 1 then
			hud.Toast("A customer is waiting at your register! Press E to ring them up.", "good")
		end
	end)

	---------------------------------------------------------------------
	-- Floating "+$" text and checkout bursts (rendered locally)
	---------------------------------------------------------------------
	Remotes:WaitForChild("Floating").OnClientEvent:Connect(function(position, text, color, burstColors)
		local camera = workspace.CurrentCamera
		if not camera or (camera.CFrame.Position - position).Magnitude > 140 then
			return
		end
		local anchor = Instance.new("Part")
		anchor.Anchored = true
		anchor.CanCollide = false
		anchor.CanQuery = false
		anchor.CanTouch = false
		anchor.Transparency = 1
		anchor.Size = Vector3.new(0.2, 0.2, 0.2)
		anchor.Position = position
		anchor.Parent = workspace.Terrain
		local gui = new("BillboardGui", { Parent = anchor, Size = UDim2.new(0, 220, 0, 40), AlwaysOnTop = true, StudsOffset = Vector3.new(0, 0, 0), LightInfluence = 0 })
		local label = Kit.Text({ Parent = gui, Size = UDim2.fromScale(1, 1), Text = text, Font = Kit.Fonts.Display, TextSize = 26, TextColor3 = color, TextStrokeTransparency = 0.3, TextXAlignment = Enum.TextXAlignment.Center })
		Kit.Tween(gui, { StudsOffset = Vector3.new(0, 4, 0) }, 1.4)
		task.delay(0.8, function()
			Kit.Tween(label, { TextTransparency = 1, TextStrokeTransparency = 1 }, 0.6)
		end)
		if burstColors and #burstColors > 0 and not (State.Data and State.Data.Settings.LowGraphics) then
			local keypoints = {}
			for i, c in ipairs(burstColors) do
				table.insert(keypoints, ColorSequenceKeypoint.new((i - 1) / math.max(1, #burstColors - 1), c))
			end
			if #keypoints == 1 then
				table.insert(keypoints, ColorSequenceKeypoint.new(1, burstColors[1]))
			end
			local emitter = new("ParticleEmitter", {
				Parent = anchor, Rate = 0, Lifetime = NumberRange.new(0.6, 1.2), Speed = NumberRange.new(8, 16),
				SpreadAngle = Vector2.new(180, 180), Color = ColorSequence.new(keypoints), LightEmission = 0.6,
				Size = NumberSequence.new({ NumberSequenceKeypoint.new(0, 0.5), NumberSequenceKeypoint.new(1, 0) }),
				Acceleration = Vector3.new(0, -25, 0), Drag = 2,
			})
			emitter:Emit(28)
		end
		Debris:AddItem(anchor, 2.5)
	end)

	---------------------------------------------------------------------
	-- Refresh from state
	---------------------------------------------------------------------
	function hud.Update(data)
		targetCash = data.Cash
		if shownCash == 0 then
			shownCash = data.Cash
			cashLabel.Text = Util.Money(data.Cash)
		end
		levelLabel.Text = ("Level %d%s"):format(data.Level, data.Title ~= "" and ("  ·  " .. data.Title) or "")
		xpFill.Size = UDim2.new(math.clamp(data.Xp / math.max(1, data.XpNeed), 0, 1), 0, 1, 0)
		ratingLabel.Text = ("%s %.1f  (%d reviews)"):format(Util.Stars(data.Rating.Value), data.Rating.Value, data.Rating.Count)
		-- red dots: rewards waiting
		local dailyReady = data.Daily.LastDay ~= data.Daily.Today
		local challengeReady = false
		for _, ch in ipairs(data.Challenges) do
			if ch.Progress >= ch.Goal and not ch.Claimed then
				challengeReady = true
			end
		end
		hud.Dots.Daily.Visible = dailyReady or challengeReady
		hud.UpdateTutorial(data)
	end

	return hud
end

return Hud
