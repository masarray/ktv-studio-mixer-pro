import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { startAppServer } from "../electron/local-server.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const server = await startAppServer({ appRoot: repoRoot });
try {
  const page = await fetch(`${server.origin}/`);
  assert.equal(page.status, 200, "root page must return HTTP 200");
  const html = await page.text();
  assert.match(html, /SONKUPIK STUDIO/i, "SSR page must contain the application brand");

  const favicon = await fetch(`${server.origin}/favicon.ico`);
  assert.equal(favicon.status, 200, "favicon must be served by the embedded server");
  assert.match(favicon.headers.get("content-type") ?? "", /image\/x-icon/);

  const assetPath = html.match(/(?:src|href)="(\/assets\/[^"]+)"/)?.[1];
  assert.ok(assetPath, "SSR page must reference a built client asset");
  const asset = await fetch(`${server.origin}${assetPath}`);
  assert.equal(asset.status, 200, "built client asset must be served");

  console.log(`[desktop-server] PASS ${server.origin}`);
} finally {
  await server.close();
}
