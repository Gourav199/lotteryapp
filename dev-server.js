"use strict";

const http = require("http");
const fs = require("fs");
const path = require("path");

function loadEnv() {
  const file = path.join(__dirname, ".env");
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const eq = trimmed.indexOf("=");
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (key && process.env[key] == null) process.env[key] = value;
  }
}

loadEnv();

const adminUsers = require("./api/admin/users");
const routes = {
  "POST /api/auth/login": require("./api/auth/login"),
  "POST /api/auth/register": require("./api/auth/register"),
  "POST /api/auth/logout": require("./api/auth/logout"),
  "GET /api/auth/me": require("./api/auth/me"),
  "GET /api/admin/users": adminUsers,
  "POST /api/admin/users": adminUsers,
  "PATCH /api/admin/users": adminUsers,
};

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
};

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error("Invalid JSON"));
      }
    });
    req.on("error", reject);
  });
}

function sendFile(res, filePath) {
  const ext = path.extname(filePath);
  const type = TYPES[ext];
  if (!type) {
    res.statusCode = 404;
    res.end("Not found");
    return;
  }
  fs.readFile(filePath, (error, data) => {
    if (error) {
      res.statusCode = 404;
      res.end("Not found");
      return;
    }
    res.statusCode = 200;
    res.setHeader("Content-Type", type);
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://127.0.0.1");
  const route = routes[`${req.method} ${url.pathname}`];

  if (route) {
    try {
      if (req.method === "POST" || req.method === "PATCH" || req.method === "PUT") {
        req.body = await readRequestBody(req);
      }
      await route(req, res);
    } catch (error) {
      if (!res.writableEnded) {
        res.statusCode = error.message === "Invalid JSON" ? 400 : 500;
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.end(JSON.stringify({
          error: error.message === "Invalid JSON" ? "Send valid JSON." : "Request failed.",
        }));
      }
    }
    return;
  }

  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/lib/") || url.pathname.includes("..")) {
    res.statusCode = 404;
    res.end("Not found");
    return;
  }

  const requested = (url.pathname === "/" ? "index.html" : url.pathname.replace(/^\/+/, ""));
  const filePath = path.resolve(__dirname, requested);
  const relative = path.relative(__dirname, filePath);
  const privateFile = new Set(["dev-server.js", "package.json", "package-lock.json"]);
  if (
    relative.startsWith("..") ||
    path.isAbsolute(relative) ||
    relative.split(path.sep).some((part) => part.startsWith(".")) ||
    privateFile.has(relative)
  ) {
    res.statusCode = 404;
    res.end("Not found");
    return;
  }
  sendFile(res, filePath);
});

const port = Number(process.env.PORT) || 3000;
server.listen(port, "127.0.0.1", () => {
  console.log(`Lottery app running at http://127.0.0.1:${port}`);
});
