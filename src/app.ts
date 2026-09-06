import express from 'express';
import morgan from 'morgan';
import usersRouter from './routes/users';
import authRouter from './routes/auth';
import listUsersRouter from './routes/list-users';
import { register, httpRequestsTotal, httpRequestDurationSeconds } from './metrics';

const app = express();

app.use(express.json());
app.use(morgan('combined'));

// RED instrumentation — records every request's route/status/duration.
// req.route isn't set yet at this point in the middleware chain, so it's read
// on 'finish' (after routing has resolved) rather than up front.
app.use((req, res, next) => {
  const start = process.hrtime.bigint();
  res.on('finish', () => {
    const route = req.route?.path ?? req.path;
    const labels = { method: req.method, route, status: String(res.statusCode) };
    httpRequestsTotal.inc(labels);
    const durationSeconds = Number(process.hrtime.bigint() - start) / 1e9;
    httpRequestDurationSeconds.observe(labels, durationSeconds);
  });
  next();
});

app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok', service: 'user-service' });
});

app.get('/metrics', async (_req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

// TEMPORARY — Day 31 Q6, re-triggering a failure after the EC2 reboot cleared
// the previous one. Remove once the Errors + Logs panels are re-verified.
app.get('/debug/fail', (_req, res) => {
  console.error('Induced failure for RED dashboard verification (Q6 logs check)');
  res.status(500).json({ error: 'induced failure for RED dashboard verification' });
});

app.use('/users', usersRouter);
app.use('/auth', authRouter);
app.use('/users', listUsersRouter);

export default app;
