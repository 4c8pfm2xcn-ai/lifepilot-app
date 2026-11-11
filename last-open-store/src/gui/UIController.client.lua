-- Boots the whole interface. Lives inside the MainUI ScreenGui (ResetOnSpawn
-- off) so menus persist across respawns.
local GuiService = game:GetService("GuiService")
local StarterGui = game:GetService("StarterGui")
local UserInputService = game:GetService("UserInputService")

local gui = script.Parent
gui.ZIndexBehavior = Enum.ZIndexBehavior.Sibling
gui.ResetOnSpawn = false

local Kit = require(gui:WaitForChild("Kit"))
local State = require(gui:WaitForChild("State"))
Kit.Root = gui

pcall(function()
	StarterGui:SetCoreGuiEnabled(Enum.CoreGuiType.Backpack, false)
end)

-- Responsive scale: designed for 1280x720, scaled for phones and TVs,
-- multiplied by the player's Interface size setting.
local scale = Instance.new("UIScale")
scale.Parent = gui
local function rescale()
	local camera = workspace.CurrentCamera
	local size = camera and camera.ViewportSize or Vector2.new(1280, 720)
	local base = math.clamp(math.min(size.X / 1280, size.Y / 720), 0.55, 1.4)
	local user = State.Data and State.Data.Settings.UIScale or 1
	scale.Scale = base * user
end
workspace.CurrentCamera:GetPropertyChangedSignal("ViewportSize"):Connect(rescale)
rescale()

local Hud = require(gui:WaitForChild("Hud"))
local hud = Hud.Build(Kit, State)
require(gui:WaitForChild("Menus")).Build(Kit, State)
require(gui:WaitForChild("Journal")).Build(Kit, State)
require(gui:WaitForChild("Customize")).Build(Kit, State)
require(gui:WaitForChild("Extras")).Build(Kit, State)
require(gui:WaitForChild("Dialogs")).Build(Kit, State)

State.On(function(data)
	hud.Update(data)
	rescale()
end)

-- Keyboard shortcuts + gamepad
UserInputService.InputBegan:Connect(function(input, processed)
	if processed then
		return
	end
	local panel = hud.Keys[input.KeyCode]
	if panel then
		Kit.Open(panel)
	elseif input.KeyCode == Enum.KeyCode.ButtonB and Kit.OpenId then
		Kit.Close()
	elseif input.KeyCode == Enum.KeyCode.ButtonY then
		-- jump straight into the nav bar on console
		if GuiService.SelectedObject then
			GuiService.SelectedObject = nil
		else
			GuiService.SelectedObject = hud.NavButtons.Order
		end
	end
end)

-- On console, show a hint for opening the menu bar
if UserInputService.GamepadEnabled then
	Kit.Toast("Press Y to use the menu bar, B to close menus.", "info")
end
