// Routes/ChartRoute.js
import express from 'express';
import { getChartData } from '../Controllers/ChartController.js';

const router = express.Router();
router.get('/getChartData', getChartData);

export default router;
