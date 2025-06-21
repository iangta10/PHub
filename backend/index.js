const path = require('path');
// Carrega variáveis de ambiente do .env na raiz do projeto
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
// Carrega variáveis de ambiente específicas do backend, se existirem
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const app = express();
const userRoutes = require('./routes');

app.use(cors());
app.use(express.json());
app.use('/', userRoutes);

module.exports = app;

if (require.main === module) {
    app.listen(3000, () => {
        console.log('Servidor rodando na porta 3000');
    });
}
