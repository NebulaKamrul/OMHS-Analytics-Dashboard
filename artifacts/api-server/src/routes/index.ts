import { Router, type IRouter } from "express";
import healthRouter from "./health";
import dashboardRouter from "./dashboard";
import departmentsRouter from "./departments";

const router: IRouter = Router();

router.use(healthRouter);
router.use(departmentsRouter);
router.use(dashboardRouter);

export default router;
