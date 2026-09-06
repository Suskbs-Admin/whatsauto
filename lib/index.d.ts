export interface Contact {
  phone: string;
  name: string;
  session: string;
  meet_link: string;
  form_link?: string;
  custom_message?: string;
}

export interface WhatsappBulkOptions {
  contactsCsv?: string; // flag --csv / --file / --input
  templatePath?: string;
  groupName?: string; // flag --group / --group-name
  groupDescription?: string;
  meetLink?: string; // flag --meet / --meet-link
  formLink?: string; // flag --form / --form-link
  config?: any;
}

export class WhatsappBulk {
  constructor(opts?: WhatsappBulkOptions);
  init(timeoutMs?: number): Promise<any>;
  sendBulk(): Promise<Array<{contact: Contact, success: boolean, chatId: string}>>;
  createOrUpdateGroup(groupNameOverride?: string): Promise<{groupId: string, inviteLink?: string, added?: number}>;
  previewMessages(): Array<{contact: Contact, message: string}>;
  destroy(): Promise<void>;
}

export function loadContacts(csvPath: string): Contact[];
export function loadTemplate(path: string): string;
export function renderTemplate(template: string, contact: Contact, extra?: Record<string,string>): string;
export function formatPhone(raw: string): string;
export function isValidMeetLink(link: string): boolean;
export function normalizeMeetLink(link: string): string;
export function extractMeetCode(link: string): string | null;
export function formatMeetLink(link: string, opts?: {fallbackText?: string}): string;
export function isValidFormLink(link: string): boolean;
export function normalizeFormLink(link: string): string;
export function formatFormLink(link: string, opts?: {fallbackText?: string}): string;
export function buildDetailedMessage(contact: Contact, groupName: string, template: string, extra?: { formLink?: string }): string;
export function sendFromCsv(opts?: WhatsappBulkOptions & {dryRun?: boolean}): Promise<any>;
export function createClient(): any;
export function waitForReady(client: any, timeoutMs?: number): Promise<void>;
export function createOrUpdateGroup(client: any, groupName: string, contacts: Contact[], options?: any): Promise<any>;
export function findGroupByName(client: any, groupName: string): Promise<any>;
