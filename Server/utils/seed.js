import slugify from "slugify";
import { Category } from "../models/Category/category.model.js";
import { PRODUCT_CATEGORIES } from "./constants.js";

export const seedDefaultCategories = async () => {
  try {
    let created = 0;
    for (const name of PRODUCT_CATEGORIES) {
      const normalized = name.toLowerCase().trim();
      const existing = await Category.findOne({ name: normalized }).exec();

      if (!existing) {
        const slug = slugify(name, {
          lower: true,
          strict: true,
          trim: true,
        });

        await Category.create({
          name,
          description: `${name} - Over-the-counter health and wellness products.`,
          slug,
          image: null,
          is_active: true,
          is_deleted: false,
        });
        created++;
      }
    }
    if (created > 0) {
      console.log(`Seeded ${created} default categories`);
    } else {
      console.log("Default categories already present");
    }
  } catch (err) {
    console.error("Failed to seed default categories:", err.message);
  }
};
