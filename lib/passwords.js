"use strict";

const crypto = require("crypto");

function key() {
  return crypto.createHash("sha256").update(process.env.JWT_SECRET).digest();
}

function encryptPassword(password) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([cipher.update(String(password), "utf8"), cipher.final()]);
  return {
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
    data: data.toString("base64"),
  };
}

function decryptPassword(encrypted) {
  if (!encrypted || !encrypted.iv || !encrypted.tag || !encrypted.data) return "";
  try {
    const decipher = crypto.createDecipheriv("aes-256-gcm", key(), Buffer.from(encrypted.iv, "base64"));
    decipher.setAuthTag(Buffer.from(encrypted.tag, "base64"));
    return Buffer.concat([
      decipher.update(Buffer.from(encrypted.data, "base64")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    return "";
  }
}

module.exports = { encryptPassword, decryptPassword };
