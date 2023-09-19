import { env } from "./env";

export const averageBlockTime = 6.174;
export const averageDaysInMonth = 30.437;
export const averageHoursInAMonth = averageDaysInMonth * 24;
export const averageBlockCountInAMonth = (averageDaysInMonth * 24 * 60 * 60) / averageBlockTime;
export const isProd = env.NODE_ENV === "production";

export const dataFolderPath = "./data";
