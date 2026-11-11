-- Small helpers shared by server and client.
local Util = {}

function Util.Money(n)
	n = math.floor(n or 0)
	local s = tostring(math.abs(n))
	local out = s:reverse():gsub("(%d%d%d)", "%1,"):reverse()
	if out:sub(1, 1) == "," then
		out = out:sub(2)
	end
	return (n < 0 and "-$" or "$") .. out
end

function Util.Clock(clockTime)
	local hours = math.floor(clockTime) % 24
	local minutes = math.floor((clockTime % 1) * 60)
	local suffix = hours >= 12 and "PM" or "AM"
	local h12 = hours % 12
	if h12 == 0 then
		h12 = 12
	end
	return ("%d:%02d %s"):format(h12, minutes, suffix)
end

-- UTC day number; daily rewards/challenges roll over at 00:00 UTC
function Util.DayNumber(timestamp)
	return math.floor((timestamp or os.time()) / 86400)
end

function Util.WeekNumber(timestamp)
	-- weeks start on Monday (Unix epoch was a Thursday)
	return math.floor(((timestamp or os.time()) / 86400 + 3) / 7)
end

function Util.Stars(rating)
	local full = math.floor(rating + 0.5)
	return string.rep("★", full) .. string.rep("☆", 5 - full)
end

function Util.Count(t)
	local n = 0
	for _ in pairs(t or {}) do
		n = n + 1
	end
	return n
end

function Util.IsNight(clockTime, nightStart, nightEnd)
	return clockTime >= nightStart or clockTime < nightEnd
end

-- Deterministic shuffle so every server picks the same daily challenges
function Util.SeededPick(list, count, seed)
	local rng = Random.new(seed)
	local indices = {}
	for i = 1, #list do
		indices[i] = i
	end
	for i = #indices, 2, -1 do
		local j = rng:NextInteger(1, i)
		indices[i], indices[j] = indices[j], indices[i]
	end
	local picked = {}
	for i = 1, math.min(count, #indices) do
		table.insert(picked, list[indices[i]])
	end
	return picked
end

return Util
