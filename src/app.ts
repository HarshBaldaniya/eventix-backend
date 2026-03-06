// Express app setup
import express from 'express';
import { routes } from './presentation/routes/routes';
import { errorHandlerMiddleware } from './presentation/middlewares/error-handler.middleware';
import { requestIdMiddleware } from './presentation/middlewares/request-id.middleware';
import { apiConstants } from './shared/constants/api.constants';

const app = express();
app.use(express.json());
app.use(requestIdMiddleware);
app.use(apiConstants.API_PREFIX, routes);
app.use(errorHandlerMiddleware);

export { app };
