import express, { Application } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { config } from './config/env';
import { configurePassport } from './config/passport';
import healthRouter from './routes/health';
import emailRouter from './routes/email.routes';
import authRouter from './routes/auth.routes';
import { notFoundHandler, globalErrorHandler } from './middleware/errorHandler';

const app: Application = express();

// Initialize Passport.js
const passport = configurePassport();

// Standard middleware
app.use(
  cors({
    origin: config.frontendUrl,
    credentials: true,
  })
);
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(passport.initialize());

// Core API Routes
app.use('/', healthRouter);
app.use('/api/auth', authRouter);
app.use('/api/emails', emailRouter);
app.use('/api/senders', emailRouter);

// Error handling middleware
app.use(notFoundHandler);
app.use(globalErrorHandler);

export default app;
