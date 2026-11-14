"use strict";

const { MongoClient } = require("mongodb");

function getClient() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    const error = new Error("MONGODB_URI is not set");
    error.code = "CONFIG";
    throw error;
  }

  if (!global._lotteryMongo) {
    const client = new MongoClient(uri);
    global._lotteryMongo = client.connect().catch((error) => {
      global._lotteryMongo = null;
      throw error;
    });
  }

  return global._lotteryMongo;
}

async function getUsersCollection() {
  const client = await getClient();
  const users = client.db(process.env.MONGODB_DB || "lottery").collection("users");

  if (!global._lotteryUsersIndexed) {
    global._lotteryUsersIndexed = users.createIndex({ username: 1 }, { unique: true });
  }
  await global._lotteryUsersIndexed;
  return users;
}

module.exports = { getUsersCollection };
