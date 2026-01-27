const express = require('express');
const router = express.Router();
const admin = require('../../firebase-admin');
const verifyToken = require('../../middleware/verifyToken');

router.get('/me', verifyToken, async (req, res) => {
    try {
        const userRef = admin.firestore().collection('users').doc(req.user.uid);
        const doc = await userRef.get();

        if (!doc.exists) {
            const email = req.user.email ? String(req.user.email).trim() : '';
            const emailLower = email.toLowerCase();
            if (emailLower) {
                let alunoSnap = await admin.firestore()
                    .collectionGroup('alunos')
                    .where('email', '==', email)
                    .limit(1)
                    .get();

                if (alunoSnap.empty) {
                    alunoSnap = await admin.firestore()
                        .collectionGroup('alunos')
                        .where('emailLowerCase', '==', emailLower)
                        .limit(1)
                        .get();
                }

                if (!alunoSnap.empty) {
                    const alunoDoc = alunoSnap.docs[0];
                    const alunoData = alunoDoc.data() || {};
                    const personalId = alunoDoc.ref.parent.parent ? alunoDoc.ref.parent.parent.id : null;
                    const now = new Date().toISOString();
                    const userPayload = {
                        email: alunoData.email || email,
                        role: 'aluno',
                        personalId,
                        nome: alunoData.nome || alunoData.name || '',
                        aulasPorSemana: alunoData.aulasPorSemana ?? null,
                        createdAt: now
                    };

                    await userRef.set(userPayload, { merge: true });
                    return res.json({ ...alunoData, ...userPayload });
                }
            }

            return res.status(404).json({ message: 'Usuário não encontrado' });
        }

        return res.json(doc.data());
    } catch (error) {
        console.error('Erro ao buscar usuário:', error);
        return res.status(500).json({ message: 'Erro interno ao buscar usuário' });
    }
});

module.exports = router;
