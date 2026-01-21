import { bootstrapEntry } from "./bootstrap-entry";

bootstrapEntry(async () => import("./app/console.ts"));
