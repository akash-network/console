import { roundDecimal } from "./mathHelpers";

export const averageDaysInMonth = 30.437;

export const epochToDate = (epoch: number) => {
  // The 0 sets the date to the epoch
  const d = new Date(0);
  d.setUTCSeconds(epoch);

  return d;
};

export const getDayStr = (date?: Date) => {
  return date ? toUTC(date).toISOString().split("T")[0] : getTodayUTC().toISOString().split("T")[0];
};

export function getTodayUTC() {
  const currentDate = toUTC(new Date());
  currentDate.setUTCHours(0, 0, 0, 0);

  return currentDate;
}

export function startOfDay(date: Date) {
  const currentDate = toUTC(date);
  currentDate.setUTCHours(0, 0, 0, 0);

  return currentDate;
}

export function endOfDay(date: Date) {
  const currentDate = toUTC(date);
  currentDate.setUTCHours(23, 59, 59, 999);

  return currentDate;
}

export function toUTC(date: Date) {
  const now_utc = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), date.getUTCHours(), date.getUTCMinutes(), date.getUTCSeconds());

  return new Date(now_utc);
}

export function getPrettyTime(timeMs: number): string {
  if (timeMs < 10) {
    return `${roundDecimal(timeMs, 2)}ms`;
  } else if (timeMs < 1_000) {
    return `${roundDecimal(timeMs, 0)}ms`;
  } else if (timeMs < 60 * 1_000) {
    return `${roundDecimal(timeMs / 1_000, 2)}s`;
  } else if (timeMs < 60 * 60 * 1_000) {
    return `${Math.floor(timeMs / 1_000 / 60)}m ${roundDecimal((timeMs / 1000) % 60, 2)}s`;
  } else {
    return `${Math.floor(timeMs / 1_000 / 60 / 60)}h ${roundDecimal(timeMs / 1_000 / 60, 2) % 60}m`;
  }
}

export function getPrettyTimeFromSeconds(seconds: number) {
  if (seconds < 0) {
    return 'Please provide a non-negative number of seconds.'
  }
  const secondsInMinute = 60
  const secondsInHour = 60 * 60
  const secondsInDay = 24 * secondsInHour
  const secondsInMonth = 30 * secondsInDay // Assuming an average of 30 days in a month
  const secondsInYear = 365 * secondsInDay // Assuming 365 days in a year

  const years = Math.floor(seconds / secondsInYear)
  const remainingSecondsAfterYears = seconds % secondsInYear

  const months = Math.floor(remainingSecondsAfterYears / secondsInMonth)
  const remainingSecondsAfterMonths = remainingSecondsAfterYears % secondsInMonth

  const days = Math.floor(remainingSecondsAfterMonths / secondsInDay)
  const remainingSecondsAfterDays = remainingSecondsAfterMonths % secondsInDay

  const hours = Math.floor(remainingSecondsAfterDays / secondsInHour)
  const remainingSecondsAfterHours = remainingSecondsAfterDays % secondsInHour

  const minutes = Math.floor(remainingSecondsAfterHours / secondsInMinute)
  const remainingSeconds = Math.round(remainingSecondsAfterHours % secondsInMinute)

  let result = ''

  if (years > 0) {
    result += `${years} ${years === 1 ? 'year' : 'years'}`
    if (months > 0) {
      result += ` and ${months} ${months === 1 ? 'month' : 'months'}`
    }
  } else if (months > 0) {
    result += `${months} ${months === 1 ? 'month' : 'months'}`
    if (days > 0) {
      result += ` and ${days} ${days === 1 ? 'day' : 'days'}`
    }
  } else if (days > 0) {
    result += `${days} ${days === 1 ? 'day' : 'days'}`
    if (hours > 0) {
      result += ` and ${hours} ${hours === 1 ? 'hour' : 'hours'}`
    }
  } else if (hours > 0) {
    result += `${hours} ${hours === 1 ? 'hour' : 'hours'}`
    if (minutes > 0) {
      result += ` and ${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`
    }
  } else if (minutes > 0) {
    result += `${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`
    if (remainingSeconds > 0) {
      result += ` and ${remainingSeconds} ${remainingSeconds === 1 ? 'second' : 'seconds'}`
    }
  } else if (remainingSeconds > 0) {
    result += `${remainingSeconds} ${remainingSeconds === 1 ? 'second' : 'seconds'}`
  } else {
    result += `0 seconds`
  }

  return result
}


export function formatLocalTime(utcTime: string | null) {
  if (!utcTime) return null;
  const [datePart, timePart] = utcTime.split("T");
  const [year, month, day] = datePart.split("-").map(Number);
  const [hours, minutes, seconds] = timePart.split(":").map(Number);

  const utcDate = new Date(Date.UTC(year, month - 1, day, hours, minutes, seconds));

  const options: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
    timeZoneName: "short"
  };

  return utcDate.toLocaleString(undefined, options);
}

export function formatTimeLapse(start: string, end: string | null) {
  const startDate = new Date(start + "Z");
  const endDate = end ? new Date(end + "Z") : new Date();

  const durationMs = endDate.getTime() - startDate.getTime();
  const hours = Math.floor(durationMs / (1000 * 60 * 60));
  const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((durationMs % (1000 * 60)) / 1000);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  } else {
    return `${seconds}s`;
  }
}
