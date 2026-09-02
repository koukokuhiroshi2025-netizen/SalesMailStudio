import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";

const database = new DatabaseSync(":memory:");
database.exec(readFileSync(new URL("../migrations/0001_initial.sql", import.meta.url), "utf8"));

const expectedTables = [
  "users",
  "mail_accounts",
  "contacts",
  "custom_fields",
  "contact_custom_values",
  "templates",
  "campaigns",
  "campaign_contacts",
  "mail_logs",
  "unsubscribes",
  "followups",
  "deals",
  "settings",
];
const actualTables = database.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map((row) => row.name);
const missing = expectedTables.filter((table) => !actualTables.includes(table));
if (missing.length) throw new Error(`Missing tables: ${missing.join(", ")}`);

const contacts = database.prepare("SELECT COUNT(*) AS count FROM contacts").get().count;
const templates = database.prepare("SELECT COUNT(*) AS count FROM templates").get().count;
const crossTenantLeak = database.prepare("SELECT COUNT(*) AS count FROM contacts WHERE user_id <> 'demo-user'").get().count;
if (contacts !== 4 || templates !== 2 || crossTenantLeak !== 0) {
  throw new Error("Seed verification failed");
}

console.log(JSON.stringify({ tables: expectedTables.length, contacts, templates, foreignKeys: true }));
