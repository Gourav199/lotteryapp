"use strict";

const { timingSafeEqual } = require("crypto");
const { sendJson, readBody, requireConfig, setSessionCookie } = require("../../lib/http");
const {
  normalizeUsername,
  publicUser,
  signSession,
  verifyPassword,
  findByUsername,
  ensureAdmin,
} = require("../../lib/accounts");

const INVALID = "That username or password doesn't match.";

function isEnvAdmin(username, password) {
  const adminUser = normalizeUsername(process.env.ADMIN_USERNAME || "");
  const adminPassword = process.env.ADMIN_PASSWORD || "";
  if (!adminUser || !adminPassword || username !== adminUser) return false;
  const given = Buffer.from(String(password));
  const expected = Buffer.from(adminPassword);
  if (given.length !== expected.length) return false;
  return timingSafeEqual(given, expected);
}

module.exports = async function login(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return sendJson(res, 405, { error: "Method not allowed." });
  }
  if (!requireConfig(res)) return;

  const body = readBody(req);
  if (!body) return sendJson(res, 400, { error: "Send a JSON username and password." });

  const username = normalizeUsername(body.username);
  const password = body.password;
  if (!username || typeof password !== "string" || !password) {
    return sendJson(res, 401, { error: INVALID });
  }

  try {
    if (isEnvAdmin(username, password)) {
      const admin = await ensureAdmin(username, password);
      setSessionCookie(req, res, signSession(admin));
      return sendJson(res, 200, publicUser(admin));
    }

    const user = await findByUsername(username);
    const matches = await verifyPassword(password, user && user.passwordHash);
    if (!user || !matches) return sendJson(res, 401, { error: INVALID });
    setSessionCookie(req, res, signSession(user));
    return sendJson(res, 200, publicUser(user));
  } catch (error) {
    console.error("login failed:", error && error.message);
    return sendJson(res, 500, { error: "Could not sign in right now." });
  }
};
