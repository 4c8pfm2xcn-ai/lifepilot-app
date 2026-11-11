-- UI kit: colors, fonts and reusable components so every menu looks and
-- behaves the same. Works with mouse, touch and gamepad (all buttons are
-- Selectable for console navigation).
local TweenService = game:GetService("TweenService")

local Kit = {}

Kit.Colors = {
	Panel = Color3.fromRGB(16, 18, 30),
	PanelLight = Color3.fromRGB(28, 31, 48),
	Card = Color3.fromRGB(34, 38, 58),
	Stroke = Color3.fromRGB(80, 90, 130),
	Text = Color3.fromRGB(240, 238, 232),
	Muted = Color3.fromRGB(160, 165, 185),
	Amber = Color3.fromRGB(255, 192, 92), -- the glow of the open-store sign
	Teal = Color3.fromRGB(90, 220, 200),
	Good = Color3.fromRGB(110, 225, 140),
	Bad = Color3.fromRGB(240, 100, 100),
	Locked = Color3.fromRGB(70, 74, 95),
	Purple = Color3.fromRGB(200, 130, 255),
}
local C = Kit.Colors

Kit.Fonts = {
	Display = Enum.Font.GothamBlack,
	Bold = Enum.Font.GothamBold,
	Body = Enum.Font.GothamMedium,
}

function Kit.Tween(obj, props, seconds, style)
	local t = TweenService:Create(obj, TweenInfo.new(seconds or 0.2, style or Enum.EasingStyle.Quad, Enum.EasingDirection.Out), props)
	t:Play()
	return t
end

function Kit.new(className, props, children)
	local inst = Instance.new(className)
	for k, v in pairs(props or {}) do
		if k ~= "Parent" then
			inst[k] = v
		end
	end
	for _, child in ipairs(children or {}) do
		child.Parent = inst
	end
	if props and props.Parent then
		inst.Parent = props.Parent
	end
	return inst
end
local new = Kit.new

function Kit.Corner(radius)
	return new("UICorner", { CornerRadius = UDim.new(0, radius or 12) })
end

function Kit.Stroke(color, transparency, thickness)
	return new("UIStroke", { Color = color or C.Stroke, Transparency = transparency or 0.5, Thickness = thickness or 1, ApplyStrokeMode = Enum.ApplyStrokeMode.Border })
end

function Kit.Pad(px)
	return new("UIPadding", { PaddingTop = UDim.new(0, px), PaddingBottom = UDim.new(0, px), PaddingLeft = UDim.new(0, px), PaddingRight = UDim.new(0, px) })
end

function Kit.List(dir, gap, align)
	return new("UIListLayout", {
		FillDirection = dir or Enum.FillDirection.Vertical,
		Padding = UDim.new(0, gap or 8),
		SortOrder = Enum.SortOrder.LayoutOrder,
		HorizontalAlignment = align or Enum.HorizontalAlignment.Left,
		VerticalAlignment = Enum.VerticalAlignment.Top,
	})
end

function Kit.Text(props)
	props.BackgroundTransparency = props.BackgroundTransparency or 1
	props.TextColor3 = props.TextColor3 or C.Text
	props.Font = props.Font or Kit.Fonts.Body
	props.TextSize = props.TextSize or 16
	props.TextXAlignment = props.TextXAlignment or Enum.TextXAlignment.Left
	props.TextWrapped = props.TextWrapped ~= false
	if props.AutoY then
		props.AutoY = nil
		props.AutomaticSize = Enum.AutomaticSize.Y
	end
	return new("TextLabel", props)
end

-- Button with hover/press feedback. style: "primary" | "secondary" | "good" | "locked" | Color3
function Kit.Button(props, onClick, style)
	local base = C.Amber
	local textColor = Color3.fromRGB(30, 22, 10)
	if style == "secondary" then
		base, textColor = C.PanelLight, C.Text
	elseif style == "good" then
		base, textColor = C.Good, Color3.fromRGB(10, 30, 15)
	elseif style == "locked" then
		base, textColor = C.Locked, C.Muted
	elseif typeof(style) == "Color3" then
		base, textColor = style, C.Text
	end
	props.BackgroundColor3 = base
	props.TextColor3 = props.TextColor3 or textColor
	props.Font = props.Font or Kit.Fonts.Bold
	props.TextSize = props.TextSize or 16
	props.AutoButtonColor = false
	props.Selectable = true
	local button = new("TextButton", props, { Kit.Corner(10) })
	local scale = new("UIScale", { Parent = button })
	local hover = base:Lerp(Color3.new(1, 1, 1), 0.12)
	button.MouseEnter:Connect(function()
		Kit.Tween(button, { BackgroundColor3 = hover }, 0.12)
	end)
	button.MouseLeave:Connect(function()
		Kit.Tween(button, { BackgroundColor3 = base }, 0.12)
		Kit.Tween(scale, { Scale = 1 }, 0.1)
	end)
	button.SelectionGained:Connect(function()
		Kit.Tween(button, { BackgroundColor3 = hover }, 0.12)
	end)
	button.SelectionLost:Connect(function()
		Kit.Tween(button, { BackgroundColor3 = base }, 0.12)
	end)
	button.MouseButton1Down:Connect(function()
		Kit.Tween(scale, { Scale = 0.95 }, 0.06)
	end)
	button.MouseButton1Up:Connect(function()
		Kit.Tween(scale, { Scale = 1 }, 0.1)
	end)
	if onClick then
		button.Activated:Connect(onClick)
	end
	return button
end

function Kit.Scroll(parent, size, position)
	local scroll = new("ScrollingFrame", {
		Parent = parent, Size = size or UDim2.fromScale(1, 1), Position = position or UDim2.new(),
		BackgroundTransparency = 1, BorderSizePixel = 0, ScrollBarThickness = 6,
		ScrollBarImageColor3 = C.Stroke, CanvasSize = UDim2.new(), AutomaticCanvasSize = Enum.AutomaticSize.Y,
		ScrollingDirection = Enum.ScrollingDirection.Y, Selectable = false,
	}, { Kit.List(nil, 8), new("UIPadding", { PaddingRight = UDim.new(0, 10), PaddingBottom = UDim.new(0, 8) }) })
	return scroll
end

function Kit.Card(parent, order, height)
	return new("Frame", {
		Parent = parent, LayoutOrder = order or 0, BackgroundColor3 = C.Card,
		Size = UDim2.new(1, 0, 0, height or 0), AutomaticSize = height and Enum.AutomaticSize.None or Enum.AutomaticSize.Y,
	}, { Kit.Corner(12), Kit.Pad(12), Kit.Stroke(C.Stroke, 0.75) })
end

function Kit.Bar(parent, fraction, color, height)
	local back = new("Frame", { Parent = parent, Size = UDim2.new(1, 0, 0, height or 8), BackgroundColor3 = C.Panel, BorderSizePixel = 0 }, { Kit.Corner(99) })
	local fill = new("Frame", { Parent = back, Size = UDim2.new(math.clamp(fraction, 0, 1), 0, 1, 0), BackgroundColor3 = color or C.Amber, BorderSizePixel = 0 }, { Kit.Corner(99) })
	return back, fill
end

function Kit.Clear(container)
	for _, child in ipairs(container:GetChildren()) do
		if not child:IsA("UIListLayout") and not child:IsA("UIPadding") and not child:IsA("UIGridLayout") then
			child:Destroy()
		end
	end
end

-- Row of tab buttons. tabs = { {Id, Label}, ... }; onSelect(id)
function Kit.Tabs(parent, tabs, onSelect)
	local row = new("ScrollingFrame", {
		Parent = parent, Size = UDim2.new(1, 0, 0, 40), BackgroundTransparency = 1, BorderSizePixel = 0,
		ScrollBarThickness = 0, ScrollingDirection = Enum.ScrollingDirection.X, AutomaticCanvasSize = Enum.AutomaticSize.X,
		CanvasSize = UDim2.new(), Selectable = false,
	}, { Kit.List(Enum.FillDirection.Horizontal, 6) })
	local buttons = {}
	local current = nil
	local api = {}
	function api.Select(id)
		current = id
		for tabId, b in pairs(buttons) do
			b.BackgroundColor3 = tabId == id and C.Amber or C.PanelLight
			b.TextColor3 = tabId == id and Color3.fromRGB(30, 22, 10) or C.Text
		end
		onSelect(id)
	end
	function api.Current()
		return current
	end
	for i, tab in ipairs(tabs) do
		local b = new("TextButton", {
			Parent = row, LayoutOrder = i, AutomaticSize = Enum.AutomaticSize.X, Size = UDim2.new(0, 0, 1, -4),
			BackgroundColor3 = C.PanelLight, TextColor3 = C.Text, Font = Kit.Fonts.Bold, TextSize = 15, Text = tab[2],
			AutoButtonColor = true, Selectable = true,
		}, { Kit.Corner(10), new("UIPadding", { PaddingLeft = UDim.new(0, 14), PaddingRight = UDim.new(0, 14) }) })
		b.Activated:Connect(function()
			api.Select(tab[1])
		end)
		buttons[tab[1]] = b
	end
	api.Row = row
	return api
end

---------------------------------------------------------------------------
-- Panels (modal windows). One open at a time; B / the X button closes.
---------------------------------------------------------------------------
local GuiService = game:GetService("GuiService")
local UserInputService = game:GetService("UserInputService")

Kit.Root = nil -- ScreenGui, set by the controller
Kit.Panels = {}
Kit.OpenId = nil
Kit.OnPanelChanged = function() end

function Kit.Panel(id, title, width, height)
	local root = new("CanvasGroup", {
		Name = id, Parent = Kit.Root, AnchorPoint = Vector2.new(0.5, 0.5), Position = UDim2.fromScale(0.5, 0.52),
		Size = UDim2.new(0, width or 640, 0, height or 460), BackgroundColor3 = C.Panel, BackgroundTransparency = 0.04,
		Visible = false, GroupTransparency = 1, ZIndex = 20,
	}, { Kit.Corner(18), Kit.Stroke(C.Amber, 0.6, 1.5) })
	local scale = new("UIScale", { Parent = root, Scale = 0.94 })
	local header = new("Frame", { Parent = root, Size = UDim2.new(1, 0, 0, 56), BackgroundColor3 = C.PanelLight, BorderSizePixel = 0 })
	Kit.Text({ Parent = header, Text = title, Font = Kit.Fonts.Display, TextSize = 24, TextColor3 = C.Amber, Position = UDim2.new(0, 20, 0, 0), Size = UDim2.new(1, -90, 1, 0), TextWrapped = false })
	local close = Kit.Button({ Parent = header, Text = "X", Size = UDim2.new(0, 40, 0, 40), Position = UDim2.new(1, -50, 0, 8), TextSize = 18 }, function()
		Kit.Close()
	end, "secondary")
	local body = new("Frame", { Parent = root, Position = UDim2.new(0, 16, 0, 66), Size = UDim2.new(1, -32, 1, -78), BackgroundTransparency = 1 })
	local panel = { Id = id, Root = root, Body = body, Scale = scale, CloseButton = close, OnOpen = nil }
	Kit.Panels[id] = panel
	return panel
end

function Kit.Open(id)
	if Kit.OpenId == id then
		Kit.Close()
		return
	end
	Kit.Close(true)
	local panel = Kit.Panels[id]
	if not panel then
		return
	end
	Kit.OpenId = id
	panel.Root.Visible = true
	panel.Root.GroupTransparency = 1
	panel.Scale.Scale = 0.94
	Kit.Tween(panel.Root, { GroupTransparency = 0 }, 0.18)
	Kit.Tween(panel.Scale, { Scale = 1 }, 0.22, Enum.EasingStyle.Back)
	if panel.OnOpen then
		task.spawn(panel.OnOpen)
	end
	if UserInputService.GamepadEnabled then
		task.defer(function()
			for _, d in ipairs(panel.Body:GetDescendants()) do
				if d:IsA("GuiButton") and d.Visible and d.Selectable then
					GuiService.SelectedObject = d
					return
				end
			end
			GuiService.SelectedObject = panel.CloseButton
		end)
	end
	Kit.OnPanelChanged(id)
end

function Kit.Close(instant)
	local panel = Kit.OpenId and Kit.Panels[Kit.OpenId]
	Kit.OpenId = nil
	if panel then
		if instant then
			panel.Root.Visible = false
		else
			local t = Kit.Tween(panel.Root, { GroupTransparency = 1 }, 0.14)
			Kit.Tween(panel.Scale, { Scale = 0.96 }, 0.14)
			t.Completed:Connect(function()
				if Kit.OpenId ~= panel.Id then
					panel.Root.Visible = false
				end
			end)
		end
		if panel.OnClose then
			task.spawn(panel.OnClose)
		end
	end
	if GuiService.SelectedObject and GuiService.SelectedObject:IsDescendantOf(Kit.Root) then
		GuiService.SelectedObject = nil
	end
	Kit.OnPanelChanged(nil)
end

function Kit.IsOpen(id)
	return Kit.OpenId == id
end

Kit.Toast = function() end -- replaced by the HUD
return Kit
