import Notification from "../../models/Notification/notification.model.js";
import { NotFoundError, ForbiddenError } from "../../utils/errors.js";
import { validateObjectId } from "../../utils/validateObjectId.js";

/**
 * Get notifications for the logged-in user 
 * Fetches notifications matching user ID or their role or general broadcast notifications
 */
export const getUserNotifications = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const userRole = req.user.role;

    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const skip = (page - 1) * limit;

    const targetRoles = [userRole, "all"];
    if (userRole === "super_admin") {
      targetRoles.push("admin");
    }

    const query = {
      $or: [
        { recipient: userId },
        { recipientRole: { $in: targetRoles } },
      ],
    };

    const [notifications, total] = await Promise.all([
      Notification.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Notification.countDocuments(query),
    ]);

    // Map through notifications to include a single client-friendly `isRead` flag
    const formattedNotifications = notifications.map((notif) => {
      const isRead = notif.recipient
        ? notif.isRead
        : notif.readBy && notif.readBy.some((id) => id.toString() === userId.toString());

      return {
        ...notif,
        isRead: !!isRead,
        readBy: undefined, // Hide the readBy array from standard output to conserve bandwidth
      };
    });

    res.status(200).json({
      message: "Notifications fetched successfully",
      data: formattedNotifications,
      pagination: {
        totalItems: total,
        totalPages: Math.ceil(total / limit),
        currentPage: page,
        limit,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Mark a single notification as read
 */
export const markNotificationAsRead = async (req, res, next) => {
  try {
    const { id } = req.params;
    validateObjectId(id, "notification id");
    const userId = req.user._id;
    const userRole = req.user.role;

    const notification = await Notification.findById(id);
    if (!notification) {
      throw new NotFoundError("Notification not found");
    }

    const targetRoles = [userRole, "all"];
    if (userRole === "super_admin") {
      targetRoles.push("admin");
    }

    const isRecipient = notification.recipient && notification.recipient.toString() === userId.toString();
    const isTargetRole = targetRoles.includes(notification.recipientRole);

    if (!isRecipient && !isTargetRole) {
      throw new ForbiddenError("You do not have permission to access this notification");
    }

    if (notification.recipient) {
      notification.isRead = true;
    } else {
      if (!notification.readBy.some((id) => id.toString() === userId.toString())) {
        notification.readBy.push(userId);
      }
    }

    await notification.save();

    res.status(200).json({
      message: "Notification marked as read",
      data: {
        ...notification.toObject(),
        isRead: true,
        readBy: undefined,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Mark all matching notifications as read for the logged-in user
 */
export const markAllNotificationsAsRead = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const userRole = req.user.role;

    await Notification.updateMany(
      { recipient: userId, isRead: false },
      { $set: { isRead: true } }
    );

    const targetRoles = [userRole, "all"];
    if (userRole === "super_admin") {
      targetRoles.push("admin");
    }

    await Notification.updateMany(
      {
        recipient: null,
        recipientRole: { $in: targetRoles },
        readBy: { $ne: userId },
      },
      { $addToSet: { readBy: userId } }
    );

    res.status(200).json({
      message: "All notifications marked as read",
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get count of unread notifications for the logged-in user
 */
export const getUnreadNotificationsCount = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const userRole = req.user.role;

    const targetRoles = [userRole, "all"];
    if (userRole === "super_admin") {
      targetRoles.push("admin");
    }

    const query = {
      $or: [
        { recipient: userId, isRead: false },
        {
          recipient: null,
          recipientRole: { $in: targetRoles },
          readBy: { $ne: userId },
        },
      ],
    };

    const unreadCount = await Notification.countDocuments(query);

    res.status(200).json({
      message: "Unread notifications count fetched successfully",
      unreadCount,
    });
  } catch (error) {
    next(error);
  }
};
