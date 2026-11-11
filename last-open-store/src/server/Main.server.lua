-- The Last Open Store - server entry point.
-- Builds the town, then starts every service. DataService starts LAST so all
-- listeners exist before the first player's save finishes loading.
local Services = script.Parent:WaitForChild("Services")

local Log = require(Services.Log)
local WorldBuilder = require(Services.WorldBuilder)
local CycleService = require(Services.CycleService)
local EconomyService = require(Services.EconomyService)
local StoreService = require(Services.StoreService)
local CustomerService = require(Services.CustomerService)
local ProgressionService = require(Services.ProgressionService)
local MysteryService = require(Services.MysteryService)
local SocialService = require(Services.SocialService)
local ShopService = require(Services.ShopService)
local StateService = require(Services.StateService)
local DataService = require(Services.DataService)

local started = os.clock()
local world = WorldBuilder.Build()

CycleService.Init(world)
EconomyService.Init(StoreService.EffectsFor)
StoreService.Init(world)
CustomerService.Init(world)
ProgressionService.Init(world)
MysteryService.Init(world)
SocialService.Init()
ShopService.Init()
StateService.Init()
DataService.Init()

print(("[LOS] The Last Open Store is open (built in %.2fs)"):format(os.clock() - started))
Log.Info("Boot", "debug logging enabled")
