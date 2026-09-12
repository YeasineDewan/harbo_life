import Notification from "../models/Notification/notification.model.js";


export const createNotification = async (notificationData) => {
  try {
    const {
      title,
      message,
      type = "general",
      recipient = null,
      recipientRole = "all",
      metadata = null,
    } = notificationData;

    const notification = new Notification({
      title,
      message,
      type,
      recipient,
      recipientRole,
      metadata,
    });

    await notification.save();
    return notification;
  } catch (error) {
    console.error("Error in createNotification service:", error);
    throw error;
  }
};

/**
 * Check if a product's stock is low (<= 5) and trigger a notification if it is.
 * To avoid duplicate notifications for the exact same stock level, we check for
 * existing notifications.
 */
export const checkAndNotifyLowStock = async (product) => {
  try {
    if (product.stock <= 5) {
      // Avoid sending duplicate alerts for the exact same product stock level
      const existingNotification = await Notification.findOne({
        type: "low_stock",
        "metadata.productId": product._id.toString(),
        "metadata.stock": product.stock,
      });

      if (!existingNotification) {
        await createNotification({
          title: "Low Stock Alert ⚠️",
          message: `Product "${product.name}" is running low on stock! Only ${product.stock} left in inventory.`,
          type: "low_stock",
          recipient: null,
          recipientRole: "admin", // Target administrators
          metadata: {
            productId: product._id,
            productName: product.name,
            stock: product.stock,
          },
        });
      }
    }
  } catch (error) {
    console.error(`Error checking low stock for product ${product._id}:`, error);
  }
};
