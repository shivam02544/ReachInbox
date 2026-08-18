import express, { Application } from 'express';
import cors from 'cors';
import healthRouter from './routes/health';
import { notFoundHandler, globalErrorHandler } from './middleware/errorHandler';

const app: Application = express();

// Standard middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health routes
app.use('/', healthRouter);

// Error handling middleware
app.use(notFoundHandler);
app.use(globalErrorHandler);

export default app;
