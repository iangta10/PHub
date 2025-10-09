const express = require('express');
const router = express.Router();
const admin = require('../../firebase-admin');
const verifyToken = require('../../middleware/verifyToken');
const requireRole = require('../../middleware/requireRole');

router.use(verifyToken);
router.use(requireRole('personal', 'admin'));

function getAlunoRef(personalId, alunoId) {
    return admin.firestore()
        .collection('users').doc(personalId)
        .collection('alunos').doc(alunoId);
}

async function recomputeResumo(personalId, alunoId) {
    const alunoRef = getAlunoRef(personalId, alunoId);
    const avaliacoesSnap = await alunoRef.collection('avaliacoes')
        .orderBy('createdAt', 'desc')
        .get();

    let lastEvaluationAt = null;
    let nextEvaluationAt = null;
    let hasDraftEvaluation = false;

    avaliacoesSnap.forEach(doc => {
        const data = doc.data();
        const status = (data.status || '').toString().toLowerCase();
        if (!hasDraftEvaluation && status === 'draft') {
            hasDraftEvaluation = true;
        }
        if (!lastEvaluationAt && status === 'completed') {
            lastEvaluationAt = data.completedAt || data.createdAt || null;
            nextEvaluationAt = data.nextEvaluationAt || null;
        }
        if (!nextEvaluationAt && data.nextEvaluationAt) {
            nextEvaluationAt = data.nextEvaluationAt;
        }
    });

    await alunoRef.set({
        lastEvaluationAt: lastEvaluationAt || null,
        nextEvaluationAt: nextEvaluationAt || null,
        hasDraftEvaluation
    }, { merge: true });

    return { lastEvaluationAt, nextEvaluationAt, hasDraftEvaluation };
}

function serializeSnapshot(snapshot) {
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

router.post('/alunos/:alunoId/avaliacoes', async (req, res) => {
    const personalId = req.user.uid;
    const { alunoId } = req.params;
    const alunoRef = getAlunoRef(personalId, alunoId);

    const now = new Date().toISOString();
    const status = (req.body?.status || 'draft').toString().toLowerCase();
    const startedAt = req.body?.startedAt || now;
    const nextEvaluationAt = req.body?.nextEvaluationAt || null;
    const completedAtInput = req.body?.completedAt || null;
    const sections = req.body?.sections && typeof req.body.sections === 'object' && !Array.isArray(req.body.sections)
        ? req.body.sections
        : {};

    const data = {
        status,
        createdAt: now,
        updatedAt: now,
        startedAt,
        nextEvaluationAt,
        completedAt: status === 'completed' ? (completedAtInput || now) : null,
        sections
    };

    try {
        const docRef = await alunoRef.collection('avaliacoes').add(data);
        const doc = await docRef.get();
        const payload = { id: doc.id, ...doc.data() };
        await recomputeResumo(personalId, alunoId);
        res.status(201).json(payload);
    } catch (err) {
        console.error('Erro ao criar avaliação:', err);
        res.status(500).json({ error: 'Erro ao criar avaliação' });
    }
});

router.get('/alunos/:alunoId/avaliacoes', async (req, res) => {
    const personalId = req.user.uid;
    const { alunoId } = req.params;
    let query = getAlunoRef(personalId, alunoId).collection('avaliacoes');

    const status = req.query?.status;
    const limitRaw = req.query?.limit;

    if (status) {
        query = query.where('status', '==', status.toString().toLowerCase());
    }

    query = query.orderBy('createdAt', 'desc');

    if (limitRaw) {
        const limit = Number(limitRaw);
        if (!Number.isNaN(limit) && limit > 0) {
            query = query.limit(limit);
        }
    }

    try {
        const snapshot = await query.get();
        res.json(serializeSnapshot(snapshot));
    } catch (err) {
        console.error('Erro ao listar avaliações:', err);
        res.status(500).json({ error: 'Erro ao listar avaliações' });
    }
});

router.get('/alunos/:alunoId/avaliacoes/:avaliacaoId', async (req, res) => {
    const personalId = req.user.uid;
    const { alunoId, avaliacaoId } = req.params;

    try {
        const doc = await getAlunoRef(personalId, alunoId)
            .collection('avaliacoes')
            .doc(avaliacaoId)
            .get();

        if (!doc.exists) {
            return res.status(404).json({ error: 'Avaliação não encontrada' });
        }

        res.json({ id: doc.id, ...doc.data() });
    } catch (err) {
        console.error('Erro ao obter avaliação:', err);
        res.status(500).json({ error: 'Erro ao obter avaliação' });
    }
});

router.patch('/alunos/:alunoId/avaliacoes/:avaliacaoId', async (req, res) => {
    const personalId = req.user.uid;
    const { alunoId, avaliacaoId } = req.params;

    const updateData = {};
    const body = req.body || {};

    if (body.status !== undefined) {
        updateData.status = body.status.toString().toLowerCase();
    }
    if (body.startedAt !== undefined) {
        updateData.startedAt = body.startedAt || null;
    }
    if (body.nextEvaluationAt !== undefined) {
        updateData.nextEvaluationAt = body.nextEvaluationAt || null;
    }
    if (body.completedAt !== undefined) {
        updateData.completedAt = body.completedAt || null;
    }
    if (body.sections && typeof body.sections === 'object' && !Array.isArray(body.sections)) {
        Object.keys(body.sections).forEach(section => {
            updateData[`sections.${section}`] = body.sections[section];
        });
    }

    updateData.updatedAt = new Date().toISOString();

    if (updateData.status === 'completed' && !updateData.completedAt) {
        updateData.completedAt = updateData.updatedAt;
    }

    try {
        const docRef = getAlunoRef(personalId, alunoId)
            .collection('avaliacoes')
            .doc(avaliacaoId);

        await docRef.set(updateData, { merge: true });
        const doc = await docRef.get();
        const payload = { id: doc.id, ...doc.data() };
        await recomputeResumo(personalId, alunoId);
        res.json(payload);
    } catch (err) {
        console.error('Erro ao atualizar avaliação:', err);
        res.status(500).json({ error: 'Erro ao atualizar avaliação' });
    }
});

router.put('/alunos/:alunoId/avaliacoes/:avaliacaoId/sections/:sectionId', async (req, res) => {
    const personalId = req.user.uid;
    const { alunoId, avaliacaoId, sectionId } = req.params;
    const { data } = req.body || {};

    if (data === undefined || data === null || typeof data !== 'object' || Array.isArray(data)) {
        return res.status(400).json({ error: 'Dados inválidos para a seção' });
    }

    const now = new Date().toISOString();

    try {
        const docRef = getAlunoRef(personalId, alunoId)
            .collection('avaliacoes')
            .doc(avaliacaoId);

        const snapshot = await docRef.get();
        if (!snapshot.exists) {
            return res.status(404).json({ error: 'Avaliação não encontrada' });
        }

        const existingData = snapshot.data() || {};
        const existingSections = existingData.sections && typeof existingData.sections === 'object' && !Array.isArray(existingData.sections)
            ? existingData.sections
            : {};

        const sections = { ...existingSections, [sectionId]: data };

        await docRef.set({
            updatedAt: now,
            sections
        }, { merge: true });

        const updated = await docRef.get();
        res.json({ id: updated.id, ...updated.data() });
    } catch (err) {
        console.error('Erro ao salvar seção da avaliação:', err);
        res.status(500).json({ error: 'Erro ao salvar seção da avaliação' });
    }
});

router.delete('/alunos/:alunoId/avaliacoes/:avaliacaoId', async (req, res) => {
    const personalId = req.user.uid;
    const { alunoId, avaliacaoId } = req.params;

    try {
        await getAlunoRef(personalId, alunoId)
            .collection('avaliacoes')
            .doc(avaliacaoId)
            .delete();

        await recomputeResumo(personalId, alunoId);
        res.json({ message: 'Avaliação removida' });
    } catch (err) {
        console.error('Erro ao remover avaliação:', err);
        res.status(500).json({ error: 'Erro ao remover avaliação' });
    }
});

module.exports = router;
