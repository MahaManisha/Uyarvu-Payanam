const mongoose = require("mongoose");

let isConnecting = false;

const connectDB = async () => {
  const primaryUri = process.env.MONGO_URI || process.env.MONGODB_URI;
  const localFallbackUri = "mongodb://127.0.0.1:27017/uyarvu_payanam";

  // Listen to connection errors and disconnects to prevent unhandled ECONNRESET drops
  if (mongoose.connection.listeners("error").length === 0) {
    mongoose.connection.on("error", (err) => {
      console.warn(`⚠️ Mongoose connection warning: ${err.message}`);
    });

    mongoose.connection.on("disconnected", async () => {
      console.warn("⚠️ Mongoose disconnected from primary database. Attempting reconnect...");
      if (!isConnecting) {
        isConnecting = true;
        try {
          await mongoose.connect(localFallbackUri, { serverSelectionTimeoutMS: 5000 });
          console.log(`MongoDB Reconnected (Local Fallback): ${localFallbackUri}`);
        } catch (e) {
          console.error("Reconnection attempt failed:", e.message);
        } finally {
          isConnecting = false;
        }
      }
    });
  }

  if (primaryUri) {
    try {
      console.log("Connecting to MongoDB...");
      await mongoose.connect(primaryUri, {
        serverSelectionTimeoutMS: 30000,
        socketTimeoutMS: 45000
      });
      console.log(`MongoDB Connected (Primary): ${primaryUri.split("@")[1] || primaryUri}`);
      return;
    } catch (error) {
      console.warn(`⚠️ Primary MongoDB connection failed (${error.message}). Trying local MongoDB fallback...`);
    }
  }

  try {
    await mongoose.connect(localFallbackUri, { serverSelectionTimeoutMS: 5000 });
    console.log(`MongoDB Connected (Local Fallback): ${localFallbackUri}`);
  } catch (error) {
    console.error("❌ Both Primary and Local MongoDB connections failed:", error);
    process.exit(1);
  }
};

module.exports = connectDB;