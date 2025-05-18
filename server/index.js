import express from 'express';
import morgan from 'morgan';
import { PORT } from './config/config.js';

const app = express();
app.use(morgan('dev'));

app.use(express.json());
app.use(express.static('public'));

app.listen(PORT, () => {
    console.log(`🚀 Servidor corriendo en http://localhost:${PORT} 🚀`);
}) 