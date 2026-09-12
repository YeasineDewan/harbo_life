import Product from "../../models/Product/product.model.js";
import { Category } from "../../models/Category/category.model.js";
import Review from "../../models/Review/review.model.js";
import { BadRequestError, NotFoundError } from "../../utils/errors.js";
import { validateObjectId } from "../../utils/validateObjectId.js";
import cloudinary from "../../config/cloudinary.js";
import streamifier from "streamifier";
import { checkAndNotifyLowStock } from "../../services/notification.service.js";
import SavedProduct from "../../models/Product/savedProduct.model.js";
import User from "../../models/User/user.model.js";
import { getEmbedding } from "../../services/embedding.service.js";

export const createProductController = async (req, res, next) => {
  try {
    const data = { ...req.body };

    if (!req.file) throw new BadRequestError("Product image is required");
    if (!data.category) throw new BadRequestError("Category is required");

    validateObjectId(data.category, "category id");

    const categoryExists = await Category.findById(data.category);
    if (!categoryExists) throw new BadRequestError("Category not found");

    if (data.price) data.price = Number(data.price);
    if (data.stock) data.stock = Number(data.stock);
    if (typeof data.requires_prescription !== "undefined") {
      data.requires_prescription =
        data.requires_prescription === "true" ||
        data.requires_prescription === true;
    }

    const isHasStrips = data.has_strips === "true" || data.has_strips === true;
    const stripCount = Number(data.strip_count || 0);
    const stripsPerBox = Number(data.strips_per_box || 0);

    data.has_strips = isHasStrips;

    if (!isHasStrips) {
      data.strip_count = 0;
      data.strips_per_box = 0;
    } else {
      if (stripsPerBox <= 0) {
        throw new BadRequestError(
          "Strips per box must be greater than 0 if product has strips.",
        );
      }
      if (stripCount >= stripsPerBox) {
        throw new BadRequestError(
          `Strip count (${stripCount}) cannot be greater than or equal to strips per box (${stripsPerBox}).`,
        );
      }
      data.strip_count = stripCount;
      data.strips_per_box = stripsPerBox;
    }

    const uploadStream = () =>
      new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { folder: "products" },
          (error, result) => (error ? reject(error) : resolve(result)),
        );
        streamifier.createReadStream(req.file.buffer).pipe(stream);
      });

    const result = await uploadStream();
    data.image = result.secure_url;

    // Generate semantic embedding
    try {
      const embeddingText = `Product: ${data.name}. Category: ${categoryExists.name}. Description: ${data.description}`;
      data.embeddings = await getEmbedding(embeddingText);
    } catch (embedError) {
      console.error("Failed to generate embedding for new product:", embedError.message);
    }

    const newProduct = new Product(data);
    await newProduct.save();
    await newProduct.populate("category");

    checkAndNotifyLowStock(newProduct).catch((err) =>
      console.error(err.message),
    );

    res.status(201).json({
      message: "Product created successfully",
      data: newProduct,
    });
  } catch (error) {
    next(error);
  }
};

export const GetAllProductsController = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const sortBy = req.query.sort || "createdAt";
    const sortOrder = req.query.order === "asc" ? 1 : -1;

    if (isNaN(page) || page < 1)
      throw new BadRequestError("Invalid page number");
    if (isNaN(limit) || limit < 1 || limit > 100)
      throw new BadRequestError("Limit must be between 1 and 100");

    const filters = { is_deleted: false, is_active: true };

    if (req.query.search) {
      filters.$or = [
        { name: { $regex: req.query.search, $options: "i" } },
        { description: { $regex: req.query.search, $options: "i" } },
      ];
    } else if (req.query.name) {
      filters.name = { $regex: req.query.name, $options: "i" };
    }

    // Top selling filter
    if (req.query.top_selling !== undefined) {
      filters.top_selling = req.query.top_selling === "true";
    }

    if (req.query.is_active !== undefined) {
      if (req.query.is_active === "false") {
        filters.is_active = { $ne: true };
      } else {
        filters.is_active = true;
      }
    }

    // Category filtering
    if (req.query.category) {
      validateObjectId(req.query.category, "category id");
      filters.category = req.query.category;
    } else if (req.query.categoryName) {
      const categoryDoc = await Category.findOne({
        $or: [
          { name: { $regex: new RegExp(`^${req.query.categoryName}$`, "i") } },
          { slug: req.query.categoryName },
        ],
      });

      if (categoryDoc) {
        filters.category = categoryDoc._id;
      } else {
        return res.json({
          message: "Products fetched successfully",
          data: [],
          pagination: {
            totalItems: 0,
            totalPages: 0,
            currentPage: page,
            limit,
            hasNextPage: false,
            hasPrevPage: false,
          },
        });
      }
    }

    // Price range filtering
    if (req.query.minPrice || req.query.maxPrice) {
      filters.price = {};
      if (req.query.minPrice) {
        filters.price.$gte = Number(req.query.minPrice);
      }
      if (req.query.maxPrice) {
        filters.price.$lte = Number(req.query.maxPrice);
      }
    }

    // Prescription requirement filter
    if (
      req.query.requires_prescription !== undefined &&
      req.query.requires_prescription !== ""
    ) {
      filters.requires_prescription =
        req.query.requires_prescription === "true";
    }

    // Has strips filter
    if (req.query.has_strips !== undefined && req.query.has_strips !== "") {
      filters.has_strips = req.query.has_strips === "true";
    }

    // Stock status filter
    if (req.query.inStock !== undefined && req.query.inStock !== "") {
      if (req.query.inStock === "true") {
        filters.stock = { $gt: 0 };
      } else if (req.query.inStock === "false") {
        filters.stock = 0;
      }
    }

    // Minimum rating filter
    if (req.query.minRating) {
      filters.rating = { $gte: Number(req.query.minRating) };
    }

    const [products, total] = await Promise.all([
      Product.find(filters)
        .skip(skip)
        .limit(limit)
        .sort({ [sortBy]: sortOrder })
        .select("-is_deleted -__v")
        .populate("category")
        .lean(),
      Product.countDocuments(filters),
    ]);

    res.json({
      message: "Products fetched successfully",
      data: products,
      pagination: {
        totalItems: total,
        totalPages: Math.ceil(total / limit),
        currentPage: page,
        limit,
        hasNextPage: page * limit < total,
        hasPrevPage: page > 1,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const GetOneProductController = async (req, res, next) => {
  try {
    const { id } = req.params;
    validateObjectId(id, "product id");

    const product = await Product.findOne({ _id: id, is_deleted: false })
      .select("-is_deleted -__v")
      .populate("category")
      .lean();

    if (!product) throw new NotFoundError("Product not found");

    const reviews = await Review.find({ product: id })
      .populate("user", "name avatar")
      .lean();

    product.reviews = reviews;

    res.json({
      message: "Product fetched successfully",
      data: product,
    });
  } catch (error) {
    next(error);
  }
};

export const DeleteProductController = async (req, res, next) => {
  try {
    const { id } = req.params;
    validateObjectId(id, "product id");

    const product = await Product.findByIdAndUpdate(
      id,
      { is_deleted: true },
      { new: true },
    ).select("-__v");
    if (!product) throw new NotFoundError("Product not found");

    res.json({ message: "Product deleted successfully" });
  } catch (error) {
    next(error);
  }
};

export const updateProductController = async (req, res, next) => {
  try {
    const { id } = req.params;
    validateObjectId(id, "product id");

    const body = { ...req.body };

    if (req.file) {
      const uploadStream = () =>
        new Promise((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream(
            {
              folder: "products",
              fetch_format: "auto",
              quality: "auto",
              width: 600,
              crop: "limit",
            },
            (error, result) => (error ? reject(error) : resolve(result)),
          );
          streamifier.createReadStream(req.file.buffer).pipe(stream);
        });

      const result = await uploadStream();
      body.image = result.secure_url;
    }

    if (!body || Object.keys(body).length === 0)
      throw new BadRequestError("Update data is required");

    if (body.price) body.price = Number(body.price);
    if (body.stock) body.stock = Number(body.stock);
    if (typeof body.requires_prescription !== "undefined") {
      body.requires_prescription =
        body.requires_prescription === "true" ||
        body.requires_prescription === true;
    }

    if (
      typeof body.has_strips !== "undefined" ||
      body.strip_count ||
      body.strips_per_box
    ) {
      const isHasStrips =
        body.has_strips === "true" || body.has_strips === true;
      const stripCount = Number(body.strip_count || 0);
      const stripsPerBox = Number(body.strips_per_box || 0);

      body.has_strips = isHasStrips;

      if (!isHasStrips) {
        body.strip_count = 0;
        body.strips_per_box = 0;
      } else {
        if (stripsPerBox <= 0) {
          throw new BadRequestError(
            "Strips per box must be greater than 0 if product has strips.",
          );
        }
        if (stripCount >= stripsPerBox) {
          throw new BadRequestError(
            `Strip count (${stripCount}) cannot be greater than or equal to strips per box (${stripsPerBox}).`,
          );
        }
        body.strip_count = stripCount;
        body.strips_per_box = stripsPerBox;
      }
    }

    let categoryExists = null;
    if (body.category) {
      validateObjectId(body.category, "category id");
      categoryExists = await Category.findById(body.category);
      if (!categoryExists) throw new BadRequestError("Category not found");
    }

    // Generate semantic embedding if name, description, or category is being updated
    if (body.name || body.description || body.category) {
      try {
        const existingProduct = await Product.findOne({ _id: id, is_deleted: false }).populate("category");
        if (existingProduct) {
          const finalName = body.name || existingProduct.name;
          const finalDescription = body.description || existingProduct.description;
          const finalCategoryName = categoryExists 
            ? categoryExists.name 
            : (existingProduct.category ? existingProduct.category.name : "");

          const embeddingText = `Product: ${finalName}. Category: ${finalCategoryName}. Description: ${finalDescription}`;
          body.embeddings = await getEmbedding(embeddingText);
        }
      } catch (embedError) {
        console.error("Failed to generate embedding for updated product:", embedError.message);
      }
    }

    const product = await Product.findOneAndUpdate(
      { _id: id, is_deleted: false },
      { $set: body },
      { new: true, runValidators: true },
    )
      .select("-is_deleted -__v")
      .populate("category");

    if (!product) throw new NotFoundError("Product not found");

    checkAndNotifyLowStock(product).catch((err) => console.error(err.message));

    res.json({
      message: "Product updated successfully",
      data: product,
    });
  } catch (error) {
    next(error);
  }
};


export const GetSavedProductsController = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const saved = await SavedProduct.find({ user: userId })
      .populate({
        path: "product",
        populate: { path: "category" },
      })
      .lean();

    const products = saved
      .map((item) => item.product)
      .filter((product) => product && !product.is_deleted);

    res.status(200).json({
      message: "Saved products fetched successfully",
      data: products,
    });
  } catch (error) {
    next(error);
  }
};
export const ToggleSavedProductController = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { productId } = req.params;

    validateObjectId(productId, "product id");

    const productExists = await Product.findOne({
      _id: productId,
      is_deleted: false,
    });
    if (!productExists) {
      return res.status(404).json({ message: "Product not found" });
    }

    const existingSave = await SavedProduct.findOne({
      user: userId,
      product: productId,
    });

    if (existingSave) {
      await Promise.all([
        SavedProduct.deleteOne({ _id: existingSave._id }),
        Product.findByIdAndUpdate(productId, { $inc: { save_count: -1 } }),
      ]);

      return res.status(200).json({
        message: "Product removed from wishlist",
        isSaved: false,
      });
    } else {
      const newSave = new SavedProduct({ user: userId, product: productId });

      await Promise.all([
        newSave.save(),
        Product.findByIdAndUpdate(productId, { $inc: { save_count: 1 } }),
      ]);

      return res.status(200).json({
        message: "Product added to wishlist",
        isSaved: true,
      });
    }
  } catch (error) {
    next(error);
  }
};
