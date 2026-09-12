import { config } from "dotenv";
config();
import { MongoMemoryReplSet } from "mongodb-memory-server";
import app from "./app.js";
import dbconnect from "./config/mongo.js";

process.env.JWT_SECRET = process.env.JWT_SECRET || "dev-super-secret-jwt-key-rochetta";
process.env.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";
process.env.JWT_COOKIE_EXPIRES = process.env.JWT_COOKIE_EXPIRES || 7;

const port = process.env.PORT || 4000;
const HOST = process.env.IP || "0.0.0.0";

(async () => {
  try {
    const mongod = await MongoMemoryReplSet.create({
      instance: { storageEngine: "wiredTiger" },
    });
    process.env.MONGO_URI = mongod.getUri();
    await dbconnect();
    app.listen(port, HOST, () =>
      console.log(`Server (local in-memory MongoDB) running on http://${HOST}:${port}`),
    );
  } catch (err) {
    console.error("Failed to start local dev server:", err.message);
    process.exit(1);
  }
})();
