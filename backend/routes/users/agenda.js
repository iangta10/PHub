const express = require('express');
const router = express.Router();
const admin = require('../../firebase-admin');
const verifyToken = require('../../middleware/verifyToken');

// === Disponibilidade ===
router.post('/agenda/disponibilidade', verifyToken, async (req, res) => {
    const personalId = req.user.uid;
    const { diaSemana, dia, inicio, fim } = req.body;

    if ((diaSemana === undefined && !dia) || !inicio || !fim) {
        return res.status(400).json({ error: 'Dados incompletos' });
    }

    try {
        const payload = { inicio, fim };
        if (diaSemana !== undefined) payload.diaSemana = Number(diaSemana);
        if (dia) payload.dia = dia;
        const docRef = await admin.firestore()
            .collection('users').doc(personalId)
            .collection('disponibilidade')
            .add(payload);

        res.status(201).json({ id: docRef.id });
    } catch (err) {
        console.error('Erro ao salvar disponibilidade:', err);
        res.status(500).json({ error: 'Erro ao salvar disponibilidade' });
    }
});

router.get('/agenda/disponibilidade', verifyToken, async (req, res) => {
    const personalId = req.user.uid;
    try {
        const snap = await admin.firestore()
            .collection('users').doc(personalId)
            .collection('disponibilidade').get();
        const itens = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        res.json(itens);
    } catch (err) {
        console.error('Erro ao obter disponibilidade:', err);
        res.status(500).json({ error: 'Erro ao obter disponibilidade' });
    }
});

router.put('/agenda/disponibilidade/:id', verifyToken, async (req, res) => {
    const personalId = req.user.uid;
    const { diaSemana, dia, inicio, fim } = req.body;
    try {
        const payload = { inicio, fim };
        if (diaSemana !== undefined) payload.diaSemana = Number(diaSemana);
        if (dia) payload.dia = dia;
        await admin.firestore()
            .collection('users').doc(personalId)
            .collection('disponibilidade').doc(req.params.id)
            .update(payload);
        res.json({ message: 'Atualizado' });
    } catch (err) {
        console.error('Erro ao atualizar disponibilidade:', err);
        res.status(500).json({ error: 'Erro ao atualizar disponibilidade' });
    }
});

router.delete('/agenda/disponibilidade/:id', verifyToken, async (req, res) => {
    const personalId = req.user.uid;
    try {
        await admin.firestore()
            .collection('users').doc(personalId)
            .collection('disponibilidade').doc(req.params.id)
            .delete();
        res.json({ message: 'Removido' });
    } catch (err) {
        console.error('Erro ao remover disponibilidade:', err);
        res.status(500).json({ error: 'Erro ao remover disponibilidade' });
    }
});

// === Aulas ===
router.post('/agenda/aulas', verifyToken, async (req, res) => {
    let personalId = req.body.personalId || req.user.uid;
    let { alunoId, inicio, fim, alunoNome, alunoEmail } = req.body;

    if (!inicio || !fim) {
        return res.status(400).json({ error: 'Horários inválidos' });
    }

    try {
        const userDoc = await admin.firestore().collection('users').doc(req.user.uid).get();
        const role = userDoc.exists ? userDoc.data().role : 'personal';

        if (role === 'aluno') {
            // busca personal pelo email do aluno
            const snap = await admin.firestore()
                .collectionGroup('alunos')
                .where('email', '==', req.user.email)
                .limit(1)
                .get();
            if (snap.empty) return res.status(404).json({ error: 'Personal não encontrado' });
            const doc = snap.docs[0];
            personalId = doc.ref.parent.parent.id;
            alunoId = doc.id;
            alunoNome = doc.data().nome;
            alunoEmail = req.user.email;
        }

        // Limite de aulas por semana conforme plano do aluno
        let aulasSemana = 2;
        if (alunoId) {
            const alunoDoc = await admin.firestore()
                .collection('users').doc(personalId)
                .collection('alunos').doc(alunoId).get();
            if (alunoDoc.exists && alunoDoc.data().aulasPorSemana) {
                aulasSemana = alunoDoc.data().aulasPorSemana;
            }
        }

        const inicioDate = new Date(inicio);
        const semanaInicio = new Date(inicioDate);
        semanaInicio.setUTCHours(0,0,0,0);
        semanaInicio.setUTCDate(inicioDate.getUTCDate() - inicioDate.getUTCDay());
        const semanaFim = new Date(semanaInicio);
        semanaFim.setUTCDate(semanaFim.getUTCDate() + 7);

        const semanaSnap = await admin.firestore()
            .collection('users').doc(personalId)
            .collection('agenda')
            .where('alunoId', '==', alunoId)
            .where('inicio', '>=', semanaInicio.toISOString())
            .where('inicio', '<', semanaFim.toISOString())
            .get();
        if (semanaSnap.size >= aulasSemana) {
            return res.status(400).json({ error: 'Limite semanal atingido' });
        }

        const docRef = await admin.firestore()
            .collection('users').doc(personalId)
            .collection('agenda').add({
                tipo: 'aula',
                alunoId: alunoId || null,
                alunoNome: alunoNome || null,
                alunoEmail: alunoEmail || null,
                inicio,
                fim,
                status: 'agendada',
                createdAt: new Date().toISOString()
            });
        res.status(201).json({ id: docRef.id });
    } catch (err) {
        console.error('Erro ao agendar aula:', err);
        res.status(500).json({ error: 'Erro ao agendar aula' });
    }
});

router.get('/agenda/aulas', verifyToken, async (req, res) => {
    const { inicio, fim, aluno, incluirOcupado } = req.query;
    const uid = req.user.uid;
    try {
        const userDoc = await admin.firestore().collection('users').doc(uid).get();
        const role = userDoc.exists ? userDoc.data().role : 'personal';

        let query;
        if (role === 'personal') {
            query = admin.firestore().collection('users').doc(uid).collection('agenda');
            if (aluno) query = query.where('alunoId', '==', aluno);
        } else {
            if (incluirOcupado === 'true') {
                const snapPersonal = await admin.firestore()
                    .collectionGroup('alunos')
                    .where('email', '==', req.user.email)
                    .limit(1)
                    .get();
                if (snapPersonal.empty) {
                    return res.status(404).json({ error: 'Personal não encontrado' });
                }
                const personalId = snapPersonal.docs[0].ref.parent.parent.id;
                query = admin.firestore().collection('users').doc(personalId).collection('agenda');
            } else {
                query = admin.firestore().collectionGroup('agenda').where('alunoEmail', '==', req.user.email);
            }
        }
        if (inicio) query = query.where('inicio', '>=', inicio);
        if (fim) query = query.where('inicio', '<=', fim);
        const snap = await query.get();
        let eventos = snap.docs.map(d => ({ id: d.id, personalId: d.ref.parent.parent.id, ...d.data() }));
        if (role === 'aluno' && incluirOcupado === 'true') {
            eventos = eventos.map(ev => {
                if (ev.alunoEmail !== req.user.email) {
                    return {
                        id: ev.id,
                        personalId: ev.personalId,
                        inicio: ev.inicio,
                        fim: ev.fim,
                        tipo: 'ocupado',
                        status: 'ocupado'
                    };
                }
                return ev;
            });
        }
        res.json(eventos);
    } catch (err) {
        console.error('Erro ao listar aulas:', err);
        res.status(500).json({ error: 'Erro ao listar aulas' });
    }
});

router.put('/agenda/aulas/:id', verifyToken, async (req, res) => {
    const uid = req.user.uid;
    const aulaId = req.params.id;
    const { status, feedback } = req.body;

    try {
        const userDoc = await admin.firestore().collection('users').doc(uid).get();
        const role = userDoc.exists ? userDoc.data().role : 'personal';

        let docRef;
        if (role === 'personal') {
            docRef = admin.firestore().collection('users').doc(uid).collection('agenda').doc(aulaId);
        } else {
            const snap = await admin.firestore()
                .collectionGroup('agenda')
                .where('alunoEmail', '==', req.user.email)
                .where(admin.firestore.FieldPath.documentId(), '==', aulaId)
                .limit(1)
                .get();
            if (snap.empty) return res.status(404).json({ error: 'Aula não encontrada' });
            docRef = snap.docs[0].ref;
        }
        const doc = await docRef.get();
        if (!doc.exists) return res.status(404).json({ error: 'Aula não encontrada' });

        if (role === 'aluno' && status === 'cancelada') {
            const inicioAula = new Date(doc.data().inicio);
            if (Date.now() > inicioAula.getTime() - 2 * 60 * 60 * 1000) {
                return res.status(400).json({ error: 'Só é possível cancelar com 2h de antecedência' });
            }
        }

        const update = {};
        if (status) update.status = status;
        if (feedback !== undefined) update.feedback = feedback;
        update.updatedAt = new Date().toISOString();
        await docRef.update(update);
        res.json({ message: 'Atualizado' });
    } catch (err) {
        console.error('Erro ao atualizar aula:', err);
        res.status(500).json({ error: 'Erro ao atualizar aula' });
    }
});

module.exports = router;
