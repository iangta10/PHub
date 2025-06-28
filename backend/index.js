const path = require('path');
// Carrega variáveis de ambiente do .env na raiz do projeto
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
// Carrega variáveis de ambiente específicas do backend, se existirem
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const app = express();
const userRoutes = require('./routes');

app.use(helmet());
const allowedOrigin = process.env.ALLOWED_ORIGIN || '*';
app.use(cors({ origin: allowedOrigin }));
app.use(express.json());
// Mount all application routes under the /api prefix so that
// requests like /api/users/me resolve correctly in all
// environments (local and Vercel).
app.use('/api', userRoutes);

module.exports = app;

if (require.main === module) {
    app.listen(3000, () => {
        console.log('Servidor rodando na porta 3000');
    });
}
