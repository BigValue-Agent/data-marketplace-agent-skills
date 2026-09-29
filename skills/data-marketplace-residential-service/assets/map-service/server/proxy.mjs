// Data Marketplace 프록시 + 정적 파일 서버 (의존성 없음, Node 18+)
//
//   DATA_MARKETPLACE_API_KEY=... node server/proxy.mjs
//   (DATA_MARKETPLACE_BASE_URL은 비표준 환경에서만 지정한다)
//
// 보안 경계: X-API-KEY는 이 프로세스의 환경변수로만 존재하고 브라우저에 절대 내려가지 않는다.
// slug 직통 전달 금지 — 아래 allowlist(계약 route ↔ 상품 slug 1:1 매핑) 밖의 경로는 404.
// 업스트림 호출은 HTTP(S)_PROXY / NO_PROXY 환경변수를 존중한다.
import http from "node:http";
import https from "node:https";
import tls from "node:tls";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const API_KEY = process.env.DATA_MARKETPLACE_API_KEY;
const API_BASE = process.env.DATA_MARKETPLACE_BASE_URL ?? "https://datamarket-api.bigvalue.ai";
const PORT = Number(process.env.PORT || 3000);
const ROOT = fileURLToPath(new URL("..", import.meta.url)); // 템플릿 루트 (server/의 상위)

if (!API_KEY) {
  console.error("DATA_MARKETPLACE_API_KEY 환경변수가 필요합니다.");
  process.exit(1);
}

// ── egress 프록시 선택 (HTTP(S)_PROXY / NO_PROXY 존중) ──────────────────────
function noProxyMatch(host) {
  const raw = process.env.NO_PROXY || process.env.no_proxy || "";
  for (let entry of raw.split(",")) {
    entry = entry.trim().toLowerCase();
    if (!entry || entry.includes("/")) continue;
    if (entry === "*") return true;
    const e = entry.startsWith(".") ? entry.slice(1) : entry;
    if (host === e || host.endsWith(`.${e}`)) return true;
  }
  return false;
}

function pickProxy(target) {
  if (noProxyMatch(target.hostname.toLowerCase())) return null;
  const env = (key) => process.env[key] || process.env[key.toLowerCase()];
  const url = target.protocol === "https:"
    ? env("HTTPS_PROXY") || env("ALL_PROXY")
    : env("HTTP_PROXY") || env("ALL_PROXY");
  return url ? new URL(url) : null;
}

function collect(res) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    res.on("data", (chunk) => chunks.push(chunk));
    res.on("end", () => resolve({
      status: res.statusCode,
      text: Buffer.concat(chunks).toString("utf8"),
    }));
    res.on("error", reject);
  });
}

async function upstreamQuery(targetUrl, { headers, body }) {
  const target = new URL(targetUrl);
  const proxy = pickProxy(target);
  if (!proxy) {
    const upstream = await fetch(targetUrl, { method: "POST", headers, body });
    return { status: upstream.status, text: await upstream.text() };
  }

  const proxyAuth = proxy.username
    ? "Basic " + Buffer.from(`${decodeURIComponent(proxy.username)}:${decodeURIComponent(proxy.password)}`).toString("base64")
    : null;

  if (target.protocol === "http:") {
    return new Promise((resolve, reject) => {
      const requestHeaders = { ...headers, Host: target.host };
      if (proxyAuth) requestHeaders["Proxy-Authorization"] = proxyAuth;
      const req = http.request({
        host: proxy.hostname,
        port: Number(proxy.port) || 80,
        method: "POST",
        path: targetUrl,
        headers: requestHeaders,
      }, (res) => collect(res).then(resolve, reject));
      req.on("error", reject);
      req.end(body);
    });
  }

  return new Promise((resolve, reject) => {
    const connectHeaders = { Host: `${target.hostname}:${target.port || 443}` };
    if (proxyAuth) connectHeaders["Proxy-Authorization"] = proxyAuth;
    const connectReq = http.request({
      host: proxy.hostname,
      port: Number(proxy.port) || 80,
      method: "CONNECT",
      path: `${target.hostname}:${target.port || 443}`,
      headers: connectHeaders,
    });
    connectReq.on("connect", (connectRes, socket) => {
      if (connectRes.statusCode !== 200) {
        reject(new Error(`proxy CONNECT ${connectRes.statusCode}`));
        return;
      }
      const tlsSocket = tls.connect({ socket, servername: target.hostname }, () => {
        const req = https.request({
          method: "POST",
          path: target.pathname + target.search,
          headers: { ...headers, Host: target.host },
          createConnection: () => tlsSocket,
        }, (res) => collect(res).then(resolve, reject));
        req.on("error", reject);
        req.end(body);
      });
      tlsSocket.on("error", reject);
    });
    connectReq.on("error", reject);
    connectReq.end();
  });
}

// minimum_service_contract의 core/lazy route ↔ Data Marketplace 상품 slug
const ROUTES = {
  // 티어 주석은 구성 3단 절삭용(README 각색 규칙 10): 기본형은 "전 구성" 4줄만 남긴다.
  "/api/location-search": { domain: "residential", slug: "location-search" }, // 전 구성
  "/api/region-detail": { domain: "region", slug: "legaldongs" }, // 전 구성
  "/api/markers": { domain: "residential", slug: "complex-type-markers" }, // 전 구성
  "/api/complex-detail": { domain: "residential", slug: "complexes" }, // 전 구성
  "/api/complex-shape": { domain: "residential", slug: "complex-shapes" }, // 표준형+
  "/api/prices?tab=realdeal": { domain: "residential", slug: "realdeal" }, // 표준형+
  "/api/prices?tab=notice": { domain: "residential", slug: "notice-prices" }, // 완성형
  "/api/prices?tab=estimated": { domain: "residential", slug: "estimated-prices" }, // 완성형
  "/api/buildings": { domain: "residential", slug: "buildings" }, // 완성형
  "/api/units": { domain: "residential", slug: "units" }, // 완성형
};

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".png": "image/png",
};

function routeKey(url) {
  // /api/prices는 tab 쿼리까지 포함해 계약 route 문자열과 일치시킨다
  if (url.pathname === "/api/prices") {
    const tab = url.searchParams.get("tab");
    return tab ? `${url.pathname}?tab=${tab}` : url.pathname;
  }
  return url.pathname;
}

function readBody(req, maxBytes = 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (c) => {
      size += c.length;
      if (size > maxBytes) { reject(new Error("body too large")); req.destroy(); return; }
      chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(body);
}

async function handleApi(req, res, url) {
  if (req.method !== "POST") return sendJson(res, 405, { success: false, detail: "POST only" });
  const key = routeKey(url);
  const product = ROUTES[key];
  if (!product) return sendJson(res, 404, { success: false, detail: `unknown route: ${routeKey(url)}` });
  let body;
  let payload;
  try {
    body = await readBody(req);
    payload = JSON.parse(body || "{}");
  } catch {
    return sendJson(res, 400, { success: false, detail: "invalid JSON body" });
  }
  if (key === "/api/markers" && Object.prototype.hasOwnProperty.call(payload, "offset")) {
    return sendJson(res, 400, {
      success: false,
      detail: "/api/markers does not support offset pagination",
    });
  }
  if (key === "/api/location-search" && Object.prototype.hasOwnProperty.call(payload, "offset")) {
    return sendJson(res, 400, {
      success: false,
      detail: "/api/location-search does not support offset pagination",
    });
  }
  try {
    // 업스트림 응답 envelope를 가공 없이 그대로 전달한다
    const upstream = await upstreamQuery(
      `${API_BASE}/api/v1/data-products/${product.domain}/${product.slug}/query`, {
      headers: { "X-API-KEY": API_KEY, "Content-Type": "application/json" },
      body: body || "{}",
    });
    res.writeHead(upstream.status, { "Content-Type": "application/json; charset=utf-8" });
    res.end(upstream.text);
  } catch (e) {
    sendJson(res, 502, { success: false, detail: `upstream error: ${e.message}` });
  }
}

async function handleStatic(req, res, url) {
  const rel = url.pathname === "/" ? "index.html" : decodeURIComponent(url.pathname.slice(1));
  if (rel.split("/").some((segment) => segment.startsWith(".")) || rel.startsWith("server/")) {
    res.writeHead(403); return res.end("forbidden");
  }
  const path = normalize(join(ROOT, rel));
  if (!path.startsWith(ROOT)) {
    res.writeHead(403); return res.end("forbidden");
  }
  try {
    const data = await readFile(path);
    res.writeHead(200, { "Content-Type": MIME[extname(path)] || "application/octet-stream" });
    res.end(data);
  } catch {
    res.writeHead(404); res.end("not found");
  }
}

http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  if (url.pathname.startsWith("/api/")) return handleApi(req, res, url);
  return handleStatic(req, res, url);
}).listen(PORT, () => {
  const proxy = pickProxy(new URL(API_BASE));
  console.log(`http://localhost:${PORT} (upstream: ${API_BASE}${proxy ? `, egress proxy: ${proxy.hostname}:${proxy.port}` : ""})`);
});
