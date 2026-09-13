/* global use, db */
// MongoDB Playground ── Seed default product categories for Harbolife
// These are the categories rendered by the sub-header (SubNavbar) at
// Web/src/components/SubNavBar/SubNavbar.jsx and linked via /category/:slug.
// Run this against your Atlas cluster (db: harbolife) to populate/verify.

use("harbolife");

const categories = [
  {
    name: "diabetes care",
    slug: "diabetes-care",
    description: "Diabetes Care - Over-the-counter health and wellness products.",
    image: null,
    is_active: true,
    is_deleted: false,
  },
  {
    name: "first aid",
    slug: "first-aid",
    description: "First Aid - Over-the-counter health and wellness products.",
    image: null,
    is_active: true,
    is_deleted: false,
  },
  {
    name: "pain relief",
    slug: "pain-relief",
    description: "Pain Relief - Over-the-counter health and wellness products.",
    image: null,
    is_active: true,
    is_deleted: false,
  },
  {
    name: "cold and flu",
    slug: "cold-and-flu",
    description: "Cold and Flu - Over-the-counter health and wellness products.",
    image: null,
    is_active: true,
    is_deleted: false,
  },
];

// Idempotent: only insert categories that don't already exist (matched by slug).
const existingSlugs = db.categories
  .find(
    { slug: { $in: categories.map((c) => c.slug) } },
    { projection: { _id: 0, slug: 1 } }
  )
  .map((c) => c.slug);

const toInsert = categories.filter((c) => !existingSlugs.includes(c.slug));

if (toInsert.length > 0) {
  const result = db.categories.insertMany(toInsert, { ordered: false });
  console.log(`Inserted ${result.insertedCount} new categories`);
} else {
  console.log("All default categories already exist");
}

// Verify the sub-header's data source.
db.categories
  .find(
    { is_active: true, is_deleted: false },
    { projection: { _id: 0, name: 1, slug: 1, is_active: 1, is_deleted: 1 } }
  )
  .sort({ createdAt: -1 });
