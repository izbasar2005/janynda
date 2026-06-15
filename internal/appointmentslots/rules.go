package appointmentslots

import "time"

const (
	SlotStepMinutes = 10
	WorkStartHour   = 9
	WorkEndHour     = 17
)

var loc = time.FixedZone("+05", 5*3600)

// Location returns the timezone used for appointment slots (Asia/Almaty +05).
func Location() *time.Location {
	return loc
}

// SlotStep is the interval between bookable appointment times.
func SlotStep() time.Duration {
	return SlotStepMinutes * time.Minute
}

// DayStart returns the first bookable slot on the given calendar day (09:00).
func DayStart(day time.Time) time.Time {
	day = day.In(loc)
	return time.Date(day.Year(), day.Month(), day.Day(), WorkStartHour, 0, 0, 0, loc)
}

// DayEnd returns the last bookable slot on the given calendar day (17:00).
func DayEnd(day time.Time) time.Time {
	day = day.In(loc)
	return time.Date(day.Year(), day.Month(), day.Day(), WorkEndHour, 0, 0, 0, loc)
}

// IsValidSlotTime reports whether t is a valid bookable slot (10-min step, 09:00–17:00).
func IsValidSlotTime(t time.Time) bool {
	t = t.In(loc)
	if t.Second() != 0 || t.Nanosecond() != 0 {
		return false
	}
	if t.Minute()%SlotStepMinutes != 0 {
		return false
	}
	start := time.Date(t.Year(), t.Month(), t.Day(), WorkStartHour, 0, 0, 0, loc)
	end := time.Date(t.Year(), t.Month(), t.Day(), WorkEndHour, 0, 0, 0, loc)
	return !t.Before(start) && !t.After(end)
}

// GenerateSlots returns all bookable slot times for the given day.
// If day is today, slots before the next available time are omitted.
func GenerateSlots(day time.Time) []time.Time {
	day = day.In(loc)
	now := time.Now().In(loc)
	todayStart := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, loc)
	dayStart := time.Date(day.Year(), day.Month(), day.Day(), 0, 0, 0, 0, loc)

	start := DayStart(day)
	end := DayEnd(day)

	if dayStart.Equal(todayStart) {
		next := time.Date(day.Year(), day.Month(), day.Day(), now.Hour(), now.Minute(), 0, 0, loc)
		if mod := next.Minute() % SlotStepMinutes; mod != 0 {
			next = next.Add(time.Duration(SlotStepMinutes-mod) * time.Minute)
		}
		if now.Second() > 0 || now.Nanosecond() > 0 {
			if !next.After(now) {
				next = next.Add(SlotStep())
			}
		}
		if next.After(start) {
			start = next
		}
	}

	var slots []time.Time
	for t := start; !t.After(end); t = t.Add(SlotStep()) {
		slots = append(slots, t)
	}
	return slots
}
