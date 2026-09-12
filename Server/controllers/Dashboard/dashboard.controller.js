import { Order } from "../../models/Order/order.model.js";
import Product from "../../models/Product/product.model.js";
import User from "../../models/User/user.model.js";
import {
  performLinearRegression,
  performKMeans,
  performApriori
} from "../../services/ai.service.js";
import { InternalServerError } from "../../utils/errors.js";

/**
 * Fetches basic summary analytics.
 */
export const GetDashboardStatsController = async (req, res, next) => {
  try {
    // Total Revenue & Orders 
    const orderStats = await Order.aggregate([
      { $match: { is_deleted: false, status: { $ne: "canceled" } } },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: "$total" },
          count: { $sum: 1 }
        }
      }
    ]);

    const totalRevenue = orderStats[0]?.totalRevenue || 0;
    const totalOrders = orderStats[0]?.count || 0;

    // Count of Products
    const totalProducts = await Product.countDocuments({ is_deleted: false });

    // Count of Users
    const totalUsers = await User.countDocuments({ is_deleted: false });

    // Low stock products (stock < 10)
    const lowStockCount = await Product.countDocuments({ is_deleted: false, stock: { $lt: 10 } });

    // Pending orders
    const pendingOrdersCount = await Order.countDocuments({ is_deleted: false, status: "pending" });

    res.status(200).json({
      message: "Dashboard summary stats fetched successfully",
      stats: {
        totalRevenue: parseFloat(totalRevenue.toFixed(2)),
        totalOrders,
        totalProducts,
        totalUsers,
        lowStockCount,
        pendingOrdersCount
      }
    });
  } catch (error) {
    next(new InternalServerError("Failed to fetch dashboard stats: " + error.message));
  }
};

/**
 * Returns 30 days historical revenue and projects the next 7 days using Linear Regression.
 */
export const GetRevenueForecastController = async (req, res, next) => {
  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);

    // Aggregate daily revenue
    const dailyStats = await Order.aggregate([
      {
        $match: {
          is_deleted: false,
          status: { $ne: "canceled" },
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          revenue: { $sum: "$total" },
          ordersCount: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Create a contiguous series of the last 30 days
    const statsMap = new Map(dailyStats.map(item => [item._id, item]));
    const historical = [];
    const points = [];

    for (let i = 29; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split("T")[0];
      const stat = statsMap.get(dateStr) || { revenue: 0, ordersCount: 0 };

      historical.push({
        date: dateStr,
        revenue: parseFloat(stat.revenue.toFixed(2)),
        ordersCount: stat.ordersCount
      });

      points.push({
        x: 29 - i,
        y: stat.revenue,
        dateStr
      });
    }

    // Run Linear Regression & get 7-day forecast
    const regressionResult = performLinearRegression(points, 7);

    res.status(200).json({
      message: "Revenue forecast generated successfully",
      historical,
      forecast: regressionResult.forecast,
      trend: {
        slope: regressionResult.slope,
        intercept: regressionResult.intercept,
        correlation: regressionResult.correlation,
        trendType: regressionResult.trendType
      }
    });
  } catch (error) {
    next(new InternalServerError("Failed to generate revenue forecast: " + error.message));
  }
};

/**
 * Runs K-Means Clustering on RFM features to segment customers.
 */
export const GetCustomerSegmentsController = async (req, res, next) => {
  try {
    // Gather RFM data per user
    const userStats = await Order.aggregate([
      { $match: { is_deleted: false, status: { $ne: "canceled" } } },
      {
        $group: {
          _id: "$user",
          totalSpend: { $sum: "$total" },
          orderCount: { $sum: 1 },
          lastOrderDate: { $max: "$createdAt" }
        }
      }
    ]);

    if (userStats.length < 3) {
      return res.status(200).json({
        message: "Insufficient customer data to run clustering (minimum 3 active customers required)",
        clusters: [],
        userAssignments: []
      });
    }

    const now = new Date();
    const data = userStats.map(u => {
      const recencyMs = now - new Date(u.lastOrderDate);
      const recencyDays = Math.max(0, Math.floor(recencyMs / (1000 * 60 * 60 * 24)));
      return {
        id: u._id.toString(),
        features: [
          recencyDays, // Recency
          u.orderCount, // Frequency
          u.totalSpend  // Monetary
        ]
      };
    });

    // Perform K-Means (K = 3)
    const { clusters, userAssignments } = performKMeans(data, 3);

    // Populate user names and emails for presentation
    const userIds = userAssignments.map(ua => ua.userId);
    const users = await User.find({ _id: { $in: userIds } }, "name email");
    const userMap = new Map(users.map(u => [u._id.toString(), u]));

    const populatedAssignments = userAssignments.map(ua => ({
      ...ua,
      user: userMap.get(ua.userId) || { name: "Unknown User", email: "Unknown Email" }
    }));

    res.status(200).json({
      message: "Customer segmentation completed successfully",
      clusters,
      userAssignments: populatedAssignments
    });
  } catch (error) {
    next(new InternalServerError("Failed to segment customers: " + error.message));
  }
};

/**
 * Runs Apriori association rule mining to discover frequently bought together products.
 */
export const GetProductBundlesController = async (req, res, next) => {
  try {
    // Fetch all non-canceled orders to extract baskets
    const orders = await Order.find({ is_deleted: false, status: { $ne: "canceled" } })
      .select("items.product");

    const baskets = orders.map(order =>
      order.items.map(item => item.product.toString())
    );

    // Run Apriori: minSupport = 1% (or at least 1 order), minConfidence = 10%
    const rules = performApriori(baskets, 0.01, 0.1);

    if (rules.length === 0) {
      return res.status(200).json({
        message: "No strong product association rules found.",
        rules: []
      });
    }

    // Populate product details for antecedent and consequent
    const productIds = Array.from(
      new Set(rules.flatMap(r => [r.antecedent, r.consequent]))
    );
    const products = await Product.find({ _id: { $in: productIds } }, "name price image category");
    const productMap = new Map(products.map(p => [p._id.toString(), p]));

    const populatedRules = rules.map(r => ({
      ...r,
      antecedentProduct: productMap.get(r.antecedent),
      consequentProduct: productMap.get(r.consequent)
    })).filter(r => r.antecedentProduct && r.consequentProduct);

    res.status(200).json({
      message: "Product bundles/association rules mined successfully",
      rules: populatedRules.slice(0, 15) // Return top 15 rules
    });
  } catch (error) {
    next(new InternalServerError("Failed to mine product bundles: " + error.message));
  }
};

/**
 * Evaluates sales velocity and predicts runout time (days remaining).
 */
export const GetInventoryVelocityController = async (req, res, next) => {
  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);

    // Aggregate units sold per product in last 30 days
    const salesAggregation = await Order.aggregate([
      {
        $match: {
          is_deleted: false,
          status: { $ne: "canceled" },
          createdAt: { $gte: startDate }
        }
      },
      { $unwind: "$items" },
      {
        $group: {
          _id: "$items.product",
          unitsSold: { $sum: "$items.quantity" }
        }
      }
    ]);

    const salesMap = new Map(
      salesAggregation.map(s => [s._id.toString(), s.unitsSold])
    );

    // Get all active products
    const products = await Product.find({ is_deleted: false, is_active: true }, "name stock price image");

    const analysis = products.map(prod => {
      const unitsSold = salesMap.get(prod._id.toString()) || 0;
      const dailyVelocity = parseFloat((unitsSold / 30).toFixed(4));

      let daysRemaining = Infinity;
      let status = "Healthy";

      if (dailyVelocity > 0) {
        daysRemaining = parseFloat((prod.stock / dailyVelocity).toFixed(1));
        if (daysRemaining <= 7) {
          status = "Immediate Reorder";
        } else if (daysRemaining <= 15) {
          status = "Warning";
        }
      } else if (prod.stock === 0) {
        daysRemaining = 0;
        status = "Out of Stock";
      }

      return {
        productId: prod._id,
        name: prod.name,
        stock: prod.stock,
        price: prod.price,
        image: prod.image,
        unitsSoldLast30Days: unitsSold,
        dailyVelocity,
        daysRemaining,
        status
      };
    });

    // Sort by urgency: out of stock, then lower days remaining, then higher stock
    analysis.sort((a, b) => {
      if (a.status === "Out of Stock" && b.status !== "Out of Stock") return -1;
      if (b.status === "Out of Stock" && a.status !== "Out of Stock") return 1;
      return a.daysRemaining - b.daysRemaining;
    });

    res.status(200).json({
      message: "Inventory velocity analysis completed successfully",
      products: analysis
    });
  } catch (error) {
    next(new InternalServerError("Failed to analyze inventory velocity: " + error.message));
  }
};
