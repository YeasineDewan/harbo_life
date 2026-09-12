import { Router } from "express";
import {
  signupLimiter,
  loginLimiter,
} from "../../middleware/rate_limiter.middleware.js";
import {
  LoginController,
  LogoutController,
  RegisterController,
} from "../../controllers/Auth/auth.controller.js";
import {
  RegisterSchema,
  LoginSchema,
} from "../../validations/Auth/auth.validation.js";
import { validate } from "../../middleware/validate.middleware.js";
import { authMiddleware } from "../../middleware/auth.middlware.js";

const router = Router();

router.post("/register", signupLimiter, validate(RegisterSchema), RegisterController);
router.post("/login", loginLimiter, validate(LoginSchema), LoginController);
router.post("/logout", authMiddleware, LogoutController);

export { router as AuthRouter };