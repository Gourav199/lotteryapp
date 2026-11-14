"use strict";

const { sendJson, requireConfig, readCookie } = require("../../lib/http");
const { readSession, findById, publicUser } = require("../../lib/accounts");

module.exports = async function me(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return sendJson(res, 405, { error: "Method not allowed." });
  }
  if (!requireConfig(res)) return;

  const session = readSession(readCookie(req));
  if (!session || !session.sub) return sendJson(res, 200, { signedIn: false });

  try {
    const user = await findById(session.sub);
    if (!user) return sendJson(res, 200, { signedIn: false });
    return sendJson(res, 200, publicUser(user));
  } catch (error) {
    console.error("session check failed:", error && error.message);
    return sendJson(res, 500, { error: "Could not check the session right now." });
  }
};
