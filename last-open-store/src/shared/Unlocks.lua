-- Checks "any of" unlock rules for cosmetics.
-- ctx = { Level, Achievements, Solved, Robux, Month, SeasonUnlocks, Streak, BestStreak }
local Unlocks = {}

local MYSTERY_NAMES = {
	letters = "Letters to Nowhere",
	lighthouse = "The Lighthouse Hum",
	buttons = "The Cat Who Pays in Buttons",
	clock = "The Stopped Clock",
	founder = "The Store That Was Here Before",
}
local MONTHS = { "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December" }

local function check(rule, ctx)
	local t = rule.Type
	if t == "Free" then
		return true
	elseif t == "Level" then
		return (ctx.Level or 1) >= rule.Level, "Reach level " .. rule.Level
	elseif t == "Achievement" then
		return ctx.Achievements and ctx.Achievements[rule.Id] ~= nil, "Achievement reward"
	elseif t == "Mystery" then
		return ctx.Solved and ctx.Solved[rule.Id] ~= nil, "Solve \"" .. (MYSTERY_NAMES[rule.Id] or "a mystery") .. "\""
	elseif t == "Season" then
		local ok = (ctx.Month == rule.Month) or (ctx.SeasonUnlocks and ctx.SeasonUnlocks[tostring(rule.Month)] ~= nil)
		return ok, "Log in during " .. MONTHS[rule.Month]
	elseif t == "Streak" then
		return (ctx.BestStreak or 0) >= rule.Days, rule.Days .. "-day login streak"
	elseif t == "Robux" then
		return ctx.Robux and ctx.Robux[rule.Key] ~= nil, "Robux"
	end
	return false, "Locked"
end

-- returns unlocked, reasonText (first non-Robux reason, for display)
function Unlocks.Check(rules, ctx)
	local reason = nil
	for _, rule in ipairs(rules or {}) do
		local ok, why = check(rule, ctx)
		if ok then
			return true
		end
		if not reason and rule.Type ~= "Robux" then
			reason = why
		end
	end
	return false, reason or "Locked"
end

function Unlocks.RobuxKey(rules)
	for _, rule in ipairs(rules or {}) do
		if rule.Type == "Robux" then
			return rule.Key
		end
	end
	return nil
end

function Unlocks.Context(data, level)
	return {
		Level = level,
		Achievements = data.Achievements,
		Solved = data.Solved,
		Robux = data.Owned.Robux,
		Month = os.date("!*t").month,
		SeasonUnlocks = data.SeasonUnlocks,
		BestStreak = data.Daily.BestStreak,
	}
end

Unlocks.MysteryNames = MYSTERY_NAMES
return Unlocks
