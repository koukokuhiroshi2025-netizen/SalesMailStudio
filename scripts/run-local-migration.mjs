import { mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const statePath = process.env.SALES_MAIL_STUDIO_STATE_PATH
  ?? join(tmpdir(), "sales-mail-studio-state");
mkdirSync(statePath, { recursive: true });

const wranglerEntry = join(process.cwd(), "node_modules", "wrangler", "bin", "wrangler.js");
const result = spawnSync(process.execPath, [
  wranglerEntry,
  "d1",
  "migrations",
  "apply",
  "sales-mail-studio-db",
  "--local",
  "--persist-to",
  statePath,
], { stdio: "inherit" });

if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
