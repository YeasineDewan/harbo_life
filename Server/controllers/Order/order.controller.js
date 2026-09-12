import {
  BadRequestError,
  NotFoundError,
  ConflictError,
  InternalServerError,
} from "../../utils/errors.js";
import { Cart } from "../../models/Cart/cart.model.js";
import { Order } from "../../models/Order/order.model.js";
import User from "../../models/User/user.model.js";
import Product from "../../models/Product/product.model.js";
import mongoose from "mongoose";
import {
  checkAndNotifyLowStock,
  createNotification,
} from "../../services/notification.service.js";
import { sendOrderConfirmationEmail } from "../../services/email.service.js";
import {
  authenticatePaymob,
  createPaymobOrder,
  generatePaymentKey,
  verifyPaymobHmac,
} from "../../services/paymob.service.js";

export const CreateOrderController = async (req, res, next) => {
  const session = await mongoose.startSession();

  try {
    const { items, address, paymentMethod = "COD" } = req.body;
    const userId = req.user._id;

    const productIds = items.map((item) => item.product);
    const uniqueProductIds = [
      ...new Set(productIds.map((id) => id.toString())),
    ];

    const products = await Product.find({
      _id: { $in: uniqueProductIds },
      is_deleted: false,
    });

    if (products.length !== uniqueProductIds.length) {
      throw new NotFoundError("One or more products not found");
    }

    const requiredQuantities = {};
    let total = 0;
    const orderItems = [];

    for (const item of items) {
      const product = products.find(
        (p) => p._id.toString() === item.product.toString(),
      );
      const unit = item.unit || "box";
      const qty = item.quantity;

      if (!requiredQuantities[product._id]) {
        requiredQuantities[product._id] = { boxes: 0, strips: 0 };
      }

      if (unit === "box") {
        requiredQuantities[product._id].boxes += qty;
      } else {
        requiredQuantities[product._id].strips += qty;
      }

      let itemPrice = product.price;
      if (unit === "strip") {
        itemPrice = Number(
          (product.price / (product.strips_per_box || 1)).toFixed(2),
        );
      }

      total += itemPrice * qty;
      orderItems.push({
        product: product._id,
        quantity: qty,
        unit: unit,
        price: itemPrice,
      });
    }

    session.startTransaction();

    const updatedProducts = [];
    for (const prodId in requiredQuantities) {
      const reqData = requiredQuantities[prodId];
      const productDoc = await Product.findById(prodId).session(session);

      if (productDoc.has_strips && productDoc.strips_per_box > 0) {
        const totalRequestedStrips =
          reqData.boxes * productDoc.strips_per_box + reqData.strips;
        const totalAvailableStrips =
          productDoc.stock * productDoc.strips_per_box + productDoc.strip_count;

        if (totalAvailableStrips < totalRequestedStrips) {
          throw new ConflictError(
            `Stock insufficient for product: ${productDoc.name}`,
          );
        }

        const newTotalStrips = totalAvailableStrips - totalRequestedStrips;
        productDoc.stock = Math.floor(
          newTotalStrips / productDoc.strips_per_box,
        );
        productDoc.strip_count = newTotalStrips % productDoc.strips_per_box;
      } else {
        if (productDoc.stock < reqData.boxes) {
          throw new ConflictError(
            `Stock insufficient for product: ${productDoc.name}`,
          );
        }
        productDoc.stock -= reqData.boxes;
      }

      await productDoc.save({ session });
      updatedProducts.push(productDoc);
    }

    const [newOrder] = await Order.create(
      [
        {
          user: userId,
          items: orderItems,
          total,
          address,
          status: "pending",
          paymentMethod,
          paymentStatus: "pending",
        },
      ],
      { session },
    );

    if (paymentMethod === "COD") {
      const cart = await Cart.findOne({
        user: userId,
        is_deleted: false,
      }).session(session);
      if (cart) {
        cart.items = [];
        cart.total_price = 0;
        await cart.save({ session });
      }
    }

    await session.commitTransaction();
    session.endSession();

    for (const prod of updatedProducts) {
      checkAndNotifyLowStock(prod).catch((err) =>
        console.error(
          "Low stock check error from order placement:",
          err.message,
        ),
      );
    }

    const user = await User.findById(userId);

    if (paymentMethod === "COD") {
      if (user && user.email) {
        const populatedOrder = await Order.findById(newOrder._id).populate(
          "items.product",
          "name price",
        );
        if (populatedOrder) {
          sendOrderConfirmationEmail(user.email, user.name, populatedOrder);
        }
      }

      return res.status(201).json({
        message: "Order created successfully",
        order: newOrder,
      });
    } else {
      try {
        if (!user) {
          throw new NotFoundError("User not found");
        }

        const authToken = await authenticatePaymob();

        const populatedItems = orderItems.map((item) => {
          const product = products.find(
            (p) => p._id.toString() === item.product.toString(),
          );
          const nameSuffix = item.unit === "strip" ? " (Strip)" : " (Box)";
          return {
            name: (product?.name || "Product") + nameSuffix,
            price: item.price,
            quantity: item.quantity,
          };
        });

        const totalCents = Math.round(total * 100);

        const paymobOrderId = await createPaymobOrder(
          authToken,
          totalCents,
          newOrder._id,
          populatedItems,
        );

        const names = user.name.split(" ");
        const billingData = {
          first_name: names[0] || "Guest",
          last_name: names.slice(1).join(" ") || "Customer",
          email: user.email || "no-email@rochetta.com",
          phone_number: address.phone || user.phone || "01000000000",
          street: address.street || "NA",
          building: "NA",
          apartment: "NA",
          floor: "NA",
          city: address.city || "NA",
          country: "EG",
          postal_code: address.postalCode || "NA",
        };

        const paymentKey = await generatePaymentKey(
          authToken,
          totalCents,
          paymobOrderId,
          billingData,
        );

        newOrder.paymobOrderId = paymobOrderId.toString();
        await newOrder.save();

        const checkoutUrl = `https://accept.paymob.com/api/acceptance/iframes/${process.env.PAYMOB_IFRAME_ID}?payment_token=${paymentKey}`;

        return res.status(201).json({
          message: "Order created successfully. Redirecting to payment...",
          order: newOrder,
          checkoutUrl,
        });
      } catch (paymobError) {
        console.error(
          "Paymob Error during order creation, rolling back order:",
          paymobError,
        );

        await Order.findByIdAndUpdate(newOrder._id, {
          status: "canceled",
          paymentStatus: "failed",
        });

        for (const prodId in requiredQuantities) {
          const reqData = requiredQuantities[prodId];
          const productDoc = await Product.findById(prodId);

          if (productDoc.has_strips && productDoc.strips_per_box > 0) {
            const totalRequestedStrips =
              reqData.boxes * productDoc.strips_per_box + reqData.strips;
            const currentTotalStrips =
              productDoc.stock * productDoc.strips_per_box +
              productDoc.strip_count;
            const revertedTotalStrips =
              currentTotalStrips + totalRequestedStrips;

            productDoc.stock = Math.floor(
              revertedTotalStrips / productDoc.strips_per_box,
            );
            productDoc.strip_count =
              revertedTotalStrips % productDoc.strips_per_box;
          } else {
            productDoc.stock += reqData.boxes;
          }
          await productDoc.save();
        }

        throw new BadRequestError(
          "Failed to initiate online payment: " + paymobError.message,
        );
      }
    }
  } catch (error) {
    if (session.inTransaction()) {
      await session.abortTransaction();
    }
    session.endSession();

    if (error.statusCode && error.statusCode !== 500) {
      return next(error);
    }
    return next(new InternalServerError("Order Failed: " + error.message));
  }
};

export const GetUserOrdersController = async (req, res, next) => {
  try {
    const userId = req.user._id;

    const orders = await Order.find({ user: userId, is_deleted: false })
      .populate("items.product", "name price stock stripsPerBox")
      .sort({ createdAt: -1 });

    res.status(200).json({
      message: "User orders fetched successfully",
      orders,
    });
  } catch (error) {
    next(error);
  }
};

// Cancel Order
export const CancelOrderController = async (req, res, next) => {
  const session = await mongoose.startSession();
  try {
    const { id } = req.params;
    const userId = req.user._id;

    session.startTransaction();

    const order = await Order.findOne({
      _id: id,
      user: userId,
      is_deleted: false,
    }).session(session);
    if (!order) throw new NotFoundError("Order not found");

    if (order.status === "canceled") {
      return res.status(400).json({ message: "Order already canceled" });
    }

    for (const it of order.items) {
      const prodId = it.product?._id ? it.product._id : it.product;
      if (!prodId) continue;

      await Product.findByIdAndUpdate(
        prodId,
        { $inc: { stock: it.quantity || 0 } },
        { session },
      );
    }

    order.status = "canceled";
    order.is_deleted = true;

    await order.save({ session, validateBeforeSave: false });

    await session.commitTransaction();
    session.endSession();

    await order.populate("items.product", "name price stock stripsPerBox");

    return res
      .status(200)
      .json({ message: "Order canceled and removed", order });
  } catch (error) {
    if (session.inTransaction()) {
      await session.abortTransaction();
    }
    session.endSession();
    next(error);
  }
};

// Get All Orders
export const GetAllOrdersAdminController = async (req, res, next) => {
  try {
    const { status, minTotal, maxTotal, startDate, endDate, search } =
      req.query;

    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const skip = (page - 1) * limit;

    let query = { is_deleted: false };

    if (status) {
      query.status = status;
    }

    if (minTotal || maxTotal) {
      query.total = {};
      if (minTotal) query.total.$gte = parseFloat(minTotal);
      if (maxTotal) query.total.$lte = parseFloat(maxTotal);
    }

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    if (search) {
      const searchOrConditions = [];

      if (mongoose.Types.ObjectId.isValid(search)) {
        searchOrConditions.push({ _id: search });
      }

      const matchedUsers = await User.find({
        $or: [
          { name: { $regex: search, $options: "i" } },
          { email: { $regex: search, $options: "i" } },
        ],
      }).select("_id");

      if (matchedUsers.length > 0) {
        searchOrConditions.push({
          user: { $in: matchedUsers.map((u) => u._id) },
        });
      }

      const matchedProducts = await Product.find({
        name: { $regex: search, $options: "i" },
      }).select("_id");

      if (matchedProducts.length > 0) {
        searchOrConditions.push({
          "items.product": { $in: matchedProducts.map((p) => p._id) },
        });
      }

      searchOrConditions.push(
        { "address.street": { $regex: search, $options: "i" } },
        { "address.city": { $regex: search, $options: "i" } },
      );

      query.$or = searchOrConditions;
    }

    const totalOrders = await Order.countDocuments(query);
    const orders = await Order.find(query)
      .populate("user", "name email")
      .populate("items.product", "name price stock stripsPerBox")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const totalPages = Math.ceil(totalOrders / limit);

    return res.status(200).json({
      message: "Orders fetched successfully by admin",
      data: {
        orders,
        pagination: {
          totalOrders,
          totalPages,
          currentPage: page,
          limit,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// Get Order by ID
export const GetOrderByIdAdminController = async (req, res, next) => {
  try {
    const { id } = req.params;

    const order = await Order.findOne({ _id: id, is_deleted: false })
      .populate("user", "name email")
      .populate("items.product", "name price stock stripsPerBox");

    if (!order) {
      throw new NotFoundError("Order not found");
    }

    return res.status(200).json({
      message: "Order fetched successfully by admin",
      order,
    });
  } catch (error) {
    next(error);
  }
};

// Update Order Status
export const UpdateOrderStatusController = async (req, res, next) => {
  const session = await mongoose.startSession();
  try {
    const { id } = req.params;
    const { status } = req.body;
    const userId = req.user._id;
    const userRole = req.user.role;

    session.startTransaction();

    const query = { _id: id, is_deleted: false };

    if (userRole !== "admin" && userRole !== "super_admin") {
      query.courier = userId;
    }

    const order = await Order.findOne(query).session(session);

    if (!order) {
      return res.status(404).json({
        message: "Order not found or you don't have permission to update it",
      });
    }

    if (order.status === "canceled") {
      return res
        .status(400)
        .json({ message: "Cannot update status of a canceled order" });
    }

    if (order.status === status) {
      return res
        .status(400)
        .json({ message: `Order status is already ${status}` });
    }

    if (status === "canceled") {
      for (const it of order.items) {
        const prodId = it.product?._id ? it.product._id : it.product;
        if (!prodId) continue;
        await Product.findByIdAndUpdate(
          prodId,
          { $inc: { stock: it.quantity || 0 } },
          { session },
        );
      }
      order.canceledAt = new Date();
    } else if (status === "shipped") {
      order.shippedAt = new Date();
    } else if (status === "delivered") {
      order.deliveredAt = new Date();
    }

    order.status = status;
    await order.save({ session, validateBeforeSave: false });

    await session.commitTransaction();
    session.endSession();

    await order.populate("user", "name phone email");
    await order.populate("items.product", "name image price");

    return res.status(200).json({
      message: "Order status updated successfully",
      data: order,
    });
  } catch (error) {
    if (session.inTransaction()) {
      await session.abortTransaction();
    }
    session.endSession();
    next(error);
  }
};

// Handle Paymob Webhook Callback
export const PaymobWebhookController = async (req, res, next) => {
  try {
    const { hmac } = req.query;
    const { obj } = req.body;

    if (!hmac || !obj) {
      throw new BadRequestError("Missing hmac or transaction object");
    }

    // const isValidHmac = verifyPaymobHmac(hmac, obj, process.env.PAYMOB_HMAC_SECRET);
    // if (!isValidHmac) {
    //   throw new BadRequestError("Invalid HMAC signature");
    // }

    const merchantOrderId = obj.order?.merchant_order_id;
    const paymobOrderId = obj.order?.id || obj.order;

    if (!merchantOrderId && !paymobOrderId) {
      throw new BadRequestError("Missing merchant_order_id and order ID");
    }

    // Try finding the order by internal ID or Paymob Order ID
    const queryConditions = [];
    if (mongoose.Types.ObjectId.isValid(merchantOrderId)) {
      queryConditions.push({ _id: merchantOrderId });
    }
    if (paymobOrderId) {
      queryConditions.push({ paymobOrderId: paymobOrderId.toString() });
    }

    const order = await Order.findOne({
      $or: queryConditions,
      is_deleted: false,
    });

    if (!order) {
      throw new NotFoundError("Order not found");
    }

    const success = obj.success === true || obj.success === "true";
    const pending = obj.pending === true || obj.pending === "true";

    if (success && !pending) {
      // Payment Successful
      if (order.paymentStatus !== "paid") {
        order.paymentStatus = "paid";
        order.status = "pending"; // Maintain status as pending fulfillment
        await order.save();

        // Clear user's cart
        const cart = await Cart.findOne({
          user: order.user,
          is_deleted: false,
        });
        if (cart) {
          cart.items = [];
          cart.total_price = 0;
          await cart.save();
        }

        // Send order confirmation email
        const user = await User.findById(order.user);
        if (user && user.email) {
          const populatedOrder = await Order.findById(order._id).populate(
            "items.product",
            "name price",
          );
          if (populatedOrder) {
            sendOrderConfirmationEmail(user.email, user.name, populatedOrder);
          }
        }

        // Create Admin Notification
        await createNotification({
          title: "New Online Payment Received 💳",
          message: `Payment of EGP ${order.total} successful for Order #${order._id}.`,
          type: "order",
          recipientRole: "admin",
          metadata: { orderId: order._id, total: order.total },
        });
      }
    } else if (!pending) {
      // Payment Failed (and not pending)
      if (order.paymentStatus !== "failed" && order.status !== "canceled") {
        order.paymentStatus = "failed";
        order.status = "canceled";
        order.canceledAt = new Date();
        await order.save();

        // Restore stocks
        for (const item of order.items) {
          const prodId = item.product?._id || item.product;
          if (prodId) {
            await Product.findByIdAndUpdate(prodId, {
              $inc: { stock: item.quantity || 0 },
            });
          }
        }

        // Notify user of payment failure
        await createNotification({
          title: "Payment Failed ❌",
          message: `We were unable to process your payment for Order #${order._id}. The order has been canceled.`,
          type: "order",
          recipient: order.user,
          metadata: { orderId: order._id },
        });
      }
    }

    return res.status(200).json({ message: "Webhook processed successfully" });
  } catch (error) {
    console.error("Paymob Webhook Error:", error.message);
    next(error);
  }
};
export const AssignOrderToCourierController = async (req, res, next) => {
  try {
    const { id: orderId } = req.params;
    const { courierId } = req.body;

    const order = await Order.findOne({ _id: orderId, is_deleted: false });

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    const courier = await User.findOne({
      _id: courierId,
      role: "courier",
      is_deleted: false,
    });

    if (!courier) {
      return res.status(404).json({ message: "Courier not found or invalid" });
    }

    order.courier = courierId;
    await order.save();

    return res.status(200).json({
      message: "Order assigned to courier successfully",
      data: order,
    });
  } catch (error) {
    next(error);
  }
};

export const GetCourierOrdersController = async (req, res, next) => {
  try {
    const courierId = req.user._id;
    const { status } = req.query;

    const query = { courier: courierId, is_deleted: false };

    if (status) {
      query.status = status;
    }

    const orders = await Order.find(query)
      .populate("user", "name phone email")
      .populate("items.product", "name image price")
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      message: "Courier orders fetched successfully",
      data: orders,
    });
  } catch (error) {
    next(error);
  }
};

export const DeleteOrderAdminController = async (req, res, next) => {
  const session = await mongoose.startSession();
  try {
    const { id } = req.params;

    session.startTransaction();

    const order = await Order.findById(id).session(session);

    if (!order || order.is_deleted) {
      return res
        .status(404)
        .json({ message: "Order not found or already deleted" });
    }

    if (order.status !== "canceled") {
      for (const it of order.items) {
        const prodId = it.product?._id ? it.product._id : it.product;
        if (!prodId) continue;
        await Product.findByIdAndUpdate(
          prodId,
          { $inc: { stock: it.quantity || 0 } },
          { session },
        );
      }
    }

    order.is_deleted = true;
    await order.save({ session, validateBeforeSave: false });

    await session.commitTransaction();
    session.endSession();

    return res.status(200).json({
      message: "Order deleted successfully and stock restored",
    });
  } catch (error) {
    if (session.inTransaction()) {
      await session.abortTransaction();
    }
    session.endSession();
    next(error);
  }
};
