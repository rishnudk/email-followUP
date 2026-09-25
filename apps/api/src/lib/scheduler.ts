/**
 * Adds a given number of business days (skipping Saturday and Sunday) to a starting date.
 */
export function addBusinessDays(startDate: Date, businessDaysToAdd: number): Date {
  const result = new Date(startDate);
  let daysAdded = 0;

  while (daysAdded < businessDaysToAdd) {
    result.setDate(result.getDate() + 1);
    const dayOfWeek = result.getDay();
    // 0 = Sunday, 6 = Saturday
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      daysAdded++;
    }
  }

  return result;
}

/**
 * Calculates a professional follow-up date and millisecond delay.
 * Ensures follow-up falls on a business day during work hours (default 9:30 AM).
 */
export function calculateFollowUpTime(options: {
  fromDate?: Date;
  businessDaysDelay: number;
  targetHour?: number; // 0-23, default 9
  targetMinute?: number; // 0-59, default 30
}): { scheduledAt: Date; delayMs: number } {
  const {
    fromDate = new Date(),
    businessDaysDelay,
    targetHour = 9,
    targetMinute = 30,
  } = options;

  let scheduledAt = addBusinessDays(fromDate, businessDaysDelay);
  scheduledAt.setHours(targetHour, targetMinute, 0, 0);

  // If the calculated time is already in the past, push to next business day
  const now = new Date();
  if (scheduledAt.getTime() <= now.getTime()) {
    scheduledAt = addBusinessDays(now, 1);
    scheduledAt.setHours(targetHour, targetMinute, 0, 0);
  }

  const delayMs = Math.max(0, scheduledAt.getTime() - now.getTime());

  return { scheduledAt, delayMs };
}
