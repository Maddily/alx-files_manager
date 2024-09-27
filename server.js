import express from 'express';
import router from './routes/index';

const app = express();
const port = process.env.PORT || 5000;

app.use(express.json({ limit: '10mb' }));
app.use(router);

app.listen(port, () => console.log('The server is running...'));

export default app;
