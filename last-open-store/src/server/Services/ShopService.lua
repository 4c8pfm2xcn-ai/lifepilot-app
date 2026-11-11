-- Optional Robux cosmetics (Developer Products). Purely cosmetic - every item
-- can also be earned in-game. Receipts are idempotent and only confirmed to
-- Roblox after the grant is saved, so a failed save is retried, not lost.
local MarketplaceService = game:GetService("MarketplaceService")
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")

local Config = require(ReplicatedStorage:WaitForChild("Shared"):WaitForChild("Config"))

local Log = require(script.Parent.Log)
local Bus = require(script.Parent.Bus)
local Net = require(script.Parent.Net)
local DataService = require(script.Parent.DataService)

local ShopService = {}

local byProductId = {}
for _, product in ipairs(Config.RobuxProducts) do
	if product.ProductId ~= 0 then
		byProductId[product.ProductId] = product
	end
end

local function processReceipt(info)
	local player = Players:GetPlayerByUserId(info.PlayerId)
	local product = byProductId[info.ProductId]
	if not player or not product then
		return Enum.ProductPurchaseDecision.NotProcessedYet
	end
	local data = DataService.Get(player)
	if not data then
		return Enum.ProductPurchaseDecision.NotProcessedYet
	end
	for _, id in ipairs(data.Receipts) do
		if id == info.PurchaseId then
			return Enum.ProductPurchaseDecision.PurchaseGranted
		end
	end
	local alreadyOwned = data.Owned.Robux[product.Key] ~= nil
	data.Owned.Robux[product.Key] = true
	table.insert(data.Receipts, info.PurchaseId)
	while #data.Receipts > 50 do
		table.remove(data.Receipts, 1)
	end
	if DataService.Save(player, false) or RunService:IsStudio() then
		Net.Notify(player, ("Thank you! %s unlocked. Equip it in Customize."):format(product.Name), "good")
		Bus.Fire("Dirty", player)
		return Enum.ProductPurchaseDecision.PurchaseGranted
	end
	-- roll back and let Roblox retry later
	if not alreadyOwned then
		data.Owned.Robux[product.Key] = nil
	end
	table.remove(data.Receipts)
	Log.Warn("Shop", "save failed, receipt will be retried", info.PurchaseId)
	return Enum.ProductPurchaseDecision.NotProcessedYet
end

function ShopService.Init()
	MarketplaceService.ProcessReceipt = processReceipt
end

return ShopService
