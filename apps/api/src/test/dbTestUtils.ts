import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";

/**
 * Points-engine tests exercise MongoDB multi-document transactions, which
 * require a replica set — a standalone mongod rejects `startTransaction()`.
 * A single-member replica set is enough and starts in a couple of seconds.
 */
let replSet: MongoMemoryReplSet | undefined;

export async function connectTestDb() {
  // Mongoose queues ("buffers") operations issued before the connection is
  // fully ready and fails them if it isn't ready within `bufferTimeoutMS`
  // (default 10s) — comfortably enough in isolation, but as this test suite
  // has grown (more files, each spinning up and tearing down its own
  // in-memory replica set in sequence), occasional real-world hiccups on a
  // loaded machine (this was traced live to a genuine
  // `MongooseError: Connection operation buffering timed out after 10000ms`,
  // not a logic bug — every test that ever hit it passed cleanly alone)
  // started tripping that timeout near the tail of a long full-suite run.
  // Each test already gets up to `testTimeout` (30s) to finish regardless,
  // so widening this specific internal timeout just lets a momentarily-slow
  // connection catch up instead of failing a test that was never actually
  // wrong.
  mongoose.set("bufferTimeoutMS", 30_000);
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
