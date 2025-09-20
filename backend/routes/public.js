const express = require('express');
const router = express.Router();
const admin = require('../firebase-admin');
const { sendMail } = require('../services/mailer');

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

router.post('/anamnese-forms', async (req, res) => {
    const {
        personalId,
        formType,
        nome,
        email,
        telefone,
        dataNascimento,
        horarioPreferido,
        preferenciaContato,
        objetivo,
        experiencia,
        restricoes,
        medicamentos,
        disponibilidade,
        alimentacaoAtual,
        restricoesAlimentares,
        observacoes
    } = req.body || {};

    const sanitize = (value) => typeof value === 'string' ? value.trim() : value;
    const optional = (value) => {
        const sanitized = sanitize(value);
        return sanitized ? sanitized : null;
    };

    const normalizedPersonalId = sanitize(personalId);
    const sanitizedNome = sanitize(nome);
    const sanitizedEmail = sanitize(email);
    const sanitizedEmailLower = sanitizedEmail ? sanitizedEmail.toLowerCase() : null;

    if (!normalizedPersonalId || !sanitizedNome || !sanitizedEmail) {
        return res.status(400).json({ error: 'Dados obrigatórios não informados.' });
    }

    const allowedTypes = new Set(['apenas-treino', 'dieta-treino']);
    const normalizedType = allowedTypes.has(formType) ? formType : 'apenas-treino';

    try {
        const personalRef = admin.firestore().collection('users').doc(normalizedPersonalId);
        const personalSnap = await personalRef.get();

        if (!personalSnap.exists) {
            return res.status(404).json({ error: 'Personal não encontrado.' });
        }

        const timestamp = new Date().toISOString();
        const alunosRef = personalRef.collection('alunos');

        let alunoRef = null;
        let isNew = true;

        let existingDoc = null;
        if (sanitizedEmail) {
            const existing = await alunosRef.where('email', '==', sanitizedEmail).limit(1).get();
            if (!existing.empty) {
                existingDoc = existing.docs[0];
            } else if (sanitizedEmailLower) {
                const existingLower = await alunosRef.where('emailLowerCase', '==', sanitizedEmailLower).limit(1).get();
                if (!existingLower.empty) {
                    existingDoc = existingLower.docs[0];
                }
            }
        }

        if (existingDoc) {
            alunoRef = existingDoc.ref;
            isNew = false;
        }

        const alunoPayload = {
            nome: sanitizedNome,
            email: sanitizedEmail,
            origem: 'formulario-anamnese',
            formularioTipo: normalizedType,
            atualizadoEm: timestamp
        };

        if (sanitizedEmailLower) {
            alunoPayload.emailLowerCase = sanitizedEmailLower;
        }

        const telefoneSanitizado = optional(telefone);
        if (telefoneSanitizado) alunoPayload.telefone = telefoneSanitizado;
        const dataNascSanitizada = optional(dataNascimento);
        if (dataNascSanitizada) alunoPayload.dataNascimento = dataNascSanitizada;
        const objetivoSanitizado = optional(objetivo);
        if (objetivoSanitizado) alunoPayload.objetivo = objetivoSanitizado;
        const observacoesSanitizadas = optional(observacoes);
        if (observacoesSanitizadas) alunoPayload.observacoes = observacoesSanitizadas;

        const anamneseBasica = {
            disponibilidade: optional(disponibilidade),
            experiencia: optional(experiencia),
            restricoes: optional(restricoes),
            medicamentos: optional(medicamentos),
            horarioPreferido: optional(horarioPreferido),
            preferenciaContato: optional(preferenciaContato),
            alimentacaoAtual: optional(alimentacaoAtual),
            restricoesAlimentares: optional(restricoesAlimentares)
        };

        Object.keys(anamneseBasica).forEach((key) => {
            if (!anamneseBasica[key]) {
                delete anamneseBasica[key];
            }
        });

        if (Object.keys(anamneseBasica).length > 0) {
            alunoPayload.anamneseBasica = anamneseBasica;
        }

        if (isNew) {
            alunoPayload.criadoEm = timestamp;
            alunoPayload.aulasPorSemana = 2;
            alunoRef = await alunosRef.add(alunoPayload);
        } else {
            await alunoRef.set(alunoPayload, { merge: true });
        }

        const personalData = personalSnap.data() || {};
        const personalEmail = personalData.email ? String(personalData.email).trim() : null;
        const personalNome = personalData.nome || '';
        const formLabel = normalizedType === 'dieta-treino' ? 'dieta e treino' : 'apenas treino';

        if (personalEmail) {
            const textMessage = `Olá ${personalNome || 'personal'},\n\n` +
                `${sanitizedNome} acabou de preencher o formulário de anamnese (${formLabel}).\n` +
                `E-mail: ${sanitizedEmail}\n` +
                `Telefone: ${telefoneSanitizado || 'não informado'}.\n\n` +
                `Acesse o painel do PersonalHub para consultar os detalhes.`;

            const htmlMessage = `<p>Olá ${personalNome || 'personal'},</p>` +
                `<p><strong>${sanitizedNome}</strong> acabou de preencher o formulário de anamnese (${formLabel}).</p>` +
                `<p><strong>E-mail:</strong> ${sanitizedEmail}<br />` +
                `<strong>Telefone:</strong> ${telefoneSanitizado || 'não informado'}</p>` +
                `<p>Acesse o painel do PersonalHub para visualizar todos os detalhes.</p>`;

            try {
                await sendMail({
                    to: personalEmail,
                    subject: 'Novo aluno cadastrado via formulário de anamnese',
                    text: textMessage,
                    html: htmlMessage
                });
            } catch (emailErr) {
                console.error('Erro ao enviar notificação por email:', emailErr);
            }
        }

        return res.status(201).json({ message: 'Formulário enviado com sucesso.' });
    } catch (err) {
        console.error('Erro ao processar formulário de anamnese público:', err);
        return res.status(500).json({ error: 'Erro ao enviar formulário.' });
    }
});

module.exports = router;
