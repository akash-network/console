export interface InboxMessage {
  id: string;
  receivedMs: number;
  subject?: string;
}

export interface InboxClient {
  generateEmail(): string;
  fetchMessages(email: string): Promise<InboxMessage[]>;
  fetchMessageBody(email: string, messageId: string): Promise<string>;
}
