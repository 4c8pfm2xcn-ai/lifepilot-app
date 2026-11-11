-- Drives the car you're sitting in. The driver owns the car's physics, so
-- setting the movers here is smooth and lag-free. Works with keyboard (WASD /
-- arrows), gamepad and the mobile thumbstick via VehicleSeat input.
local Players = game:GetService("Players")
local RunService = game:GetService("RunService")

local player = Players.LocalPlayer

local ACCEL = 45 -- studs/s^2
local BRAKE = 90
local COAST = 25

local speed = 0
local currentSeat = nil

RunService.Heartbeat:Connect(function(dt)
	local character = player.Character
	local humanoid = character and character:FindFirstChildOfClass("Humanoid")
	local seat = humanoid and humanoid.SeatPart
	if not seat or not seat:IsA("VehicleSeat") or seat.Name ~= "DriveSeat" then
		currentSeat = nil
		speed = 0
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
	end

	local maxSpeed = car:GetAttribute("MaxSpeed") or 70
	local turnRate = car:GetAttribute("TurnRate") or 1.8
	local throttle = seat.ThrottleFloat
	local steerInput = seat.SteerFloat

	local target = throttle * maxSpeed
	if throttle < 0 then
		target = throttle * maxSpeed * 0.4 -- reverse is slower
	end
	local rate
	if throttle == 0 then
		rate = COAST
	elseif (target > 0 and speed < 0) or (target < 0 and speed > 0) then
		rate = BRAKE
	else
		rate = ACCEL
	end
	if speed < target then
		speed = math.min(speed + rate * dt, target)
	elseif speed > target then
		speed = math.max(speed - rate * dt, target)
	end

	local look = body.CFrame.LookVector
	local flat = Vector3.new(look.X, 0, look.Z)
	if flat.Magnitude > 0.01 then
		flat = flat.Unit
	end
	drive.PlaneVelocity = Vector2.new(flat.X * speed, flat.Z * speed)

	-- Steering scales up with speed and flips in reverse, like a real car
	local grip = math.clamp(math.abs(speed) / 25, 0, 1)
	local direction = speed >= 0 and 1 or -1
	steer.AngularVelocity = Vector3.new(0, -steerInput * turnRate * grip * direction, 0)
end)
