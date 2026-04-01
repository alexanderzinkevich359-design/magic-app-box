import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format a "HH:MM:SS" or "HH:MM" time string according to the user's
 * display preference.  Stored times are always 24-hour; this converts
 * to 12-hour (e.g. "2:30 PM") when fmt === "12h".
 */
export function formatDisplayTime(
  t: string | null | undefined,
  fmt: "12h" | "24h" = "12h"
): string {
  if (!t) return "";
  const [h, m] = t.slice(0, 5).split(":").map(Number);
  if (fmt === "24h") {
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  }
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 || 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${period}`;
}
