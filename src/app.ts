// Express app - CORS, JSON body, request ID, rate limit, routes, 404, error handler
import cors from 'cors';
import express from 'express';
import { routes } from './presentation/routes/routes';
import { errorHandlerMiddleware } from './presentation/middlewares/error-handler.middleware';
import { requestIdMiddleware } from './presentation/middlewares/request-id.middleware';
import { rateLimitMiddleware } from './presentation/middlewares/rate-limit.middleware';
import { apiConstants } from './shared/constants/api.constants';
import { STATUS_CODE_NOT_FOUND } from './shared/constants/status-code.constants';
import { EVB404001 } from './shared/constants/error-code.constants';

const app = express();
app.use(cors({
  origin: [
    'http://localhost:3001',
    'http://localhost:3002',
    'http://127.0.0.1:3001',
    'http://127.0.0.1:3002',
    'https://eventix-frontend.vercel.app',
  ],
  credentials: true,
}));
app.use(express.json());
app.use(requestIdMiddleware);
app.use(apiConstants.API_PREFIX, rateLimitMiddleware, routes);

// 404 for unmatched routes - returns JSON instead of default HTML
app.use((req, res) => {
  res.status(STATUS_CODE_NOT_FOUND).json({
    success: false,
    error: {
      code: EVB404001,
      message: 'Route not found. Check the path and ensure required parameters (e.g. event ID, booking ID) are provided.',
      details: { path: req.originalUrl },
    },
  });
});

app.use(errorHandlerMiddleware);

export { app };
