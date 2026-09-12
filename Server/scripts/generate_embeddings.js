import mongoose from "mongoose";
import dotenv from "dotenv";
import dbconnect from "../config/mongo.js";
import Product from "../models/Product/product.model.js";
import { Category } from "../models/Category/category.model.js";
import { getEmbedding } from "../services/embedding.service.js";

dotenv.config();

const runMigration = async () => {
  try {
    console.log("Connecting to database...");
    await dbconnect();
    console.log("Database connected successfully.");

    const forceOverwrite = process.argv.includes("--force");
    const query = { is_deleted: false };
    
    if (!forceOverwrite) {
      // Find products without embeddings
      query.$or = [
        { embeddings: { $exists: false } },
        { embeddings: { $size: 0 } }
      ];
    }

    const products = await Product.find(query).populate("category");
    console.log(`Found ${products.length} products to process.`);

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < products.length; i++) {
      const prod = products[i];
      const categoryName = prod.category ? prod.category.name : "General";
      const textToEmbed = `Product: ${prod.name}. Category: ${categoryName}. Description: ${prod.description}`;
      
      console.log(`[${i + 1}/${products.length}] Generating embedding for "${prod.name}"...`);
      
      try {
        const embedding = await getEmbedding(textToEmbed);
        prod.embeddings = embedding;
        await prod.save();
        successCount++;
      } catch (err) {
        console.error(`Failed to generate embedding for "${prod.name}":`, err.message);
        failCount++;
      }

      // Add a small delay (500ms) to respect free-tier API rate limits (e.g. 15 RPM for Gemini)
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    console.log(`Migration completed! Success: ${successCount}, Failed: ${failCount}`);
  } catch (error) {
    console.error("Migration failed:", error);
  } finally {
    console.log("Closing database connection...");
    await mongoose.connection.close();
    console.log("Database connection closed.");
    process.exit(0);
  }
};

runMigration();
