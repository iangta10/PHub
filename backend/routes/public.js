const express = require('express');
const router = express.Router();
const admin = require('../firebase-admin');

router.get('/personal/:slug', async (req, res) => {
    const { slug } = req.params;
    try {
        const snap = await admin.firestore()
            .collection('users')
            .where('page.slug', '==', slug)
            .limit(1)
            .get();
        if (snap.empty) return res.status(404).json({ error: 'Personal não encontrado' });
        const page = snap.docs[0].data().page || {};
        res.json(page);
    } catch (err) {
        console.error('Erro ao buscar página pública:', err);
        res.status(500).json({ error: 'Erro ao buscar página' });
    }
});

module.exports = router;
