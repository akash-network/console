import createError from "http-errors";
import { z } from "zod";

export type ActivityPosition = { createdAt: string; id: string };

const ActivityPositionSchema = z.tuple([z.string().datetime(), z.string().uuid()]);

export function encodeActivityCursor({ createdAt, id }: ActivityPosition): string {
  return Buffer.from(JSON.stringify([createdAt, id])).toString("base64url");
}

export function decodeActivityCursor(cursor: string): ActivityPosition {
  try {
    const [createdAt, id] = ActivityPositionSchema.parse(JSON.parse(Buffer.from(cursor, "base64url").toString()));
    return { createdAt, id };
  } catch {
    throw createError(400, "Invalid cursor");
  }
}
