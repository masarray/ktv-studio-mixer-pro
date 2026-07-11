import assert from "node:assert/strict";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { startAppServer } from "../electron/local-server.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function request(origin, pathname) {
  return new Promise((resolve, reject) => {
    const req = http.get(new URL(pathname, origin), { agent: false }, (res) => {
      const chunks = [];
      res.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
      res.on("end", () => resolve({
        status: res.statusCode ?? 0,
        headers: res.headers,
        body: Buffer.concat(chunks),
      }));
    });
    req.setTimeout(8000, () => req.destroy(new Error(`Timeout requesting ${pathname}`)));
    req.once("error", reject);
  });
}

async function main() {
  const server = await startAppServer({ appRoot: repoRoot });
  try {
    const page = await request(server.origin, "/");
    assert.equal(page.status, 200, "root page must return HTTP 200");
    const html = page.body.toString("utf8");
    assert.match(html, /SONKUPIK STUDIO/i, "SSR page must contain the application brand");

    const favicon = await request(server.origin, "/favicon.ico");
    assert.equal(favicon.status, 200, "favicon must be served by the embedded server");
    assert.match(String(favicon.headers["content-type"] ?? ""), /image\/x-icon/);
    assert.ok(favicon.body.length > 0, "favicon response must be fully consumed");

    const assetPath = html.match(/(?:src|href)="(\/assets\/[^"]+)"/)?.[1];
    assert.ok(assetPath, "SSR page must reference a built client asset");
    const asset = await request(server.origin, assetPath);
    assert.equal(asset.status, 200, "built client asset must be served");
    assert.ok(asset.body.length > 0, "built client asset response must be fully consumed");

    console.log(`[desktop-server] PASS ${server.origin}`);
  } finally {
    await Promise.race([
      server.close(),
      new Promise((_, reject) => setTimeout(() => reject(new Error("Desktop server shutdown timeout")), 3000)),
    ]);
    console.log("[desktop-server] CLOSED");
  }
}

main().then(
  () => setImmediate(() => process.exit(0)),
  (error) => {
    console.error("[desktop-server] FAIL", error);
    setImmediate(() => process.exit(1));
  },
);
