import Product from "../models/Product/product.model.js";
import { Order } from "../models/Order/order.model.js";
import { Cart } from "../models/Cart/cart.model.js";
import { getEmbedding, cosineSimilarity } from "../services/embedding.service.js";


export const getDbContext = async (userId, userMessage) => {
    let dbContext = "";
    const messageLower = userMessage.toLowerCase();

    const cartKeywords = ["cart", "basket", "my items", "العربة", "سلة", "سلي", "مشترياتي"];

    if (cartKeywords.some(keyword => messageLower.includes(keyword))) {
        try {
            const cart = await Cart.findOne({ user: userId, is_deleted: false }).populate("items.product");

            if (cart && cart.items && cart.items.length > 0) {
                dbContext += `\n[User's Cart Items]:\n`;

                cart.items.forEach((item, index) => {
                    if (item.product) {
                        dbContext += `${index + 1}. Product: ${item.product.name}, Quantity: ${item.quantity}, Price: ${item.price} EGP per ${item.unit || 'box'}\n`;
                    }
                });

                dbContext += `Total Cart Price: ${cart.total_price} EGP\n`;
            } else {
                dbContext += `\n[User's Cart]: The user's cart is currently empty.\n`;
            }
        } catch (err) {
            console.error("Error fetching cart context for chatbot:", err);
        }
    }

    const orderKeywords = ["order", "delivery", "shipped", "delivered", "track", "الطلب", "الطلبات", "طلب", "شحن"];

    if (orderKeywords.some(keyword => messageLower.includes(keyword))) {
        try {
            const orders = await Order.find({ user: userId, is_deleted: false })
                .sort({ createdAt: -1 })
                .limit(3)
                .populate("items.product");
            if (orders && orders.length > 0) {
                dbContext += `\n[User's Recent Orders]:\n`;
                orders.forEach((order, index) => {
                    dbContext += `Order #${index + 1} (ID: ${order._id}):\n`;
                    dbContext += `  Status: ${order.status}\n`;
                    dbContext += `  Total: ${order.total} EGP\n`;
                    dbContext += `  Address: ${order.address.street}, ${order.address.city}\n`;
                    dbContext += `  Date: ${order.createdAt.toDateString()}\n`;
                    dbContext += `  Items:\n`;
                    order.items.forEach(item => {
                        if (item.product) {
                            dbContext += `    - ${item.product.name} (Qty: ${item.quantity}, Price: ${item.price} EGP)\n`;
                        }
                    });
                });
            } else {
                dbContext += `\n[User's Orders]: The user has no orders yet.\n`;
            }
        } catch (err) {
            console.error("Error fetching orders context for chatbot:", err);
        }
    }

    const productKeywords = ["have", "buy", "price", "find", "search", "medicine", "drug", "pill", "tab", "cure", "treatment", "pain", "cold", "flu", "cough", "fever", "diabet", "stomach", "headache", "tooth", "throat", "allergy", "sick", "ill", "cream", "gel", "capsule", "syrup", "دواء", "علاج", "سعر", "عندكم", "ابحث", "مسكن", "مضاد", "مرض", "مرضى", "سكر", "ضغط", "صداع", "الم", "مغص", "برد", "احتقان", "حساسية", "كحة", "سخونة", "حرارة"];
    const seemsLikeProductQuery = productKeywords.some(keyword => messageLower.includes(keyword)) || userMessage.split(/\s+/).length < 5;

    if (seemsLikeProductQuery) {
        try {
            let products = [];
            let embedding = null;

            // try to generate query embedding
            try {
                embedding = await getEmbedding(userMessage);
            } catch (embedErr) {
                console.warn("Could not generate query embedding (API key might be missing), falling back to keyword search:", embedErr.message);
            }

            if (embedding) {
                // MongoDB Atlas Vector Search
                try {
                    products = await Product.aggregate([
                        {
                            $vectorSearch: {
                                index: "vector_index",
                                path: "embeddings",
                                queryVector: embedding,
                                numCandidates: 100,
                                limit: 5
                            }
                        },
                        {
                            $match: {
                                is_active: true,
                                is_deleted: false
                            }
                        }
                    ]);

                    // Populate category after aggregation
                    if (products.length > 0) {
                        products = await Product.populate(products, { path: "category" });
                    }
                    console.log(`Atlas Vector Search found ${products.length} products.`);
                } catch (vectorSearchErr) {
                    console.log("Atlas Vector Search failed or index not set up. Falling back to local in-memory cosine similarity search:", vectorSearchErr.message);
                    products = []; // clear in case of partial aggregation errors
                }

                // Local In-Memory Cosine Similarity (fallback if Atlas Vector Search failed/not configured)
                if (products.length === 0) {
                    const allProducts = await Product.find({
                        is_active: true,
                        is_deleted: false,
                        embeddings: { $exists: true, $not: { $size: 0 } }
                    }).populate("category");

                    if (allProducts.length > 0) {
                        const scoredProducts = allProducts.map(prod => {
                            const similarity = cosineSimilarity(embedding, prod.embeddings);
                            return { product: prod, similarity };
                        });

                        // Sort by similarity descending
                        scoredProducts.sort((a, b) => b.similarity - a.similarity);

                        // Select top 5 products with a baseline similarity threshold
                        products = scoredProducts
                            .filter(item => item.similarity > 0.3)
                            .slice(0, 5)
                            .map(item => item.product);

                        console.log(`Local Cosine Similarity Search found ${products.length} products.`);
                    }
                }
            }

            // Keyword / Regex Fallback (if embeddings are not configured or no matches were found)
            if (products.length === 0) {
                console.log("No vector matches found. Performing keyword search fallback.");
                const cleanWords = userMessage
                    .replace(/[^\w\s\u0600-\u06FF]/g, '')
                    .split(/\s+/)
                    .filter(w => w.length > 2);

                if (cleanWords.length > 0) {
                    const queryConditions = cleanWords.map(word => ({
                        $or: [
                            { name: { $regex: word, $options: "i" } },
                            { description: { $regex: word, $options: "i" } }
                        ]
                    }));

                    products = await Product.find({
                        $or: queryConditions,
                        is_active: true,
                        is_deleted: false
                    })
                        .limit(5)
                        .populate("category");
                }
            }

            // If absolutely no products found, default to top-selling and high-rating
            if (products.length === 0) {
                products = await Product.find({ is_active: true, is_deleted: false })
                    .sort({ top_selling: -1, rating: -1 })
                    .limit(5)
                    .populate("category");
            }

            if (products && products.length > 0) {
                dbContext += `\n[Available Pharmacy Products / Search Results]:\n`;
                products.forEach((prod, index) => {
                    dbContext += `${index + 1}. Name: ${prod.name}\n`;
                    dbContext += `   Category: ${prod.category ? prod.category.name : 'General'}\n`;
                    dbContext += `   Price: ${prod.price} EGP\n`;
                    dbContext += `   Description: ${prod.description}\n`;
                    dbContext += `   Stock Status: ${prod.stock > 0 ? `In Stock (${prod.stock})` : 'Out of Stock'}\n`;
                    dbContext += `   Requires Prescription: ${prod.requires_prescription ? 'Yes' : 'No'}\n`;
                });
            }
        } catch (err) {
            console.error("Error searching product context for chatbot:", err);
        }
    }

    return dbContext;
};
