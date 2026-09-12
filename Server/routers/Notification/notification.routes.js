import { Router } from "express";
import { authMiddleware } from "../../middleware/auth.middlware.js";
import {
  getUserNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  getUnreadNotificationsCount,
} from "../../controllers/Notification/notification.controller.js";

const router = Router();

// Protect all endpoints
router.use(authMiddleware);

router.get("/", getUserNotifications);
router.get("/unread-count", getUnreadNotificationsCount);
router.patch("/read-all", markAllNotificationsAsRead);
router.patch("/:id/read", markNotificationAsRead);

export { router as NotificationRouter };
