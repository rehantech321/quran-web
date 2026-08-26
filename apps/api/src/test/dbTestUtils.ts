import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";

/**
 * Points-engine tests exercise MongoDB multi-document transactions, which
 * require a replica set — a standalone mongod rejects `startTransaction()`.
 * A single-member replica set is enough and starts in a couple of seconds.
 */
let replSet: MongoMemoryReplSet | undefined;

export async function connectTestDb() {
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(replSet.getUri());
}

export async function disconnectTestDb() {
  await mongoose.disconnect();
  await replSet?.stop();
  replSet = undefined;
}

export async function clearTestDb() {
  const collections = mongoose.connection.collections;
  await Promise.all(Object.values(collections).map((c) => c.deleteMany({})));
}
