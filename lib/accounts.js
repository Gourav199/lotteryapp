"use strict";

const { ObjectId } = require("mongodb");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { getUsersCollection } = require("./db");
const { encryptPassword, decryptPassword } = require("./passwords");

const USERNAME = /^[a-z0-9_]{3,32}$/;
let dummyHash;

function normalizeUsername(value) {
  return String(value || "").trim().toLowerCase();
}

function accountError(username, password) {
  if (!USERNAME.test(username)) {
    return "Use 3–32 letters, numbers, or underscores.";
  }
  if (typeof password !== "string" || password.length < 8 || password.length > 72) {
    return "Password must be 8–72 characters.";
  }
  return "";
}

function publicUser(user) {
  return {
    signedIn: true,
    username: user.username,
    role: user.role === "admin" ? "admin" : "user",
  };
}

async function seedAdminFromEnv() {
  const username = normalizeUsername(process.env.ADMIN_USERNAME || "");
  const password = process.env.ADMIN_PASSWORD || "";
  const users = await getUsersCollection();
  const existingAdmin = await users.findOne({ role: "admin" });
  if (existingAdmin) return existingAdmin;
  if (!username || typeof password !== "string" || !password) return null;

  const fields = {
    role: "admin",
    passwordHash: await bcrypt.hash(password, 10),
    passwordEnc: encryptPassword(password),
  };
  const existing = await users.findOne({ username });
  if (existing) {
    await users.updateOne({ _id: existing._id }, { $set: fields });
    return { _id: existing._id, username, role: "admin" };
  }
  try {
    const result = await users.insertOne({ username, ...fields, createdAt: new Date() });
    return { _id: result.insertedId, username, role: "admin" };
  } catch (error) {
    if (!error || error.code !== 11000) throw error;
    const winner = await users.findOne({ username });
    if (!winner) throw error;
    if (winner.role !== "admin") {
      await users.updateOne({ _id: winner._id }, { $set: fields });
    }
    return { _id: winner._id, username, role: "admin" };
  }
}

function signSession(user) {
  return jwt.sign(
    {
      sub: String(user._id),
      username: user.username,
      role: user.role === "admin" ? "admin" : "user",
    },
    process.env.JWT_SECRET,
    { expiresIn: "7d", algorithm: "HS256" }
  );
}

function readSession(token) {
  if (!token) return null;
  try {
    return jwt.verify(token, process.env.JWT_SECRET, { algorithms: ["HS256"] });
  } catch {
    return null;
  }
}

async function verifyPassword(password, passwordHash) {
  if (!passwordHash) {
    if (!dummyHash) dummyHash = await bcrypt.hash("timing-placeholder", 10);
    await bcrypt.compare(password, dummyHash);
    return false;
  }
  return bcrypt.compare(password, passwordHash);
}

async function findByUsername(username) {
  const users = await getUsersCollection();
  return users.findOne({ username });
}

async function findById(id) {
  if (!ObjectId.isValid(id)) return null;
  const users = await getUsersCollection();
  return users.findOne(
    { _id: new ObjectId(id) },
    { projection: { passwordHash: 0, passwordEnc: 0 } }
  );
}

function accountView(user) {
  return {
    username: user.username,
    password: decryptPassword(user.passwordEnc),
    createdAt: user.createdAt,
  };
}

async function createAccount(username, password) {
  const users = await getUsersCollection();
  const admin = await users.findOne({ username, role: "admin" }, { projection: { _id: 1 } });
  if (admin) return { reserved: true };
  const record = {
    username,
    role: "user",
    passwordHash: await bcrypt.hash(password, 10),
    passwordEnc: encryptPassword(password),
    createdAt: new Date(),
  };
  try {
    const result = await users.insertOne(record);
    return { user: { _id: result.insertedId, username, role: "user", createdAt: record.createdAt, password } };
  } catch (error) {
    if (error && error.code === 11000) return { taken: true };
    throw error;
  }
}

async function listAccounts() {
  const users = await getUsersCollection();
  const docs = await users.find({ role: { $ne: "admin" } }).sort({ createdAt: -1 }).toArray();
  return docs.map(accountView);
}

async function setAccountPassword(username, password) {
  const users = await getUsersCollection();
  const existing = await users.findOne({ username });
  if (!existing) return null;
  if (existing.role === "admin") return { reserved: true };
  const passwordEnc = encryptPassword(password);
  await users.updateOne(
    { _id: existing._id },
    { $set: { passwordHash: await bcrypt.hash(password, 10), passwordEnc } }
  );
  return accountView({ ...existing, passwordEnc });
}

async function setAdminPassword(adminId, password) {
  if (!ObjectId.isValid(adminId)) return null;
  const users = await getUsersCollection();
  const existing = await users.findOne({ _id: new ObjectId(adminId), role: "admin" });
  if (!existing) return null;
  await users.updateOne(
    { _id: existing._id },
    {
      $set: {
        passwordHash: await bcrypt.hash(password, 10),
        passwordEnc: encryptPassword(password),
      },
    }
  );
  return { username: existing.username };
}

module.exports = {
  normalizeUsername,
  accountError,
  publicUser,
  signSession,
  readSession,
  verifyPassword,
  findByUsername,
  findById,
  seedAdminFromEnv,
  createAccount,
  listAccounts,
  setAccountPassword,
  setAdminPassword,
};
