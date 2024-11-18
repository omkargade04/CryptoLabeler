import express from 'express';
import cors from 'cors';

const userRoutes = require('./routes/user.routes');
const workerRoutes = require('./routes/worker.routes');

const app = express();

app.use(express.json());
app.use(cors());

app.use('/v1/user', userRoutes);
app.use('/v1/worker', workerRoutes);


app.listen(8000, () => {
    console.log("Server running...");
});