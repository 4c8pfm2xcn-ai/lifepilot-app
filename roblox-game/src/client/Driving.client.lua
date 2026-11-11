-- Drives the vehicle you're sitting in. The driver owns the car's physics, so
-- setting the movers here is smooth and lag-free.
--
-- Controls:  W/S or arrows = gas/brake, A/D = steer (VehicleSeat input; works
-- with gamepad and the mobile thumbstick too)
--            F = NITRO      E / Q = fly up / down (flying cars)
-- On-screen NITRO / UP / DOWN buttons appear while driving (for phones).
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")
local TweenService = game:GetService("TweenService")
local UserInputService = game:GetService("UserInputService")

local player = Players.LocalPlayer
local Config = require(ReplicatedStorage:WaitForChild("Shared"):WaitForChild("Config"))
local NitroRemote = ReplicatedStorage:WaitForChild("Remotes"):WaitForChild("Nitro")
local camera = workspace.CurrentCamera

local ACCEL = 50 -- studs/s^2
local BRAKE = 100
local COAST = 25
local BASE_FOV = 70

local speed = 0
local fuel = 1
local currentSeat = nil
local held = { Nitro = false, Up = false, Down = false }
local nitroOn = false
local fovTween = nil
local lastPadBoost = 0

---------------------------------------------------------------------------
-- Driving HUD
---------------------------------------------------------------------------
local gui = Instance.new("ScreenGui")
gui.Name = "DrivingUI"
gui.ResetOnSpawn = false
gui.Enabled = false
gui.Parent = player:WaitForChild("PlayerGui")

local dash = Instance.new("Frame")
dash.AnchorPoint = Vector2.new(1, 1)
dash.Position = UDim2.new(1, -16, 1, -150)
dash.Size = UDim2.new(0, 200, 0, 92)
dash.BackgroundColor3 = Color3.fromRGB(20, 22, 30)
dash.BackgroundTransparency = 0.25
dash.Parent = gui
Instance.new("UICorner", dash).CornerRadius = UDim.new(0, 12)

local speedLabel = Instance.new("TextLabel")
speedLabel.BackgroundTransparency = 1
speedLabel.Position = UDim2.new(0, 12, 0, 6)
speedLabel.Size = UDim2.new(1, -24, 0, 46)
speedLabel.Font = Enum.Font.GothamBlack
speedLabel.TextScaled = true
speedLabel.TextXAlignment = Enum.TextXAlignment.Left
speedLabel.TextColor3 = Color3.new(1, 1, 1)
speedLabel.Text = "0 MPH"
speedLabel.Parent = dash

local fuelBack = Instance.new("Frame")
fuelBack.Position = UDim2.new(0, 12, 0, 58)
fuelBack.Size = UDim2.new(1, -24, 0, 12)
fuelBack.BackgroundColor3 = Color3.fromRGB(50, 50, 60)
fuelBack.Parent = dash
Instance.new("UICorner", fuelBack).CornerRadius = UDim.new(1, 0)
local fuelFill = Instance.new("Frame")
fuelFill.Size = UDim2.fromScale(1, 1)
fuelFill.BackgroundColor3 = Color3.fromRGB(0, 220, 255)
fuelFill.Parent = fuelBack
Instance.new("UICorner", fuelFill).CornerRadius = UDim.new(1, 0)

local statusLabel = Instance.new("TextLabel")
statusLabel.BackgroundTransparency = 1
statusLabel.Position = UDim2.new(0, 12, 0, 72)
statusLabel.Size = UDim2.new(1, -24, 0, 16)
statusLabel.Font = Enum.Font.GothamBold
statusLabel.TextScaled = true
statusLabel.TextXAlignment = Enum.TextXAlignment.Left
statusLabel.TextColor3 = Color3.fromRGB(180, 190, 210)
statusLabel.Text = "NITRO [F]"
statusLabel.Parent = dash

local function holdButton(text, position, color, key)
	local b = Instance.new("TextButton")
	b.AnchorPoint = Vector2.new(1, 1)
	b.Position = position
	b.Size = UDim2.new(0, 84, 0, 60)
	b.BackgroundColor3 = color
	b.BackgroundTransparency = 0.15
	b.Font = Enum.Font.GothamBlack
	b.TextScaled = true
	b.TextColor3 = Color3.new(1, 1, 1)
	b.Text = text
	b.Parent = gui
	Instance.new("UICorner", b).CornerRadius = UDim.new(0, 14)
	local pad = Instance.new("UIPadding", b)
	pad.PaddingTop = UDim.new(0, 12)
	pad.PaddingBottom = UDim.new(0, 12)
	b.MouseButton1Down:Connect(function()
		held[key] = true
	end)
	b.MouseButton1Up:Connect(function()
		held[key] = false
	end)
	b.MouseLeave:Connect(function()
		held[key] = false
	end)
	return b
end

local nitroButton = holdButton("NITRO", UDim2.new(1, -224, 1, -150), Color3.fromRGB(0, 150, 220), "Nitro")
local upButton = holdButton("UP", UDim2.new(1, -312, 1, -150), Color3.fromRGB(60, 160, 80), "Up")
local downButton = holdButton("DOWN", UDim2.new(1, -400, 1, -150), Color3.fromRGB(160, 80, 60), "Down")
local _ = nitroButton

local keyMap = { [Enum.KeyCode.F] = "Nitro", [Enum.KeyCode.E] = "Up", [Enum.KeyCode.Q] = "Down", [Enum.KeyCode.ButtonX] = "Nitro" }
UserInputService.InputBegan:Connect(function(input, processed)
	local key = keyMap[input.KeyCode]
	if key and not processed then
		held[key] = true
	end
end)
UserInputService.InputEnded:Connect(function(input)
	local key = keyMap[input.KeyCode]
	if key then
		held[key] = false
	end
end)

local function setFov(fov)
	if fovTween then
		fovTween:Cancel()
	end
	fovTween = TweenService:Create(camera, TweenInfo.new(0.35, Enum.EasingStyle.Quad), { FieldOfView = fov })
	fovTween:Play()
end

local function setNitro(on)
	if on ~= nitroOn then
		nitroOn = on
		NitroRemote:FireServer(on)
		setFov(on and 88 or BASE_FOV)
	end
end

---------------------------------------------------------------------------
-- Boost pads
---------------------------------------------------------------------------
local padsFolder = nil
local function onBoostPad(position)
	if not padsFolder then
		local city = workspace:FindFirstChild("City")
		padsFolder = city and city:FindFirstChild("BoostPads")
		if not padsFolder then
			return false
		end
	end
	for _, pad in ipairs(padsFolder:GetChildren()) do
		local p = pad.CFrame:PointToObjectSpace(position)
		if math.abs(p.X) <= pad.Size.X / 2 and math.abs(p.Z) <= pad.Size.Z / 2 and p.Y < 6 then
			return true
		end
	end
	return false
end

---------------------------------------------------------------------------
-- Main loop
---------------------------------------------------------------------------
RunService.Heartbeat:Connect(function(dt)
	local character = player.Character
	local humanoid = character and character:FindFirstChildOfClass("Humanoid")
	local seat = humanoid and humanoid.SeatPart
	if not seat or not seat:IsA("VehicleSeat") or seat.Name ~= "DriveSeat" then
		if currentSeat then
			currentSeat = nil
			speed = 0
			setNitro(false)
			gui.Enabled = false
		end
		fuel = math.min(1, fuel + dt / Config.Nitro.Recharge)
		return
	end
	local car = seat.Parent
	local body = car and car:FindFirstChild("Body")
	local drive = body and body:FindFirstChild("Drive")
	local steer = body and body:FindFirstChild("Steer")
	if not drive or not steer then
		return
	end
	if seat ~= currentSeat then
		currentSeat = seat
		speed = 0
		gui.Enabled = true
	end

	local flying = car:GetAttribute("Fly") == true
	upButton.Visible = flying
	downButton.Visible = flying

	local maxSpeed = car:GetAttribute("MaxSpeed") or 70
	local turnRate = car:GetAttribute("TurnRate") or 1.8
	local spiked = (body:GetAttribute("SpikedUntil") or 0) > workspace:GetServerTimeNow()
	if spiked then
		maxSpeed = maxSpeed * Config.SpikeSlowdown
	end

	local throttle = seat.ThrottleFloat
	local steerInput = seat.SteerFloat

	-- Nitro
	local wantNitro = held.Nitro and throttle > 0 and fuel > 0 and not spiked
	if wantNitro then
		fuel = math.max(0, fuel - dt / Config.Nitro.Duration)
	else
		fuel = math.min(1, fuel + dt / Config.Nitro.Recharge)
	end
	setNitro(wantNitro)
	local topSpeed = wantNitro and maxSpeed * Config.Nitro.Multiplier or maxSpeed

	local target = throttle * topSpeed
	if throttle < 0 then
		target = throttle * maxSpeed * 0.4 -- reverse is slower
	end
	local rate
	if throttle == 0 then
		rate = COAST
	elseif (target > 0 and speed < 0) or (target < 0 and speed > 0) then
		rate = BRAKE
	else
		rate = wantNitro and ACCEL * 2.5 or ACCEL
	end
	if speed < target then
		speed = math.min(speed + rate * dt, target)
	elseif speed > target then
		speed = math.max(speed - rate * dt, target)
	end

	-- Boost pads launch you instantly
	if not flying and not spiked and os.clock() - lastPadBoost > 1 and onBoostPad(body.Position) then
		lastPadBoost = os.clock()
		speed = math.max(speed, maxSpeed * Config.BoostPadMultiplier)
		fuel = 1
		setFov(95)
		task.delay(0.6, function()
			if not nitroOn then
				setFov(BASE_FOV)
			end
		end)
	end

	local look = body.CFrame.LookVector
	local flat = Vector3.new(look.X, 0, look.Z)
	if flat.Magnitude > 0.01 then
		flat = flat.Unit
	end

	if flying and drive.VelocityConstraintMode == Enum.VelocityConstraintMode.Vector then
		local vertical = 0
		if held.Up then
			vertical = Config.FlySpeedVertical
		elseif held.Down then
			vertical = -Config.FlySpeedVertical
		end
		if body.Position.Y > Config.FlyMaxAltitude and vertical > 0 then
			vertical = 0
		end
		drive.VectorVelocity = Vector3.new(flat.X * speed, vertical, flat.Z * speed)
	else
		drive.PlaneVelocity = Vector2.new(flat.X * speed, flat.Z * speed)
	end

	-- Steering scales up with speed and flips in reverse, like a real car
	local grip = math.clamp(math.abs(speed) / 25, 0, 1)
	local direction = speed >= 0 and 1 or -1
	steer.AngularVelocity = Vector3.new(0, -steerInput * turnRate * grip * direction, 0)

	-- HUD
	speedLabel.Text = ("%d MPH"):format(math.floor(body.AssemblyLinearVelocity.Magnitude * 0.9))
	speedLabel.TextColor3 = wantNitro and Color3.fromRGB(0, 230, 255) or Color3.new(1, 1, 1)
	fuelFill.Size = UDim2.fromScale(fuel, 1)
	if spiked then
		statusLabel.Text = "TIRES SPIKED!"
		statusLabel.TextColor3 = Color3.fromRGB(255, 80, 80)
	elseif flying then
		statusLabel.Text = "NITRO [F]  UP [E]  DOWN [Q]"
		statusLabel.TextColor3 = Color3.fromRGB(180, 190, 210)
	else
		statusLabel.Text = "NITRO [F]"
		statusLabel.TextColor3 = Color3.fromRGB(180, 190, 210)
	end
end)
