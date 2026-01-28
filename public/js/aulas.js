import { fetchWithFreshToken, fetchUserRole } from './auth.js';

function formatTime(seconds) {
    if (!Number.isFinite(seconds) || seconds <= 0) return '0:00';
    const total = Math.floor(seconds);
    const mins = Math.floor(total / 60);
    const secs = total % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function extractGoogleDriveId(url) {
    if (!url) return null;
    const patterns = [
        /drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/,
        /drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/,
        /drive\.google\.com\/uc\?id=([a-zA-Z0-9_-]+)/,
        /drive\.google\.com\/uc\?export=download&id=([a-zA-Z0-9_-]+)/
    ];
    const match = patterns.map(pattern => url.match(pattern)).find(Boolean);
    return match ? match[1] : null;
}

function normalizeVideoUrl(url) {
    const trimmed = (url || '').trim();
    if (!trimmed) return '';
    const driveId = extractGoogleDriveId(trimmed);
    if (!driveId) return trimmed;
    return `https://drive.google.com/uc?export=download&id=${driveId}`;
}

function buildLessonRow({ courseId, lesson, role }) {
    const progress = lesson.progresso || { positionSeconds: 0, completed: false };
    const hasProgress = progress.positionSeconds > 0 && !progress.completed;
    const canTrackProgress = role !== 'admin';
    const statusLabel = canTrackProgress
        ? (progress.completed
            ? 'Concluída'
            : hasProgress
                ? `Continuar em ${formatTime(progress.positionSeconds)}`
                : 'Iniciar aula')
        : 'Assistir aula';

    return `
        <li class="aula-item" data-course-id="${courseId}" data-lesson-id="${lesson.id}">
            <div class="aula-info">
                <h4>${lesson.titulo}</h4>
                <p>${lesson.duracaoSegundos ? `Duração: ${formatTime(lesson.duracaoSegundos)}` : 'Duração não informada'}</p>
            </div>
            <div class="aula-actions">
                <button class="aula-action-btn" data-action="play">${statusLabel}</button>
                ${canTrackProgress
                    ? `<span class="aula-status ${progress.completed ? 'is-complete' : ''}">
                        ${progress.completed ? '✅ Finalizada' : hasProgress ? `⏱️ ${formatTime(progress.positionSeconds)}` : ''}
                    </span>`
                    : ''}
            </div>
        </li>`;
}

function courseCard(course, role) {
    const lessons = Array.isArray(course.lessons) ? course.lessons : [];
    const completedCount = lessons.filter(l => l.progresso && l.progresso.completed).length;
    const progressLabel = lessons.length
        ? `${completedCount}/${lessons.length} aulas concluídas`
        : 'Sem aulas cadastradas';

    return `
        <article class="curso-card" data-course-id="${course.id}">
            <div class="curso-header">
                <div>
                    <h3>${course.titulo}</h3>
                    <p>${course.descricao || 'Sem descrição'}</p>
                </div>
                <div class="curso-actions">
                    ${role === 'admin'
                        ? `<button class="curso-btn" data-action="edit">Editar</button>
                           <button class="curso-btn danger" data-action="delete">Excluir</button>`
                        : `<span class="curso-progress">${progressLabel}</span>`}
                </div>
            </div>
            <ul class="aula-list">
                ${lessons.map(lesson => buildLessonRow({ courseId: course.id, lesson, role })).join('')}
            </ul>
        </article>`;
}

function buildLessonField(lesson = {}) {
    return `
        <div class="lesson-field" data-lesson-id="${lesson.id || ''}">
            <label>
                Título da aula
                <input type="text" name="lessonTitle" value="${lesson.titulo || ''}" required />
            </label>
            <label>
                URL do vídeo
                <input type="url" name="lessonUrl" value="${lesson.videoUrl || ''}" placeholder="https://drive.google.com/file/d/..." required />
            </label>
            <label>
                Duração (segundos)
                <input type="number" name="lessonDuration" value="${lesson.duracaoSegundos || ''}" min="0" />
            </label>
            <button type="button" class="remove-lesson">Remover aula</button>
        </div>`;
}

function openCourseModal({ course, onSave }) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content aulas-modal">
            <h3>${course ? 'Editar curso' : 'Novo curso'}</h3>
            <label>
                Título do curso
                <input type="text" name="courseTitle" value="${course?.titulo || ''}" required />
            </label>
            <label>
                Descrição
                <textarea name="courseDescription" rows="3">${course?.descricao || ''}</textarea>
            </label>
            <div class="lessons-container">
                ${Array.isArray(course?.lessons) && course.lessons.length
        ? course.lessons.map(buildLessonField).join('')
        : buildLessonField()}
            </div>
            <button type="button" class="add-lesson">Adicionar aula</button>
            <div class="modal-actions">
                <button type="button" class="primary">${course ? 'Salvar alterações' : 'Criar curso'}</button>
                <button type="button" class="cancel">Cancelar</button>
            </div>
        </div>`;

    const closeModal = () => modal.remove();

    modal.addEventListener('click', e => {
        if (e.target === modal) closeModal();
    });

    modal.querySelector('.cancel').addEventListener('click', closeModal);

    modal.querySelector('.add-lesson').addEventListener('click', () => {
        const container = modal.querySelector('.lessons-container');
        container.insertAdjacentHTML('beforeend', buildLessonField());
    });

    modal.addEventListener('click', e => {
        if (e.target.classList.contains('remove-lesson')) {
            e.target.closest('.lesson-field').remove();
        }
    });

    modal.querySelector('.primary').addEventListener('click', async () => {
        const title = modal.querySelector('[name="courseTitle"]').value.trim();
        const description = modal.querySelector('[name="courseDescription"]').value.trim();
        const lessonFields = Array.from(modal.querySelectorAll('.lesson-field'));
        const lessons = lessonFields.map(field => ({
            id: field.dataset.lessonId || undefined,
            titulo: field.querySelector('[name="lessonTitle"]').value.trim(),
            videoUrl: field.querySelector('[name="lessonUrl"]').value.trim(),
            duracaoSegundos: field.querySelector('[name="lessonDuration"]').value
        }));

        if (!title) {
            alert('Informe o título do curso.');
            return;
        }
        if (lessons.every(lesson => !lesson.titulo || !lesson.videoUrl)) {
            alert('Adicione ao menos uma aula com título e vídeo.');
            return;
        }

        await onSave({ titulo: title, descricao: description, lessons });
        closeModal();
    });

    document.body.appendChild(modal);
}

function buildPlayerSection() {
    return `
        <section class="aula-player hidden" id="aulaPlayer">
            <div class="player-header">
                <div>
                    <h3 id="playerTitle">Aula</h3>
                    <p id="playerSubtitle"></p>
                </div>
                <button id="closePlayer">Fechar</button>
            </div>
            <video id="lessonVideo" controls></video>
            <div class="player-actions">
                <span id="playerStatus"></span>
                <a id="driveLink" class="drive-link hidden" href="#" target="_blank" rel="noopener">Abrir no Google Drive</a>
                <button id="markComplete" class="primary">Marcar como concluída</button>
            </div>
        </section>`;
}

export async function loadAulasSection(roleOverride) {
    const content = document.getElementById('content');
    content.innerHTML = `
        <section class="aulas-section">
            <div class="aulas-header">
                <div>
                    <h2>Aulas</h2>
                    <p>Gerencie cursos e acompanhe o progresso dos alunos.</p>
                </div>
                <button class="primary" id="novoCursoBtn" style="display:none;">Novo curso</button>
            </div>
            <div id="aulasGrid" class="aulas-grid"></div>
        </section>
        ${buildPlayerSection()}
    `;

    const aulasGrid = content.querySelector('#aulasGrid');
    const player = content.querySelector('#aulaPlayer');
    const video = content.querySelector('#lessonVideo');
    const playerTitle = content.querySelector('#playerTitle');
    const playerSubtitle = content.querySelector('#playerSubtitle');
    const playerStatus = content.querySelector('#playerStatus');
    const driveLink = content.querySelector('#driveLink');
    const markCompleteBtn = content.querySelector('#markComplete');
    const closePlayerBtn = content.querySelector('#closePlayer');

    const role = roleOverride || await fetchUserRole();
    const isAdmin = role === 'admin';
    const novoCursoBtn = content.querySelector('#novoCursoBtn');
    if (isAdmin) {
        novoCursoBtn.style.display = 'inline-flex';
        markCompleteBtn.classList.add('hidden');
    }

    let activeLesson = null;
    let progressCache = new Map();
    let saveTimeout = null;

    const saveProgress = async ({ positionSeconds, completed }) => {
        if (!activeLesson || isAdmin) return;
        const progressKey = `${activeLesson.courseId}_${activeLesson.lessonId}`;
        const currentProgress = progressCache.get(progressKey) || {};
        const updatedProgress = {
            positionSeconds,
            completed,
            updatedAt: new Date().toISOString()
        };
        progressCache.set(progressKey, { ...currentProgress, ...updatedProgress });
        updatePlayerStatus(updatedProgress);
        if (completed) {
            markCompleteBtn.textContent = 'Concluída';
            markCompleteBtn.disabled = true;
        }
        const payload = {
            courseId: activeLesson.courseId,
            lessonId: activeLesson.lessonId,
            positionSeconds,
            completed
        };
        try {
            await fetchWithFreshToken('/api/users/aulas/progresso', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
        } catch (err) {
            console.error('Erro ao salvar progresso:', err);
        }
    };

    const scheduleSave = () => {
        if (saveTimeout) clearTimeout(saveTimeout);
        saveTimeout = setTimeout(() => {
            const currentTime = Math.floor(video.currentTime || 0);
            saveProgress({ positionSeconds: currentTime, completed: false });
        }, 1200);
    };

    const updatePlayerStatus = (progress) => {
        if (!progress) {
            playerStatus.textContent = '';
            return;
        }
        playerStatus.textContent = progress.completed
            ? '✅ Aula concluída'
            : `Você parou em ${formatTime(progress.positionSeconds || 0)}`;
    };

    const openPlayer = (course, lesson) => {
        activeLesson = { courseId: course.id, lessonId: lesson.id, title: lesson.titulo };
        const progressKey = `${course.id}_${lesson.id}`;
        const progress = progressCache.get(progressKey) || { positionSeconds: 0, completed: false };
        const driveId = extractGoogleDriveId(lesson.videoUrl);

        player.classList.remove('hidden');
        playerTitle.textContent = lesson.titulo;
        playerSubtitle.textContent = course.titulo;
        video.src = normalizeVideoUrl(lesson.videoUrl);
        video.dataset.courseId = course.id;
        video.dataset.lessonId = lesson.id;
        updatePlayerStatus(progress);

        if (driveId) {
            driveLink.href = `https://drive.google.com/file/d/${driveId}/view`;
            driveLink.classList.remove('hidden');
        } else {
            driveLink.href = '#';
            driveLink.classList.add('hidden');
        }

        if (progress.completed) {
            markCompleteBtn.textContent = 'Concluída';
            markCompleteBtn.disabled = true;
        } else {
            markCompleteBtn.textContent = 'Marcar como concluída';
            markCompleteBtn.disabled = false;
        }

        video.addEventListener('loadedmetadata', () => {
            if (progress.positionSeconds && progress.positionSeconds < video.duration) {
                video.currentTime = progress.positionSeconds;
            }
        }, { once: true });
    };

    const closePlayer = () => {
        player.classList.add('hidden');
        video.pause();
        video.removeAttribute('src');
        activeLesson = null;
    };

    closePlayerBtn.addEventListener('click', closePlayer);

    video.addEventListener('pause', () => {
        const currentTime = Math.floor(video.currentTime || 0);
        saveProgress({ positionSeconds: currentTime, completed: false });
    });

    video.addEventListener('timeupdate', () => {
        if (isAdmin) return;
        scheduleSave();
    });

    video.addEventListener('ended', () => {
        if (isAdmin) return;
        const duration = Math.floor(video.duration || video.currentTime || 0);
        saveProgress({ positionSeconds: duration, completed: true });
    });

    markCompleteBtn.addEventListener('click', () => {
        const duration = Math.floor(video.duration || video.currentTime || 0);
        saveProgress({ positionSeconds: duration, completed: true });
        markCompleteBtn.textContent = 'Concluída';
        markCompleteBtn.disabled = true;
        playerStatus.textContent = '✅ Aula concluída';
    });

    const fetchCourses = async () => {
        try {
            const res = await fetchWithFreshToken('/api/users/aulas');
            if (!res.ok) throw new Error('Erro ao carregar aulas');
            const data = await res.json();
            return Array.isArray(data) ? data : [];
        } catch (err) {
            console.error(err);
            aulasGrid.innerHTML = '<p>Erro ao carregar aulas.</p>';
            return [];
        }
    };

    const renderCourses = (courses) => {
        if (!courses.length) {
            aulasGrid.innerHTML = '<p>Nenhum curso cadastrado ainda.</p>';
            return;
        }
        aulasGrid.innerHTML = courses.map(course => courseCard(course, role)).join('');
        courses.forEach(course => {
            (course.lessons || []).forEach(lesson => {
                const progressKey = `${course.id}_${lesson.id}`;
                if (lesson.progresso) {
                    progressCache.set(progressKey, lesson.progresso);
                }
            });
        });
    };

    const refreshCourses = async () => {
        const courses = await fetchCourses();
        renderCourses(courses);
        return courses;
    };

    let cachedCourses = await refreshCourses();

    if (isAdmin) {
        novoCursoBtn.addEventListener('click', () => {
            openCourseModal({
                course: null,
                onSave: async (payload) => {
                    await fetchWithFreshToken('/api/users/aulas', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    });
                    cachedCourses = await refreshCourses();
                }
            });
        });
    }

    aulasGrid.addEventListener('click', async (event) => {
        const actionButton = event.target.closest('[data-action]');
        const lessonItem = event.target.closest('.aula-item');
        const courseCardEl = event.target.closest('.curso-card');

        if (actionButton && courseCardEl) {
            const action = actionButton.dataset.action;
            const courseId = courseCardEl.dataset.courseId;
            const course = cachedCourses.find(c => c.id === courseId);

            if (!course) return;

            if (action === 'edit') {
                openCourseModal({
                    course,
                    onSave: async (payload) => {
                        await fetchWithFreshToken(`/api/users/aulas/${courseId}`, {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(payload)
                        });
                        cachedCourses = await refreshCourses();
                    }
                });
            }

            if (action === 'delete') {
                const confirmDelete = confirm('Tem certeza que deseja excluir este curso?');
                if (!confirmDelete) return;
                await fetchWithFreshToken(`/api/users/aulas/${courseId}`, { method: 'DELETE' });
                cachedCourses = await refreshCourses();
            }
        }

        if (lessonItem) {
            const courseId = lessonItem.dataset.courseId;
            const lessonId = lessonItem.dataset.lessonId;
            const course = cachedCourses.find(c => c.id === courseId);
            if (!course) return;
            const lesson = (course.lessons || []).find(l => l.id === lessonId);
            if (!lesson) return;
            openPlayer(course, lesson);
        }
    });
}
