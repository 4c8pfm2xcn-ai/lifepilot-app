-- Getaway City - server entry point. Builds the map and starts every service.
local Services = script.Parent:WaitForChild("Services")

local Remotes = require(Services.Remotes)
local MapBuilder = require(Services.MapBuilder)
local DataService = require(Services.DataService)
local ShopService = require(Services.ShopService)
local TeamService = require(Services.TeamService)
local JailService = require(Services.JailService)
local ArrestService = require(Services.ArrestService)
local ToolService = require(Services.ToolService)
local RobberyService = require(Services.RobberyService)
local VehicleService = require(Services.VehicleService)

local _ = Remotes -- created on require so clients can find them immediately

local map = MapBuilder.Build()

DataService.Init(map)
ShopService.Init()
TeamService.Init(map)
JailService.Init(map)
ArrestService.Init()
RobberyService.Init(map)
VehicleService.Init(map)

TeamService.OnCharacterSpawned(ToolService.GiveTools)

print("[Getaway City] Server ready")
