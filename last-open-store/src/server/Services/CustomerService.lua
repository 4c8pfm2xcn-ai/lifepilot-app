-- Customer AI + ambient pedestrians.
--
-- Each customer is a real R15 character driven by one coroutine:
--   sidewalk -> door -> browse shelves (by personality) -> queue -> pay or
--   give up -> leave. Shelf stock is removed when they pick items up and put
--   back if they leave angry, so shelves always reflect reality.
-- Spawning is one 0.5s loop over all stores; movement uses Humanoid:MoveTo
-- (pathfinding inside stores) with a stuck-recovery fallback.
local PathfindingService = game:GetService("PathfindingService")
local PhysicsService = game:GetService("PhysicsService")
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage:WaitForChild("Shared")
local Config = require(Shared:WaitForChild("Config"))
local Products = require(Shared:WaitForChild("Products"))
local CustomerTypes = require(Shared:WaitForChild("CustomerTypes"))
local Cosmetics = require(Shared:WaitForChild("Cosmetics"))
local Util = require(Shared:WaitForChild("Util"))

local Log = require(script.Parent.Log)
local Bus = require(script.Parent.Bus)
local Net = require(script.Parent.Net)
local DataService = require(script.Parent.DataService)
local EconomyService = require(script.Parent.EconomyService)
local CycleService = require(script.Parent.CycleService)
local StoreService = require(script.Parent.StoreService)
local StoreBuilder = require(script.Parent.StoreBuilder)

local CustomerService = {}

local NPC_GROUP = "LOS_NPC"
local PLAYER_GROUP = "LOS_Players"
local SKIN = { Color3.fromRGB(255, 220, 190), Color3.fromRGB(235, 190, 150), Color3.fromRGB(200, 150, 110), Color3.fromRGB(150, 100, 70), Color3.fromRGB(110, 75, 55) }

local folder
local template
local customers = {} -- set of customer objects
local perStore = {} -- [store] = count

local function pick(list)
	return list[math.random(1, #list)]
end

---------------------------------------------------------------------------
-- NPC model
---------------------------------------------------------------------------
local function buildFallbackTemplate()
	local model = Instance.new("Model")
	model.Name = "Customer"
	local root = Instance.new("Part")
	root.Name = "HumanoidRootPart"
	root.Size = Vector3.new(2, 2, 1)
	root.Transparency = 1
	root.Parent = model
	local function limb(name, size, offset)
		local p = Instance.new("Part")
		p.Name = name
		p.Size = size
		p.CFrame = root.CFrame * CFrame.new(offset)
		p.CanCollide = false
		p.Massless = true
		p.Parent = model
		local w = Instance.new("WeldConstraint")
		w.Part0 = root
		w.Part1 = p
		w.Parent = p
		return p
	end
	limb("UpperTorso", Vector3.new(2, 2, 1), Vector3.new(0, 0, 0))
	local head = limb("Head", Vector3.new(1.3, 1.3, 1.3), Vector3.new(0, 1.7, 0))
	head.Shape = Enum.PartType.Ball
	limb("LeftUpperLeg", Vector3.new(0.9, 2, 0.9), Vector3.new(-0.5, -2, 0))
	limb("RightUpperLeg", Vector3.new(0.9, 2, 0.9), Vector3.new(0.5, -2, 0))
	local humanoid = Instance.new("Humanoid")
	humanoid.RigType = Enum.HumanoidRigType.R15
	humanoid.HipHeight = 3
	humanoid.Parent = model
	model.PrimaryPart = root
	return model
end

local function buildTemplate()
	local ok, model = pcall(function()
		return Players:CreateHumanoidModelFromDescription(Instance.new("HumanoidDescription"), Enum.HumanoidRigType.R15)
	end)
	if not ok or not model then
		Log.Warn("Customers", "using block NPCs (couldn't build R15 rig):", model)
		return buildFallbackTemplate()
	end
	model.Name = "Customer"
	local animate = model:FindFirstChild("Animate")
	if animate then
		animate:Destroy()
	end
	return model
end

local function makeGui(head, name)
	local gui = Instance.new("BillboardGui")
	gui.Name = "CustomerGui"
	gui.Size = UDim2.new(0, 220, 0, 96)
	gui.StudsOffset = Vector3.new(0, 3, 0)
	gui.MaxDistance = 70
	gui.Adornee = head
	gui.Parent = head
	local bubble = Instance.new("TextLabel")
	bubble.Name = "Bubble"
	bubble.Size = UDim2.new(1, 0, 0, 52)
	bubble.BackgroundColor3 = Color3.fromRGB(255, 255, 255)
	bubble.BackgroundTransparency = 0.05
	bubble.TextColor3 = Color3.fromRGB(30, 30, 40)
	bubble.Font = Enum.Font.GothamMedium
	bubble.TextScaled = true
	bubble.TextWrapped = true
	bubble.Visible = false
	bubble.Parent = gui
	local corner = Instance.new("UICorner")
	corner.CornerRadius = UDim.new(0, 10)
	corner.Parent = bubble
	local pad = Instance.new("UIPadding")
	pad.PaddingLeft = UDim.new(0, 8)
	pad.PaddingRight = UDim.new(0, 8)
	pad.PaddingTop = UDim.new(0, 4)
	pad.PaddingBottom = UDim.new(0, 4)
	pad.Parent = bubble
	local nameLabel = Instance.new("TextLabel")
	nameLabel.Name = "NameLabel"
	nameLabel.Position = UDim2.new(0, 0, 0, 56)
	nameLabel.Size = UDim2.new(1, 0, 0, 20)
	nameLabel.BackgroundTransparency = 1
	nameLabel.TextColor3 = Color3.new(1, 1, 1)
	nameLabel.TextStrokeTransparency = 0.4
	nameLabel.Font = Enum.Font.GothamBold
	nameLabel.TextScaled = true
	nameLabel.Text = name
	nameLabel.Parent = gui
	local barBack = Instance.new("Frame")
	barBack.Name = "Patience"
	barBack.Position = UDim2.new(0.2, 0, 0, 80)
	barBack.Size = UDim2.new(0.6, 0, 0, 8)
	barBack.BackgroundColor3 = Color3.fromRGB(30, 30, 40)
	barBack.Visible = false
	barBack.Parent = gui
	local fill = Instance.new("Frame")
	fill.Name = "Fill"
	fill.Size = UDim2.fromScale(1, 1)
	fill.BackgroundColor3 = Color3.fromRGB(90, 230, 130)
	fill.BorderSizePixel = 0
	fill.Parent = barBack
	return { Gui = gui, Bubble = bubble, Bar = barBack, Fill = fill, Name = nameLabel }
end

local function setupAnimations(c)
	local animator = c.Humanoid:FindFirstChildOfClass("Animator")
	if not animator then
		animator = Instance.new("Animator")
		animator.Parent = c.Humanoid
	end
	local tracks = {}
	for key, id in pairs(Config.NPCAnimations) do
		local ok, track = pcall(function()
			local anim = Instance.new("Animation")
			anim.AnimationId = id
			return animator:LoadAnimation(anim)
		end)
		if ok and track then
			track.Looped = true
			tracks[key] = track
		end
	end
	if tracks.Idle then
		tracks.Idle:Play()
	end
	c.Humanoid.Running:Connect(function(speed)
		if not tracks.Walk then
			return
		end
		if speed > 0.5 then
			if not tracks.Walk.IsPlaying then
				tracks.Walk:Play(0.15)
			end
			tracks.Walk:AdjustSpeed(speed / 12)
		elseif tracks.Walk.IsPlaying then
			tracks.Walk:Stop(0.2)
		end
	end)
end

local function spawnNpc(typeDef, position, showGui)
	local model = template:Clone()
	local skin = pick(SKIN)
	for _, d in ipairs(model:GetDescendants()) do
		if d:IsA("BasePart") then
			d.CollisionGroup = NPC_GROUP
			local n = d.Name
			if n:find("Torso") or n:find("Arm") or n:find("Hand") then
				d.Color = typeDef and typeDef.Shirt or Color3.fromHSV(math.random(), 0.4, 0.8)
			elseif n:find("Leg") or n:find("Foot") then
				d.Color = typeDef and typeDef.Pants or Color3.fromRGB(50, 55, 70)
			elseif n == "Head" then
				d.Color = (typeDef and typeDef.Id == "buttons") and typeDef.Shirt or skin
			end
		end
	end
	local humanoid = model:FindFirstChildOfClass("Humanoid")
	humanoid.DisplayDistanceType = Enum.HumanoidDisplayDistanceType.None
	humanoid.WalkSpeed = Config.NPCWalkSpeed * (typeDef and typeDef.Speed or 1)
	humanoid.BreakJointsOnDeath = false
	humanoid:SetStateEnabled(Enum.HumanoidStateType.Dead, false)
	model:PivotTo(CFrame.new(position + Vector3.new(0, 3, 0)))
	if typeDef and typeDef.Scale then
		pcall(function()
			model:ScaleTo(typeDef.Scale)
		end)
	end
	model.Parent = folder
	local root = model:FindFirstChild("HumanoidRootPart")
	pcall(function()
		root:SetNetworkOwner(nil)
	end)
	local c = { Model = model, Humanoid = humanoid, Root = root, Type = typeDef }
	local head = model:FindFirstChild("Head")
	if showGui and head then
		c.Gui = makeGui(head, typeDef.Name)
	end
	setupAnimations(c)
	return c
end

---------------------------------------------------------------------------
-- Movement + speech
---------------------------------------------------------------------------
-- Humanoid:MoveTo gives up after 8 seconds, so long walks re-issue it every
-- 6 seconds until the target is reached or the overall timeout expires.
local function moveTo(c, target, timeout)
	local started = os.clock()
	while c.Model.Parent and os.clock() - started < timeout do
		local done, reached = false, false
		local conn = c.Humanoid.MoveToFinished:Connect(function(r)
			done = true
			reached = r
		end)
		c.Humanoid:MoveTo(target)
		local legStart = os.clock()
		while not done and c.Model.Parent and os.clock() - legStart < 6 and os.clock() - started < timeout do
			task.wait(0.1)
		end
		conn:Disconnect()
		if done then
			local flat = ((c.Root.Position - target) * Vector3.new(1, 0, 1)).Magnitude
			if reached or flat < 3 then
				return true
			end
			task.wait(0.2) -- blocked; try again shortly
		end
	end
	return false
end

local pathParams = { AgentRadius = 1.6, AgentHeight = 5, AgentCanJump = false, WaypointSpacing = 5 }

local function walk(c, target, usePath)
	if not c.Model.Parent then
		return
	end
	local speed = math.max(c.Humanoid.WalkSpeed, 4)
	local function timeFor(from)
		return (from - target).Magnitude / speed + 2
	end
	local followed = false
	if usePath then
		local path = PathfindingService:CreatePath(pathParams)
		local ok = pcall(function()
			path:ComputeAsync(c.Root.Position, target)
		end)
		if ok and path.Status == Enum.PathStatus.Success then
			followed = true
			local last = c.Root.Position
			for i, waypoint in ipairs(path:GetWaypoints()) do
				if i > 1 then
					if not c.Model.Parent then
						return
					end
					moveTo(c, waypoint.Position, (waypoint.Position - last).Magnitude / speed + 1.5)
					last = waypoint.Position
				end
			end
		end
	end
	if not followed then
		moveTo(c, target, timeFor(c.Root.Position))
	end
	-- stuck recovery
	if c.Model.Parent and (c.Root.Position - target) * Vector3.new(1, 0, 1) ~= Vector3.zero then
		local flatDist = ((c.Root.Position - target) * Vector3.new(1, 0, 1)).Magnitude
		if flatDist > 5 then
			c.Model:PivotTo(CFrame.new(target + Vector3.new(0, 3, 0)))
		end
	end
end

local function say(c, text, seconds)
	if not c.Gui or not text then
		return
	end
	c.Gui.Bubble.Text = text
	c.Gui.Bubble.Visible = true
	c.SayToken = (c.SayToken or 0) + 1
	local token = c.SayToken
	task.delay(seconds or 3.5, function()
		if c.SayToken == token and c.Gui and c.Gui.Bubble.Parent then
			c.Gui.Bubble.Visible = false
		end
	end)
end

local function face(c, point)
	local p = c.Root.Position
	c.Root.CFrame = CFrame.lookAt(p, Vector3.new(point.X, p.Y, point.Z))
end

local function despawn(c)
	customers[c] = nil
	if c.Store and perStore[c.Store] then
		perStore[c.Store] = math.max(0, perStore[c.Store] - 1)
	end
	if c.Model then
		c.Model:Destroy()
	end
end

---------------------------------------------------------------------------
-- Choosing who comes in
---------------------------------------------------------------------------
local function eligible(t, data)
	local s = t.Spawn
	local night = CycleService.IsNight()
	local weather = CycleService.Weather()
	if s.Time == "Day" and night then
		return false
	end
	if s.Time == "Night" and not night then
		return false
	end
	if s.Weather == "Rain" and weather ~= "Rain" and weather ~= "Storm" then
		return false
	end
	if s.HourMin then
		local clock = CycleService.Clock()
		if clock < s.HourMin or clock >= s.HourMax then
			return false
		end
	end
	if s.RequiresClue and not data.Clues[s.RequiresClue] then
		return false
	end
	return true
end

local function chooseType(store, data)
	local mods = CycleService.Mods()
	local mysteryChance = Config.MysteryCustomerChance * store.Effects.RareChance * (mods.MysteryMult or 1)
	if math.random() < mysteryChance then
		local options = {}
		for _, t in ipairs(CustomerTypes.List) do
			if t.Mystery and eligible(t, data) then
				table.insert(options, t)
			end
		end
		if #options > 0 then
			return pick(options)
		end
	end
	local total, weighted = 0, {}
	for _, t in ipairs(CustomerTypes.List) do
		if not t.Mystery and eligible(t, data) then
			local w = t.Weight * ((mods.TypeBoost and mods.TypeBoost[t.Id]) or 1)
			total = total + w
			table.insert(weighted, { t, w })
		end
	end
	local roll = math.random() * total
	for _, entry in ipairs(weighted) do
		roll = roll - entry[2]
		if roll <= 0 then
			return entry[1]
		end
	end
	return weighted[1] and weighted[1][1]
end

local function wants(t, product)
	if t.Mystery and product.Secret then
		return true -- mysterious visitors are drawn to secret products
	end
	if t.Rarities then
		return table.find(t.Rarities, product.Rarity) ~= nil
	end
	return table.find(t.Prefers, product.Category) ~= nil
end

---------------------------------------------------------------------------
-- Reviews
---------------------------------------------------------------------------
local function review(store, c, stars, angry)
	local t = c.Type
	if not (t.AlwaysReview or math.random() < (angry and 0.6 or Config.ReviewChance)) then
		return
	end
	local text = stars >= 4 and pick(t.Lines.Good) or pick(t.Lines.Bad)
	StoreService.AddReview(store.Owner, t.Name, stars, text)
end

---------------------------------------------------------------------------
-- Paying (called by StoreService when the customer is rung up)
---------------------------------------------------------------------------
local function onCheckout(store, c, by)
	local owner = store.Owner
	local data = owner and DataService.Get(owner)
	if not data then
		return
	end
	local waitTime = os.clock() - (c.ArrivedAt or os.clock())
	local revenue, tip, categories = EconomyService.PriceSale(c.Cart, { Customer = c.Type, Effects = store.Effects, WaitTime = waitTime })
	EconomyService.AddCash(owner, revenue + tip, "Sale")
	EconomyService.AddXp(owner, math.ceil(revenue * 0.6) + 2)

	local items = 0
	for _, line in ipairs(c.Cart) do
		items = items + line.Q
		data.Products[line.P] = (data.Products[line.P] or 0) + line.Q
	end
	data.Stats.Served = data.Stats.Served + 1
	data.Stats.Sold = data.Stats.Sold + items
	local firstMeet = data.Customers[c.Type.Id] == nil
	data.Customers[c.Type.Id] = (data.Customers[c.Type.Id] or 0) + 1
	if firstMeet then
		Net.Notify(owner, ("New customer met: %s. %s"):format(c.Type.Name, c.Type.Desc), "good")
	end

	local effect = Cosmetics.EffectById[data.Store.Effect] or Cosmetics.EffectById.None
	local text = "+" .. Util.Money(revenue) .. (tip > 0 and ("  (+" .. Util.Money(tip) .. " tip)") or "")
	Net.Events.Floating:FireAllClients(store.Register.Position + Vector3.new(0, 2, 0), text, Color3.fromRGB(120, 255, 150), effect.Colors)
	say(c, pick(c.Type.Lines.Happy), 3)

	local patienceTotal = c.PatienceTotal or 30
	local frac = math.clamp(waitTime / patienceTotal, 0, 1)
	local stars = 5 - (frac > 0.66 and 2 or (frac > 0.33 and 1 or 0)) - (c.Missing and 1 or 0)
	if c.Type.Strict and (frac > 0.15 or c.Missing) then
		stars = stars - 1
	end
	review(store, c, math.clamp(stars, 1, 5), false)

	local info = {
		Customer = c.Type.Id, Cart = c.Cart, Revenue = revenue, Tip = tip, Items = items,
		Categories = categories, Night = CycleService.IsNight(), WaitTime = waitTime, ByHand = by ~= nil,
	}
	Bus.Fire("Sale", owner, info)
	Bus.Fire("CustomerServed", owner, c.Type.Id, c.Cart)
	Bus.Fire("Dirty", owner)
end

---------------------------------------------------------------------------
-- The customer's visit
---------------------------------------------------------------------------
local function visit(c)
	local store = c.Store
	local owner = store.Owner
	local function alive()
		return c.Model.Parent ~= nil and store.Active and store.Owner == owner
	end
	local t = c.Type
	local data = DataService.Get(owner)
	if not data then
		return
	end

	walk(c, StoreBuilder.WorldPoint(store, StoreBuilder.DoorOutside), false)
	if not alive() then
		return
	end
	walk(c, StoreBuilder.WorldPoint(store, StoreBuilder.DoorInside), false)
	if not alive() then
		return
	end
	say(c, pick(t.Lines.Enter), 3.5)

	-- Decide what to look for
	local stocked = StoreService.Stocked(store)
	local matching = {}
	for _, entry in ipairs(stocked) do
		local product = Products.ById[entry.P]
		if product and wants(t, product) then
			table.insert(matching, entry)
		end
	end
	if #matching == 0 then
		c.Missing = true
		if t.Flexible then
			matching = stocked
		end
	end
	-- Mysterious customers go for secret products first
	table.sort(matching, function(a, b)
		local pa, pb = Products.ById[a.P], Products.ById[b.P]
		if t.Mystery and pa.Secret ~= pb.Secret then
			return pa.Secret == true
		end
		return false
	end)
	if not t.Mystery then
		for i = #matching, 2, -1 do
			local j = math.random(1, i)
			matching[i], matching[j] = matching[j], matching[i]
		end
	end

	local budget = math.random(t.Budget[1], t.Budget[2])
	local wantCount = math.random(t.Items[1], t.Items[2])
	c.Cart = {}
	local seen = {}
	for _, entry in ipairs(matching) do
		if #c.Cart >= wantCount or not alive() then
			break
		end
		if not seen[entry.P] then
			seen[entry.P] = true
			local product = Products.ById[entry.P]
			local maxByBudget = math.floor(budget / product.Price)
			local qty = math.clamp(math.random(1, 2), 1, math.max(1, maxByBudget))
			if maxByBudget >= 1 or (#c.Cart == 0 and product.Price <= budget * 2) then
				walk(c, entry.Front, true)
				if not alive() then
					return
				end
				face(c, store.Units[entry.Unit].CFrame.Position)
				task.wait(math.random(12, 26) / 10)
				local taken = StoreService.Take(store, entry.Unit, entry.Slot, entry.P, qty)
				if taken > 0 then
					table.insert(c.Cart, { P = entry.P, Q = taken, Unit = entry.Unit, Slot = entry.Slot })
					budget = budget - product.Price * taken
				else
					c.Missing = true -- someone else grabbed the last one
				end
			end
		end
	end

	local function giveBack()
		for _, line in ipairs(c.Cart) do
			StoreService.Return(store, line.Unit, line.Slot, line.P, line.Q)
		end
		c.Cart = {}
	end

	if #c.Cart == 0 then
		say(c, pick(t.Lines.Sad), 3)
		if c.Missing then
			review(store, c, 2, false)
		end
		return
	end

	-- Queue up
	c.PatienceTotal = t.Patience * store.Effects.Patience
	c.State = "Queued"
	local joinedAt = os.clock()
	while alive() and not StoreService.JoinQueue(store, c) do
		task.wait(0.5)
		if os.clock() - joinedAt > c.PatienceTotal / 2 then
			say(c, pick(t.Lines.Sad), 3)
			giveBack()
			review(store, c, 1, true)
			data.Stats.Angry = data.Stats.Angry + 1
			return
		end
	end
	if c.Gui then
		c.Gui.Bar.Visible = true
	end
	local lastIndex = nil
	local queueStart = os.clock()
	while alive() and c.State == "Queued" do
		local index, point = StoreService.QueuePosition(store, c)
		if not index then
			break
		end
		if index ~= lastIndex then
			lastIndex = index
			c.AtCounter = false
			walk(c, point, false)
			face(c, store.Register.Position)
			if index == 1 and c.State == "Queued" then
				c.AtCounter = true
				c.ArrivedAt = os.clock()
				if store.Owner then
					Net.Events.Tutorial:FireClient(store.Owner, "CustomerWaiting")
				end
			end
		end
		local elapsed = os.clock() - queueStart
		local left = 1 - elapsed / c.PatienceTotal
		if c.Gui then
			c.Gui.Fill.Size = UDim2.fromScale(math.clamp(left, 0, 1), 1)
			c.Gui.Fill.BackgroundColor3 = left > 0.5 and Color3.fromRGB(90, 230, 130) or (left > 0.25 and Color3.fromRGB(255, 200, 60) or Color3.fromRGB(240, 70, 70))
		end
		if left <= 0 and c.State == "Queued" then
			StoreService.LeaveQueue(store, c)
			c.State = "Angry"
			say(c, pick(t.Lines.Sad), 3)
			giveBack()
			review(store, c, 1, true)
			data.Stats.Angry = data.Stats.Angry + 1
			Bus.Fire("CustomerLeftAngry", owner, t.Id)
			break
		end
		task.wait(0.25)
	end
	if c.Gui then
		c.Gui.Bar.Visible = false
	end
	if c.State == "Paid" then
		task.wait(1.2)
	end
end

local function runCustomer(c)
	local ok, err = pcall(visit, c)
	if not ok then
		Log.Warn("Customers", "visit failed:", err)
	end
	-- If something interrupted the visit mid-queue, make sure nothing is stuck
	if c.Store and c.State == "Queued" then
		StoreService.LeaveQueue(c.Store, c)
		for _, line in ipairs(c.Cart or {}) do
			StoreService.Return(c.Store, line.Unit, line.Slot, line.P, line.Q)
		end
	end
	if c.Model.Parent and c.Store.Active then
		pcall(function()
			walk(c, StoreBuilder.WorldPoint(c.Store, StoreBuilder.DoorInside), true)
			walk(c, StoreBuilder.WorldPoint(c.Store, StoreBuilder.DoorOutside), false)
			walk(c, StoreBuilder.WorldPoint(c.Store, pick(StoreBuilder.Sidewalk)), false)
		end)
	end
	despawn(c)
end

local function countAll()
	local n = 0
	for _ in pairs(customers) do
		n = n + 1
	end
	return n
end

local function spawnCustomer(store, typeDef)
	local start = StoreBuilder.WorldPoint(store, pick(StoreBuilder.Sidewalk))
	local c = spawnNpc(typeDef, start, true)
	c.Store = store
	c.State = "Arriving"
	customers[c] = true
	perStore[store] = (perStore[store] or 0) + 1
	task.spawn(runCustomer, c)
end

---------------------------------------------------------------------------
-- Pedestrians (ambient life)
---------------------------------------------------------------------------
local function pedestrian(route)
	while true do
		local c = spawnNpc(nil, route[1], false)
		local ok = pcall(function()
			for lap = 1, 3 do
				for _, point in ipairs(route) do
					walk(c, point + Vector3.new(math.random(-2, 2), 0, math.random(-2, 2)), false)
				end
				if lap == 3 then
					break
				end
			end
		end)
		if not ok then
			Log.Warn("Customers", "pedestrian route failed")
		end
		c.Model:Destroy()
		task.wait(math.random(3, 10))
	end
end

---------------------------------------------------------------------------
-- Init
---------------------------------------------------------------------------
function CustomerService.Init(worldRefs)
	folder = Instance.new("Folder")
	folder.Name = "Customers"
	folder.Parent = workspace

	pcall(function()
		PhysicsService:RegisterCollisionGroup(NPC_GROUP)
		PhysicsService:RegisterCollisionGroup(PLAYER_GROUP)
	end)
	pcall(function()
		PhysicsService:CollisionGroupSetCollidable(NPC_GROUP, NPC_GROUP, false)
		PhysicsService:CollisionGroupSetCollidable(NPC_GROUP, PLAYER_GROUP, false)
	end)
	local function groupCharacter(character)
		for _, d in ipairs(character:GetDescendants()) do
			if d:IsA("BasePart") then
				d.CollisionGroup = PLAYER_GROUP
			end
		end
		character.DescendantAdded:Connect(function(d)
			if d:IsA("BasePart") then
				d.CollisionGroup = PLAYER_GROUP
			end
		end)
	end
	local function onPlayer(player)
		player.CharacterAdded:Connect(groupCharacter)
		if player.Character then
			groupCharacter(player.Character)
		end
	end
	Players.PlayerAdded:Connect(onPlayer)
	for _, player in ipairs(Players:GetPlayers()) do
		onPlayer(player)
	end

	template = buildTemplate()
	StoreService.OnCheckout = onCheckout

	-- Owner is leaving: put every cart back on the shelves (before the
	-- final save), then remove the store's customers.
	StoreService.OnClosing = function(store)
		for c in pairs(customers) do
			if c.Store == store then
				if c.State ~= "Paid" then
					for _, line in ipairs(c.Cart or {}) do
						StoreService.Return(store, line.Unit, line.Slot, line.P, line.Q)
					end
				end
				c.Cart = {}
				c.State = "Closed"
				despawn(c)
			end
		end
		perStore[store] = 0
	end

	-- Spawner
	task.spawn(function()
		while true do
			task.wait(0.5)
			for _, store in pairs(StoreService.All()) do
				local data = store.Active and store.Owner and DataService.Get(store.Owner)
				if data then
					local fx = store.Effects
					local mods = CycleService.Mods()
					local rate = fx.CustomerRate * (mods.CustomerRate or 1)
					if CycleService.IsNight() then
						rate = rate * Config.NightCustomerBonus * fx.NightRate
					end
					rate = rate * (0.7 + (data.Rating.Value / 5) * 0.6)
					if data.Level <= 2 then
						rate = rate * 1.3 -- a lively first few minutes
					end
					store.SpawnTimer = (store.SpawnTimer or 0) + 0.5
					local interval = Config.CustomerSpawnInterval / rate
					if store.SpawnTimer >= interval then
						store.SpawnTimer = 0
						local hasStock = #StoreService.Stocked(store) > 0
						if hasStock and (perStore[store] or 0) < fx.MaxCustomers and countAll() < Config.GlobalCustomerCap then
							local typeDef = chooseType(store, data)
							if typeDef then
								spawnCustomer(store, typeDef)
							end
						end
					end
				end
			end
		end
	end)

	for i = 1, Config.Pedestrians do
		local route = worldRefs.Waypoints[(i - 1) % #worldRefs.Waypoints + 1]
		task.delay(i * 2, pedestrian, route)
	end
end

return CustomerService
