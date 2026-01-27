const express = require('express');
const router = express.Router();
const admin = require('../../firebase-admin');
const verifyToken = require('../../middleware/verifyToken');

const COURSE_COLLECTION = 'cursosAulas';

async function getUserRole(uid) {
    const userDoc = await admin.firestore().collection('users').doc(uid).get();
    if (!userDoc.exists) return 'personal';
    return userDoc.data().role || 'personal';
}

function buildLessonId() {
    return admin.firestore().collection(COURSE_COLLECTION).doc().collection('lessons').doc().id;
}

function normalizeLessons(lessons, keepIds = false) {
    if (!Array.isArray(lessons)) return [];
    return lessons
        .map(lesson => ({
            id: keepIds && lesson.id ? lesson.id : buildLessonId(),
            titulo: (lesson.titulo || '').trim(),
            videoUrl: (lesson.videoUrl || '').trim(),
            duracaoSegundos: Number.isFinite(Number(lesson.duracaoSegundos))
                ? Number(lesson.duracaoSegundos)
                : null
        }))
        .filter(lesson => lesson.titulo && lesson.videoUrl);
}

router.get('/aulas', verifyToken, async (req, res) => {
    try {
        const uid = req.user.uid;
        const role = await getUserRole(uid);
        const snapshot = await admin.firestore().collection(COURSE_COLLECTION).orderBy('criadoEm', 'desc').get();
        const courses = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        if (role === 'admin') {
            return res.json(courses);
        }

        const progressSnap = await admin.firestore()
            .collection('users')
            .doc(uid)
            .collection('aulasProgresso')
            .get();

        const progressMap = new Map();
        progressSnap.forEach(doc => {
            progressMap.set(doc.id, doc.data());
        });

        const coursesWithProgress = courses.map(course => {
            const lessons = Array.isArray(course.lessons) ? course.lessons : [];
            const enrichedLessons = lessons.map(lesson => {
                const progressKey = `${course.id}_${lesson.id}`;
                const progress = progressMap.get(progressKey);
                return {
                    ...lesson,
                    progresso: progress
                        ? {
                            positionSeconds: progress.positionSeconds || 0,
                            completed: Boolean(progress.completed),
                            updatedAt: progress.updatedAt || null
                        }
                        : { positionSeconds: 0, completed: false, updatedAt: null }
                };
            });

            return {
                ...course,
                lessons: enrichedLessons
            };
        });

        return res.json(coursesWithProgress);
    } catch (err) {
        console.error('Erro ao carregar aulas:', err);
        return res.status(500).json({ error: 'Erro ao carregar aulas' });
    }
});

router.post('/aulas', verifyToken, async (req, res) => {
    try {
        const uid = req.user.uid;
        const role = await getUserRole(uid);
        if (role !== 'admin') {
            return res.status(403).json({ error: 'Acesso negado' });
        }

        const { titulo, descricao, lessons } = req.body;
        if (!titulo || !titulo.trim()) {
            return res.status(400).json({ error: 'Título é obrigatório' });
        }

        const normalizedLessons = normalizeLessons(lessons);
        if (normalizedLessons.length === 0) {
            return res.status(400).json({ error: 'Adicione ao menos uma aula com vídeo' });
        }

        const courseRef = admin.firestore().collection(COURSE_COLLECTION).doc();
        const now = new Date().toISOString();
        await courseRef.set({
            titulo: titulo.trim(),
            descricao: descricao ? descricao.trim() : '',
            lessons: normalizedLessons,
            criadoEm: now,
            atualizadoEm: now
        });

        return res.status(201).json({ id: courseRef.id });
    } catch (err) {
        console.error('Erro ao criar curso:', err);
        return res.status(500).json({ error: 'Erro ao criar curso' });
    }
});

router.put('/aulas/:courseId', verifyToken, async (req, res) => {
    try {
        const uid = req.user.uid;
        const role = await getUserRole(uid);
        if (role !== 'admin') {
            return res.status(403).json({ error: 'Acesso negado' });
        }

        const { courseId } = req.params;
        const { titulo, descricao, lessons } = req.body;
        const updateData = { atualizadoEm: new Date().toISOString() };

        if (titulo !== undefined) updateData.titulo = titulo ? titulo.trim() : '';
        if (descricao !== undefined) updateData.descricao = descricao ? descricao.trim() : '';
        if (lessons !== undefined) {
            const normalizedLessons = normalizeLessons(lessons, true);
            if (normalizedLessons.length === 0) {
                return res.status(400).json({ error: 'Adicione ao menos uma aula com vídeo' });
            }
            updateData.lessons = normalizedLessons;
        }

        await admin.firestore().collection(COURSE_COLLECTION).doc(courseId).set(updateData, { merge: true });
        return res.json({ message: 'Curso atualizado' });
    } catch (err) {
        console.error('Erro ao atualizar curso:', err);
        return res.status(500).json({ error: 'Erro ao atualizar curso' });
    }
});

router.delete('/aulas/:courseId', verifyToken, async (req, res) => {
    try {
        const uid = req.user.uid;
        const role = await getUserRole(uid);
        if (role !== 'admin') {
            return res.status(403).json({ error: 'Acesso negado' });
        }

        const { courseId } = req.params;
        await admin.firestore().collection(COURSE_COLLECTION).doc(courseId).delete();
        return res.json({ message: 'Curso removido' });
    } catch (err) {
        console.error('Erro ao remover curso:', err);
        return res.status(500).json({ error: 'Erro ao remover curso' });
    }
});

router.post('/aulas/progresso', verifyToken, async (req, res) => {
    try {
        const uid = req.user.uid;
        const { courseId, lessonId, positionSeconds, completed } = req.body;

        if (!courseId || !lessonId) {
            return res.status(400).json({ error: 'Curso e aula são obrigatórios' });
        }

        const docId = `${courseId}_${lessonId}`;
        const payload = {
            courseId,
            lessonId,
            positionSeconds: Number.isFinite(Number(positionSeconds)) ? Number(positionSeconds) : 0,
            completed: Boolean(completed),
            updatedAt: new Date().toISOString()
        };

        await admin.firestore()
            .collection('users')
            .doc(uid)
            .collection('aulasProgresso')
            .doc(docId)
            .set(payload, { merge: true });

        return res.json({ message: 'Progresso atualizado' });
    } catch (err) {
        console.error('Erro ao atualizar progresso:', err);
        return res.status(500).json({ error: 'Erro ao atualizar progresso' });
    }
});

module.exports = router;
