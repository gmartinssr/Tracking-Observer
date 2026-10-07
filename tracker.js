const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { URL } = require("url");

const args = process.argv.slice(2);
const valueAfter = (name, fallback) => {
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
};
const projectRoot = path.resolve(valueAfter("--project", process.cwd()));
const port = Number(valueAfter("--port", "4173"));
const entry = valueAfter("--entry", "index.html");
const backendUrl = valueAfter("--backend-url");
const clients = new Set();
const events = [];
const maxEvents = 500;
const sessionId = crypto.randomUUID();
const files = {
  dashboard: path.join(__dirname, "dashboard.html"),
  css: path.join(__dirname, "dashboard.css"),
  tracker: path.join(__dirname, "browser-tracker.js"),
};

if (!fs.existsSync(projectRoot) || !fs.statSync(projectRoot).isDirectory()) {
  console.error(`Pasta do projeto não encontrada: ${projectRoot}`);
  process.exit(1);
}

function sendJson(response, status, data) {
  const body = JSON.stringify(data);
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store",
  });
  response.end(body);
}

function sendFile(response, file, contentType) {
  response.writeHead(200, { "Content-Type": contentType, "Cache-Control": "no-store" });
  fs.createReadStream(file).pipe(response);
}

function publish(event) {
  const item = { id: crypto.randomUUID(), sessionId, timestamp: new Date().toISOString(), ...event };
  events.push(item);
  if (events.length > maxEvents) events.shift();
  const message = `data: ${JSON.stringify(item)}\n\n`;
  for (const client of clients) client.write(message);
}

function safeProjectFile(requestPath) {
  const decoded = decodeURIComponent(requestPath);
  const relative = decoded === "/" ? entry : decoded.slice(1);
  const file = path.resolve(projectRoot, relative);
  const root = projectRoot.endsWith(path.sep) ? projectRoot : projectRoot + path.sep;
  return file === projectRoot || file.startsWith(root) ? file : null;
}

function injectTracker(html) {
  const tag = `<script src="/__tracker/browser-tracker.js"></script>`;
  if (html.includes("/__tracker/browser-tracker.js")) return html;
  const closingHead = html.search(/<\/head\s*>/i);
  return closingHead >= 0
    ? `${html.slice(0, closingHead)}${tag}${html.slice(closingHead)}`
    : `${tag}${html}`;
}

async function readRequestBody(request) {
  let body = "";
  for await (const chunk of request) body += chunk;
  return body;
}

function proxyBackend(request, response, targetUrl) {
  const target = new URL(request.url, targetUrl);
  const proxyRequest = http.request(target, {
    method: request.method,
    headers: { ...request.headers, host: target.host },
  }, (proxyResponse) => {
    response.writeHead(proxyResponse.statusCode || 502, proxyResponse.headers);
    proxyResponse.pipe(response);
  });
  proxyRequest.on("error", (error) => {
    console.error(`Backend indisponível em ${target.origin}: ${error.message}`);
    if (!response.headersSent) sendJson(response, 502, { error: "Backend indisponível." });
    else response.end();
  });
  request.pipe(proxyRequest);
}

const server = http.createServer(async (request, response) => {
  const requestUrl = new URL(request.url, `http://${request.headers.host}`);

  if (backendUrl && requestUrl.pathname.startsWith("/api/")) {
    return proxyBackend(request, response, backendUrl);
  }

  if (requestUrl.pathname === "/__tracker/event" && request.method === "POST") {
    try {
      const event = JSON.parse(await readRequestBody(request));
      if (!event || typeof event.type !== "string") return sendJson(response, 400, { error: "Evento inválido." });
      publish(event);
      return sendJson(response, 202, { accepted: true });
    } catch {
      return sendJson(response, 400, { error: "JSON inválido." });
    }
  }
  if (requestUrl.pathname === "/__tracker/events") return sendJson(response, 200, events);
  if (requestUrl.pathname === "/__tracker/stream") {
    response.writeHead(200, { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache", Connection: "keep-alive" });
    response.write(`data: ${JSON.stringify({ type: "connected", sessionId })}\n\n`);
    for (const event of events) response.write(`data: ${JSON.stringify(event)}\n\n`);
    clients.add(response);
    request.on("close", () => clients.delete(response));
    return;
  }
  if (requestUrl.pathname === "/__tracker/browser-tracker.js") return sendFile(response, files.tracker, "application/javascript; charset=utf-8");
  if (requestUrl.pathname === "/__tracker/dashboard.css") return sendFile(response, files.css, "text/css; charset=utf-8");
  if (requestUrl.pathname === "/__tracker" || requestUrl.pathname === "/__tracker/") return sendFile(response, files.dashboard, "text/html; charset=utf-8");

  if (requestUrl.pathname === "/" && entry !== "index.html") {
    response.writeHead(302, { Location: `/${entry}` });
    return response.end();
  }

  const file = safeProjectFile(requestUrl.pathname);
  if (!file || !fs.existsSync(file) || !fs.statSync(file).isFile()) return sendJson(response, 404, { error: "Arquivo não encontrado." });
  const extension = path.extname(file).toLowerCase();
  const contentTypes = {
    ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8",
    ".js": "application/javascript; charset=utf-8", ".json": "application/json; charset=utf-8",
    ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg", ".gif": "image/gif", ".ico": "image/x-icon",
  };
  if (extension === ".html") {
    response.writeHead(200, { "Content-Type": contentTypes[".html"], "Cache-Control": "no-store" });
    return response.end(injectTracker(fs.readFileSync(file, "utf8")));
  }
  return sendFile(response, file, contentTypes[extension] || "application/octet-stream");
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Projeto monitorado: ${projectRoot}`);
  console.log(`Aplicação: http://127.0.0.1:${port}/`);
  console.log(`Rastreamento: http://127.0.0.1:${port}/__tracker/`);
});
