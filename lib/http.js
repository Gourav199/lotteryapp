"use strict";

const COOKIE = "lottery_session";
const WEEK = 60 * 60 * 24 * 7;

function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(payload));
}

function readBody(req) {
  if (!req.body) return {};
  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body);
    } catch {
      return null;
    }
  }
  return req.body;
}

function configError() {
  if (!process.env.MONGODB_URI || !process.env.JWT_SECRET) {
    return "Sign-in is not configured. Set MONGODB_URI and JWT_SECRET.";
  }
  if (process.env.JWT_SECRET.length < 32 || process.env.JWT_SECRET.startsWith("replace-with")) {
    return "JWT_SECRET must be a random string of at least 32 characters.";
  }
  return "";
}

function requireConfig(res) {
  const message = configError();
  if (!message) return true;
  sendJson(res, 500, { error: message });
  return false;
}

function isSecure(req) {
  if (process.env.VERCEL) return true;
  return req.headers["x-forwarded-proto"] === "https";
}

function writeSessionCookie(req, res, token, maxAge) {
  const parts = [
    `${COOKIE}=${encodeURIComponent(token)}`,
    "HttpOnly",
    "Path=/",
    "SameSite=Lax",
    `Max-Age=${maxAge}`,
  ];
  if (isSecure(req)) parts.push("Secure");
  res.setHeader("Set-Cookie", parts.join("; "));
}

function setSessionCookie(req, res, token) {
  writeSessionCookie(req, res, token, WEEK);
}

function clearSessionCookie(req, res) {
  writeSessionCookie(req, res, "", 0);
}

function readCookie(req) {
  const header = req.headers.cookie || "";
  const part = header.split(";").map((item) => item.trim()).find((item) => item.startsWith(`${COOKIE}=`));
  if (!part) return "";
  return decodeURIComponent(part.slice(COOKIE.length + 1));
}

module.exports = {
  sendJson,
  readBody,
  requireConfig,
  setSessionCookie,
  clearSessionCookie,
  readCookie,
};
