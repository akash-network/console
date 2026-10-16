export interface EmailLink {
  text: string;
  href: string;
}

export interface InboxMessage {
  id: string;
  receivedMs: number;
  subject?: string;
  /** Absent when the inbox does not keep the links of an email. */
  links?: EmailLink[];
}

export interface InboxClient {
  generateEmail(): string;
  fetchMessages(email: string): Promise<InboxMessage[]>;
  fetchMessageBody(email: string, messageId: string): Promise<string>;
}
