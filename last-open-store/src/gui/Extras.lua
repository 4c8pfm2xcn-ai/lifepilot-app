-- Town (visit stores + leaderboards), Daily (streak, challenges, weekly
-- event) and Settings panels.
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage:WaitForChild("Shared")
local Config = require(Shared:WaitForChild("Config"))
local Util = require(Shared:WaitForChild("Util"))
local WorldState = ReplicatedStorage:WaitForChild("WorldState")

local Extras = {}

function Extras.Build(Kit, State)
	local C = Kit.Colors
	local new = Kit.new

	---------------------------------------------------------------------
	-- TOWN
	---------------------------------------------------------------------
	local town = Kit.Panel("Town", "TOWN", 700, 520)
	local townList = Kit.Scroll(town.Body, UDim2.new(1, 0, 1, -48), UDim2.new(0, 0, 0, 48))
	local townTab = "Stores"
	local function renderTown()
		Kit.Clear(townList)
		if townTab == "Stores" then
			local result = State.Request("GetStores", {})
			if not result.ok then
				Kit.Text({ Parent = townList, Text = result.msg or "Couldn't load stores.", TextColor3 = C.Bad, Size = UDim2.new(1, 0, 0, 30) })
				return
			end
			local intro = Kit.Card(townList, 0)
			Kit.Text({ Parent = intro, Text = "Visit other shopkeepers, rate their stores in their guestbook, and earn a bonus when you visit a friend each day.", TextColor3 = C.Muted, TextSize = 14, Size = UDim2.new(1, 0, 0, 0), AutoY = true })
			for i, s in ipairs(result.Stores) do
				local c = Kit.Card(townList, i)
				local name = s.StoreName ~= "" and s.StoreName or (s.Name .. "'s Mart")
				local tags = (s.Mine and "  (you)" or "") .. (s.Friend and "  ★ friend" or "")
				Kit.Text({ Parent = c, Text = name .. tags, Font = Kit.Fonts.Bold, TextSize = 17, TextColor3 = s.Friend and C.Teal or C.Text, Size = UDim2.new(1, -150, 0, 22) })
				Kit.Text({ Parent = c, Text = ("%s %.1f (%d reviews)  ·  Keeper: %s  ·  Level %d%s"):format(Util.Stars(s.Rating), s.Rating, s.Reviews, s.Name, s.Level, s.Title ~= "" and ("  ·  " .. s.Title) or ""), TextSize = 13, TextColor3 = C.Muted, Position = UDim2.new(0, 0, 0, 24), Size = UDim2.new(1, -150, 0, 0), AutoY = true })
				Kit.Button({ Parent = c, Text = s.Mine and "Go home" or "Visit", Size = UDim2.new(0, 130, 0, 38), Position = UDim2.new(1, -130, 0, 0) }, function()
					State.Act("Visit", { UserId = s.UserId }, Kit)
					Kit.Close()
				end, s.Mine and "secondary" or nil)
				new("Frame", { Parent = c, Size = UDim2.new(0, 0, 0, 40), BackgroundTransparency = 1 })
			end
		else
			local result = State.Request("GetLeaderboards", {})
			local boards = result.ok and result.Boards or { Earned = {}, Rating = {} }
			for i, info in ipairs({ { "Top earners (all time)", boards.Earned, false }, { "Best rated stores", boards.Rating, true } }) do
				local c = Kit.Card(townList, i)
				Kit.List(nil, 4).Parent = c
				Kit.Text({ Parent = c, LayoutOrder = 0, Text = info[1], Font = Kit.Fonts.Display, TextSize = 18, TextColor3 = C.Amber, Size = UDim2.new(1, 0, 0, 24) })
				if #info[2] == 0 then
					Kit.Text({ Parent = c, LayoutOrder = 1, Text = "No entries yet (leaderboards update every couple of minutes in live servers).", TextColor3 = C.Muted, TextSize = 14, Size = UDim2.new(1, 0, 0, 0), AutoY = true })
				end
				for _, e in ipairs(info[2]) do
					local value = info[3] and ("%.2f ★"):format(e.Value) or Util.Money(e.Value)
					Kit.Text({ Parent = c, LayoutOrder = e.Rank, Text = ("%d.  %s   %s"):format(e.Rank, e.Name, value), TextSize = 15, TextColor3 = e.Rank == 1 and C.Amber or C.Text, Size = UDim2.new(1, 0, 0, 20) })
				end
			end
		end
	end
	local townTabs = Kit.Tabs(town.Body, { { "Stores", "Open Stores" }, { "Leaderboards", "Leaderboards" } }, function(id)
		townTab = id
		renderTown()
	end)
	town.OnOpen = function()
		townTabs.Select(townTab)
	end

	---------------------------------------------------------------------
	-- DAILY
	---------------------------------------------------------------------
	local daily = Kit.Panel("Daily", "DAILY REWARDS", 700, 540)
	local dailyList = Kit.Scroll(daily.Body)
	local function renderDaily()
		local data = State.Data
		if not data then
			return
		end
		Kit.Clear(dailyList)
		local d = data.Daily
		local claimedToday = d.LastDay == d.Today
		local continuing = d.LastDay == d.Today - 1
		local nextStreak = claimedToday and d.Streak or (continuing and d.Streak + 1 or 1)
		local currentIndex = (nextStreak - 1) % #Config.DailyRewards + 1

		local streakCard = Kit.Card(dailyList, 1)
		Kit.List(nil, 10).Parent = streakCard
		Kit.Text({ Parent = streakCard, LayoutOrder = 0, Text = ("Login streak: %d day%s  ·  Best: %d"):format(d.Streak, d.Streak == 1 and "" or "s", d.BestStreak), Font = Kit.Fonts.Display, TextSize = 18, TextColor3 = C.Amber, Size = UDim2.new(1, 0, 0, 24) })
		local row = new("Frame", { Parent = streakCard, LayoutOrder = 1, Size = UDim2.new(1, 0, 0, 70), BackgroundTransparency = 1 }, { Kit.List(Enum.FillDirection.Horizontal, 6) })
		for i, amount in ipairs(Config.DailyRewards) do
			local done = claimedToday and i <= currentIndex or (not claimedToday and i < currentIndex)
			local isNext = i == currentIndex
			local tile = new("Frame", { Parent = row, LayoutOrder = i, Size = UDim2.new(1 / 7, -6, 1, 0), BackgroundColor3 = isNext and C.Amber or (done and C.PanelLight or C.Panel) }, { Kit.Corner(10) })
			Kit.Text({ Parent = tile, Text = "Day " .. i, Font = Kit.Fonts.Bold, TextSize = 13, TextColor3 = isNext and Color3.fromRGB(30, 22, 10) or C.Muted, Size = UDim2.new(1, 0, 0, 24), TextXAlignment = Enum.TextXAlignment.Center })
			Kit.Text({ Parent = tile, Text = (done and "✓ " or "") .. Util.Money(amount) .. (i == 7 and "\n+ bonus" or ""), Font = Kit.Fonts.Bold, TextSize = 14, TextColor3 = isNext and Color3.fromRGB(30, 22, 10) or C.Text, Position = UDim2.new(0, 0, 0, 24), Size = UDim2.new(1, 0, 1, -24), TextXAlignment = Enum.TextXAlignment.Center })
		end
		if claimedToday then
			local hours = math.floor(d.SecondsLeft / 3600)
			local minutes = math.floor(d.SecondsLeft % 3600 / 60)
			Kit.Text({ Parent = streakCard, LayoutOrder = 2, Text = ("Claimed! Next reward in %dh %dm."):format(hours, minutes), TextColor3 = C.Good, Size = UDim2.new(1, 0, 0, 22) })
		else
			Kit.Button({ Parent = streakCard, LayoutOrder = 2, Text = "Claim day " .. nextStreak .. " reward", Size = UDim2.new(0, 220, 0, 42) }, function()
				State.Act("ClaimDaily", {}, Kit)
			end)
		end
		Kit.Text({ Parent = streakCard, LayoutOrder = 3, Text = "Reach a 7-day streak to unlock the Hearts checkout effect and the Sakura Night theme. Missing a day resets the streak, but never your best.", TextColor3 = C.Muted, TextSize = 13, Size = UDim2.new(1, 0, 0, 0), AutoY = true })

		local chCard = Kit.Card(dailyList, 2)
		Kit.List(nil, 8).Parent = chCard
		Kit.Text({ Parent = chCard, LayoutOrder = 0, Text = "Today's challenges", Font = Kit.Fonts.Display, TextSize = 18, TextColor3 = C.Amber, Size = UDim2.new(1, 0, 0, 24) })
		for i, ch in ipairs(data.Challenges) do
			local line = new("Frame", { Parent = chCard, LayoutOrder = i, Size = UDim2.new(1, 0, 0, 48), BackgroundTransparency = 1 })
			Kit.Text({ Parent = line, Text = ("%s  (%d/%d)"):format(ch.Desc, ch.Progress, ch.Goal), Font = Kit.Fonts.Bold, TextSize = 15, Size = UDim2.new(1, -150, 0, 20) })
			local bar = Kit.Bar(line, ch.Progress / ch.Goal, ch.Progress >= ch.Goal and C.Good or C.Amber, 8)
			bar.Position = UDim2.new(0, 0, 0, 28)
			bar.Size = UDim2.new(1, -150, 0, 8)
			if ch.Claimed then
				Kit.Button({ Parent = line, Text = "Claimed ✓", Size = UDim2.new(0, 136, 0, 38), Position = UDim2.new(1, -136, 0, 4) }, nil, "good")
			elseif ch.Progress >= ch.Goal then
				Kit.Button({ Parent = line, Text = "Claim " .. Util.Money(ch.Reward), Size = UDim2.new(0, 136, 0, 38), Position = UDim2.new(1, -136, 0, 4) }, function()
					State.Act("ClaimChallenge", { Index = i }, Kit)
				end)
			else
				Kit.Button({ Parent = line, Text = Util.Money(ch.Reward), Size = UDim2.new(0, 136, 0, 38), Position = UDim2.new(1, -136, 0, 4) }, nil, "locked")
			end
		end
		Kit.Text({ Parent = chCard, LayoutOrder = 10, Text = "New challenges every day at 00:00 UTC.", TextColor3 = C.Muted, TextSize = 13, Size = UDim2.new(1, 0, 0, 18) })

		local weekCard = Kit.Card(dailyList, 3)
		Kit.Text({ Parent = weekCard, Text = "This week: " .. (WorldState:GetAttribute("WeeklyName") or ""), Font = Kit.Fonts.Display, TextSize = 18, TextColor3 = C.Teal, Size = UDim2.new(1, 0, 0, 24) })
		Kit.Text({ Parent = weekCard, Text = WorldState:GetAttribute("WeeklyDesc") or "", TextColor3 = C.Muted, TextSize = 14, Position = UDim2.new(0, 0, 0, 28), Size = UDim2.new(1, 0, 0, 0), AutoY = true })
		new("Frame", { Parent = weekCard, Size = UDim2.new(0, 0, 0, 48), BackgroundTransparency = 1 })

		local month = data.Month
		local seasonText = (month == 10 and "Harvest season! Log in this month to unlock the Harvest Orange uniform forever.")
			or (month == 12 and "Snowfall season! Log in this month to unlock the Snowfall theme forever.")
			or "Seasonal cosmetics arrive in October (Harvest) and December (Snowfall). Log in during those months to keep them forever."
		local seasonCard = Kit.Card(dailyList, 4)
		Kit.Text({ Parent = seasonCard, Text = seasonText, TextColor3 = C.Purple, TextSize = 14, Size = UDim2.new(1, 0, 0, 0), AutoY = true })
	end
	daily.OnOpen = renderDaily

	---------------------------------------------------------------------
	-- SETTINGS
	---------------------------------------------------------------------
	local settings = Kit.Panel("Settings", "SETTINGS", 560, 500)
	local setList = Kit.Scroll(settings.Body)
	local hasAudio = false
	for _, id in pairs(Config.Audio) do
		if id ~= "" then
			hasAudio = true
		end
	end
	local function renderSettings()
		local data = State.Data
		if not data then
			return
		end
		Kit.Clear(setList)
		local s = data.Settings
		local function toggle(order, label, desc, key)
			local c = Kit.Card(setList, order)
			Kit.Text({ Parent = c, Text = label, Font = Kit.Fonts.Bold, TextSize = 16, Size = UDim2.new(1, -120, 0, 20) })
			Kit.Text({ Parent = c, Text = desc, TextSize = 13, TextColor3 = C.Muted, Position = UDim2.new(0, 0, 0, 22), Size = UDim2.new(1, -120, 0, 0), AutoY = true })
			Kit.Button({ Parent = c, Text = s[key] and "ON" or "OFF", Size = UDim2.new(0, 100, 0, 36), Position = UDim2.new(1, -100, 0, 0) }, function()
				State.Request("SetSetting", { Key = key, Value = not s[key] })
			end, s[key] and "good" or "secondary")
			new("Frame", { Parent = c, Size = UDim2.new(0, 0, 0, 38), BackgroundTransparency = 1 })
		end
		toggle(1, "Rain effects", "Falling rain and lightning flashes.", "Rain")
		toggle(2, "Low graphics mode", "Turns off glow, flickering neon and particle effects. Great for older phones.", "LowGraphics")
		toggle(3, "Customer speech bubbles", "Show what customers say above their heads.", "Bubbles")

		local scaleCard = Kit.Card(setList, 4)
		Kit.Text({ Parent = scaleCard, Text = "Interface size", Font = Kit.Fonts.Bold, TextSize = 16, Size = UDim2.new(1, 0, 0, 20) })
		local row = new("Frame", { Parent = scaleCard, Position = UDim2.new(0, 0, 0, 28), Size = UDim2.new(1, 0, 0, 36), BackgroundTransparency = 1 }, { Kit.List(Enum.FillDirection.Horizontal, 8) })
		for i, opt in ipairs({ { "Small", 0.85 }, { "Normal", 1 }, { "Large", 1.15 } }) do
			Kit.Button({ Parent = row, LayoutOrder = i, Text = opt[1], Size = UDim2.new(0, 110, 1, 0) }, function()
				State.Request("SetSetting", { Key = "UIScale", Value = opt[2] })
			end, math.abs(s.UIScale - opt[2]) < 0.01 and nil or "secondary")
		end
		new("Frame", { Parent = scaleCard, Size = UDim2.new(0, 0, 0, 66), BackgroundTransparency = 1 })

		if hasAudio then
			local volCard = Kit.Card(setList, 5)
			Kit.Text({ Parent = volCard, Text = ("Ambience volume: %d%%"):format(math.floor(s.Volume * 100 + 0.5)), Font = Kit.Fonts.Bold, TextSize = 16, Size = UDim2.new(1, 0, 0, 20) })
			local vrow = new("Frame", { Parent = volCard, Position = UDim2.new(0, 0, 0, 28), Size = UDim2.new(1, 0, 0, 36), BackgroundTransparency = 1 }, { Kit.List(Enum.FillDirection.Horizontal, 8) })
			for i, v in ipairs({ 0, 0.25, 0.5, 0.75, 1 }) do
				Kit.Button({ Parent = vrow, LayoutOrder = i, Text = math.floor(v * 100) .. "%", Size = UDim2.new(0, 70, 1, 0) }, function()
					State.Request("SetSetting", { Key = "Volume", Value = v })
				end, math.abs(s.Volume - v) < 0.01 and nil or "secondary")
			end
			new("Frame", { Parent = volCard, Size = UDim2.new(0, 0, 0, 66), BackgroundTransparency = 1 })
		end

		local tut = Kit.Card(setList, 6)
		Kit.Text({ Parent = tut, Text = "Tutorial", Font = Kit.Fonts.Bold, TextSize = 16, Size = UDim2.new(1, -170, 0, 20) })
		Kit.Button({ Parent = tut, Text = "Show it again", Size = UDim2.new(0, 160, 0, 36), Position = UDim2.new(1, -160, 0, 0) }, function()
			State.Act("RestartTutorial", {}, Kit)
		end, "secondary")
		new("Frame", { Parent = tut, Size = UDim2.new(0, 0, 0, 38), BackgroundTransparency = 1 })

		local info = Kit.Card(setList, 7)
		Kit.Text({ Parent = info, Text = (data.Saving and "✓ Your progress is saving." or "⚠ Progress is NOT saving in this session (in Studio, enable API access).") .. "\nControls: walk up to shelves, coolers and the register and press E (or tap the prompt). Shortcuts: O Order · I Stock · U Upgrades · J Journal · C Customize · T Town · G Daily.", TextSize = 13, TextColor3 = data.Saving and C.Muted or C.Bad, Size = UDim2.new(1, 0, 0, 0), AutoY = true })
	end
	settings.OnOpen = renderSettings

	local queued = false
	State.On(function()
		if queued then
			return
		end
		queued = true
		task.delay(0.5, function()
			queued = false
			if Kit.IsOpen("Daily") then
				renderDaily()
			elseif Kit.IsOpen("Settings") then
				renderSettings()
			end
		end)
	end)
end

return Extras
