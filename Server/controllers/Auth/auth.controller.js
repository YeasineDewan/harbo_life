import {
  BadRequestError,
  NotFoundError,
  ConflictError,
} from "../../utils/errors.js";
import { generateToken } from "../../services/jwt.service.js";
import User from "../../models/User/user.model.js";
import {
  ComparePassword,
  hashPassword,
} from "../../services/password.service.js";
import { sendWelcomeEmail } from "../../services/email.service.js";
import { DEFAULT_ROLE } from "../../utils/constants.js";

const isProduction = process.env.NODE_ENV === "production";

const cookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: isProduction ? "none" : "lax",
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

const formatUserResponse = (user) => {
  const { _id, name, email, role, avatar } = user.toObject();
  return { _id, name, email, role, avatar };
};

// Register
export const RegisterController = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;
    const normalizedEmail = email.toLowerCase();

    const existingUser = await User.findOne({ email: normalizedEmail });

    if (existingUser?.is_active && !existingUser?.is_deleted) {
      throw new ConflictError("Email already exists");
    }

    const hashedPassword = await hashPassword(password);

    const savedUser = existingUser?.is_deleted
      ? await User.findByIdAndUpdate(
          existingUser._id,
          {
            name,
            password: hashedPassword,
            role: DEFAULT_ROLE,
            is_deleted: false,
            is_active: true,
          },
          { new: true },
        )
      : await User.create({
          name,
          email: normalizedEmail,
          password: hashedPassword,
          avatar: null,
        });

    const token = generateToken(savedUser._id, savedUser.role);

    res.cookie("token", token, cookieOptions);

    sendWelcomeEmail(savedUser.email, savedUser.name);

    return res.status(201).json({
      message: existingUser?.is_deleted
        ? "Account reactivated successfully"
        : "Registered successfully",
      data: formatUserResponse(savedUser),
      token,
    });
  } catch (error) {
    next(error);
  }
};

// Login
export const LoginController = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const normalizedEmail = email.toLowerCase();

    const user = await User.findOne({ email: normalizedEmail }).select(
      "+password",
    );

    if (!user || user.is_deleted || !user.is_active) {
      throw new NotFoundError("Invalid email or password");
    }

    const isMatch = await ComparePassword(password, user.password);

    if (!isMatch) {
      throw new BadRequestError("Invalid email or password");
    }

    const token = generateToken(user._id, user.role);

    res.cookie("token", token, cookieOptions);

    return res.status(200).json({
      message: "Logged in successfully",
      data: formatUserResponse(user),
      token,
    });
  } catch (error) {
    next(error);
  }
};

// Logout
export const LogoutController = async (req, res, next) => {
  try {
    const { maxAge, ...clearOptions } = cookieOptions;

    res.clearCookie("token", clearOptions);

    return res.status(200).json({
      message: "Logged out successfully",
    });
  } catch (error) {
    next(error);
  }
};
