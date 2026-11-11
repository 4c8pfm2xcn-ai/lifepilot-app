-- Police actions: handcuff arrests and taser stuns. All checks are server-side.
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Debris = game:GetService("Debris")

local Config = require(ReplicatedStorage:WaitForChild("Shared"):WaitForChild("Config"))
local Remotes = require(script.Parent.Remotes)
local DataService = require(script.Parent.DataService)
local TeamService = require(script.Parent.TeamService)
local JailService = require(script.Parent.JailService)

local ArrestService = {}

local lastCuff = {}
local lastTase = {}

local function rootOf(player)
	local character = player.Character
	local humanoid = character and character:FindFirstChildOfClass("Humanoid")
	if not humanoid or humanoid.Health <= 0 then
		return nil
	end
	return character:FindFirstChild("HumanoidRootPart"), humanoid
end

function ArrestService.IsWanted(player)
	return player.Team == TeamService.Teams.Criminal
		and ((player:GetAttribute("Bounty") or 0) > 0 or (player:GetAttribute("Bag") or 0) > 0)
end

-- Nearest wanted criminal within range; requireFacing limits to a cone in front of the cop
local function findTarget(cop, range, requireFacing)
	local copRoot = rootOf(cop)
	if not copRoot then
		return nil
	end
	local best, bestDist = nil, range
	for _, player in ipairs(Players:GetPlayers()) do
		if player ~= cop and ArrestService.IsWanted(player) then
			local root = rootOf(player)
			if root then
				local offset = root.Position - copRoot.Position
				local dist = offset.Magnitude
				local facingOk = true
				if requireFacing and dist > 4 then
					facingOk = copRoot.CFrame.LookVector:Dot(offset.Unit) > 0.6
				end
				if dist <= bestDist and facingOk then
					best, bestDist = player, dist
				end
			end
		end
	end
	return best
end

function ArrestService.TryArrest(cop)
	if cop.Team ~= TeamService.Teams.Police then
		return
	end
	local now = os.clock()
	if lastCuff[cop] and now - lastCuff[cop] < 0.5 then
		return
	end
	lastCuff[cop] = now

	local target = findTarget(cop, Config.ArrestRange, false)
	if not target then
		return
	end
	local bounty = target:GetAttribute("Bounty") or 0
	local reward = (Config.ArrestBaseReward + math.floor(bounty * Config.ArrestBountyShare)) * DataService.Multiplier(cop)
	DataService.AddCash(cop, reward)
	DataService.AddXp(cop, Config.ArrestXp)
	DataService.Increment(cop, "Arrests")

	target:SetAttribute("Bag", 0)
	target:SetAttribute("Bounty", 0)
	JailService.Jail(target)

	Remotes.Notify(cop, ("You arrested %s and earned $%d!"):format(target.Name, reward), "good")
	Remotes.NotifyAll(("%s was arrested by Officer %s"):format(target.Name, cop.Name), "info")
end

local function zap(fromPos, toPos)
	local dist = (toPos - fromPos).Magnitude
	local beam = Instance.new("Part")
	beam.Anchored = true
	beam.CanCollide = false
	beam.CanQuery = false
	beam.CanTouch = false
	beam.Material = Enum.Material.Neon
	beam.Color = Color3.fromRGB(120, 200, 255)
	beam.Size = Vector3.new(0.2, 0.2, dist)
	beam.CFrame = CFrame.lookAt(fromPos, toPos) * CFrame.new(0, 0, -dist / 2)
	beam.Parent = workspace
	Debris:AddItem(beam, 0.15)
end

function ArrestService.TryTase(cop)
	if cop.Team ~= TeamService.Teams.Police then
		return
	end
	local now = os.clock()
	if lastTase[cop] and now - lastTase[cop] < Config.TaserCooldown then
		return
	end
	local target = findTarget(cop, Config.TaserRange, true)
	if not target then
		return
	end
	lastTase[cop] = now

	local copRoot = rootOf(cop)
	local root, humanoid = rootOf(target)
	if not copRoot or not root then
		return
	end
	zap(copRoot.Position, root.Position)

	-- Knock them out of vehicles and freeze them briefly
	humanoid.Sit = false
	local stunnedUntil = workspace:GetServerTimeNow() + Config.TaserStun
	target:SetAttribute("StunnedUntil", stunnedUntil)
	humanoid.WalkSpeed = 0
	humanoid.JumpHeight = 0
	Remotes.Notify(target, "You've been TASED!", "bad")
	task.delay(Config.TaserStun, function()
		if humanoid.Parent and target:GetAttribute("StunnedUntil") == stunnedUntil then
			humanoid.WalkSpeed = Config.WalkSpeed
			humanoid.JumpHeight = Config.JumpHeight
			target:SetAttribute("StunnedUntil", nil)
		end
	end)
end

function ArrestService.Init()
	Players.PlayerRemoving:Connect(function(player)
		lastCuff[player] = nil
		lastTase[player] = nil
	end)
end

return ArrestService
