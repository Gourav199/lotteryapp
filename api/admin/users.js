"use strict";

const { sendJson, readBody, requireConfig, readCookie } = require("../../lib/http");
const {
  readSession,
  findById,
  normalizeUsername,
  accountError,
  createAccount,
  listAccounts,
  setAccountPassword,
} = require("../../lib/accounts");

async function requireAdmin(req, res) {
  const session = readSession(readCookie(req));
  if (!session || !session.sub) {
    sendJson(res, 401, { error: "Not signed in." });
    return null;
  }
  const user = await findById(session.sub);
  if (!user) {
    sendJson(res, 401, { error: "Not signed in." });
    return null;
  }
  if (user.role !== "admin") {
    sendJson(res, 403, { error: "Only an administrator can do that." });
    return null;
  }
  return user;
}

module.exports = async function adminUsers(req, res) {
  if (!requireConfig(res)) return;

  let admin;
  try {
    admin = await requireAdmin(req, res);
  } catch (error) {
    console.error("admin check failed:", error && error.message);
    return sendJson(res, 500, { error: "Could not check the administrator session." });
  }
  if (!admin) return;

  try {
    if (req.method === "GET") {
      const accounts = await listAccounts();
      return sendJson(res, 200, { accounts });
    }

    if (req.method !== "POST" && req.method !== "PATCH") {
      res.setHeader("Allow", "GET, POST, PATCH");
      return sendJson(res, 405, { error: "Method not allowed." });
    }

    const body = readBody(req);
    if (!body) return sendJson(res, 400, { error: "Send a JSON username and password." });

    const username = normalizeUsername(body.username);
    const problem = accountError(username, body.password);
    if (problem) return sendJson(res, 400, { error: problem });

    if (req.method === "POST") {
      const created = await createAccount(username, body.password);
      if (created.reserved) return sendJson(res, 409, { error: "That username is reserved." });
      if (created.taken) return sendJson(res, 409, { error: "That username is already taken." });
      return sendJson(res, 201, {
        username: created.user.username,
        password: created.user.password,
        createdAt: created.user.createdAt,
      });
    }

    const updated = await setAccountPassword(username, body.password);
    if (updated && updated.reserved) return sendJson(res, 409, { error: "That username is reserved." });
    if (!updated) return sendJson(res, 404, { error: "That account was not found." });
    return sendJson(res, 200, updated);
  } catch (error) {
    console.error("admin accounts failed:", error && error.message);
    return sendJson(res, 500, { error: "Could not update accounts right now." });
  }
};
