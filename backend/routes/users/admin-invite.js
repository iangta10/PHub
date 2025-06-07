const express = require('express');
const router = express.Router();
const admin = require('../../firebase-admin');
const verifyToken = require('../../middleware/verifyToken');

router.post('/admin-invites', verifyToken, async (req, res) => {
    try {
        const userDoc = await admin.firestore().collection('users').doc(req.user.uid).get();
        if (!userDoc.exists || userDoc.data().role !== 'admin') {
            return res.status(403).json({ message: 'Apenas admins podem criar convites' });
        }

        const code = Math.random().toString(36).substring(2, 8);
        await admin.firestore().collection('adminInvites').doc(code).set({
            createdBy: req.user.uid,
            createdAt: new Date().toISOString(),
            used: false
        });

        res.status(200).json({ code });
    } catch (err) {
        console.error('Erro ao criar convite de admin:', err);
        res.status(500).json({ message: 'Erro ao criar convite de admin' });
    }
});

module.exports = router;
