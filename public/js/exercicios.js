import { fetchWithFreshToken } from "./auth.js";

const CATEGORIAS = [
    'Musculação',
    'Cardio',
    'Mobilidade',
    'Alongamento'
];

export const GRUPOS = [
    'Peito',
    'Costas',
    'Bíceps',
    'Tríceps',
    'Ombros',
    'Quadríceps',
    'Posteriores',
    'Panturrilha',
    'Abdômen',
    'Glúteos'
];

let CURRENT_EXERCICIOS = [];
let SORT_STATE = { col: null, asc: true };
let SELECTED_EXERCICIOS = new Set();

function escapeHtml(value = '') {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function escapeAttribute(value = '') {
    return escapeHtml(value)
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function renderGrupoCheckboxes(selected = []) {
    const selectedSet = new Set(Array.isArray(selected) ? selected : []);
    return GRUPOS.map(grupo => {
        const checked = selectedSet.has(grupo) ? 'checked' : '';
        return `
            <label class="custom-checkbox">
                <input type="checkbox" name="grupos" value="${escapeAttribute(grupo)}" ${checked} />
                <span class="checkbox-box"></span>
                <span class="checkbox-label">${escapeHtml(grupo)}</span>
            </label>
        `;
    }).join('');
}

function collectSelectedGrupos(container) {
    return Array.from(container.querySelectorAll('input[name="grupos"]:checked')).map(input => input.value);
}

function normalizeRepeticoesValue(value) {
    if (Array.isArray(value)) {
        return value.map(v => String(v).trim()).filter(v => v !== '');
    }
    if (value === null || value === undefined) {
        return [];
    }
    const str = String(value).trim();
    return str ? [str] : [];
}

function parseRepeticoesDataset(value) {
    if (!value) return [];
    try {
        const parsed = JSON.parse(decodeURIComponent(value));
        return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
        console.warn('Não foi possível interpretar repeticoes salvas:', err);
        return [];
    }
}

function createRepeticaoInputs(series, values = []) {
    const items = [];
    for (let i = 0; i < series; i++) {
        const value = values[i] !== undefined ? values[i] : '';
        items.push(`
            <div class="repeticao-wrapper">
                <input type="text" class="repeticao-input" maxlength="4" inputmode="numeric" pattern="[0-9]*" placeholder="${i + 1}ª" value="${escapeAttribute(value)}" />
                ${i === 0 ? '<button type="button" class="fillAllReps">Preencher todos</button>' : ''}
            </div>
        `);
    }
    return items.join('');
}

function attachFillAllHandler(container) {
    const btn = container.querySelector('.fillAllReps');
    if (!btn) return;
    btn.addEventListener('click', () => {
        const inputs = container.querySelectorAll('.repeticao-input');
        if (!inputs.length) return;
        const value = inputs[0].value;
        inputs.forEach(input => {
            input.value = value;
        });
    });
}

function getRepeticoesValues(container) {
    return Array.from(container.querySelectorAll('.repeticao-input')).map(input => input.value.trim());
}

function setupRepeticoesField(form, seriesInput, container, initialValues = []) {
    const render = (series, values) => {
        const validSeries = series > 0 ? series : 0;
        container.innerHTML = createRepeticaoInputs(validSeries, values);
        attachFillAllHandler(container);
    };

    const initialSeriesValue = parseInt(seriesInput.value, 10);
    const initialSeries = Number.isFinite(initialSeriesValue) && initialSeriesValue > 0
        ? initialSeriesValue
        : (initialValues.length || 0);

    render(initialSeries, initialValues);

    seriesInput.addEventListener('input', () => {
        const currentValues = getRepeticoesValues(container);
        const parsed = parseInt(seriesInput.value, 10);
        const series = Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
        render(series, currentValues);
    });
}

function getExerciseKey(id, global) {
    return `${id}::${global ? '1' : '0'}`;
}

function parseExerciseKey(key) {
    const [id, flag] = key.split('::');
    return { id, global: flag === '1' };
}

function getSelectedExercises() {
    return Array.from(SELECTED_EXERCICIOS).map(parseExerciseKey);
}

function updateBulkButtonState() {
    const applyBtn = document.getElementById('applyBulkEdit');
    if (!applyBtn) return;
    const categoria = document.getElementById('bulkCategoria');
    const grupo = document.getElementById('bulkGrupo');
    const hasSelection = SELECTED_EXERCICIOS.size > 0;
    const hasUpdates = (categoria && categoria.value) || (grupo && grupo.value);
    applyBtn.disabled = !(hasSelection && hasUpdates);
}

function refreshSelectAllState() {
    const selectAll = document.getElementById('selectAllEx');
    const tbody = document.querySelector('#listaExercicios tbody');
    if (!selectAll || !tbody) return;
    const checkboxes = Array.from(tbody.querySelectorAll('.selectEx'));
    if (!checkboxes.length) {
        selectAll.checked = false;
        selectAll.indeterminate = false;
        return;
    }
    const checkedCount = checkboxes.filter(cb => cb.checked).length;
    selectAll.checked = checkedCount === checkboxes.length;
    selectAll.indeterminate = checkedCount > 0 && checkedCount < checkboxes.length;
}

function bindTableRowActions(tbody) {
    tbody.querySelectorAll('.selectEx').forEach(cb => {
        cb.addEventListener('change', () => {
            const key = cb.dataset.key;
            if (!key) return;
            if (cb.checked) {
                SELECTED_EXERCICIOS.add(key);
            } else {
                SELECTED_EXERCICIOS.delete(key);
            }
            updateBulkButtonState();
            refreshSelectAllState();
        });
    });

    tbody.querySelectorAll('.delEx').forEach(btn => {
        btn.addEventListener('click', async () => {
            const tr = btn.closest('tr');
            if (!tr) return;
            if (confirm('Excluir exercício?')) {
                await fetchWithFreshToken(`/api/users/exercicios/${tr.dataset.id}?global=${tr.dataset.global}`, { method: 'DELETE' });
                loadExerciciosSection();
            }
        });
    });

    tbody.querySelectorAll('.editEx').forEach(btn => {
        btn.addEventListener('click', () => {
            const tr = btn.closest('tr');
            if (!tr) return;
            const data = {
                id: tr.dataset.id,
                global: tr.dataset.global,
                nome: tr.querySelector('.col-nome')?.textContent || '',
                categoria: tr.querySelector('.col-categoria')?.textContent || '',
                grupoMuscularPrincipal: tr.querySelector('.col-grupo')?.textContent || '',
                gruposMusculares: tr.dataset.grupos ? tr.dataset.grupos.split(',').filter(Boolean) : []
            };
            openExercicioModal(data);
        });
    });
}

export async function loadExerciciosSection(filters = {}) {
    const content = document.getElementById("content");
    content.innerHTML = "<h2>Carregando...</h2>";

    try {
        const query = new URLSearchParams(filters).toString();
        const [exRes, metRes] = await Promise.all([
            fetchWithFreshToken(`/api/users/exercicios?${query}`),
            fetchWithFreshToken('/api/users/metodos')
        ]);
        const exercicios = await exRes.json();
        const metodos = await metRes.json();
        CURRENT_EXERCICIOS = exercicios;
        SORT_STATE = { col: null, asc: true };
        renderForms(content, exercicios, metodos);
    } catch (err) {
        console.error('Erro ao carregar dados de exercícios:', err);
        content.innerHTML = '<p style="color:red;">Erro ao carregar dados</p>';
    }
}

function renderForms(container, exercicios, metodos) {
    SELECTED_EXERCICIOS = new Set();
    const exerciciosOptions = exercicios.map(e => `<option value="${escapeAttribute(e.nome)}"></option>`).join('');
    const categoriaOptions = CATEGORIAS.map(c => `<option value="${escapeAttribute(c)}">${escapeHtml(c)}</option>`).join('');
    const grupoOptions = GRUPOS.map(g => `<option value="${escapeAttribute(g)}">${escapeHtml(g)}</option>`).join('');

    const metodosList = metodos.map(m => {
        const repeticoesList = normalizeRepeticoesValue(m.repeticoes);
        const repeticoesAttr = encodeURIComponent(JSON.stringify(repeticoesList));
        const infoParts = [];
        if (m.series) infoParts.push(`${m.series} séries`);
        if (repeticoesList.length) infoParts.push(`Reps: ${repeticoesList.join(' / ')}`);
        if (m.observacoes) infoParts.push(m.observacoes);
        const infoText = infoParts.join(' • ');
        return `
            <li data-id="${escapeAttribute(m.id)}" data-global="${m.global}" data-nome="${escapeAttribute(m.nome)}" data-series="${escapeAttribute(m.series || '')}" data-repeticoes='${repeticoesAttr}' data-observacoes="${escapeAttribute(m.observacoes || '')}">
                <div class="metodo-row">
                    <div class="metodo-text">
                        <strong>${escapeHtml(m.nome)}</strong>
                        ${infoText ? `<small>${escapeHtml(infoText)}</small>` : ''}
                    </div>
                    <div class="metodo-actions">
                        <button type="button" class="editMetodo">Editar</button>
                        <button type="button" class="delMetodo">Excluir</button>
                    </div>
                </div>
            </li>
        `;
    }).join('');

    container.innerHTML = `
        <h2>Exercícios Personalizados</h2>
        <form id="novoExercicio">
            <input type="text" name="nome" list="exerciciosOptions" placeholder="Nome" required />
            <datalist id="exerciciosOptions">${exerciciosOptions}</datalist>
            <div class="exerciseOptions">
                <h3 id="exercicioTitle">Categoria</h3>
                <select name="categoria">${categoriaOptions}</select>
            </div>
            <div class="exerciseOptions">
                <h3 id="exercicioTitle">Grupo Muscular Principal</h3>
                <select name="grupoPrincipal">${grupoOptions}</select>
            </div>
            <div class="exerciseOptions">
                <h3 id="exercicioTitle">Outros Grupos Se Houver</h3>
                <div class="custom-checkboxes">
                    ${renderGrupoCheckboxes()}
                </div>
            </div>
            <button type="submit">Criar</button>
        </form>
        <h2>Métodos de Treino</h2>
        <form id="novoMetodo">
            <input type="text" name="nome" placeholder="Nome" required />
            <input type="number" name="series" min="0" placeholder="Séries" />
            <div class="repeticoes-group">
                <label>Repetições</label>
                <div class="repeticoes-inputs"></div>
            </div>
            <input type="text" name="observacoes" placeholder="Observações" />
            <button type="submit">Criar</button>
        </form>
        <ul id="listaMetodos" class="lista-metodos">${metodosList}</ul>
        <h2>Edição em Massa</h2>
        <div id="bulkEdit" class="bulk-edit">
            <div class="bulk-controls">
                <select id="bulkCategoria">
                    <option value="">Categoria (manter)</option>
                    ${categoriaOptions}
                </select>
                <select id="bulkGrupo">
                    <option value="">Grupo principal (manter)</option>
                    ${grupoOptions}
                </select>
                <button type="button" id="applyBulkEdit" disabled>Aplicar edição</button>
            </div>
            <small>Selecione os exercícios abaixo para atualizar categoria e/ou grupo principal.</small>
        </div>
        <h2>Buscar Exercícios</h2>
        <div id="filtros">
            <input type="text" id="fNome" placeholder="Nome" />
            <input type="text" id="fCategoria" placeholder="Categoria" />
            <input type="text" id="fGrupo" placeholder="Grupo muscular" />
            <button id="buscarEx" type="button">Buscar</button>
        </div>
        <table id="listaExercicios" class="table-exercicios">
            <thead>
                <tr>
                    <th class="col-select"><input type="checkbox" id="selectAllEx" /></th>
                    <th data-sort="nome">Nome</th>
                    <th data-sort="categoria">Categoria</th>
                    <th data-sort="grupoMuscularPrincipal">Grupo Principal</th>
                    <th>Ações</th>
                </tr>
            </thead>
            <tbody></tbody>
        </table>
        <div id="editModal" class="modal hidden"><div class="modal-content"></div></div>
    `;

    const novoExercicioForm = document.getElementById('novoExercicio');
    novoExercicioForm.addEventListener('submit', async e => {
        e.preventDefault();
        const form = e.target;
        const gruposContainer = form.querySelector('.custom-checkboxes');
        const grupos = collectSelectedGrupos(gruposContainer);
        const body = {
            nome: form.nome.value,
            categoria: form.categoria.value,
            grupoMuscularPrincipal: form.grupoPrincipal.value,
            gruposMusculares: grupos
        };
        const resp = await fetchWithFreshToken('/api/users/exercicios', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        if (resp.ok) {
            loadExerciciosSection();
        } else {
            alert('Erro ao criar exercício');
        }
    });

    const novoMetodoForm = document.getElementById('novoMetodo');
    const seriesInput = novoMetodoForm.querySelector('input[name="series"]');
    const repeticoesContainer = novoMetodoForm.querySelector('.repeticoes-inputs');
    setupRepeticoesField(novoMetodoForm, seriesInput, repeticoesContainer, []);
    novoMetodoForm.addEventListener('submit', async e => {
        e.preventDefault();
        const form = e.target;
        const repeticoes = getRepeticoesValues(repeticoesContainer);
        const body = {
            nome: form.nome.value,
            series: form.series.value,
            repeticoes,
            observacoes: form.observacoes.value
        };
        const resp = await fetchWithFreshToken('/api/users/metodos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        if (resp.ok) {
            loadExerciciosSection();
        } else {
            alert('Erro ao criar método');
        }
    });

    document.querySelectorAll('#listaMetodos .delMetodo').forEach(btn => {
        btn.addEventListener('click', async () => {
            const li = btn.closest('li');
            if (!li) return;
            if (confirm('Excluir método?')) {
                await fetchWithFreshToken(`/api/users/metodos/${li.dataset.id}?global=${li.dataset.global}`, { method: 'DELETE' });
                loadExerciciosSection();
            }
        });
    });

    document.querySelectorAll('#listaMetodos .editMetodo').forEach(btn => {
        btn.addEventListener('click', () => {
            const li = btn.closest('li');
            if (!li) return;
            const data = {
                id: li.dataset.id,
                global: li.dataset.global,
                nome: li.dataset.nome,
                series: li.dataset.series,
                repeticoes: parseRepeticoesDataset(li.dataset.repeticoes),
                observacoes: li.dataset.observacoes
            };
            openMetodoModal(data);
        });
    });

    document.getElementById('buscarEx').addEventListener('click', () => {
        const nome = document.getElementById('fNome').value;
        const categoria = document.getElementById('fCategoria').value;
        const grupo = document.getElementById('fGrupo').value;
        loadExerciciosSection({ nome, categoria, grupo });
    });

    const applyBulkBtn = document.getElementById('applyBulkEdit');
    applyBulkBtn.addEventListener('click', async () => {
        const exerciciosSelecionados = getSelectedExercises();
        if (!exerciciosSelecionados.length) {
            alert('Selecione ao menos um exercício.');
            return;
        }
        const categoriaSel = document.getElementById('bulkCategoria');
        const grupoSel = document.getElementById('bulkGrupo');
        const payload = { exercicios: exerciciosSelecionados };
        if (categoriaSel.value) payload.categoria = categoriaSel.value;
        if (grupoSel.value) payload.grupoMuscularPrincipal = grupoSel.value;
        if (!payload.categoria && !payload.grupoMuscularPrincipal) {
            alert('Defina ao menos um campo para atualizar.');
            return;
        }
        applyBulkBtn.disabled = true;
        try {
            const resp = await fetchWithFreshToken('/api/users/exercicios', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (!resp.ok) {
                const data = await resp.json().catch(() => ({}));
                throw new Error(data.error || 'Erro ao aplicar edição em massa');
            }
            categoriaSel.value = '';
            grupoSel.value = '';
            SELECTED_EXERCICIOS.clear();
            loadExerciciosSection();
        } catch (err) {
            alert(err.message);
        } finally {
            applyBulkBtn.disabled = false;
            updateBulkButtonState();
        }
    });

    document.getElementById('bulkCategoria').addEventListener('change', updateBulkButtonState);
    document.getElementById('bulkGrupo').addEventListener('change', updateBulkButtonState);

    const selectAll = document.getElementById('selectAllEx');
    selectAll.addEventListener('change', () => {
        const tbody = document.querySelector('#listaExercicios tbody');
        if (!tbody) return;
        const checkboxes = tbody.querySelectorAll('.selectEx');
        SELECTED_EXERCICIOS.clear();
        checkboxes.forEach(cb => {
            cb.checked = selectAll.checked;
            if (selectAll.checked) {
                SELECTED_EXERCICIOS.add(cb.dataset.key);
            }
        });
        updateBulkButtonState();
        refreshSelectAllState();
    });

    document.querySelectorAll('#listaExercicios th[data-sort]').forEach(th => {
        th.addEventListener('click', () => {
            const col = th.dataset.sort;
            if (SORT_STATE.col === col) {
                SORT_STATE.asc = !SORT_STATE.asc;
            } else {
                SORT_STATE.col = col;
                SORT_STATE.asc = true;
            }
            CURRENT_EXERCICIOS.sort((a, b) => {
                const va = (a[col] || '').toString().toLowerCase();
                const vb = (b[col] || '').toString().toLowerCase();
                if (va < vb) return SORT_STATE.asc ? -1 : 1;
                if (va > vb) return SORT_STATE.asc ? 1 : -1;
                return 0;
            });
            updateTable();
        });
    });

    updateTable();
    updateBulkButtonState();
}

function updateTable() {
    const tbody = document.querySelector('#listaExercicios tbody');
    if (!tbody) return;

    const validKeys = new Set(CURRENT_EXERCICIOS.map(e => getExerciseKey(e.id, e.global)));
    SELECTED_EXERCICIOS = new Set(Array.from(SELECTED_EXERCICIOS).filter(key => validKeys.has(key)));

    tbody.innerHTML = CURRENT_EXERCICIOS.map(e => {
        const key = getExerciseKey(e.id, e.global);
        const checked = SELECTED_EXERCICIOS.has(key) ? 'checked' : '';
        const gruposAttr = escapeAttribute((Array.isArray(e.gruposMusculares) ? e.gruposMusculares : []).join(','));
        return `
            <tr data-id="${escapeAttribute(e.id)}" data-global="${e.global}" data-grupos="${gruposAttr}">
                <td class="col-select"><input type="checkbox" class="selectEx" data-key="${escapeAttribute(key)}" ${checked} /></td>
                <td class="col-nome">${escapeHtml(e.nome)}</td>
                <td class="col-categoria">${escapeHtml(e.categoria || '')}</td>
                <td class="col-grupo">${escapeHtml(e.grupoMuscularPrincipal || '')}</td>
                <td><button type="button" class="editEx">Editar</button> <button type="button" class="delEx">Excluir</button></td>
            </tr>
        `;
    }).join('');

    bindTableRowActions(tbody);
    refreshSelectAllState();
    updateBulkButtonState();
}

function showModal(html, onSubmit, onReady) {
    const modal = document.getElementById('editModal');
    const content = modal.querySelector('.modal-content');
    content.innerHTML = html;
    modal.classList.remove('hidden');
    const cancelBtn = content.querySelector('.cancelModal');
    if (cancelBtn) {
        cancelBtn.addEventListener('click', () => modal.classList.add('hidden'));
    }
    const form = content.querySelector('form');
    if (typeof onReady === 'function' && form) {
        onReady(form, modal);
    }
    if (form) {
        form.addEventListener('submit', async e => {
            e.preventDefault();
            await onSubmit(form);
            modal.classList.add('hidden');
        });
    }
}

function openExercicioModal(exercicio) {
    const categoriaOptions = CATEGORIAS.map(c => `<option value="${escapeAttribute(c)}" ${c === exercicio.categoria ? 'selected' : ''}>${escapeHtml(c)}</option>`).join('');
    const grupoOptions = GRUPOS.map(g => `<option value="${escapeAttribute(g)}" ${g === exercicio.grupoMuscularPrincipal ? 'selected' : ''}>${escapeHtml(g)}</option>`).join('');

    const html = `
        <form id="editExForm">
            <h3>Editar Exercício</h3>
            <input type="text" name="nome" value="${escapeAttribute(exercicio.nome)}" required />
            <select name="categoria">${categoriaOptions}</select>
            <select name="grupoPrincipal">${grupoOptions}</select>
            <div class="exerciseOptions">
                <h4>Outros Grupos</h4>
                <div class="custom-checkboxes">
                    ${renderGrupoCheckboxes(exercicio.gruposMusculares)}
                </div>
            </div>
            <div class="modal-actions">
                <button type="submit">Salvar</button>
                <button type="button" class="cancelModal">Cancelar</button>
            </div>
        </form>`;

    showModal(html, async form => {
        const grupos = collectSelectedGrupos(form.querySelector('.custom-checkboxes'));
        const body = {
            nome: form.nome.value,
            categoria: form.categoria.value,
            grupoMuscularPrincipal: form.grupoPrincipal.value,
            gruposMusculares: grupos
        };
        await fetchWithFreshToken(`/api/users/exercicios/${exercicio.id}?global=${exercicio.global}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        loadExerciciosSection();
    });
}

function openMetodoModal(metodo) {
    const repeticoesList = normalizeRepeticoesValue(metodo.repeticoes);
    const defaultSeries = metodo.series || (repeticoesList.length ? String(repeticoesList.length) : '');

    const html = `
        <form id="editMetodoForm">
            <h3>Editar Método</h3>
            <input type="text" name="nome" value="${escapeAttribute(metodo.nome)}" required />
            <input type="number" name="series" min="0" placeholder="Séries" value="${escapeAttribute(defaultSeries)}" />
            <div class="repeticoes-group">
                <label>Repetições</label>
                <div class="repeticoes-inputs"></div>
            </div>
            <input type="text" name="observacoes" placeholder="Observações" value="${escapeAttribute(metodo.observacoes || '')}" />
            <div class="modal-actions">
                <button type="submit">Salvar</button>
                <button type="button" class="cancelModal">Cancelar</button>
            </div>
        </form>`;

    showModal(html, async form => {
        const repeticoes = getRepeticoesValues(form.querySelector('.repeticoes-inputs'));
        const body = {
            nome: form.nome.value,
            series: form.series.value,
            repeticoes,
            observacoes: form.observacoes.value
        };
        await fetchWithFreshToken(`/api/users/metodos/${metodo.id}?global=${metodo.global}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        loadExerciciosSection();
    }, form => {
        const seriesField = form.querySelector('input[name="series"]');
        const repsContainer = form.querySelector('.repeticoes-inputs');
        setupRepeticoesField(form, seriesField, repsContainer, repeticoesList);
    });
}

export async function fetchExerciciosMap() {
    const res = await fetchWithFreshToken('/api/users/exercicios');
    const exercicios = await res.json();
    const map = {};
    exercicios.forEach(e => {
        const cat = e.categoria || 'Outros';
        if (!map[cat]) map[cat] = [];
        map[cat].push(e);
    });
    return map;
}

export async function fetchMetodos() {
    const res = await fetchWithFreshToken('/api/users/metodos');
    return await res.json();
}
