const express = require('express');
const router = express.Router();
const admin = require('../../firebase-admin');
const { sendMail } = require('../../services/mailer');
const verifyToken = require('../../middleware/verifyToken');
const requireRole = require('../../middleware/requireRole');

router.use(verifyToken);
router.use(requireRole('personal', 'admin'));

// Criar aluno
router.post('/alunos', async (req, res) => {
    const {
        nome,
        email,
        observacoes,
        aulasPorSemana,
        fotoUrl,
        telefone,
        dataNascimento,
        idade,
        genero,
        sexo,
        objetivo,
        metas,
        prazoMeta,
        motivacao,
        plano,
        inicioPlano,
        vencimentoPlano
    } = req.body;
    const personalId = req.user.uid;

    try {
        const docRef = await admin.firestore()
            .collection('users')
            .doc(personalId)
            .collection('alunos')
            .add({
                nome,
                email,
                observacoes,
                aulasPorSemana: aulasPorSemana || 2,
                fotoUrl: fotoUrl || null,
                telefone: telefone || null,
                dataNascimento: dataNascimento || null,
                idade: (() => {
                    if (idade === undefined || idade === null || idade === '') return null;
                    const idadeNumber = typeof idade === 'number' ? idade : Number(idade);
                    return Number.isNaN(idadeNumber) ? null : idadeNumber;
                })(),
                genero: genero || sexo || null,
                sexo: sexo || genero || null,
                objetivo: objetivo || null,
                metas: metas || null,
                prazoMeta: prazoMeta || null,
                motivacao: motivacao || null,
                plano: plano || null,
                inicioPlano: inicioPlano || null,
                vencimentoPlano: vencimentoPlano || null,
                criadoEm: new Date().toISOString()
            });

        res.status(201).json({ id: docRef.id });
    } catch (err) {
        console.error("Erro ao criar aluno:", err);
        res.status(500).json({ error: "Erro ao criar aluno" });
    }
});

// Listar alunos
router.get('/alunos', async (req, res) => {
    const personalId = req.user.uid;

    try {
        const snapshot = await admin.firestore()
            .collection('users')
            .doc(personalId)
            .collection('alunos')
            .get();

        let alunos = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        const { nome } = req.query;
        if (nome) {
            const search = nome.toLowerCase();
            alunos = alunos.filter(aluno => aluno.nome && aluno.nome.toLowerCase().includes(search));
        }

        res.status(200).json(alunos);
    } catch (err) {
        console.error("Erro ao buscar alunos:", err);
        res.status(500).json({ error: "Erro ao buscar alunos" });
    }
});

// Buscar dados de um aluno especifico
router.get('/alunos/:id', async (req, res) => {
    const personalId = req.user.uid;
    const alunoId = req.params.id;

    try {
        const doc = await admin.firestore()
            .collection('users')
            .doc(personalId)
            .collection('alunos')
            .doc(alunoId)
            .get();

        if (!doc.exists) {
            return res.status(404).json({ error: 'Aluno não encontrado' });
        }

        return res.status(200).json({ id: doc.id, ...doc.data() });
    } catch (err) {
        console.error('Erro ao buscar aluno:', err);
        res.status(500).json({ error: 'Erro ao buscar aluno' });
    }
});

// Atualizar dados de um aluno
router.put('/alunos/:id', async (req, res) => {
    const personalId = req.user.uid;
    const alunoId = req.params.id;
    const {
        nome,
        email,
        observacoes,
        aulasPorSemana,
        fotoUrl,
        telefone,
        dataNascimento,
        idade,
        genero,
        sexo,
        objetivo,
        metas,
        prazoMeta,
        motivacao,
        plano,
        inicioPlano,
        vencimentoPlano
    } = req.body;

    try {
        const alunoRef = admin.firestore()
            .collection('users')
            .doc(personalId)
            .collection('alunos')
            .doc(alunoId);

        const updateData = {};
        if (nome !== undefined) updateData.nome = nome;
        if (email !== undefined) updateData.email = email;
        if (observacoes !== undefined) updateData.observacoes = observacoes;
        if (aulasPorSemana !== undefined) updateData.aulasPorSemana = aulasPorSemana;
        if (fotoUrl !== undefined) updateData.fotoUrl = fotoUrl;
        if (telefone !== undefined) updateData.telefone = telefone;
        if (dataNascimento !== undefined) updateData.dataNascimento = dataNascimento;
        if (idade !== undefined) {
            if (idade === null || idade === '') {
                updateData.idade = null;
            } else {
                const idadeNumber = typeof idade === 'number' ? idade : Number(idade);
                updateData.idade = Number.isNaN(idadeNumber) ? null : idadeNumber;
            }
        }
        if (genero !== undefined) updateData.genero = genero;
        if (sexo !== undefined) {
            updateData.sexo = sexo;
            if (genero === undefined) {
                updateData.genero = sexo;
            }
        }
        if (objetivo !== undefined) updateData.objetivo = objetivo;
        if (metas !== undefined) updateData.metas = metas;
        if (prazoMeta !== undefined) updateData.prazoMeta = prazoMeta;
        if (motivacao !== undefined) updateData.motivacao = motivacao;
        if (plano !== undefined) updateData.plano = plano;
        if (inicioPlano !== undefined) updateData.inicioPlano = inicioPlano;
        if (vencimentoPlano !== undefined) updateData.vencimentoPlano = vencimentoPlano;

        await alunoRef.update(updateData);
        res.status(200).json({ message: 'Aluno atualizado' });
    } catch (err) {
        console.error('Erro ao atualizar aluno:', err);
        res.status(500).json({ error: 'Erro ao atualizar aluno' });
    }
});

// Definir plano de um aluno (após confirmação de pagamento)
router.post('/alunos/:id/plan', async (req, res) => {
    const personalId = req.user.uid;
    const alunoId = req.params.id;
    const { planId, aulasPorSemana } = req.body;

    if (!aulasPorSemana) {
        return res.status(400).json({ error: 'Dados incompletos' });
    }

    try {
        const alunoRef = admin.firestore()
            .collection('users').doc(personalId)
            .collection('alunos').doc(alunoId);
        await alunoRef.set({ planId: planId || null, aulasPorSemana }, { merge: true });
        res.json({ message: 'Plano definido' });
    } catch (err) {
        console.error('Erro ao definir plano:', err);
        res.status(500).json({ error: 'Erro ao definir plano' });
    }
});

// Remover aluno
router.delete('/alunos/:id', async (req, res) => {
    const personalId = req.user.uid;
    const alunoId = req.params.id;

    try {
        await admin.firestore()
            .collection('users')
            .doc(personalId)
            .collection('alunos')
            .doc(alunoId)
            .delete();

        res.status(200).json({ message: 'Aluno removido' });
    } catch (err) {
        console.error('Erro ao remover aluno:', err);
        res.status(500).json({ error: 'Erro ao remover aluno' });
    }
});

router.post('/alunos/:id/reset-password', async (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Acesso restrito ao administrador.' });
    }

    const personalId = req.user.uid;
    const alunoId = req.params.id;

    try {
        const alunoRef = admin.firestore()
            .collection('users')
            .doc(personalId)
            .collection('alunos')
            .doc(alunoId);

        const alunoSnap = await alunoRef.get();
        if (!alunoSnap.exists) {
            return res.status(404).json({ error: 'Aluno não encontrado.' });
        }

        const alunoData = alunoSnap.data() || {};
        const emailRaw = alunoData.email || alunoData.emailAddress || null;
        const email = emailRaw ? String(emailRaw).trim() : '';
        if (!email) {
            return res.status(400).json({ error: 'O aluno não possui e-mail cadastrado.' });
        }

        const continueUrl = process.env.PASSWORD_RESET_REDIRECT_URL || process.env.PASSWORD_RESET_CONTINUE_URL || null;
        const actionSettings = continueUrl ? { url: continueUrl, handleCodeInApp: false } : undefined;
        const resetLink = await admin.auth().generatePasswordResetLink(email, actionSettings);

        let remetenteNome = 'PersonalHub';
        try {
            const personalSnap = await admin.firestore().collection('users').doc(personalId).get();
            if (personalSnap.exists) {
                const personalData = personalSnap.data() || {};
                if (personalData.nome) {
                    remetenteNome = personalData.nome;
                }
            }
        } catch (infoErr) {
            console.warn('Não foi possível carregar dados do usuário para o e-mail de redefinição:', infoErr);
        }

        const alunoNome = alunoData.nome || alunoData.name || 'aluno';
        const subject = 'Redefinição de senha - PersonalHub';
        const text = `Olá ${alunoNome},\n\n${remetenteNome} solicitou o envio deste e-mail para que você possa redefinir a sua senha de acesso ao PersonalHub.\n\nUse o link a seguir para criar uma nova senha:\n${resetLink}\n\nSe você não reconhece esta solicitação, ignore este e-mail.\n\nPersonalHub`;
        const html = `<p>Olá ${alunoNome},</p>`
            + `<p>${remetenteNome} solicitou o envio deste e-mail para que você possa redefinir a sua senha de acesso ao PersonalHub.</p>`
            + `<p><a href="${resetLink}" target="_blank" rel="noopener">Clique aqui para redefinir sua senha</a></p>`
            + `<p>Se você não reconhece esta solicitação, ignore este e-mail.</p>`
            + '<p>PersonalHub</p>';

        const mailSent = await sendMail({ to: email, subject, text, html });
        if (!mailSent) {
            return res.status(503).json({ error: 'Serviço de e-mail não configurado.' });
        }

        return res.json({ message: 'E-mail de redefinição enviado com sucesso.' });
    } catch (err) {
        console.error('Erro ao enviar redefinição de senha para aluno:', err);
        return res.status(500).json({ error: 'Não foi possível enviar o e-mail de redefinição de senha.' });
    }
});

module.exports = router;
