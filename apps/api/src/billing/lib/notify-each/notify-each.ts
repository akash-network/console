/** Sends to every contact even when one send fails, and fails only when nobody was reached, so a retry never repeats a delivered email. */
export async function notifyEach<T>(
  contacts: readonly T[],
  send: (contact: T) => Promise<unknown>,
  onFailure: (contact: T, error: unknown) => void
): Promise<void> {
  let lastError: unknown;
  let deliveredCount = 0;

  for (const contact of contacts) {
    try {
      await send(contact);
      deliveredCount++;
    } catch (error) {
      lastError = error;
      onFailure(contact, error);
    }
  }

  if (contacts.length > 0 && deliveredCount === 0) {
    throw lastError;
  }
}
