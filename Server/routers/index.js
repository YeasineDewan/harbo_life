import { Router } from "express";
import { AuthRouter } from "./Auth/auth.routes.js";
import { ProductRouter } from "./Product/product.routes.js";
import { CartRouter } from "./Cart/cart.routes.js";
import { OrderRouter } from "./Order/order.routes.js";
import { UserRouter } from "./User/user.routes.js";
import { CategoryRouter } from "./Category/category.routes.js";
import { ReviewRouter } from "./Review/review.routes.js";
import { ChatRouter } from "./Chat/chat.routes.js";
import { NotificationRouter } from "./Notification/notification.routes.js";
import { DashboardRouter } from "./Dashboard/dashboard.routes.js";

const router = Router();

router.use("/user", UserRouter);
router.use("/auth", AuthRouter);
router.use("/products", ProductRouter);
router.use("/cart", CartRouter);
router.use("/order", OrderRouter);
router.use("/categories", CategoryRouter);
router.use("/reviews", ReviewRouter);
router.use("/chat", ChatRouter);
router.use("/notifications", NotificationRouter);
router.use("/dashboard", DashboardRouter);

export { router as ApiRouter };
