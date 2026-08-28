import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import authRouter from "./auth.js";
import providersRouter from "./providers.js";
import bookingPagesRouter from "./booking-pages.js";
import bookingsRouter from "./bookings.js";
import rescheduleRouter from "./reschedule.js";
import reviewsRouter from "./reviews.js";
import invoicesRouter from "./invoices.js";
import notificationsRouter from "./notifications.js";
import adminRouter from "./admin.js";
import supportRouter from "./support.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/auth", authRouter);
router.use("/providers", providersRouter);
router.use("/booking-pages", bookingPagesRouter);
router.use(rescheduleRouter);
router.use("/bookings", bookingsRouter);
router.use("/reviews", reviewsRouter);
router.use("/invoices", invoicesRouter);
router.use("/notifications", notificationsRouter);
router.use("/admin", adminRouter);
router.use("/support", supportRouter);

export default router;
