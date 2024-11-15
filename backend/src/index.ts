import express from 'express';
const userRoutes = require('./routes/user.routes');
const workerRoutes = require('./routes/worker.routes');

const app = express();

app.use(express.json());
app.use('/v1/user', userRoutes);
app.use('/v1/worker', workerRoutes);


app.listen(3000, () => {
    console.log("Server running...");
});