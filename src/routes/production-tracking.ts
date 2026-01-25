import { Router } from "express";
import {
  getProductionTracking,
  createProductionTracking,
  deleteProductionTracking,
  getProductionTrackingHistory,
  deleteProductionTrackingHistory,
  getProductionTrackingStatistics,
  refreshProductionTracking,
} from "../controllers/production-tracking-controller";

const productionTrackingRouter = Router();

productionTrackingRouter.get("/", getProductionTracking);
productionTrackingRouter.post("/", createProductionTracking);
productionTrackingRouter.delete("/:id", deleteProductionTracking);

productionTrackingRouter.get("/history", getProductionTrackingHistory);
productionTrackingRouter.delete("/history/:id", deleteProductionTrackingHistory);

productionTrackingRouter.get("/statistics", getProductionTrackingStatistics);
productionTrackingRouter.post("/refresh", refreshProductionTracking);

export default productionTrackingRouter;
