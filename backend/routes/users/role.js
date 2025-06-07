const express = require('express');
const router = express.Router();
const admin = require('../../firebase-admin');
const verifyToken = require('../../middleware/verifyToken');

router.get('/role', verifyToken, async (req, res) => {
    try {
        const doc = await admin.firestore().collection('users').doc(req.user.uid).get();
        if (!doc.exists) return res.status(404).json({ error: 'Usuário não encontrado' });

        const userData = doc.data();
        return res.status(200).json({ role: userData.role });
    } catch (err) {
        return res.status(500).json({ error: 'Erro ao buscar role do usuário' });
    }
});

module.exports = router;
