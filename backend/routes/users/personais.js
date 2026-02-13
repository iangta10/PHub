const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const admin = require('../../firebase-admin');
const verifyToken = require('../../middleware/verifyToken');
const requireRole = require('../../middleware/requireRole');

function normalizeEmail(email) {
    return String(email || '').trim().toLowerCase();
}

function generatePassword(length = 12) {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%*';
    const bytes = crypto.randomBytes(length);
    let out = '';
    for (let i = 0; i < length; i++) {
        out += alphabet[bytes[i] % alphabet.length];
    }
    return out;
}

function sanitizePersonal(doc) {
    const data = doc.data() || {};
    return {
        id: doc.id,
        nome: data.nome || '',
        email: data.email || '',
        username: data.username || '',
        createdAt: data.createdAt || null,
        updatedAt: data.updatedAt || null
    };
}

router.get('/personais', verifyToken, requireRole('admin'), async (req, res) => {
    try {
        const snap = await admin.firestore().collection('users').where('role', '==', 'personal').get();
        const personals = snap.docs
            .map(sanitizePersonal)
            .sort((a, b) => (a.nome || a.email).localeCompare(b.nome || b.email, 'pt-BR'));
        return res.status(200).json(personals);
    } catch (error) {
        console.error('Erro ao listar personais:', error);
        return res.status(500).json({ message: 'Erro ao listar personais' });
    }
});

router.post('/personais', verifyToken, requireRole('admin'), async (req, res) => {
    const email = normalizeEmail(req.body.email);
    const nome = String(req.body.nome || '').trim();
    const username = String(req.body.username || '').trim();

    if (!email || !nome) {
        return res.status(400).json({ message: 'Nome e email são obrigatórios' });
    }

    const password = generatePassword();
    const now = new Date().toISOString();

    try {
        const authUser = await admin.auth().createUser({
            email,
            password,
            displayName: nome
        });

        await admin.auth().setCustomUserClaims(authUser.uid, { role: 'personal' });

        await admin.firestore().collection('users').doc(authUser.uid).set({
            nome,
            email,
            emailLowerCase: email,
            username: username || 'personal',
            role: 'personal',
            createdAt: now,
            updatedAt: now
        });

        return res.status(201).json({
            id: authUser.uid,
            nome,
            email,
            username: username || 'personal',
            password
        });
    } catch (error) {
        console.error('Erro ao criar personal:', error);
        return res.status(500).json({ message: 'Erro ao criar personal' });
    }
});

router.put('/personais/:id', verifyToken, requireRole('admin'), async (req, res) => {
    const personalId = req.params.id;
    const email = normalizeEmail(req.body.email);
    const nome = String(req.body.nome || '').trim();
    const username = String(req.body.username || '').trim();

    if (!email || !nome) {
        return res.status(400).json({ message: 'Nome e email são obrigatórios' });
    }

    try {
        const ref = admin.firestore().collection('users').doc(personalId);
        const doc = await ref.get();
        if (!doc.exists || doc.data().role !== 'personal') {
            return res.status(404).json({ message: 'Personal não encontrado' });
        }

        await admin.auth().updateUser(personalId, {
            email,
            displayName: nome
        });

        await ref.update({
            nome,
            email,
            emailLowerCase: email,
            username: username || 'personal',
            updatedAt: new Date().toISOString()
        });

        return res.status(200).json({ message: 'Personal atualizado com sucesso' });
    } catch (error) {
        console.error('Erro ao atualizar personal:', error);
        return res.status(500).json({ message: 'Erro ao atualizar personal' });
    }
});

router.delete('/personais/:id', verifyToken, requireRole('admin'), async (req, res) => {
    const personalId = req.params.id;

    try {
        const ref = admin.firestore().collection('users').doc(personalId);
        const doc = await ref.get();
        if (!doc.exists || doc.data().role !== 'personal') {
            return res.status(404).json({ message: 'Personal não encontrado' });
        }

        await ref.delete();
        await admin.auth().deleteUser(personalId);

        return res.status(200).json({ message: 'Personal removido com sucesso' });
    } catch (error) {
        console.error('Erro ao remover personal:', error);
        return res.status(500).json({ message: 'Erro ao remover personal' });
    }
});

module.exports = router;
