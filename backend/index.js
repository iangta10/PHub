require('dotenv').config();
const express = require('express');
const cors = require('cors');
const app = express();
const userRoutes = require('./routes');

app.use(cors());
app.use(express.json());
app.use('/', userRoutes);

app.listen(3000, () => {
    console.log('Servidor rodando na porta 3000');
});
