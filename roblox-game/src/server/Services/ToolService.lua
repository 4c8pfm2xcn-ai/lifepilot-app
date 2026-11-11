-- Builds and hands out team tools: Handcuffs + Taser for police, Boost for criminals.
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Config = require(ReplicatedStorage:WaitForChild("Shared"):WaitForChild("Config"))
local Remotes = require(script.Parent.Remotes)
local ArrestService = require(script.Parent.ArrestService)

local ToolService = {}

local lastBoost = {}

local function makeTool(name, tip, color, onActivated)
	local tool = Instance.new("Tool")
	tool.Name = name
	tool.ToolTip = tip
	tool.CanBeDropped = false
	tool.RequiresHandle = true
	local handle = Instance.new("Part")
	handle.Name = "Handle"
	handle.Size = Vector3.new(0.6, 0.6, 1.4)
	handle.Color = color
	handle.Material = Enum.Material.Metal
	handle.CanCollide = false
	handle.Massless = true
	handle.Parent = tool
	tool.Activated:Connect(function()
		local character = tool.Parent
		local player = character and game:GetService("Players"):GetPlayerFromCharacter(character)
		if player then
			onActivated(player)
		end
	end)
	return tool
end

local function boost(player)
	local now = os.clock()
	if lastBoost[player] and now - lastBoost[player] < Config.BoostCooldown then
		Remotes.Notify(player, ("Boost recharging: %ds"):format(math.ceil(Config.BoostCooldown - (now - lastBoost[player]))), "info")
		return
	end
	local humanoid = player.Character and player.Character:FindFirstChildOfClass("Humanoid")
	if not humanoid or player:GetAttribute("StunnedUntil") then
		return
	end
	lastBoost[player] = now
	humanoid.WalkSpeed = Config.BoostSpeed
	task.delay(Config.BoostDuration, function()
		if humanoid.Parent and not player:GetAttribute("StunnedUntil") then
			humanoid.WalkSpeed = Config.WalkSpeed
		end
	end)
end

function ToolService.GiveTools(player, character, teamKey)
	local backpack = player:WaitForChild("Backpack")
	if player.Character ~= character then
		return
	end
	if teamKey == "Police" then
		makeTool("Handcuffs", "Get close to a wanted criminal and click", Color3.fromRGB(180, 180, 190), ArrestService.TryArrest).Parent = backpack
		makeTool("Taser", "Stun a wanted criminal in front of you (knocks them out of cars)", Color3.fromRGB(240, 220, 40), ArrestService.TryTase).Parent = backpack
		makeTool("Spike Strip", "Throw spikes on the road to pop a getaway car's tires", Color3.fromRGB(255, 60, 60), ArrestService.PlaceSpikes).Parent = backpack
	elseif teamKey == "Criminal" then
		makeTool("Boost", "Short burst of speed to escape the cops", Color3.fromRGB(230, 60, 60), boost).Parent = backpack
	end
end

return ToolService
