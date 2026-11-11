-- Robux purchases: VIP game pass and cash developer products.
-- Set the IDs in Shared/Config.lua after creating them in the Creator Dashboard.
local MarketplaceService = game:GetService("MarketplaceService")
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")

local Config = require(ReplicatedStorage:WaitForChild("Shared"):WaitForChild("Config"))
local Remotes = require(script.Parent.Remotes)
local DataService = require(script.Parent.DataService)

local ShopService = {}

local productsById = {}
for _, product in ipairs(Config.CashProducts) do
	if product.Id ~= 0 then
		productsById[product.Id] = product
	end
end

local function checkVip(player)
	local passId = Config.GamePasses.VIP
	if passId == 0 then
		return
	end
	local ok, owns = pcall(function()
		return MarketplaceService:UserOwnsGamePassAsync(player.UserId, passId)
	end)
	if ok and owns then
		DataService.SetVip(player, true)
	end
end

local function processReceipt(info)
	local player = Players:GetPlayerByUserId(info.PlayerId)
	if not player then
		return Enum.ProductPurchaseDecision.NotProcessedYet
	end
	local product = productsById[info.ProductId]
	local profile = DataService.Get(player)
	if not product or not profile then
		return Enum.ProductPurchaseDecision.NotProcessedYet
	end

	-- Idempotency: never grant the same purchase twice
	local receipts = profile.Data.Receipts
	for _, id in ipairs(receipts) do
		if id == info.PurchaseId then
			return Enum.ProductPurchaseDecision.PurchaseGranted
		end
	end

	DataService.AddCash(player, product.Cash)
	table.insert(receipts, info.PurchaseId)
	while #receipts > 50 do
		table.remove(receipts, 1)
	end

	if DataService.Save(player) or RunService:IsStudio() then
		Remotes.Notify(player, ("Thanks for your purchase! +$%d"):format(product.Cash), "good")
		return Enum.ProductPurchaseDecision.PurchaseGranted
	end
	-- Roll back so the retry doesn't double-grant
	DataService.AddCash(player, -product.Cash)
	table.remove(receipts)
	return Enum.ProductPurchaseDecision.NotProcessedYet
end

function ShopService.Init()
	MarketplaceService.ProcessReceipt = processReceipt

	local function onJoin(player)
		if DataService.WaitForProfile(player) then
			checkVip(player)
		end
	end
	Players.PlayerAdded:Connect(onJoin)
	for _, player in ipairs(Players:GetPlayers()) do
		task.spawn(onJoin, player)
	end

	MarketplaceService.PromptGamePassPurchaseFinished:Connect(function(player, passId, purchased)
		if purchased and passId == Config.GamePasses.VIP then
			DataService.SetVip(player, true)
			Remotes.Notify(player, "VIP unlocked! You now earn 2x cash and carry a bigger bag.", "good")
		end
	end)
end

return ShopService
