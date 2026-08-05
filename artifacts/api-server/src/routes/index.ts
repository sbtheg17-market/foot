import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import authRouter from "./auth.js";
import providersRouter from "./providers.js";
import bookingsRouter from "./bookings.js";
import reviewsRouter from "./reviews.js";
import invoicesRouter from "./invoices.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/auth", authRouter);
router.use("/providers", providersRouter);
router.use("/bookings", bookingsRouter);
router.use("/reviews", reviewsRouter);
router.use("/invoices", invoicesRouter);

export default router;
