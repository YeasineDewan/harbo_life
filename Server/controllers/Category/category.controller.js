import { Category } from "../../models/Category/category.model.js";
import { BadRequestError, ConflictError, NotFoundError } from "../../utils/errors.js";
import { validateObjectId } from "../../utils/validateObjectId.js";
import { PRODUCT_CATEGORIES } from "../../utils/constants.js";
import cloudinary from "../../config/cloudinary.js";
import slugify from "slugify";


const uploadToCloudinary = (buffer, options) => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(options, (error, result) => {
      if (error) reject(error);
      else resolve(result);
    });
    stream.end(buffer);
  });
};

export const createCategoryController = async (req, res, next) => {
  try {
    const { name, description } = req.body;

    console.log("body:", req.body);
    console.log("file:", req.file);

    if (!name) throw new BadRequestError("Category name is required");
    if (!req.file) throw new BadRequestError("Category image is required");

    const existing = await Category.findOne({ name: name.toLowerCase().trim() });
    if (existing) throw new ConflictError("Category already exists");

    const uploadResult = await uploadToCloudinary(req.file.buffer, {
      folder: "categories",
      format: "webp",
      public_id: `category_${name.toLowerCase().replace(/\s+/g, "_")}`,
      overwrite: true,
    });

    const slug = slugify(name, { lower: true, strict: true, trim: true });

    const newCategory = await Category.create({
      name,
      description,
      image: uploadResult.secure_url,
      slug
    });

    res.status(201).json({
      message: "Category created successfully",
      data: newCategory,
    });
  } catch (error) {
    next(error);
  }
};

export const getAllCategoriesController = async (req, res, next) => {
  try {
    console.log("Query Params Received:", req.query);
    const { search, page = 1, limit = 10 } = req.query;

    const filter = {
      is_active: true,
      is_deleted: false,
    };

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const limitNumber = parseInt(limit);

    const totalItems = await Category.countDocuments(filter);
    const totalPages = Math.ceil(totalItems / limitNumber);

    const categories = await Category.find(filter)
      .select("-__v -is_active -is_deleted")
      .skip(skip)
      .limit(limitNumber)
      .sort({ createdAt: -1 });

    res.json({
      message: "Categories fetched successfully",
      data: categories,
      pagination: {
        totalItems,
        totalPages,
        currentPage: parseInt(page),
        limit: limitNumber,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getOneCategoryController = async (req, res, next) => {
  try {
    const { id } = req.params;

    validateObjectId(id, "category id");

    const category = await Category.findOne({
      _id: id,
      is_active: true,
      is_deleted: false
    }).select("-__v -is_active -is_deleted");

    if (!category) {
      throw new NotFoundError("Category not found");
    }

    res.json({
      message: "Category fetched successfully",
      data: category,
    });
  } catch (error) {
    next(error);
  }
};

export const getCategoryBySlugController = async (req, res, next) => {
  try {
    const { slug } = req.params;

    const category = await Category.findOne({
      slug,
      is_active: true,
      is_deleted: false
    }).select("-__v -is_active -is_deleted");

    if (!category) {
      throw new NotFoundError("Category not found");
    }

    res.json({
      message: "Category fetched successfully",
      data: category,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteCategoryController = async (req, res, next) => {
  try {
    const { id } = req.params;

    validateObjectId(id, "category id");

    const category = await Category.findByIdAndUpdate(
      id,
      { is_deleted: true, is_active: false },
      { new: true }
    );

    if (!category) {
      throw new NotFoundError("Category not found");
    }

    res.json({
      message: "Category deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};


export const updateCategoryController = async (req, res, next) => {
  try {
    const { id } = req.params;

    validateObjectId(id, "category id");

    const existingCategory = await Category.findOne({
      _id: id,
      is_active: true,
      is_deleted: false
    });

    if (!existingCategory) {
      throw new NotFoundError("Category not found");
    }

    if (!req.body || Object.keys(req.body).length === 0) {
      throw new BadRequestError("Update data is required");
    }

    const allowedFields = ["name", "description"];
    const updateData = Object.keys(req.body)
      .filter((key) => allowedFields.includes(key))
      .reduce((obj, key) => {
        obj[key] = req.body[key];
        return obj;
      }, {});

    if (req.file) {
      const uploadResult = await uploadToCloudinary(req.file.buffer, {
        folder: "categories",
        format: "webp",
        public_id: `category_${id}`,
        overwrite: true,
      });
      updateData.image = uploadResult.secure_url;
    }

    if (updateData.name) {
      updateData.slug = slugify(updateData.name, { lower: true, strict: true, trim: true });
    }

    if (Object.keys(updateData).length === 0) {
      throw new BadRequestError("No valid fields provided");
    }

    const category = await Category.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, runValidators: true }
    ).select("-__v");

    res.json({
      message: "Category updated successfully",
      data: category,
    });
  } catch (error) {
    next(error);
  }
};