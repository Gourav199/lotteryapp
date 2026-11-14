"use strict";

const {
  createHmac,
  createHash,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} = require("node:crypto");

const PASSWORD_KEY = "lotteryapp:admin-credential:v1";
const SESSION_COOKIE = "lottery_session";
const SESSION_SECONDS = 8 * 60 * 60;
const PASSWORD_MIN_LENGTH = 12;
const LOGIN_ATTEMPT_LIMIT = 10;
const LOGIN_WINDOW_SECONDS = 15 * 60;

function send(res, status, body, headers = {}) {
  res.setHeader("Cache-Control", "no-store");
  Object.entries(headers).forEach(([name, value]) => res.setHeader(name, value));
  res.status(status).json(body);
}

function configuration() {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  const password = process.env.ADMIN_PASSWORD;
  const secret = process.env.AUTH_SESSION_SECRET;
  if (!url || !token || !password || !secret) {
    throw new Error("Authentication is not configured. Set ADMIN_PASSWORD, AUTH_SESSION_SECRET, and the Upstash Redis REST URL and token in Vercel.");
  }
  if (password.length < PASSWORD_MIN_LENGTH) {
    throw new Error(`ADMIN_PASSWORD must be at least ${PASSWORD_MIN_LENGTH} characters.`);
  }
  if (secret.length < 32) {
    throw new Error("AUTH_SESSION_SECRET must be at least 32 characters.");
  }
  if (new URL(url).protocol !== "https:") {
    throw new Error("The Upstash Redis REST URL must use HTTPS.");
  }
  return { url: url.replace(/\/+$/, ""), token, password, secret };
}

async function redis(config, command) {
  const response = await fetch(config.url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(command),
  });
  if (!response.ok) throw new Error("Password storage is unavailable. Check the Upstash Redis configuration.");
  const result = await response.json();
  if (result.error) throw new Error("Password storage request failed.");
  return result.result;
}

function derivePassword(password, salt) {
  return scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }).toString("hex");
}

function createCredential(password) {
  const salt = randomBytes(16).toString("hex");
  return JSON.stringify({ id: randomBytes(16).toString("hex"), salt, hash: derivePassword(password, salt) });
}

function parseCredential(serialized) {
  try {
    const credential = JSON.parse(serialized);
    if (!credential
      || !/^[0-9a-f]{32}$/i.test(credential.id)
      || !/^[0-9a-f]{32}$/i.test(credential.salt)
      || !/^[0-9a-f]{128}$/i.test(credential.hash)) {
      throw new Error("Saved password data is invalid.");
    }
    return credential;
  } catch {
    throw new Error("Saved password data is invalid.");
  }
}

function verifyCredential(password, credential) {
  const expected = Buffer.from(credential.hash, "hex");
  const actual = Buffer.from(derivePassword(password, credential.salt), "hex");
  return timingSafeEqual(actual, expected);
}

function sign(payload, secret) {
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", secret).update(data).digest("base64url");
  return `${data}.${signature}`;
}

function readSession(req, secret, credentialId) {
  const cookies = String(req.headers.cookie || "").split(/;\s*/);
  const cookie = cookies.find((item) => item.startsWith(`${SESSION_COOKIE}=`));
  if (!cookie) return null;

  const [data, signature, extra] = cookie.slice(SESSION_COOKIE.length + 1).split(".");
  if (!data || !signature || extra) return null;
  const expected = createHmac("sha256", secret).update(data).digest();
  let actual;
  try {
    actual = Buffer.from(signature, "base64url");
  } catch {
    return null;
  }
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;

  try {
    const payload = JSON.parse(Buffer.from(data, "base64url").toString("utf8"));
    if (payload.sub !== "admin"
      || payload.credentialId !== credentialId
      || !Number.isInteger(payload.exp)
      || payload.exp <= Date.now() / 1000) return null;
    return payload;
  } catch {
    return null;
  }
}

function sessionCookie(req, secret, credentialId) {
  const payload = { sub: "admin", credentialId, exp: Math.floor(Date.now() / 1000) + SESSION_SECONDS };
  const secure = process.env.NODE_ENV === "production" || req.headers["x-forwarded-proto"] === "https";
  return `${SESSION_COOKIE}=${sign(payload, secret)}; Path=/; Max-Age=${SESSION_SECONDS}; HttpOnly; SameSite=Strict${secure ? "; Secure" : ""}`;
}

async function authenticatedCredential(req, config) {
  const saved = await redis(config, ["GET", PASSWORD_KEY]);
  if (!saved) return null;
  const credential = parseCredential(saved);
  return readSession(req, config.secret, credential.id) ? credential : null;
}

function clearSessionCookie(req) {
  const secure = process.env.NODE_ENV === "production" || req.headers["x-forwarded-proto"] === "https";
  return `${SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Strict${secure ? "; Secure" : ""}`;
}

async function checkLoginRateLimit(req, config) {
  const ip = req.headers["x-real-ip"]
    || String(req.headers["x-forwarded-for"] || "").split(",")[0].trim()
    || (req.socket && req.socket.remoteAddress)
    || "unknown";
  const key = `lotteryapp:login-attempts:${createHash("sha256").update(String(ip)).digest("hex")}`;
  const count = Number(await redis(config, ["INCR", key]));
  if (count === 1) await redis(config, ["EXPIRE", key, String(LOGIN_WINDOW_SECONDS)]);
  return { key, limited: count > LOGIN_ATTEMPT_LIMIT };
}

function isSameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return false;
  const forwardedHost = String(req.headers["x-forwarded-host"] || req.headers.host || "").split(",")[0].trim();
  const forwardedProto = String(req.headers["x-forwarded-proto"] || (req.socket && req.socket.encrypted ? "https" : "http"))
    .split(",")[0]
    .trim();
  try {
    const originUrl = new URL(origin);
    return originUrl.origin === `${forwardedProto}://${forwardedHost}`;
  } catch {
    return false;
  }
}

function requestBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  try {
    return JSON.parse(req.body || "");
  } catch {
    return {};
  }
}

async function login(req, res, config) {
  const body = requestBody(req);
  if (typeof body.username !== "string" || typeof body.password !== "string") {
    return send(res, 400, { error: "Enter a username and password." });
  }
  if (body.password.length > 256) return send(res, 400, { error: "Password is too long." });
  const attempts = await checkLoginRateLimit(req, config);
  if (attempts.limited) {
    return send(res, 429, { error: "Too many sign-in attempts. Try again in 15 minutes." }, { "Retry-After": String(LOGIN_WINDOW_SECONDS) });
  }

  let saved = await redis(config, ["GET", PASSWORD_KEY]);
  let valid = false;
  if (body.username === "admin") {
    if (saved) {
      valid = verifyCredential(body.password, parseCredential(saved));
    } else if (body.password === config.password) {
      const initialCredential = createCredential(config.password);
      const created = await redis(config, ["SET", PASSWORD_KEY, initialCredential, "NX"]);
      saved = created ? initialCredential : await redis(config, ["GET", PASSWORD_KEY]);
      valid = Boolean(saved) && verifyCredential(body.password, parseCredential(saved));
    }
  }
  if (!valid) return send(res, 401, { error: "That username or password doesn't match." });
  await redis(config, ["DEL", attempts.key]);
  const credential = parseCredential(saved);
  return send(res, 200, { authenticated: true }, { "Set-Cookie": sessionCookie(req, config.secret, credential.id) });
}

async function changePassword(req, res, config, credential) {
  const body = requestBody(req);
  if (typeof body.currentPassword !== "string" || typeof body.newPassword !== "string") {
    return send(res, 400, { error: "Enter your current and new passwords." });
  }
  if (body.newPassword.length < PASSWORD_MIN_LENGTH) {
    return send(res, 400, { error: `New password must be at least ${PASSWORD_MIN_LENGTH} characters.` });
  }
  if (body.newPassword.length > 256) {
    return send(res, 400, { error: "New password is too long." });
  }

  if (!verifyCredential(body.currentPassword, credential)) {
    return send(res, 401, { error: "Current password is incorrect." });
  }
  const saved = createCredential(body.newPassword);
  await redis(config, ["SET", PASSWORD_KEY, saved]);
  const newCredential = parseCredential(saved);
  return send(res, 200, { changed: true }, { "Set-Cookie": sessionCookie(req, config.secret, newCredential.id) });
}

module.exports = async function handler(req, res) {
  try {
    const config = configuration();
    const action = req.query && req.query.action
      ? req.query.action
      : new URL(req.url, "https://vercel.local").searchParams.get("action");

    if (req.method === "GET" && action === "session") {
      return send(res, 200, { authenticated: Boolean(await authenticatedCredential(req, config)) });
    }
    if (req.method !== "POST") {
      return send(res, 405, { error: "Method not allowed." }, { Allow: "GET, POST" });
    }
    if (!isSameOrigin(req)) return send(res, 403, { error: "Request origin was not accepted." });

    const body = requestBody(req);
    if (body.action === "login") return await login(req, res, config);
    if (body.action === "logout") {
      if (!await authenticatedCredential(req, config)) return send(res, 401, { error: "Your session has expired. Sign in again." });
      return send(res, 200, { authenticated: false }, { "Set-Cookie": clearSessionCookie(req) });
    }
    if (body.action === "change-password") {
      const credential = await authenticatedCredential(req, config);
      if (!credential) return send(res, 401, { error: "Your session has expired. Sign in again." });
      return await changePassword(req, res, config, credential);
    }
    return send(res, 400, { error: "Unknown authentication action." });
  } catch (error) {
    console.error("Authentication API error:", error);
    return send(res, 503, { error: error.message || "Authentication service is unavailable." });
  }
};
