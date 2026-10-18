import { notFound } from "next/navigation";

/** console-api answers 400 to an id no record can ever have, such as `/blocks/abc` or `/addresses/undefined`. */
export function notFoundOnMalformedId(response: Response): void {
  if (response.status === 400) {
    notFound();
  }
}
