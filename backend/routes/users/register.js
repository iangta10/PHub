const express = require('express');
const router = express.Router();
const admin = require('../../firebase-admin');
const verifyToken = require('../../middleware/verifyToken');

router.post('/register', verifyToken, async (req, res) => {
    const { email, username, tipo, codigo, nome, personalSlug, aulasPorSemana } = req.body;
    const uid = req.user.uid;

    if (!email || !tipo) {
        return res.status(400).json({ message: "Campos obrigatórios ausentes" });
    }

    try {
        if (tipo === 'personal') {
            if (!codigo || codigo !== '1234') {
                return res.status(403).json({
                    message: 'Código inválido. Redirecionando para pagamento...',
                    redirect: 'https://example.com/pagamento'
                });
            }

            await admin.firestore().collection('users').doc(uid).set({
                email,
                username: username || "personal",
                role: 'personal',
                createdAt: new Date().toISOString()
            });

            return res.status(200).json({ message: "Personal registrado" });
        }

        if (tipo === 'admin') {
            if (!codigo) {
                return res.status(403).json({ message: 'Código de admin obrigatório' });
            }

            const inviteDoc = await admin.firestore().collection('adminInvites').doc(codigo).get();
            if (!inviteDoc.exists || inviteDoc.data().used) {
                return res.status(403).json({ message: 'Código de admin inválido' });
            }

            await admin.firestore().collection('users').doc(uid).set({
                email,
                username: username || 'admin',
                role: 'admin',
                createdAt: new Date().toISOString()
            });

            await inviteDoc.ref.update({ used: true, usedBy: uid, usedAt: new Date().toISOString() });

            return res.status(200).json({ message: 'Admin registrado' });
        }

        if (tipo === 'aluno') {
            if (personalSlug) {
                const snap = await admin.firestore()
                    .collection('users')
                    .where('page.slug', '==', personalSlug)
                    .limit(1)
                    .get();
                if (snap.empty) {
                    return res.status(404).json({ message: 'Personal não encontrado' });
                }
                const personalId = snap.docs[0].id;
                const now = new Date().toISOString();
                await admin.firestore().collection('users').doc(uid).set({
                    email,
                    emailLowerCase: String(email).toLowerCase(),
                    role: 'aluno',
                    personalId,
                    aulasPorSemana: aulasPorSemana ? parseInt(aulasPorSemana) : 1,
                    nome: nome || '',
                    createdAt: now
                });
                await admin.firestore().collection('users').doc(personalId)
                    .collection('alunos').doc(uid).set({
                        nome: nome || '',
                        email,
                        emailLowerCase: String(email).toLowerCase(),
                        aulasPorSemana: aulasPorSemana ? parseInt(aulasPorSemana) : 1,
                        criadoEm: now
                    });
                return res.status(200).json({ message: 'Aluno registrado com sucesso' });
            }

            const snapshot = await admin.firestore()
                .collectionGroup('alunos')
                .where('email', '==', email)
                .where('nome', '!=', null)
                .limit(1)
                .get();

            if (snapshot.empty) {
                return res.status(403).json({
                    message: "Este email não foi pré-cadastrado por nenhum personal."
                });
            }

            await admin.firestore().collection('users').doc(uid).set({
                email,
                role: 'aluno',
                createdAt: new Date().toISOString()
            });

            return res.status(200).json({ message: "Aluno registrado com sucesso" });
        }

        return res.status(400).json({ message: "Tipo de usuário inválido." });

    } catch (err) {
        console.error('Erro ao salvar usuário:', err);
        return res.status(500).json({ message: 'Erro interno ao salvar usuário' });
    }
});




module.exports = router;
