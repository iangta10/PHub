import { listEvaluationStudents, SIXTY_DAYS_MS, SEVEN_DAYS_MS } from './dataProviders/evaluationsProvider.mjs';

const DAY_IN_MS = 24 * 60 * 60 * 1000;
const SEARCH_DEBOUNCE = 300;
const PAGE_SIZE = 25;

const STATUS_LABELS = {
    none: 'Sem',
    draft: 'Nova',
    completed: 'Concluída'
};

const FILTER_KEYS = {
    vencidos: 'overdue',
    sem: 'noEvaluation',
    aVencer: 'upcoming'
};

const FILTER_LABELS = {
    vencidos: 'Vencidos',
    sem: 'Sem avaliação',
    aVencer: 'A vencer'
};

function toDate(value) {
    if (!value && value !== 0) return null;
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date;
}

function formatDate(date) {
    if (!date) return '—';
    return date.toLocaleDateString('pt-BR');
}

function formatRelative(date) {
    if (!date) return '';
    const now = Date.now();
    const diff = now - date.getTime();
    const days = Math.floor(Math.abs(diff) / DAY_IN_MS);
    if (days === 0) {
        return diff >= 0 ? 'hoje' : 'em 0 dias';
    }
    if (diff >= 0) {
        return `há ${days} ${days === 1 ? 'dia' : 'dias'}`;
    }
    return `em ${days} ${days === 1 ? 'dia' : 'dias'}`;
}

function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (match) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    })[match]);
}

function highlightTerm(text, term) {
    if (!term) return escapeHtml(text);
    const escapedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escapedTerm})`, 'gi');
    return escapeHtml(text).replace(regex, '<mark>$1</mark>');
}

function computeStatus(student) {
    const now = Date.now();
    const last = toDate(student.lastEvaluationAt);
    const next = toDate(student.nextEvaluationAt);
    const hasDraft = Boolean(student.hasDraftEvaluation);

    const overdueByLast = last ? (now - last.getTime()) > SIXTY_DAYS_MS : false;
    const overdueByNext = next ? next.getTime() < now : false;
    const overdue = overdueByLast || (!last && next && next.getTime() < now) || overdueByNext;
    const upcoming = next ? (next.getTime() >= now && (next.getTime() - now) <= SEVEN_DAYS_MS) : false;
    const noEvaluation = !last;

    let statusKey = 'completed';
    if (noEvaluation) {
        statusKey = 'none';
    } else if (hasDraft) {
        statusKey = 'draft';
    }

    return {
        ...student,
        lastEvaluationDate: last,
        nextEvaluationDate: next,
        statusKey,
        statusLabel: STATUS_LABELS[statusKey],
        flags: {
            overdue,
            upcoming,
            noEvaluation
        }
    };
}

function sortStudents(students, sortState) {
    const direction = sortState.direction === 'desc' ? -1 : 1;
    const field = sortState.field;
    return [...students].sort((a, b) => {
        if (field === 'name') {
            return a.name.localeCompare(b.name, 'pt-BR') * direction;
        }
        if (field === 'last') {
            const aDate = a.lastEvaluationDate;
            const bDate = b.lastEvaluationDate;
            if (!aDate && !bDate) return 0;
            if (!aDate) return sortState.direction === 'asc' ? -1 : 1;
            if (!bDate) return sortState.direction === 'asc' ? 1 : -1;
            return (aDate.getTime() - bDate.getTime()) * direction;
        }
        if (field === 'next') {
            const aDate = a.nextEvaluationDate;
            const bDate = b.nextEvaluationDate;
            if (!aDate && !bDate) return 0;
            if (!aDate) return sortState.direction === 'asc' ? -1 : 1;
            if (!bDate) return sortState.direction === 'asc' ? 1 : -1;
            return (aDate.getTime() - bDate.getTime()) * direction;
        }
        return 0;
    });
}

function filterStudents(students, state) {
    const term = state.searchTerm.toLowerCase();
    let filtered = students;
    if (term) {
        filtered = filtered.filter(student => student.name.toLowerCase().includes(term));
    }

    const activeFilters = Object.entries(state.filters)
        .filter(([, active]) => active)
        .map(([key]) => key);

    if (activeFilters.length) {
        filtered = filtered.filter(student => {
            return activeFilters.every(filterKey => {
                const flagKey = FILTER_KEYS[filterKey];
                if (flagKey === 'overdue') return student.flags.overdue;
                if (flagKey === 'noEvaluation') return student.flags.noEvaluation;
                if (flagKey === 'upcoming') return student.flags.upcoming;
                return true;
            });
        });
    }

    return sortStudents(filtered, state.sort);
}

function computeFilterCounts(students, term) {
    const normalizedTerm = term.toLowerCase();
    const base = normalizedTerm
        ? students.filter(student => student.name.toLowerCase().includes(normalizedTerm))
        : [...students];

    return {
        vencidos: base.filter(student => student.flags.overdue).length,
        sem: base.filter(student => student.flags.noEvaluation).length,
        aVencer: base.filter(student => student.flags.upcoming).length
    };
}

function buildRecommendedList(students) {
    const list = students
        .filter(student => student.flags.noEvaluation || student.flags.overdue)
        .sort((a, b) => {
            if (a.flags.noEvaluation && !b.flags.noEvaluation) return -1;
            if (!a.flags.noEvaluation && b.flags.noEvaluation) return 1;
            const aTime = a.lastEvaluationDate ? a.lastEvaluationDate.getTime() : 0;
            const bTime = b.lastEvaluationDate ? b.lastEvaluationDate.getTime() : 0;
            return aTime - bTime;
        });
    return list;
}

function renderRecommended(container, students, handlers, searchTerm) {
    if (!container) return;
    container.innerHTML = '';

    if (!students.length) {
        const empty = document.createElement('div');
        empty.className = 'evaluations-empty';
        empty.innerHTML = `
            <p>Tudo em dia por aqui 👏</p>
            <button type="button" data-action="create-first">Criar primeira avaliação</button>
        `;
        empty.querySelector('[data-action="create-first"]').addEventListener('click', handlers.onCreateFirst);
        container.appendChild(empty);
        return;
    }

    if (students.length <= 5) {
        const table = document.createElement('table');
        table.className = 'evaluations-recommended-table';
        table.innerHTML = `
            <thead>
                <tr>
                    <th>Nome</th>
                    <th>Última avaliação</th>
                    <th>Próxima</th>
                    <th>Ações</th>
                </tr>
            </thead>
            <tbody>
                ${students.map(student => `
                    <tr data-id="${student.id}">
                        <td>${highlightTerm(student.name, searchTerm)}</td>
                        <td>${student.lastEvaluationDate ? `${formatDate(student.lastEvaluationDate)}<span>${formatRelative(student.lastEvaluationDate)}</span>` : 'Sem registro'}</td>
                        <td>${student.nextEvaluationDate ? `${formatDate(student.nextEvaluationDate)}<span>${formatRelative(student.nextEvaluationDate)}</span>` : '—'}</td>
                        <td>
                            <div class="evaluation-actions">
                                <button type="button" data-action="new" data-id="${student.id}">+ Nova avaliação</button>
                                <button type="button" data-action="history" data-id="${student.id}">Ver histórico</button>
                                <button type="button" data-action="export" data-id="${student.id}">Exportar/Imprimir</button>
                            </div>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        `;
        container.appendChild(table);
    } else {
        const grid = document.createElement('div');
        grid.className = 'evaluations-recommended-grid';
        grid.innerHTML = students.map(student => `
            <article class="evaluation-card" data-id="${student.id}">
                <header>
                    <h4>${highlightTerm(student.name, searchTerm)}</h4>
                    ${student.flags.noEvaluation ? '<span class="status-pill status-pill--none">Sem avaliação</span>' : '<span class="status-pill status-pill--overdue">Vencida</span>'}
                </header>
                <dl>
                    <div>
                        <dt>Última avaliação</dt>
                        <dd>${student.lastEvaluationDate ? `${formatDate(student.lastEvaluationDate)}<span>${formatRelative(student.lastEvaluationDate)}</span>` : 'Sem registro'}</dd>
                    </div>
                    <div>
                        <dt>Próxima avaliação</dt>
                        <dd>${student.nextEvaluationDate ? `${formatDate(student.nextEvaluationDate)}<span>${formatRelative(student.nextEvaluationDate)}</span>` : '—'}</dd>
                    </div>
                </dl>
                <div class="evaluation-actions">
                    <button type="button" data-action="new" data-id="${student.id}">+ Nova avaliação</button>
                    <button type="button" data-action="history" data-id="${student.id}">Ver histórico</button>
                    <button type="button" data-action="export" data-id="${student.id}">Exportar/Imprimir</button>
                </div>
            </article>
        `).join('');
        container.appendChild(grid);
    }
}

function renderTable(container, students, state, searchTerm) {
    if (!container) return;
    container.innerHTML = '';

    if (!students.length) {
        const empty = document.createElement('div');
        empty.className = 'evaluations-empty';
        empty.innerHTML = `
            <p>Nenhum aluno corresponde aos filtros</p>
            <button type="button" data-action="clear-filters">Limpar filtros</button>
        `;
        empty.querySelector('button').addEventListener('click', state.onClearFilters);
        container.appendChild(empty);
        return;
    }

    const table = document.createElement('table');
    table.className = 'evaluations-table';
    table.innerHTML = `
        <thead>
            <tr>
                <th><button type="button" data-sort="name">Nome<span data-sort-indicator="name"></span></button></th>
                <th>Status da avaliação</th>
                <th><button type="button" data-sort="last">Última avaliação<span data-sort-indicator="last"></span></button></th>
                <th><button type="button" data-sort="next">Próxima avaliação<span data-sort-indicator="next"></span></button></th>
                <th>Ações</th>
            </tr>
        </thead>
        <tbody>
            ${students.map(student => `
                <tr data-id="${student.id}">
                    <td>
                        <div class="evaluation-student">
                            ${student.avatarUrl ? `<img src="${student.avatarUrl}" alt="" class="evaluation-avatar" />` : ''}
                            <span class="evaluation-name">${highlightTerm(student.name, searchTerm)}</span>
                        </div>
                    </td>
                    <td><span class="status-pill status-pill--${student.statusKey}">${student.statusLabel}</span></td>
                    <td>
                        ${student.lastEvaluationDate
                            ? `<div class="evaluation-date">${formatDate(student.lastEvaluationDate)}<span>${formatRelative(student.lastEvaluationDate)}</span></div>`
                            : '<div class="evaluation-date">Sem registro</div>'}
                    </td>
                    <td>
                        ${student.nextEvaluationDate
                            ? `<div class="evaluation-date">${formatDate(student.nextEvaluationDate)}<span>${formatRelative(student.nextEvaluationDate)}</span></div>`
                            : '<div class="evaluation-date">—</div>'}
                    </td>
                    <td>
                        <div class="evaluation-actions">
                            <button type="button" data-action="new" data-id="${student.id}">Nova</button>
                            <button type="button" data-action="history" data-id="${student.id}">Histórico</button>
                            <button type="button" data-action="export" data-id="${student.id}">Exportar</button>
                        </div>
                    </td>
                </tr>
            `).join('')}
        </tbody>
    `;

    container.appendChild(table);

    const indicators = table.querySelectorAll('[data-sort-indicator]');
    indicators.forEach(indicator => {
        const field = indicator.getAttribute('data-sort-indicator');
        indicator.textContent = '';
        if (state.sort.field === field) {
            indicator.textContent = state.sort.direction === 'asc' ? '▲' : '▼';
        }
    });
}

function renderHistory(panel, student, entries, handlers) {
    if (!panel) return;
    const content = panel.querySelector('[data-role="history-content"]');
    const title = panel.querySelector('[data-role="history-title"]');
    if (title) {
        title.textContent = `Histórico de ${student.name}`;
    }
    if (!content) return;

    if (!entries.length) {
        content.innerHTML = '<p class="history-empty">Nenhuma avaliação registrada.</p>';
        return;
    }

    content.innerHTML = entries.map(entry => {
        const date = toDate(entry.data) || toDate(entry.date) || toDate(entry.createdAt);
        const next = toDate(entry.proxima) || toDate(entry.proximaAvaliacao) || toDate(entry.nextEvaluationAt);
        const origin = entry.origin || 'remote';
        const id = entry.id || entry.avaliacaoId || entry.key || '';
        const canEdit = origin === 'local' && id;
        const canDelete = origin === 'local' && id;
        const canView = Boolean(id);
        const dateLabel = date ? `${formatDate(date)} <span>${formatRelative(date)}</span>` : 'Sem data';
        const nextLabel = next ? `${formatDate(next)} <span>${formatRelative(next)}</span>` : '—';
        return `
            <article class="history-card" data-origin="${origin}" data-id="${id}">
                <header>
                    <h4>${dateLabel}</h4>
                    <span class="history-source">${origin === 'local' ? 'Rascunho local' : 'Registro sincronizado'}</span>
                </header>
                <p><strong>Próxima avaliação:</strong> ${nextLabel}</p>
                <div class="history-actions">
                    <button type="button" data-history-action="view" data-id="${id}" ${!canView ? 'disabled' : ''}>Visualizar</button>
                    <button type="button" data-history-action="edit" data-id="${id}" ${!canEdit ? 'disabled' : ''}>Editar</button>
                    <button type="button" data-history-action="delete" data-id="${id}" ${!canDelete ? 'disabled' : ''}>Excluir</button>
                </div>
            </article>
        `;
    }).join('');

    content.querySelectorAll('[data-history-action]').forEach(button => {
        button.addEventListener('click', () => {
            const action = button.getAttribute('data-history-action');
            const entryId = button.getAttribute('data-id');
            handlers.onHistoryAction(action, student, entryId, button.closest('.history-card'));
        });
    });
}

function collectHistory(student) {
    const localKey = `avaliacoes_${student.id}`;
    let local = [];
    try {
        local = JSON.parse(localStorage.getItem(localKey) || '[]');
    } catch (err) {
        console.error('Não foi possível ler avaliações locais:', err);
    }
    const parsedLocal = Array.isArray(local)
        ? local.map((item, index) => ({
            ...item,
            origin: 'local',
            id: String(item?.id || item?.key || item?.avaliacaoId || item?.data || `local-${index}`)
        }))
        : [];
    return parsedLocal;
}

async function loadHistory(student, panel, handlers) {
    if (!panel) return;
    panel.classList.add('is-open');
    const content = panel.querySelector('[data-role="history-content"]');
    if (content) {
        content.innerHTML = '<p class="history-loading">Carregando avaliações...</p>';
    }

    let remote = [];
    try {
        const module = await import('./auth.js');
        const res = await module.fetchWithFreshToken(`/api/users/alunos/${student.id}/avaliacoes`);
        if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data)) {
                remote = data.map(item => ({ ...item, origin: 'remote' }));
            }
        }
    } catch (err) {
        console.error('Erro ao carregar avaliações remotas:', err);
    }

    const combined = [...remote, ...collectHistory(student)];
    combined.sort((a, b) => {
        const aDate = toDate(a.data) || toDate(a.date) || toDate(a.createdAt);
        const bDate = toDate(b.data) || toDate(b.date) || toDate(b.createdAt);
        if (!aDate && !bDate) return 0;
        if (!aDate) return 1;
        if (!bDate) return -1;
        return bDate.getTime() - aDate.getTime();
    });

    renderHistory(panel, student, combined, handlers);
}

function attachRecommendedActions(container, handlers) {
    container.querySelectorAll('[data-action]').forEach(button => {
        button.addEventListener('click', () => {
            const action = button.getAttribute('data-action');
            if (action === 'create-first') return;
            const id = button.getAttribute('data-id');
            handlers.onAction(action, id);
        });
    });
}

function createHistoryPanel() {
    const panel = document.createElement('aside');
    panel.className = 'evaluation-history-panel';
    panel.innerHTML = `
        <div class="history-header">
            <h3 data-role="history-title">Histórico</h3>
            <button type="button" class="history-close" data-role="history-close">Fechar</button>
        </div>
        <div class="history-body" data-role="history-content"></div>
    `;
    return panel;
}

function openStudentSelectionModal(students, onSelect) {
    document.querySelectorAll('.evaluation-select-modal').forEach(existing => existing.remove());

    const list = Array.isArray(students)
        ? [...students].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
        : [];

    const modal = document.createElement('div');
    modal.className = 'modal evaluation-select-modal';
    modal.innerHTML = `
        <div class="modal-content evaluation-select-modal__content" role="dialog" aria-modal="true">
            <header class="evaluation-select-modal__header">
                <h3 class="evaluation-select-modal__title">Selecionar aluno</h3>
                <button type="button" class="evaluation-select-modal__close" aria-label="Fechar seleção">&times;</button>
            </header>
            <div class="evaluation-select-modal__body">
                <div class="evaluation-select-modal__search">
                    <input type="search" placeholder="Buscar por nome" aria-label="Buscar aluno" />
                </div>
                <div class="evaluation-select-modal__list" data-role="students"></div>
            </div>
        </div>
    `;

    const listContainer = modal.querySelector('[data-role="students"]');
    const searchInput = modal.querySelector('input[type="search"]');
    const closeButton = modal.querySelector('.evaluation-select-modal__close');

    let currentTerm = '';

    const close = () => {
        document.removeEventListener('keydown', handleKeydown);
        modal.remove();
    };

    const handleKeydown = event => {
        if (event.key === 'Escape') {
            event.preventDefault();
            close();
        }
    };

    const renderList = () => {
        const searchValue = currentTerm.trim();
        const normalizedTerm = searchValue.toLowerCase();
        const filtered = normalizedTerm
            ? list.filter(student => student.name.toLowerCase().includes(normalizedTerm))
            : list;

        if (!filtered.length) {
            listContainer.innerHTML = '<p class="evaluation-select-modal__empty">Nenhum aluno encontrado.</p>';
            return;
        }

        listContainer.innerHTML = filtered.map(student => `
            <div class="evaluation-select-modal__item" data-id="${student.id}">
                <div class="evaluation-select-modal__info">
                    <span class="evaluation-select-modal__name">${highlightTerm(student.name, searchValue)}</span>
                </div>
                <button type="button" class="evaluation-select-modal__action" data-id="${student.id}">Avaliar</button>
            </div>
        `).join('');

        listContainer.querySelectorAll('button[data-id]').forEach(button => {
            button.addEventListener('click', () => {
                const id = button.getAttribute('data-id');
                if (id && typeof onSelect === 'function') {
                    close();
                    onSelect(id);
                }
            });
        });
    };

    if (searchInput) {
        searchInput.addEventListener('input', () => {
            currentTerm = searchInput.value;
            renderList();
        });
    }

    if (closeButton) {
        closeButton.addEventListener('click', close);
    }

    modal.addEventListener('click', event => {
        if (event.target === modal) {
            close();
        }
    });

    document.addEventListener('keydown', handleKeydown);

    renderList();
    document.body.appendChild(modal);

    if (searchInput) {
        setTimeout(() => searchInput.focus(), 0);
    }
}

function openNewEvaluation(studentId) {
    if (!studentId) return;
    window.location.href = `nova_avaliacao.html?id=${encodeURIComponent(studentId)}`;
}

function handleHistoryAction(action, student, entryId, card) {
    if (!entryId) {
        alert('Registro sem identificador disponível.');
        return;
    }
    if (action === 'view') {
        window.location.href = `visualizar_avaliacao.html?alunoId=${encodeURIComponent(student.id)}&avaliacaoId=${encodeURIComponent(entryId)}`;
        return;
    }
    if (action === 'edit') {
        const storageKey = `currentAvalId_${student.id}`;
        localStorage.setItem(storageKey, entryId);
        openNewEvaluation(student.id);
        return;
    }
    if (action === 'delete') {
        if (!confirm('Deseja excluir esta avaliação local?')) return;
        const storageKey = `avaliacoes_${student.id}`;
        const list = collectHistory(student).filter(item => String(item.id) !== String(entryId));
        localStorage.setItem(storageKey, JSON.stringify(list));
        if (card) {
            card.remove();
        }
    }
}

function attachTableActions(container, handlers) {
    container.querySelectorAll('[data-action]').forEach(button => {
        button.addEventListener('click', () => {
            const action = button.getAttribute('data-action');
            const id = button.getAttribute('data-id');
            handlers.onAction(action, id);
        });
    });
}

export async function loadAvaliacoesSection() {
    const content = document.getElementById('content');
    if (!content) return;

    content.innerHTML = '<div class="evaluations-loading">Carregando...</div>';

    const studentsRaw = await listEvaluationStudents();
    const students = studentsRaw.map(computeStatus);

    const state = {
        students,
        searchTerm: '',
        filters: {
            vencidos: false,
            sem: false,
            aVencer: false
        },
        sort: { field: 'name', direction: 'asc' },
        visible: PAGE_SIZE,
        onClearFilters: () => {
            state.filters = { vencidos: false, sem: false, aVencer: false };
            state.searchTerm = '';
            searchInput.value = '';
            state.visible = PAGE_SIZE;
            update();
        }
    };

    const page = document.createElement('div');
    page.className = 'evaluations-page';
    page.innerHTML = `
        <header class="evaluations-toolbar">
            <div>
                <h2>Avaliação Física</h2>
                <p>Gerencie avaliações, acompanhe pendências e programe os próximos encontros.</p>
            </div>
            <button type="button" class="primary-action" data-role="create">+ Nova avaliação</button>
        </header>
        <section class="evaluations-recommended">
            <div class="section-heading">
                <h3>Atividades recomendadas</h3>
                <p>Alunos sem avaliação ou com avaliação vencida (última &gt; 60 dias).</p>
            </div>
            <div class="recommended-content" data-role="recommended"></div>
        </section>
        <section class="evaluations-controls">
            <div class="search-wrapper">
                <input type="search" placeholder="Buscar por nome" aria-label="Buscar aluno" data-role="search" />
            </div>
            <div class="filters" data-role="filters">
                <button type="button" data-filter="vencidos">${FILTER_LABELS.vencidos} (0)</button>
                <button type="button" data-filter="sem">${FILTER_LABELS.sem} (0)</button>
                <button type="button" data-filter="aVencer">${FILTER_LABELS.aVencer} (0)</button>
            </div>
        </section>
        <section class="evaluations-table-wrapper">
            <div class="table-container" data-role="table"></div>
            <div class="table-footer" data-role="footer">
                <button type="button" data-role="load-more">Carregar mais</button>
            </div>
        </section>
    `;

    const historyPanel = createHistoryPanel();
    page.appendChild(historyPanel);

    content.innerHTML = '';
    content.appendChild(page);

    const recommendedContainer = page.querySelector('[data-role="recommended"]');
    const tableContainer = page.querySelector('[data-role="table"]');
    const footer = page.querySelector('[data-role="footer"]');
    const loadMoreBtn = footer?.querySelector('[data-role="load-more"]');
    const searchInput = page.querySelector('[data-role="search"]');
    const filterButtons = page.querySelectorAll('[data-filter]');
    const createButton = page.querySelector('[data-role="create"]');

    const handlers = {
        onAction: (action, id) => {
            const student = state.students.find(item => item.id === id);
            if (!student) return;
            if (action === 'new') {
                openNewEvaluation(student.id);
                return;
            }
            if (action === 'history') {
                loadHistory(student, historyPanel, {
                    onHistoryAction: (historyAction, st, entryId, card) => handleHistoryAction(historyAction, st, entryId, card)
                });
                return;
            }
            if (action === 'export') {
                alert('Exportação/Impressão ainda não implementada para este aluno.');
            }
        }
    };

    const updateRecommended = () => {
        const list = buildRecommendedList(state.students);
        renderRecommended(recommendedContainer, list, {
            onCreateFirst: () => {
                if (!state.students.length) return;
                const first = state.students[0];
                openNewEvaluation(first.id);
            },
            onAction: handlers.onAction
        }, state.searchTerm);
        if (recommendedContainer) {
            attachRecommendedActions(recommendedContainer, handlers);
        }
    };

    const updateTable = () => {
        const filtered = filterStudents(state.students, state);
        const visibleStudents = filtered.slice(0, state.visible);
        renderTable(tableContainer, visibleStudents, state, state.searchTerm);
        if (tableContainer) {
            attachTableActions(tableContainer, handlers);
        }
        if (loadMoreBtn) {
            if (visibleStudents.length >= filtered.length) {
                loadMoreBtn.classList.add('is-hidden');
            } else {
                loadMoreBtn.classList.remove('is-hidden');
            }
        }
    };

    const updateFilters = () => {
        const counts = computeFilterCounts(state.students, state.searchTerm);
        filterButtons.forEach(button => {
            const key = button.getAttribute('data-filter');
            const active = state.filters[key];
            const label = FILTER_LABELS[key] || button.textContent.split('(')[0].trim();
            button.textContent = `${label} (${counts[key] || 0})`;
            button.classList.toggle('is-active', Boolean(active));
        });
    };

    let searchTimeout;
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                state.searchTerm = searchInput.value.trim();
                state.visible = PAGE_SIZE;
                update();
            }, SEARCH_DEBOUNCE);
        });
    }

    filterButtons.forEach(button => {
        button.addEventListener('click', () => {
            const key = button.getAttribute('data-filter');
            state.filters[key] = !state.filters[key];
            state.visible = PAGE_SIZE;
            update();
        });
    });

    if (loadMoreBtn) {
        loadMoreBtn.addEventListener('click', () => {
            state.visible += PAGE_SIZE;
            updateTable();
            if (tableContainer) {
                attachTableActions(tableContainer, handlers);
            }
        });
    }

    page.addEventListener('click', event => {
        const button = event.target.closest('button[data-sort]');
        if (!button) return;
        const field = button.getAttribute('data-sort');
        if (!field) return;
        if (state.sort.field === field) {
            state.sort.direction = state.sort.direction === 'asc' ? 'desc' : 'asc';
        } else {
            state.sort.field = field;
            state.sort.direction = 'asc';
        }
        state.visible = PAGE_SIZE;
        updateTable();
    });

    if (createButton) {
        createButton.addEventListener('click', () => {
            openStudentSelectionModal(state.students, id => openNewEvaluation(id));
        });
    }

    const closeHistoryBtn = historyPanel.querySelector('[data-role="history-close"]');
    if (closeHistoryBtn) {
        closeHistoryBtn.addEventListener('click', () => {
            historyPanel.classList.remove('is-open');
        });
    }

    function update() {
        updateRecommended();
        updateFilters();
        updateTable();
    }

    update();
}
