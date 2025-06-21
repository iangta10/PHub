const express = require('express');
const router = express.Router();
const admin = require('../../firebase-admin');
const verifyToken = require('../../middleware/verifyToken');

router.get('/personal-page', verifyToken, async (req, res) => {
    const uid = req.user.uid;
    try {
        const doc = await admin.firestore().collection('users').doc(uid).get();
        if (!doc.exists) return res.status(404).json({ error: 'Usuário não encontrado' });
        res.json(doc.data().page || {});
    } catch (err) {
        console.error('Erro ao obter página:', err);
        res.status(500).json({ error: 'Erro ao obter página' });
    }
});

router.put('/personal-page', verifyToken, async (req, res) => {
    const uid = req.user.uid;
    const { slug, displayName, photoUrl, description, planos } = req.body;
    const page = { slug, displayName, photoUrl, description, planos };
    try {
        await admin.firestore().collection('users').doc(uid).set({ page }, { merge: true });
        res.json({ message: 'Página atualizada' });
    } catch (err) {
        console.error('Erro ao salvar página:', err);
        res.status(500).json({ error: 'Erro ao salvar página' });
    }
});

module.exports = router;
