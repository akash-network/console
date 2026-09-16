import type { NextApiRequest, NextApiResponse } from "next";

export default function healthz(_req: NextApiRequest, res: NextApiResponse) {
  res.status(200).json({ data: { status: "ok" } });
}
