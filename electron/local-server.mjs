import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import path from "node:path";
import { Readable } from "node:stream";
import { pathToFileURL } from "node:url";

const MIME = new Map([
  [".css", "text/css; charset=utf-8"],
  [".gif", "image/gif"],
  [".html", "text/html; charset=utf-8"],
  [".ico", "image/x-icon"],
  [".jpeg", "image/jpeg"],
  [".jpg", "image/jpeg"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".map", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".webp", "image/webp"],
  [".woff", "font/woff"],
  [".woff2", "font/woff2"],
]);

function safeStaticPath(clientRoot, pathname) {
  let relative;
  try {
    relative = decodeURIComponent(pathname).replace(/^\/+/, "");
  } catch {
    return null;
  }
  if (!relative || relative.endsWith("/")) return null;
  const candidate = path.resolve(clientRoot, relative);
  const rootWithSeparator = `${path.resolve(clientRoot)}${path.sep}`;
  return candidate.startsWith(rootWithSeparator) ? candidate : null;
}

function serveStatic(req, res, clientRoot, pathname) {
  const candidate = safeStaticPath(clientRoot, pathname);
  if (!candidate || !existsSync(candidate)) return false;
  const info = statSync(candidate);
  if (!info.isFile()) return false;

  const contentType = MIME.get(path.extname(candidate).toLowerCase()) ?? "application/octet-stream";
  res.statusCode = 200;
  res.setHeader("content-type", contentType);
  res.setHeader("content-length", info.size);
  res.setHeader("cache-control", pathname.startsWith("/assets/")
    ? "public, max-age=31536000, immutable"
    : "no-cache");
  if (req.method === "HEAD") {
    res.end();
  } else {
    createReadStream(candidate).pipe(res);
  }
  return true;
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  return chunks.length ? Buffer.concat(chunks) : undefined;
}

async function toFetchRequest(req, origin) {
  const method = req.method ?? "GET";
  const headers = new Headers();
  for (const [name, raw] of Object.entries(req.headers)) {
    if (raw === undefined) continue;
    if (Array.isArray(raw)) raw.forEach((value) => headers.append(name, value));
    else headers.set(name, raw);
  }
  const body = method === "GET" || method === "HEAD" ? undefined : await readBody(req);
  return new Request(new URL(req.url ?? "/", origin), {
    method,
    headers,
    body,
  });
}

async function sendFetchResponse(req, res, response) {
  res.statusCode = response.status;
  res.statusMessage = response.statusText;
  response.headers.forEach((value, name) => {
    if (name.toLowerCase() !== "transfer-encoding") res.setHeader(name, value);
  });
  if (req.method === "HEAD" || !response.body) {
    res.end();
    return;
  }
  Readable.fromWeb(response.body).pipe(res);
}

export async function startAppServer({ appRoot, host = "127.0.0.1", port = 0 } = {}) {
  if (!appRoot) throw new Error("appRoot is required");
  const clientRoot = path.join(appRoot, "dist", "client");
  const serverEntryPath = path.join(appRoot, "dist", "server", "server.js");
  if (!existsSync(clientRoot) || !existsSync(serverEntryPath)) {
    throw new Error("Production build is missing. Run npm run build before launching the desktop app.");
  }

  const moduleUrl = pathToFileURL(serverEntryPath).href;
  const serverEntry = await import(moduleUrl);
  const fetchHandler = serverEntry.default?.fetch;
  if (typeof fetchHandler !== "function") {
    throw new Error("TanStack server entry does not expose a fetch handler.");
  }

  let origin = "";
  const server = createServer(async (req, res) => {
    try {
      const requestUrl = new URL(req.url ?? "/", origin);
      if (serveStatic(req, res, clientRoot, requestUrl.pathname)) return;
      const request = await toFetchRequest(req, origin);
      const response = await fetchHandler(request, {}, {});
      await sendFetchResponse(req, res, response);
    } catch (error) {
      console.error("[desktop-server] request failed", error);
      if (!res.headersSent) res.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
      res.end("SONKUPIK STUDIO failed to load.");
    }
  });

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, resolve);
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Desktop server did not expose a TCP port.");
  origin = `http://${host}:${address.port}`;

  return {
    origin,
    close: () => new Promise((resolve) => server.close(() => resolve())),
  };
}
