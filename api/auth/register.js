"use strict";

const { sendJson } = require("../../lib/http");

module.exports = async function register(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return sendJson(res, 405, { error: "Method not allowed." });
  }
  return sendJson(res, 403, { error: "An administrator creates each account." });
};
