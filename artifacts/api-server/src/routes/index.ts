import { Router, type IRouter } from "express";
import healthRouter from "./health";
import analyticsRouter from "./analytics";
import filtersRouter from "./filters";

const router: IRouter = Router();

router.use(healthRouter);
router.use(filtersRouter);
router.use(analyticsRouter);

export default router;
