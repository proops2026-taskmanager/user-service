import express from 'express';
import morgan from 'morgan';
import usersRouter from './routes/users';

const app = express();

app.use(express.json());
app.use(morgan('combined'));

app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok', service: 'user-service' });
});

app.use('/users', usersRouter);

export default app;
