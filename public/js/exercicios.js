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
    const exerciciosOptions = exercicios.map(e => `<option value="${e.nome}"></option>`).join('');
    const categoriaOptions = CATEGORIAS.map(c => `<option value="${c}">${c}</option>`).join('');
    const grupoOptions = GRUPOS.map(g => `<option value="${g}">${g}</option>`).join('');

    container.innerHTML = `
        <h2>Exercícios Personalizados</h2>
        <form id="novoExercicio">
            <input type="text" name="nome" list="exerciciosOptions" placeholder="Nome" required />
            <datalist id="exerciciosOptions">${exerciciosOptions}</datalist>
            <div class="exerciseOptions">
                <h3 id="exercicioTitle">Categoria<h3/>
                <select name="categoria">${categoriaOptions}</select>
            </div>
            <div class="exerciseOptions">
                <h3 id="exercicioTitle" >Grupo Muscular Principal<h3/>
                <select name="grupoPrincipal">${grupoOptions}</select>
            </div>
            <div class="exerciseOptions">
                <h3 id="exercicioTitle">Outros Grupos Se Houver<h3/>
                <select name="grupos" multiple>${grupoOptions}</select>
            </div>
            <button type="submit">Criar</button>
        </form>
        <h2>Métodos de Treino</h2>
        <form id="novoMetodo">
            <input type="text" name="nome" placeholder="Nome" required />
            <input type="number" name="series" placeholder="Séries" />
            <input type="number" name="repeticoes" placeholder="Repetições" />
            <input type="text" name="observacoes" placeholder="Observações" />
            <button type="submit">Criar</button>
        </form>
        <ul id="listaMetodos">${metodos.map(m => `<li data-id="${m.id}" data-global="${m.global}" data-series="${m.series || ''}" data-repeticoes="${m.repeticoes || ''}" data-observacoes="${m.observacoes || ''}">${m.nome} <button class="editMetodo">Editar</button> <button class="delMetodo">Excluir</button></li>`).join('')}</ul>
        <h2>Buscar Exercícios</h2>
        <div id="filtros">
            <input type="text" id="fNome" placeholder="Nome" />
            <input type="text" id="fCategoria" placeholder="Categoria" />
            <input type="text" id="fGrupo" placeholder="Grupo muscular" />
            <button id="buscarEx">Buscar</button>
        </div>
        <table id="listaExercicios" class="table-exercicios">
            <thead>
                <tr>
                    <th data-sort="nome">Nome</th>
                    <th data-sort="categoria">Categoria</th>
                    <th data-sort="grupoMuscularPrincipal">Grupo Principal</th>
                    <th>Ações</th>
                </tr>
            </thead>
            <tbody>
                ${exercicios.map(e => `
                    <tr data-id="${e.id}" data-global="${e.global}" data-grupos="${(e.gruposMusculares || []).join(',')}">
                        <td class="col-nome">${e.nome}</td>
                        <td class="col-categoria">${e.categoria || ''}</td>
                        <td class="col-grupo">${e.grupoMuscularPrincipal || ''}</td>
                        <td><button class="editEx">Editar</button> <button class="delEx">Excluir</button></td>
                    </tr>`).join('')}
            </tbody>
        </table>
        <div id="editModal" class="modal hidden"><div class="modal-content"></div></div>
    `;

    document.getElementById('novoExercicio').addEventListener('submit', async e => {
        e.preventDefault();
        const form = e.target;
        const grupos = Array.from(form.grupos.selectedOptions).map(o => o.value);
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

    document.getElementById('novoMetodo').addEventListener('submit', async e => {
        e.preventDefault();
        const form = e.target;
        const body = {
            nome: form.nome.value,
            series: form.series.value,
            repeticoes: form.repeticoes.value,
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
            const li = btn.parentElement;
            if (confirm('Excluir método?')) {
                await fetchWithFreshToken(`/api/users/metodos/${li.dataset.id}?global=${li.dataset.global}`, { method: 'DELETE' });
                loadExerciciosSection();
            }
        });
    });

    document.querySelectorAll('#listaMetodos .editMetodo').forEach(btn => {
        btn.addEventListener('click', () => {
            const li = btn.parentElement;
            const data = {
                id: li.dataset.id,
                global: li.dataset.global,
                nome: li.firstChild.textContent.trim(),
                series: li.dataset.series,
                repeticoes: li.dataset.repeticoes,
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

    document.querySelectorAll('#listaExercicios .delEx').forEach(btn => {
        btn.addEventListener('click', async () => {
            const tr = btn.closest('tr');
            if (confirm('Excluir exercício?')) {
                await fetchWithFreshToken(`/api/users/exercicios/${tr.dataset.id}?global=${tr.dataset.global}`, { method: 'DELETE' });
                loadExerciciosSection();
            }
        });
    });

    document.querySelectorAll('#listaExercicios .editEx').forEach(btn => {
        btn.addEventListener('click', () => {
            const tr = btn.closest('tr');
            const data = {
                id: tr.dataset.id,
                global: tr.dataset.global,
                nome: tr.querySelector('.col-nome').textContent,
                categoria: tr.querySelector('.col-categoria').textContent,
                grupoMuscularPrincipal: tr.querySelector('.col-grupo').textContent,
                gruposMusculares: tr.dataset.grupos ? tr.dataset.grupos.split(',') : []
            };
            openExercicioModal(data);
        });
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
                const va = (a[col] || '').toLowerCase();
                const vb = (b[col] || '').toLowerCase();
                if (va < vb) return SORT_STATE.asc ? -1 : 1;
                if (va > vb) return SORT_STATE.asc ? 1 : -1;
                return 0;
            });
            updateTable();
        });
    });
}

function updateTable() {
    const tbody = document.querySelector('#listaExercicios tbody');
    if (!tbody) return;
    tbody.innerHTML = CURRENT_EXERCICIOS.map(e => `
        <tr data-id="${e.id}" data-global="${e.global}" data-grupos="${(e.gruposMusculares || []).join(',')}">
            <td class="col-nome">${e.nome}</td>
            <td class="col-categoria">${e.categoria || ''}</td>
            <td class="col-grupo">${e.grupoMuscularPrincipal || ''}</td>
            <td><button class="editEx">Editar</button> <button class="delEx">Excluir</button></td>
        </tr>
    `).join('');

    tbody.querySelectorAll('.delEx').forEach(btn => {
        btn.addEventListener('click', async () => {
            const tr = btn.closest('tr');
            if (confirm('Excluir exercício?')) {
                await fetchWithFreshToken(`/api/users/exercicios/${tr.dataset.id}?global=${tr.dataset.global}`, { method: 'DELETE' });
                loadExerciciosSection();
            }
        });
    });

    tbody.querySelectorAll('.editEx').forEach(btn => {
        btn.addEventListener('click', () => {
            const tr = btn.closest('tr');
            const data = {
                id: tr.dataset.id,
                global: tr.dataset.global,
                nome: tr.querySelector('.col-nome').textContent,
                categoria: tr.querySelector('.col-categoria').textContent,
                grupoMuscularPrincipal: tr.querySelector('.col-grupo').textContent,
                gruposMusculares: tr.dataset.grupos ? tr.dataset.grupos.split(',') : []
            };
            openExercicioModal(data);
        });
    });
}

function showModal(html, onSubmit) {
    const modal = document.getElementById('editModal');
    const content = modal.querySelector('.modal-content');
    content.innerHTML = html;
    modal.classList.remove('hidden');
    content.querySelector('.cancelModal').addEventListener('click', () => modal.classList.add('hidden'));
    const form = content.querySelector('form');
    form.addEventListener('submit', async e => {
        e.preventDefault();
        await onSubmit(form);
        modal.classList.add('hidden');
    });
}

function openExercicioModal(exercicio) {
    const categoriaOptions = CATEGORIAS.map(c => `<option value="${c}" ${c === exercicio.categoria ? 'selected' : ''}>${c}</option>`).join('');
    const grupoOptions = GRUPOS.map(g => `<option value="${g}" ${g === exercicio.grupoMuscularPrincipal ? 'selected' : ''}>${g}</option>`).join('');
    const multiOptions = GRUPOS.map(g => `<option value="${g}" ${exercicio.gruposMusculares.includes(g) ? 'selected' : ''}>${g}</option>`).join('');

    const html = `
        <form id="editExForm">
            <h3>Editar Exercício</h3>
            <input type="text" name="nome" value="${exercicio.nome}" required />
            <select name="categoria">${categoriaOptions}</select>
            <select name="grupoPrincipal">${grupoOptions}</select>
            <select name="grupos" multiple>${multiOptions}</select>
            <div>
                <button type="submit">Salvar</button>
                <button type="button" class="cancelModal">Cancelar</button>
            </div>
        </form>`;

    showModal(html, async form => {
        const grupos = Array.from(form.grupos.selectedOptions).map(o => o.value);
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
    const html = `
        <form id="editMetodoForm">
            <h3>Editar Método</h3>
            <input type="text" name="nome" value="${metodo.nome}" required />
            <input type="number" name="series" placeholder="Séries" value="${metodo.series || ''}" />
            <input type="number" name="repeticoes" placeholder="Repetições" value="${metodo.repeticoes || ''}" />
            <input type="text" name="observacoes" placeholder="Observações" value="${metodo.observacoes || ''}" />
            <div>
                <button type="submit">Salvar</button>
                <button type="button" class="cancelModal">Cancelar</button>
            </div>
        </form>`;

    showModal(html, async form => {
        const body = {
            nome: form.nome.value,
            series: form.series.value,
            repeticoes: form.repeticoes.value,
            observacoes: form.observacoes.value
        };
        await fetchWithFreshToken(`/api/users/metodos/${metodo.id}?global=${metodo.global}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        loadExerciciosSection();
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
