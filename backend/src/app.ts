import express, { Application } from 'express';
import cors from 'cors';
import healthRouter from './routes/health';
import emailRouter from './routes/email.routes';
import { notFoundHandler, globalErrorHandler } from './middleware/errorHandler';

const app: Application = express();

// Standard middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Core API Routes
app.use('/', healthRouter);
app.use('/api/emails', emailRouter);

// Error handling middleware
app.use(notFoundHandler);
app.use(globalErrorHandler);

export default app;
