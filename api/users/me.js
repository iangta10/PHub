const admin = require('../../backend/firebase-admin');
const verifyToken = require('../../backend/middleware/verifyToken');

module.exports = async (req, res) => {
    await verifyToken(req, res, async () => {
        try {
            const userRef = admin.firestore().collection('users').doc(req.user.uid);
            const doc = await userRef.get();

            if (!doc.exists) {
                return res.status(404).json({ message: 'Usuário não encontrado' });
            }

            return res.json(doc.data());
        } catch (error) {
            console.error('Erro ao buscar usuário:', error);
            return res.status(500).json({ message: 'Erro interno ao buscar usuário' });
        }
    });
};
