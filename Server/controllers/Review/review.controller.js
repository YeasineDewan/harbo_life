import Review from "../../models/Review/review.model.js";
import Product from "../../models/Product/product.model.js";
import User from "../../models/User/user.model.js";
import {
  BadRequestError,
  NotFoundError,
  ForbiddenError,
  ConflictError,
} from "../../utils/errors.js";
import { validateObjectId } from "../../utils/validateObjectId.js";

const updateProductRating = async (productId) => {
  const reviews = await Review.find({ product: productId });
  const numReviews = reviews.length;
  const avgRating =
    numReviews > 0
      ? Number(
          (reviews.reduce((sum, r) => sum + r.rating, 0) / numReviews).toFixed(
            1,
          ),
        )
      : 0;

  await Product.findByIdAndUpdate(productId, {
    rating: avgRating,
    num_reviews: numReviews,
  });
};

export const getTopReviewsController = async (req, res, next) => {
  try {
    const reviews = await Review.find({ isTopReview: true })
      .populate("user", "name avatar")
      .limit(6)
      .sort({ createdAt: -1 });

    res.status(200).json({
      message: "Top reviews fetched successfully",
      data: reviews,
    });
  } catch (error) {
    next(error);
  }
};

export const createReviewController = async (req, res, next) => {
  try {
    const { product, rating, comment } = req.body;

    const userId = req.user._id;

    validateObjectId(product, "product id");

    const productExists = await Product.findOne({
      _id: product,
      is_deleted: false,
      is_active: true,
    });

    if (!productExists) {
      throw new NotFoundError("Product not found");
    }

    const existingReview = await Review.findOne({
      product,
      user: userId,
      is_deleted: false,
    });

    if (existingReview) {
      throw new ConflictError("You have already reviewed this product");
    }

    const newReview = new Review({
      product,
      user: userId,
      rating,
      comment,
    });

    await newReview.save();
    await updateProductRating(product);
    await newReview.populate("user", "name avatar");

    res.status(201).json({
      message: "Review created successfully",
      data: newReview,
    });
  } catch (error) {
    next(error);
  }
};

export const getAllReviewsController = async (req, res, next) => {
  try {
    const {
      product,
      user,
      productName,
      userName,
      search,
      rating,
      page = 1,
      limit = 10,
    } = req.query;

    const filters = {};

    // Direct filters by ID
    if (product) {
      validateObjectId(product, "product id");
      filters.product = product;
    }

    if (user) {
      validateObjectId(user, "user id");
      filters.user = user;
    }

    // Filter by rating
    if (rating !== undefined) {
      const ratingNum = Number(rating);
      if (!isNaN(ratingNum) && ratingNum >= 1 && ratingNum <= 5) {
        filters.rating = ratingNum;
      }
    }

    // Filter by product name
    if (productName) {
      const matchingProducts = await Product.find({
        name: { $regex: productName, $options: "i" },
      }).select("_id");

      const productIds = matchingProducts.map((p) => p._id);

      if (filters.product) {
        filters.product = { $and: [filters.product, { $in: productIds }] };
      } else {
        filters.product = { $in: productIds };
      }
    }

    // Filter by user name
    if (userName) {
      const matchingUsers = await User.find({
        name: { $regex: userName, $options: "i" },
      }).select("_id");
      const userIds = matchingUsers.map((u) => u._id);

      if (filters.user) {
        filters.user = { $and: [filters.user, { $in: userIds }] };
      } else {
        filters.user = { $in: userIds };
      }
    }

    // General search
    if (search) {
      const matchingProducts = await Product.find({
        name: { $regex: search, $options: "i" },
      }).select("_id");
      const productIds = matchingProducts.map((p) => p._id);

      const matchingUsers = await User.find({
        name: { $regex: search, $options: "i" },
      }).select("_id");
      const userIds = matchingUsers.map((u) => u._id);

      filters.$or = [
        { comment: { $regex: search, $options: "i" } },
        { product: { $in: productIds } },
        { user: { $in: userIds } },
      ];
    }

    const pageNumber = parseInt(page) || 1;
    const limitNumber = parseInt(limit) || 10;
    const skip = (pageNumber - 1) * limitNumber;

    if (isNaN(pageNumber) || pageNumber < 1) {
      throw new BadRequestError("Invalid page number");
    }
    if (isNaN(limitNumber) || limitNumber < 1 || limitNumber > 100) {
      throw new BadRequestError("Limit must be between 1 and 100");
    }

    const totalItems = await Review.countDocuments(filters);
    const totalPages = Math.ceil(totalItems / limitNumber);

    const reviews = await Review.find(filters)
      .skip(skip)
      .limit(limitNumber)
      .populate("user", "name avatar")
      .populate("product", "name image")
      .sort({ createdAt: -1 });

    res.status(200).json({
      message: "Reviews fetched successfully",
      data: reviews,
      pagination: {
        totalItems,
        totalPages,
        currentPage: pageNumber,
        limit: limitNumber,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getOneReviewController = async (req, res, next) => {
  try {
    const { id } = req.params;
    validateObjectId(id, "review id");

    const review = await Review.findById(id)
      .populate("user", "name avatar")
      .populate("product", "name image");

    if (!review) {
      throw new NotFoundError("Review not found");
    }

    res.status(200).json({
      message: "Review fetched successfully",
      data: review,
    });
  } catch (error) {
    next(error);
  }
};

export const updateReviewController = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { rating, comment, isTopReview } = req.body;
    const userId = req.user._id;
    const userRole = req.user.role;

    validateObjectId(id, "review id");

    const review = await Review.findById(id);

    if (!review) {
      throw new NotFoundError("Review not found");
    }

    const isOwner = review.user.toString() === userId.toString();
    const isAdmin = ["admin", "super_admin"].includes(userRole);

    if (!isOwner && !isAdmin) {
      throw new ForbiddenError("You are not authorized to update this review");
    }

    if (isOwner) {
      if (rating !== undefined) review.rating = rating;
      if (comment !== undefined) review.comment = comment;
    }

    if (isAdmin && isTopReview !== undefined) {
      review.isTopReview = isTopReview;
    }

    await review.save();
    await updateProductRating(review.product);
    await review.populate("user", "name avatar");
    await review.populate("product", "name image");

    res.status(200).json({
      message: "Review updated successfully",
      data: review,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteReviewController = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;
    const userRole = req.user.role;

    validateObjectId(id, "review id");

    const review = await Review.findById(id);
    if (!review) {
      throw new NotFoundError("Review not found");
    }

    const isOwner = review.user.toString() === userId.toString();
    const isAdmin = ["admin", "super_admin"].includes(userRole);

    if (!isOwner && !isAdmin) {
      throw new ForbiddenError("You are not authorized to delete this review");
    }

    const productId = review.product;

    await Review.findByIdAndDelete(id);
    await updateProductRating(productId);

    res.status(200).json({
      message: "Review deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};
