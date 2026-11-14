"use strict";

const { sendJson, clearSessionCookie } = require("../../lib/http");

module.exports = async function logout(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return sendJson(res, 405, { error: "Method not allowed." });
  }
  clearSessionCookie(req, res);
  return sendJson(res, 200, { ok: true });
};
