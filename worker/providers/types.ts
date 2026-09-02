export interface OutgoingMail {
  to: string;
  cc?: string;
  bcc?: string;
  subject: string;
  body: string;
  accountId?: string;
}

export interface ProviderResult {
  success: boolean;
  providerMessageId?: string;
  error?: string;
}

export interface ConnectionResult {
  success: boolean;
  message: string;
}

export interface MailProvider {
  testConnection(): Promise<ConnectionResult>;
  sendMail(message: OutgoingMail): Promise<ProviderResult>;
  saveDraft?(message: OutgoingMail): Promise<ProviderResult>;
}

export interface GaroonCredentials {
  baseUrl: string;
  username: string;
  password: string;
  accountId: string;
  basicUsername?: string;
  basicPassword?: string;
}
