-- Store ownership, shelves, checkout queue and customization.
--
-- Shelf contents live in the player's save (data.Shelves) and are mirrored
-- to the 3D store. Players stock shelves by walking to them (prompt opens
-- the stock menu; the server re-checks distance on every request).
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local TextService = game:GetService("TextService")

local Shared = ReplicatedStorage:WaitForChild("Shared")
local Config = require(Shared:WaitForChild("Config"))
local Products = require(Shared:WaitForChild("Products"))
local Cosmetics = require(Shared:WaitForChild("Cosmetics"))
local Effects = require(Shared:WaitForChild("Effects"))
local Unlocks = require(Shared:WaitForChild("Unlocks"))
local Util = require(Shared:WaitForChild("Util"))

local Log = require(script.Parent.Log)
local Bus = require(script.Parent.Bus)
local Net = require(script.Parent.Net)
local DataService = require(script.Parent.DataService)
local EconomyService = require(script.Parent.EconomyService)
local CycleService = require(script.Parent.CycleService)
local StoreBuilder = require(script.Parent.StoreBuilder)

local StoreService = {}

local stores = {} -- [plotIndex] = store
local byPlayer = {} -- [Player] = store
local storesFolder

StoreService.OnCheckout = nil -- set by CustomerService: function(store, customer, byPlayer)
StoreService.OnClosing = nil -- set by CustomerService: function(store) returns carts, removes NPCs

local function slotKey(unit, slot)
	return "u" .. unit .. "s" .. slot
end

function StoreService.All()
	return stores
end

function StoreService.ForPlayer(player)
	return byPlayer[player]
end

function StoreService.EffectsFor(player)
	local store = byPlayer[player]
	if store and store.Effects then
		return store.Effects
	end
	local data = DataService.Get(player)
	return Effects.Compute(data and data.Upgrades)
end

-- Which store (if any) contains this world position
function StoreService.StoreAt(position)
	for _, store in pairs(stores) do
		local p = store.CFrame:PointToObjectSpace(position)
		if math.abs(p.X) <= 31 and p.Z >= -21 and p.Z <= 21 and p.Y > -5 and p.Y < 20 then
			return store
		end
	end
	return nil
end

---------------------------------------------------------------------------
-- Shelf state
---------------------------------------------------------------------------
function StoreService.Slots(store, unitIndex)
	local data = store.Owner and DataService.Get(store.Owner)
	local slots = {}
	if data then
		for slot = 1, Config.SlotsPerUnit do
			slots[slot] = data.Shelves[slotKey(unitIndex, slot)]
		end
	end
	return slots
end

function StoreService.RefreshUnit(store, unitIndex)
	StoreBuilder.UpdateUnit(store, unitIndex, StoreService.Slots(store, unitIndex), store.Effects.SlotCapacity)
end

function StoreService.RefreshAllUnits(store)
	for i = 1, StoreBuilder.UnitCount do
		StoreService.RefreshUnit(store, i)
	end
end

-- Every stocked slot in open units: { Unit, Slot, P, Q, Front }
function StoreService.Stocked(store)
	local list = {}
	local data = store.Owner and DataService.Get(store.Owner)
	if not data then
		return list
	end
	for _, unit in ipairs(store.Units) do
		if unit.Open then
			for slot = 1, Config.SlotsPerUnit do
				local entry = data.Shelves[slotKey(unit.Index, slot)]
				if entry and entry.Q > 0 then
					table.insert(list, { Unit = unit.Index, Slot = slot, P = entry.P, Q = entry.Q, Front = unit.Front })
				end
			end
		end
	end
	return list
end

-- A customer takes up to qty units from a slot. Returns how many they got.
function StoreService.Take(store, unitIndex, slot, productId, qty)
	local data = store.Owner and DataService.Get(store.Owner)
	if not data then
		return 0
	end
	local key = slotKey(unitIndex, slot)
	local entry = data.Shelves[key]
	if not entry or entry.P ~= productId or entry.Q <= 0 then
		return 0
	end
	local taken = math.min(qty, entry.Q)
	entry.Q = entry.Q - taken
	if entry.Q <= 0 then
		data.Shelves[key] = nil
	end
	StoreService.RefreshUnit(store, unitIndex)
	Bus.Fire("Dirty", store.Owner)
	return taken
end

-- Put items back (customer left without paying)
function StoreService.Return(store, unitIndex, slot, productId, qty)
	local data = store.Owner and DataService.Get(store.Owner)
	if not data or qty <= 0 then
		return
	end
	local key = slotKey(unitIndex, slot)
	local entry = data.Shelves[key]
	if not entry then
		data.Shelves[key] = { P = productId, Q = qty }
	elseif entry.P == productId then
		entry.Q = entry.Q + qty
	else
		data.Inventory[productId] = (data.Inventory[productId] or 0) + qty
	end
	StoreService.RefreshUnit(store, unitIndex)
	Bus.Fire("Dirty", store.Owner)
end

---------------------------------------------------------------------------
-- Reviews & rating (moving average over roughly the last 30 reviews)
---------------------------------------------------------------------------
function StoreService.AddReview(player, author, stars, text)
	local data = player and DataService.Get(player)
	if not data then
		return
	end
	stars = math.clamp(math.floor(stars), 1, 5)
	local r = data.Rating
	local window = math.min(r.Count, 30)
	r.Value = (r.Value * window + stars) / (window + 1)
	r.Count = r.Count + 1
	table.insert(r.Recent, 1, { A = author, S = stars, T = text })
	while #r.Recent > 6 do
		table.remove(r.Recent)
	end
	if stars == 5 then
		data.Stats.FiveStars = data.Stats.FiveStars + 1
	end
	Net.Notify(player, ("%s %s: \"%s\""):format(Util.Stars(stars), author, text), "review")
	Bus.Fire("Review", player, stars)
	Bus.Fire("RatingChanged", player)
	Bus.Fire("Dirty", player)
end

---------------------------------------------------------------------------
-- Checkout queue
---------------------------------------------------------------------------
function StoreService.JoinQueue(store, customer)
	if #store.Queue >= #StoreBuilder.QueuePoints then
		return false
	end
	table.insert(store.Queue, customer)
	return true
end

function StoreService.LeaveQueue(store, customer)
	for i, c in ipairs(store.Queue) do
		if c == customer then
			table.remove(store.Queue, i)
			return
		end
	end
end

function StoreService.QueuePosition(store, customer)
	for i, c in ipairs(store.Queue) do
		if c == customer then
			return i, StoreBuilder.WorldPoint(store, StoreBuilder.QueuePoints[i])
		end
	end
	return nil
end

local function checkout(store, by)
	local front = store.Queue[1]
	if not front or not front.AtCounter or front.State ~= "Queued" then
		return false
	end
	table.remove(store.Queue, 1)
	front.State = "Paid"
	if StoreService.OnCheckout then
		StoreService.OnCheckout(store, front, by)
	end
	return true
end

---------------------------------------------------------------------------
-- Applying a player's save to their store
---------------------------------------------------------------------------
local function unlockCtx(player, data)
	return Unlocks.Context(data, data.Level)
end

local function applyUniform(player)
	local data = DataService.Get(player)
	local character = player.Character
	if not data or not character then
		return
	end
	local uniform = Cosmetics.UniformById[data.Store.Uniform] or Cosmetics.UniformById.Classic
	local torso = character:FindFirstChild("UpperTorso") or character:FindFirstChild("Torso")
	if not torso then
		return
	end
	local old = character:FindFirstChild("Apron")
	if old then
		old:Destroy()
	end
	local apron = Instance.new("Part")
	apron.Name = "Apron"
	apron.Size = Vector3.new(1.8, 1.9, 0.15)
	apron.Color = uniform.Color
	apron.Material = uniform.Neon and Enum.Material.Neon or Enum.Material.Fabric
	apron.CanCollide = false
	apron.CanQuery = false
	apron.Massless = true
	apron.CFrame = torso.CFrame * CFrame.new(0, -0.35, -torso.Size.Z / 2 - 0.08)
	local weld = Instance.new("WeldConstraint")
	weld.Part0 = torso
	weld.Part1 = apron
	weld.Parent = apron
	apron.Parent = character
end

function StoreService.ApplyAll(store)
	local player = store.Owner
	local data = player and DataService.Get(player)
	if not data then
		return
	end
	store.Effects = Effects.Compute(data.Upgrades)
	local theme = Cosmetics.ThemeById[data.Store.Theme] or Cosmetics.ThemeById.Classic
	StoreBuilder.ApplyTheme(store, theme)
	StoreBuilder.ApplyLayout(store, data.Store.Layout, store.Effects.Expansion)
	local name = data.Store.Name ~= "" and data.Store.Name or (player.DisplayName .. "'s Mart")
	StoreBuilder.SetSign(store, name, Cosmetics.SignColors[data.Store.SignColor] or theme.Sign)
	StoreBuilder.ApplyDecor(store, data.Store.DecorOn)
	StoreService.RefreshAllUnits(store)
	store.Model:SetAttribute("OwnerUserId", player.UserId)
	store.Model:SetAttribute("StoreName", name)
	store.Model:SetAttribute("Rating", data.Rating.Value)
end

local function resetStore(store)
	store.Owner = nil
	store.Active = false
	store.Queue = {}
	store.Effects = Effects.Defaults()
	StoreBuilder.ApplyTheme(store, Cosmetics.ThemeById.Classic)
	StoreBuilder.ApplyLayout(store, "Classic", 1)
	StoreBuilder.SetSign(store, "FOR RENT", Cosmetics.ThemeById.Classic.Sign)
	StoreBuilder.ApplyDecor(store, {})
	StoreBuilder.SetNote(store, false)
	for i = 1, StoreBuilder.UnitCount do
		StoreBuilder.UpdateUnit(store, i, {}, store.Effects.SlotCapacity)
	end
	store.RegisterPrompt.Enabled = false
	store.Model:SetAttribute("OwnerUserId", 0)
	store.Model:SetAttribute("StoreName", "")
end

local function spawnAtStore(player)
	local store = byPlayer[player]
	local character = player.Character
	if not store or not character then
		return
	end
	local root = character:WaitForChild("HumanoidRootPart", 5)
	if not root then
		return
	end
	if not character.Parent then
		character.AncestryChanged:Wait()
	end
	task.wait()
	character:PivotTo(store.CFrame * CFrame.new(StoreBuilder.OwnerSpawn) * CFrame.Angles(0, math.pi, 0))
end

local function claimPlot(player, data)
	for i = 1, Config.PlotCount do
		local store = stores[i]
		if store and not store.Owner then
			store.Owner = player
			store.Active = true
			store.Queue = {}
			store.SpawnTimer = 0
			store.RestockTimer = 0
			byPlayer[player] = store
			player:SetAttribute("PlotIndex", i)
			store.RegisterPrompt.Enabled = true
			StoreService.ApplyAll(store)
			Log.Info("Store", player.Name, "owns plot", i)
			Bus.Fire("StoreOpened", store)
			Bus.Fire("Dirty", player)
			return store
		end
	end
	Net.Notify(player, "All shops on the street are taken. Explore the town and visit other stores!", "info")
	return nil
end

---------------------------------------------------------------------------
-- Note on the counter (mystery)
---------------------------------------------------------------------------
local function showNote(store)
	local p = StoreBuilder.SetNote(store, true)
	if p then
		p.Triggered:Connect(function(player)
			if player == store.Owner then
				Bus.Fire("MysteryObject", player, "messageNote")
			else
				Net.Notify(player, "That note is for the shopkeeper.", "info")
			end
		end)
	end
end

---------------------------------------------------------------------------
-- Requests
---------------------------------------------------------------------------
local function nearUnit(player, store, unitIndex)
	local root = player.Character and player.Character:FindFirstChild("HumanoidRootPart")
	local unit = store.Units[unitIndex]
	return root and unit and (root.Position - unit.CFrame.Position).Magnitude <= Config.StockInteractDistance
end

local function validUnit(store, payload)
	local unitIndex = Net.Int(payload.Unit, 1, StoreBuilder.UnitCount)
	if not unitIndex or not store.Units[unitIndex].Open then
		return nil
	end
	return unitIndex
end

local function registerRequests()
	Net.Handle("StockSlot", { Rate = 6, Burst = 10 }, function(player, payload)
		local store = byPlayer[player]
		local data = DataService.Get(player)
		if not store or not data then
			return Net.Fail("You don't have a store yet.")
		end
		local unitIndex = validUnit(store, payload)
		local slot = Net.Int(payload.Slot, 1, Config.SlotsPerUnit)
		local productId = Net.Key(payload.Product, Products.ById)
		if not unitIndex or not slot or not productId then
			return Net.Fail("Invalid shelf.")
		end
		if not nearUnit(player, store, unitIndex) then
			return Net.Fail("Walk closer to the shelf.")
		end
		local product = Products.ById[productId]
		if product.Cold ~= StoreBuilder.IsCooler(unitIndex) then
			return Net.Fail(product.Cold and "Drinks go in a cooler." or "That goes on a shelf, not in the cooler.")
		end
		local have = data.Inventory[productId] or 0
		if have <= 0 then
			return Net.Fail("None in your backroom. Order more!")
		end
		local key = slotKey(unitIndex, slot)
		local entry = data.Shelves[key]
		if entry and entry.P ~= productId then
			-- swap: old product goes back to the backroom
			data.Inventory[entry.P] = (data.Inventory[entry.P] or 0) + entry.Q
			entry = nil
		end
		local current = entry and entry.Q or 0
		local add = math.min(store.Effects.SlotCapacity - current, have)
		if add <= 0 then
			return Net.Fail("That slot is already full.")
		end
		data.Shelves[key] = { P = productId, Q = current + add }
		data.Inventory[productId] = have - add
		if data.Inventory[productId] <= 0 then
			data.Inventory[productId] = nil
		end
		data.Stats.Stocked = data.Stats.Stocked + add
		StoreService.RefreshUnit(store, unitIndex)
		Bus.Fire("Stocked", player, add)
		Bus.Fire("Dirty", player)
		return Net.Ok(("Stocked %d %s."):format(add, product.Name))
	end)

	Net.Handle("ClearSlot", { Rate = 6, Burst = 10 }, function(player, payload)
		local store = byPlayer[player]
		local data = DataService.Get(player)
		if not store or not data then
			return Net.Fail("No store.")
		end
		local unitIndex = validUnit(store, payload)
		local slot = Net.Int(payload.Slot, 1, Config.SlotsPerUnit)
		if not unitIndex or not slot then
			return Net.Fail("Invalid shelf.")
		end
		if not nearUnit(player, store, unitIndex) then
			return Net.Fail("Walk closer to the shelf.")
		end
		local key = slotKey(unitIndex, slot)
		local entry = data.Shelves[key]
		if not entry then
			return Net.Fail("Already empty.")
		end
		data.Inventory[entry.P] = (data.Inventory[entry.P] or 0) + entry.Q
		data.Shelves[key] = nil
		StoreService.RefreshUnit(store, unitIndex)
		Bus.Fire("Dirty", player)
		return Net.Ok("Moved back to the backroom.")
	end)

	Net.Handle("RestockUnit", { Rate = 3, Burst = 5 }, function(player, payload)
		local store = byPlayer[player]
		local data = DataService.Get(player)
		if not store or not data then
			return Net.Fail("No store.")
		end
		local unitIndex = validUnit(store, payload)
		if not unitIndex then
			return Net.Fail("Invalid shelf.")
		end
		if not nearUnit(player, store, unitIndex) then
			return Net.Fail("Walk closer to the shelf.")
		end
		local total = 0
		for slot = 1, Config.SlotsPerUnit do
			local entry = data.Shelves[slotKey(unitIndex, slot)]
			if entry then
				local have = data.Inventory[entry.P] or 0
				local add = math.min(store.Effects.SlotCapacity - entry.Q, have)
				if add > 0 then
					entry.Q = entry.Q + add
					data.Inventory[entry.P] = have - add
					if data.Inventory[entry.P] <= 0 then
						data.Inventory[entry.P] = nil
					end
					total = total + add
				end
			end
		end
		if total == 0 then
			return Net.Fail("Nothing to refill. Pick products for empty slots or order more stock.")
		end
		data.Stats.Stocked = data.Stats.Stocked + total
		StoreService.RefreshUnit(store, unitIndex)
		Bus.Fire("Stocked", player, total)
		Bus.Fire("Dirty", player)
		return Net.Ok(("Refilled %d items."):format(total))
	end)

	-- Customization -------------------------------------------------------
	local function equip(kind, map, field, after)
		Net.Handle("Set" .. kind, { Rate = 2, Burst = 4 }, function(player, payload)
			local data = DataService.Get(player)
			local store = byPlayer[player]
			if not data then
				return Net.Fail("Still loading.")
			end
			local id = Net.Key(payload.Id, map)
			if not id then
				return Net.Fail("Unknown item.")
			end
			local ok, reason = Unlocks.Check(map[id].Unlock, unlockCtx(player, data))
			if not ok then
				return Net.Fail("Locked: " .. reason)
			end
			data.Store[field] = id
			if after then
				after(player, store, id)
			end
			Bus.Fire("Dirty", player)
			return Net.Ok(map[id].Name .. " equipped.")
		end)
	end
	equip("Theme", Cosmetics.ThemeById, "Theme", function(_, store)
		if store then
			StoreService.ApplyAll(store)
		end
	end)
	equip("Layout", Cosmetics.LayoutById, "Layout", function(player, store, id)
		if store then
			StoreBuilder.ApplyLayout(store, id, store.Effects.Expansion)
			StoreService.RefreshAllUnits(store)
			Bus.Fire("LayoutChanged", store, player)
		end
	end)
	equip("Uniform", Cosmetics.UniformById, "Uniform", function(player)
		applyUniform(player)
	end)
	equip("Effect", Cosmetics.EffectById, "Effect", nil)

	Net.Handle("BuyDecor", { Rate = 2, Burst = 4 }, function(player, payload)
		local data = DataService.Get(player)
		local id = data and Net.Key(payload.Id, Cosmetics.DecorById)
		if not id then
			return Net.Fail("Unknown decoration.")
		end
		local decor = Cosmetics.DecorById[id]
		local ok, reason = Unlocks.Check(decor.Unlock, unlockCtx(player, data))
		if not ok then
			return Net.Fail("Locked: " .. reason)
		end
		if data.Owned.Decor[id] or decor.Price == 0 then
			return Net.Fail("You already own this.")
		end
		if not EconomyService.Spend(player, decor.Price) then
			return Net.Fail("You need " .. Util.Money(decor.Price) .. ".")
		end
		data.Owned.Decor[id] = true
		data.Store.DecorOn[id] = true
		local store = byPlayer[player]
		if store then
			StoreBuilder.ApplyDecor(store, data.Store.DecorOn)
		end
		Bus.Fire("Dirty", player)
		return Net.Ok(decor.Name .. " placed in your store!")
	end)

	Net.Handle("ToggleDecor", { Rate = 4, Burst = 6 }, function(player, payload)
		local data = DataService.Get(player)
		local id = data and Net.Key(payload.Id, Cosmetics.DecorById)
		if not id then
			return Net.Fail("Unknown decoration.")
		end
		local decor = Cosmetics.DecorById[id]
		local unlocked = Unlocks.Check(decor.Unlock, unlockCtx(player, data))
		local owned = data.Owned.Decor[id] or (decor.Price == 0 and unlocked)
		if not owned then
			return Net.Fail("You don't own this yet.")
		end
		data.Store.DecorOn[id] = (not data.Store.DecorOn[id]) or nil
		local store = byPlayer[player]
		if store then
			StoreBuilder.ApplyDecor(store, data.Store.DecorOn)
		end
		Bus.Fire("Dirty", player)
		return Net.Ok(data.Store.DecorOn[id] and (decor.Name .. " placed.") or (decor.Name .. " put away."))
	end)

	Net.Handle("SetSign", { Rate = 0.2, Burst = 2 }, function(player, payload)
		local data = DataService.Get(player)
		local name = Net.Str(payload.Name, 24)
		local color = Net.Int(payload.Color, 1, #Cosmetics.SignColors)
		if not data or not name or not color then
			return Net.Fail("Invalid sign.")
		end
		name = name:gsub("^%s+", ""):gsub("%s+$", "")
		if #name < 2 then
			return Net.Fail("Pick a name with at least 2 characters.")
		end
		local ok, filtered = pcall(function()
			local result = TextService:FilterStringAsync(name, player.UserId, Enum.TextFilterContext.PublicChat)
			return result:GetNonChatStringForBroadcastAsync()
		end)
		if not ok then
			Log.Warn("Store", "text filter failed", filtered)
			return Net.Fail("Couldn't check that name right now. Try again in a moment.")
		end
		data.Store.Name = filtered
		data.Store.SignColor = color
		local store = byPlayer[player]
		if store then
			StoreService.ApplyAll(store)
		end
		Bus.Fire("Dirty", player)
		return Net.Ok("Sign updated: " .. filtered)
	end)
end

---------------------------------------------------------------------------
-- Init
---------------------------------------------------------------------------
function StoreService.Init(worldRefs)
	storesFolder = Instance.new("Folder")
	storesFolder.Name = "Stores"
	storesFolder.Parent = workspace

	for i = 1, Config.PlotCount do
		local store = StoreBuilder.Build(i, worldRefs.Plots[i], storesFolder)
		store.Queue = {}
		store.Effects = Effects.Defaults()
		stores[i] = store
		resetStore(store)

		for _, unit in ipairs(store.Units) do
			unit.Prompt.Triggered:Connect(function(player)
				if player == store.Owner then
					Net.Events.OpenStock:FireClient(player, unit.Index, StoreBuilder.IsCooler(unit.Index))
				else
					Net.Notify(player, "Only the shopkeeper can stock these shelves.", "info")
				end
			end)
		end
		store.RegisterPrompt.Triggered:Connect(function(player)
			if player ~= store.Owner then
				return
			end
			if not checkout(store, player) then
				Net.Notify(player, "Nobody is waiting at the register yet.", "info")
			end
		end)
		store.GuestbookPrompt.Triggered:Connect(function(player)
			if not store.Owner then
				return
			end
			if player == store.Owner then
				Net.Notify(player, "Visitors can rate your store here. Invite friends!", "info")
				return
			end
			Net.Events.OpenRate:FireClient(player, store.Owner.UserId, store.Model:GetAttribute("StoreName"))
		end)
	end

	Bus.On("ProfileLoaded", function(player, data)
		claimPlot(player, data)
		player.CharacterAdded:Connect(function()
			spawnAtStore(player)
			task.wait(0.5)
			applyUniform(player)
		end)
		if player.Character then
			spawnAtStore(player)
			applyUniform(player)
		end
	end)

	-- Runs before the leaving player's final save
	DataService.BeforeRelease(function(player)
		local store = byPlayer[player]
		if store then
			if StoreService.OnClosing then
				StoreService.OnClosing(store)
			end
			byPlayer[player] = nil
			resetStore(store)
			Bus.Fire("StoreClosed", store)
		end
	end)

	Bus.On("UpgradesChanged", function(player)
		local store = byPlayer[player]
		local data = DataService.Get(player)
		if not store or not data then
			return
		end
		local before = store.Effects.Expansion
		store.Effects = Effects.Compute(data.Upgrades)
		if store.Effects.Expansion ~= before then
			StoreBuilder.ApplyLayout(store, data.Store.Layout, store.Effects.Expansion)
			Bus.Fire("LayoutChanged", store, player)
		end
		StoreService.RefreshAllUnits(store)
	end)

	Bus.On("RatingChanged", function(player)
		local store = byPlayer[player]
		local data = DataService.Get(player)
		if store and data then
			store.Model:SetAttribute("Rating", data.Rating.Value)
		end
	end)

	-- Notes on counters: the Mysterious Message event, or the founder story
	Bus.On("NightStarted", function()
		for _, store in pairs(stores) do
			local data = store.Owner and DataService.Get(store.Owner)
			if data then
				data.Stats.Nights = data.Stats.Nights + 1
				local founderNote = data.Clues.f1 and not data.Clues.f2
				if CycleService.EventId() == "Message" or founderNote then
					showNote(store)
				end
				Bus.Fire("Dirty", store.Owner)
			end
		end
	end)
	Bus.On("DayStarted", function()
		for _, store in pairs(stores) do
			StoreBuilder.SetNote(store, false)
		end
	end)

	registerRequests()

	-- Store tick: auto-checkout and the stock clerk
	task.spawn(function()
		while true do
			task.wait(0.5)
			local now = os.clock()
			for _, store in pairs(stores) do
				local data = store.Owner and DataService.Get(store.Owner)
				if data then
					local fx = store.Effects
					local front = store.Queue[1]
					if fx.CheckoutDelay and front and front.AtCounter and front.State == "Queued" and now - front.ArrivedAt >= fx.CheckoutDelay then
						checkout(store, nil)
					end
					if fx.RestockInterval then
						store.RestockTimer = (store.RestockTimer or 0) + 0.5
						if store.RestockTimer >= fx.RestockInterval then
							store.RestockTimer = 0
							for unitIndex = 1, StoreBuilder.UnitCount do
								local done = false
								if store.Units[unitIndex].Open then
									for slot = 1, Config.SlotsPerUnit do
										local entry = data.Shelves[slotKey(unitIndex, slot)]
										local have = entry and data.Inventory[entry.P] or 0
										if entry and entry.Q < fx.SlotCapacity and have > 0 then
											local add = math.min(fx.SlotCapacity - entry.Q, have)
											entry.Q = entry.Q + add
											data.Inventory[entry.P] = have - add
											if data.Inventory[entry.P] <= 0 then
												data.Inventory[entry.P] = nil
											end
											StoreService.RefreshUnit(store, unitIndex)
											Bus.Fire("Dirty", store.Owner)
											done = true
											break
										end
									end
								end
								if done then
									break
								end
							end
						end
					end
				end
			end
		end
	end)
end

StoreService.ApplyUniform = applyUniform
return StoreService
