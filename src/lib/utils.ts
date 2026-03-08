import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

const MY_LOCALE = "en-MY"
const MY_TIME_ZONE = "Asia/Kuala_Lumpur"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDateMY(value: Date | string | number) {
  return new Date(value).toLocaleDateString(MY_LOCALE, { timeZone: MY_TIME_ZONE })
}

export function formatDateTimeMY(value: Date | string | number) {
  return new Date(value).toLocaleString(MY_LOCALE, { timeZone: MY_TIME_ZONE })
}
