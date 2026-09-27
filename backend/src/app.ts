import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { config } from './config';
import apiRoutes from './routes/api.routes';
import { initBot } from './bot/bot';

dotenv.config();

const app = express();

app.use(cors({
  origin: 'http://localhost:5173',
}));

app.use(express.json());

// Routes
app.use('/api/v1', apiRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Centralized error handling
app.use(
  (
    err: any,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Internal Server Error' });
  }
);

const PORT = config.port;

app.listen(PORT, () => {
  console.log(`Backend API running on port ${PORT}`);
  initBot();
});
