import {
  NotFoundError,
  BadRequestError,
  ForbiddenError,
} from "../../utils/errors.js";
import User from "../../models/User/user.model.js";
import cloudinary from "../../config/cloudinary.js";
import bcrypt from "bcrypt";

export const GetUserByIdController = async (req, res, next) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id).select("-password -__v").lean();

    if (!user) {
      throw new NotFoundError("User not found");
    }

    res.status(200).json({
      message: "User fetched successfully",
      data: user,
    });
  } catch (error) {
    next(error);
  }
};

export const GetUserProfileController = async (req, res, next) => {
  try {
    const userId = req.user._id;

    const user = await User.findById(userId)
      .select("-password -__v -is_deleted -is_active")
      .lean();

    if (!user) {
      throw new NotFoundError("User not found");
    }

    res.status(200).json({
      message: "User profile fetched successfully",
      data: user,
    });
  } catch (error) {
    next(error);
  }
};

export const UpdateAvatarController = async (req, res, next) => {
  try {
    if (!req.file) throw new BadRequestError("No image provided");

    const uploadResult = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: "avatars",
          format: "webp",
          public_id: `avatar_${req.user.id}`,
          overwrite: true,
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        },
      );
      stream.end(req.file.buffer);
    });

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { avatar: uploadResult.secure_url },
      { new: true },
    )
      .select("-password -__v -is_deleted -is_active")
      .lean();

    res.status(200).json({
      message: "Avatar updated successfully",
      data: user,
    });
  } catch (error) {
    next(error);
  }
};

export const UpdateUserController = async (req, res, next) => {
  try {
    const { id } = req.params;
    const requesterRole = req.user.role;

    const targetUser = await User.findById(id);
    if (!targetUser) throw new NotFoundError("User not found");

    // Only super_admin can modify another super_admin's data
    if (targetUser.role === "super_admin" && requesterRole !== "super_admin") {
      throw new ForbiddenError("Cannot modify a super admin");
    }

    const allowedFields = [
      "name",
      "email",
      "phone",
      "date_of_birth",
      "gender",
      "address",
    ];

    const updateData = Object.keys(req.body)
      .filter((key) => allowedFields.includes(key))
      .reduce((obj, key) => {
        obj[key] = req.body[key];
        return obj;
      }, {});

    if (Object.keys(updateData).length === 0) {
      throw new BadRequestError("No valid fields provided");
    }

    if (updateData.email && updateData.email !== targetUser.email) {
      const emailExists = await User.findOne({
        email: updateData.email,
        _id: { $ne: id },
      }).lean();
      if (emailExists) throw new BadRequestError("Email already in use");
    }

    if (updateData.address) {
      updateData.address = {
        ...targetUser.address,
        ...updateData.address,
      };
    }

    const updatedUser = await User.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, runValidators: true },
    )
      .select("-password -__v -is_deleted")
      .lean();

    res.status(200).json({
      message: "User updated successfully",
      data: updatedUser,
    });
  } catch (error) {
    next(error);
  }
};

export const UpdateUserRoleController = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { role } = req.body;
    const requesterRole = req.user.role;

    const targetUser = await User.findById(id);
    if (!targetUser) throw new NotFoundError("User not found");

    if (targetUser.role === "super_admin") {
      throw new ForbiddenError("Cannot modify a super admin's role");
    }

    if (requesterRole === "admin" && role === "super_admin") {
      throw new ForbiddenError("Admins cannot assign super_admin role");
    }

    targetUser.role = role;
    await targetUser.save();

    res.status(200).json({
      message: "User role updated successfully",
      data: {
        _id: targetUser._id,
        role: targetUser.role,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const CreateUserController = async (req, res, next) => {
  try {
    const creatorRole = req.user.role;
    const { name, email, password, phone, role } = req.body;

    if (creatorRole === "admin" && role === "super_admin") {
      throw new ForbiddenError(
        "Admins are not allowed to create super_admin accounts",
      );
    }
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = new User({
      name,
      email,
      password: hashedPassword,
      phone,
      role: role || "user",
    });

    await newUser.save();

    const userResponse = newUser.toObject();
    delete userResponse.password;

    res.status(201).json({
      message: "User created successfully",
      data: userResponse,
    });
  } catch (error) {
    next(error);
  }
};

export const GetAllUsersController = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 10,
      role,
      is_active,
      gender,
      search,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    const filter = {
      role: { $ne: "super_admin" },
      is_deleted: false,
    };

    if (role && role !== "super_admin") {
      filter.role = role;
    }

    if (is_active !== undefined) {
      filter.is_active = is_active === "true";
    }

    if (gender) {
      filter.gender = gender;
    }

    if (search && search.trim() !== "") {
      const searchRegex = new RegExp(search.trim(), "i");
      filter.$or = [
        { name: searchRegex },
        { email: searchRegex },
        { communications_email: searchRegex },
        { phone: searchRegex },
      ];
    }

    const pageNum = Math.max(Number(page), 1);
    const limitNum = Math.max(Number(limit), 1);
    const skip = (pageNum - 1) * limitNum;

    const allowedSortFields = ["createdAt", "name", "email", "role"];
    const sortField = allowedSortFields.includes(sortBy) ? sortBy : "createdAt";
    const sortDirection = sortOrder === "asc" ? 1 : -1;

    const [users, total] = await Promise.all([
      User.find(filter)
        .select("-password -__v -is_deleted")
        .sort({ [sortField]: sortDirection })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      User.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(total / limitNum);

    res.status(200).json({
      message: "Users fetched successfully",
      data: users,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages,
        hasNextPage: pageNum < totalPages,
        hasPrevPage: pageNum > 1,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const DeleteUserController = async (req, res, next) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id);
    if (!user) throw new NotFoundError("User not found");

    if (user.role === "super_admin") {
      throw new ForbiddenError("Cannot delete a super admin");
    }

    user.is_deleted = true;
    user.is_active = false;
    await user.save();

    res.status(200).json({ message: "User deleted successfully" });
  } catch (error) {
    next(error);
  }
};

export const ToggleUserActiveController = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { is_active } = req.body;

    const user = await User.findById(id);
    if (!user) throw new NotFoundError("User not found");

    if (user.role === "super_admin") {
      throw new ForbiddenError("Cannot change status of a super admin");
    }

    user.is_active = is_active;
    await user.save();

    res.status(200).json({
      message: `User ${is_active ? "activated" : "deactivated"} successfully`,
    });
  } catch (error) {
    next(error);
  }
};

export const GetCouriersListController = async (req, res, next) => {
  try {
    const couriers = await User.find({ role: "courier", is_deleted: false })
      .select("name _id")
      .lean();

    return res.status(200).json({
      message: "Couriers fetched successfully",
      data: couriers,
    });
  } catch (error) {
    next(error);
  }
};
