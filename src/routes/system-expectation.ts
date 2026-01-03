import { Router } from "express";
import { createWorkOrder, deleteWorkOrder, getAlarmLogDetailByIdAndCode, getWorkOrders } from "../controllers/alarm-error-logs-controller";

const systemExpectationRouter = Router();

systemExpectationRouter.get("/alarm-error-logs/alarm-detail", getAlarmLogDetailByIdAndCode);
systemExpectationRouter.post("/alarm-error-logs/work-order", createWorkOrder);
systemExpectationRouter.get("/alarm-error-logs/work-order", getWorkOrders);
systemExpectationRouter.delete("/alarm-error-logs/work-order/:workOrderId", deleteWorkOrder);

export default systemExpectationRouter;
