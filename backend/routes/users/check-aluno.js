const express = require('express');
const router = express.Router();
const admin = require('../../firebase-admin');

router.post('/check-aluno', async (req, res) => {
    const { email } = req.body;

    if (!email) {
        return res.status(400).json({ message: "Email não fornecido" });
    }

    try {
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

        return res.status(200).json({ ok: true });

    } catch (err) {
        console.error('Erro na verificação de email:', err);
        return res.status(500).json({ message: "Erro ao verificar email" });
    }
});

module.exports = router;
