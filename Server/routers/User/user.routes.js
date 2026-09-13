import { Router } from "express";
import { authMiddleware } from "../../middleware/auth.middlware.js";
import { checkRole } from "../../middleware/check_roles.middleware.js";
import { ForbiddenError } from "../../utils/errors.js";
import {
  GetUserProfileController,
  UpdateAvatarController,
  UpdateUserController,
  CreateUserController,
  GetAllUsersController,
  DeleteUserController,
  ToggleUserActiveController,
  GetUserByIdController,
  UpdateUserRoleController,
  GetCouriersListController
} from "../../controllers/User/user.controller.js";
import {
  processImage,
  uploadSingle,
} from "../../middleware/upload.middleware.js";
import {
  updateProfileSchema,
  createUserSchema,
  toggleActiveSchema,
} from "../../validations/User/user.validation.js";
import { validate } from "../../middleware/validate.middleware.js";

const router = Router();

router.use(authMiddleware);

router.get("/me", GetUserProfileController);

router.patch(
  "/update-profile/:id",
  (req, res, next) => {
    if (req.user._id.toString() !== req.params.id && !["admin", "super_admin"].includes(req.user.role)) {
      return next(new ForbiddenError("Forbidden: You can only update your own profile"));
    }
    next();
  },
  validate(updateProfileSchema),
  UpdateUserController,
);

router.patch(
  "/update-avatar",
  uploadSingle("avatar"),
  processImage({ width: 300, height: 300 }),
  UpdateAvatarController,
);

router.post(
  "/create",
  checkRole(["super_admin", "admin"]),
  validate(createUserSchema),
  CreateUserController,
);

router.get(
  "/couriers/list",
  checkRole(["admin", "super_admin"]),
  GetCouriersListController,
);

router.get("/:id", checkRole(["super_admin", "admin"]), GetUserByIdController);

router.get("/", checkRole(["super_admin", "admin"]), GetAllUsersController);

router.delete("/:id", checkRole(["super_admin", "admin"]), DeleteUserController);

router.patch(
  "/:id/status",
  checkRole(["super_admin", "admin"]),
  validate(toggleActiveSchema),
  ToggleUserActiveController,
);

router.patch(
  "/:id/role",
  checkRole(["super_admin", "admin"]),
  UpdateUserRoleController,
);

export { router as UserRouter };
