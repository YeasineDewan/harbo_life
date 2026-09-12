import mongoose from "mongoose";
import { Cart } from "../../models/Cart/cart.model.js";
import Product from "../../models/Product/product.model.js";
import { BadRequestError } from "../../utils/errors.js";

// Get Cart
export const GetUserCartController = async (req, res, next) => {
  try {
    const user = req.user;
    let cart = await Cart.findOne({
      user: user._id,
      is_deleted: false,
    }).populate("items.product");

    if (!cart) {
      try {
        cart = new Cart({ user: user._id, items: [], total_price: 0 });
        await cart.save();
        await cart.populate("items.product");
        return res
          .status(201)
          .json({ message: "Cart created successfully", data: cart });
      } catch (error) {
        // Handle concurrent creation race condition
        if (error.code === 11000) {
          cart = await Cart.findOne({
            user: user._id,
            is_deleted: false,
          }).populate("items.product");
        } else {
          throw error;
        }
      }
    }

    return res
      .status(200)
      .json({ message: "Cart found successfully", data: cart });
  } catch (error) {
    next(error);
  }
};

export const AddToCartController = async (req, res, next) => {
  const session = await mongoose.startSession();
  try {
    const userId = req.user._id;
    const { productId, quantity, unit = "box" } = req.body;
    const qty = quantity || 1;

    if (!["box", "strip"].includes(unit)) {
      throw new BadRequestError("Invalid unit. Must be 'box' or 'strip'.");
    }

    session.startTransaction();

    const product = await Product.findOne({
      _id: productId,
      is_deleted: false,
    }).session(session);
    if (!product) throw new BadRequestError("Product not found");

    let itemPrice = product.price;
    if (unit === "strip") {
      if (!product.has_strips || product.strips_per_box <= 0) {
        throw new BadRequestError("This product is not sold by strips");
      }
      itemPrice = Number((product.price / product.strips_per_box).toFixed(2));
    }

    if (unit === "box" && product.stock < qty) {
      throw new BadRequestError("Not enough stock available (Boxes)");
    } else if (unit === "strip") {
      const totalStrips =
        product.strip_count + product.stock * product.strips_per_box;
      if (totalStrips < qty)
        throw new BadRequestError("Not enough stock available (Strips)");
    }

    let userCart = await Cart.findOne({
      user: userId,
      is_deleted: false,
    }).session(session);

    if (!userCart) {
      userCart = new Cart({
        user: userId,
        items: [{ product: productId, quantity: qty, unit, price: itemPrice }],
      });
    } else {
      const existingItem = userCart.items.find(
        (it) => it.product.toString() === productId && it.unit === unit,
      );

      if (existingItem) {
        existingItem.quantity += qty;
      } else {
        userCart.items.push({
          product: productId,
          quantity: qty,
          unit,
          price: itemPrice,
        });
      }
    }

    userCart.total_price = userCart.items.reduce(
      (total, item) => total + item.price * item.quantity,
      0,
    );

    await userCart.save({ session });
    await session.commitTransaction();
    session.endSession();

    await userCart.populate("items.product");

    return res
      .status(201)
      .json({ message: "Added to cart successfully", data: userCart });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    next(error);
  }
};

export const RemoveFromCartController = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { productId } = req.params;
    const { unit = "box" } = req.body; 

    const cart = await Cart.findOne({ user: userId, is_deleted: false });
    if (!cart) throw new BadRequestError("Cart not found");

    const idx = cart.items.findIndex(
      (it) => it.product.toString() === productId && it.unit === unit,
    );
    if (idx === -1) throw new BadRequestError("Product not found in cart");

    cart.items.splice(idx, 1);
    cart.total_price = cart.items.reduce(
      (total, item) => total + item.price * item.quantity,
      0,
    );

    await cart.save();
    await cart.populate("items.product");

    return res.status(200).json({ message: "Product removed", data: cart });
  } catch (error) {
    next(error);
  }
};

export const ClearCartController = async (req, res, next) => {
  try {
    const userId = req.user._id;

    const cart = await Cart.findOne({ user: userId, is_deleted: false });
    if (!cart) throw new BadRequestError("Cart not found");

    cart.items = [];
    cart.total_price = 0;

    await cart.save();
    return res.status(200).json({ message: "Cart cleared", data: cart });
  } catch (error) {
    next(error);
  }
};

export const UpdateCartQuantityController = async (req, res, next) => {
  const session = await mongoose.startSession();
  try {
    const userId = req.user._id;
    const { productId } = req.params;
    const { quantity, unit = "box" } = req.body;

    if (!quantity || quantity < 1)
      throw new BadRequestError("Quantity must be at least 1");

    session.startTransaction();

    const cart = await Cart.findOne({
      user: userId,
      is_deleted: false,
    }).session(session);
    if (!cart) throw new BadRequestError("Cart not found");

    const existingItem = cart.items.find(
      (it) => it.product.toString() === productId && it.unit === unit,
    );
    if (!existingItem) throw new BadRequestError("Product not found in cart");

    const product = await Product.findOne({
      _id: productId,
      is_deleted: false,
    }).session(session);
    if (!product) throw new BadRequestError("Product not found");

    if (unit === "box" && product.stock < quantity) {
      throw new BadRequestError("Not enough stock available (Boxes)");
    } else if (unit === "strip") {
      const totalStrips =
        product.strip_count + product.stock * product.strips_per_box;
      if (totalStrips < quantity)
        throw new BadRequestError("Not enough stock available (Strips)");
    }

    existingItem.quantity = quantity;
    cart.total_price = cart.items.reduce(
      (total, item) => total + item.price * item.quantity,
      0,
    );

    await cart.save({ session });
    await session.commitTransaction();
    session.endSession();

    await cart.populate("items.product");

    return res
      .status(200)
      .json({ message: "Cart updated successfully", data: cart });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    next(error);
  }
};

