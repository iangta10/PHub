import { fetchWithFreshToken } from "./auth.js";
import { fetchExerciciosMap, fetchMetodos, GRUPOS } from "./exercicios.js";

let EXERCICIOS_MAP = {};
let TODAS_CATEGORIAS = [];
let TODOS_EXERCICIOS = [];
let METODOS = [];
let TODOS_EXERCICIOS_OBJ = [];
let CAT_OPTIONS = '';
let GRUPO_OPTIONS = '';
let activeDiaIndex = 0;
let ALUNOS_BY_ID = new Map();

function calcularIdade(dataNascimento) {
    if (!dataNascimento) return '';
    const nasc = new Date(dataNascimento);
    if (Number.isNaN(nasc.getTime())) return '';
    const hoje = new Date();
    let idade = hoje.getFullYear() - nasc.getFullYear();
    const mes = hoje.getMonth() - nasc.getMonth();
    if (mes < 0 || (mes === 0 && hoje.getDate() < nasc.getDate())) {
        idade--;
    }
    return idade >= 0 ? idade : '';
}

function escapeHtml(value = '') {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function escapeAttribute(value = '') {
    return escapeHtml(value)
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function formatDateLabel(value) {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return String(value);
    }
    return date.toLocaleDateString('pt-BR');
}

function getTodayInputValue() {
    const today = new Date();
    const adjusted = new Date(today.getTime() - today.getTimezoneOffset() * 60000);
    return adjusted.toISOString().slice(0, 10);
}

function getAlunoModalidade(aluno = {}) {
    const direct = (aluno.modalidade || '').toString().toLowerCase();
    if (direct) return direct;

    const plano = aluno.plano && typeof aluno.plano === 'object' ? aluno.plano : {};
    const planModalidade = (plano.modalidade || '').toString().toLowerCase();
    if (planModalidade) return planModalidade;

    const planId = (plano.id || aluno.planId || '').toString().toLowerCase();
    const planName = (plano.nome || '').toString().toLowerCase();
    if (planId.startsWith('presencial') || planName.includes('presencial')) return 'presencial';
    if (planId.includes('treino') || planName.includes('treino')) return 'online';

    return '';
}

function isPresencialAluno(aluno = {}) {
    return getAlunoModalidade(aluno) === 'presencial';
}

function parseRepeticoesValue(value) {
    if (Array.isArray(value)) {
        return value.map(item => String(item ?? '').trim());
    }
    if (value === null || value === undefined || value === '') return [];
    return String(value)
        .split(/[\/,;|]+/)
        .map(item => item.trim())
        .filter(item => item !== '');
}

function parseRepeticoesDataset(value) {
    if (!value) return [];
    try {
        const parsed = JSON.parse(decodeURIComponent(value));
        return Array.isArray(parsed) ? parsed.map(item => String(item ?? '').trim()) : [];
    } catch (err) {
        console.warn('Não foi possível interpretar as repetições do método:', err);
        return [];
    }
}

function normalizeSeriesCount(value, fallback = 0) {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function expandRepsToSeries(seriesCount, repsList = []) {
    const count = normalizeSeriesCount(seriesCount, repsList.length);
    if (!count) return [];
    const normalized = parseRepeticoesValue(repsList);
    return Array.from({ length: count }, (_, index) => {
        if (normalized[index] !== undefined) return normalized[index];
        if (normalized.length === 1) return normalized[0];
        return '';
    });
}

function getSeriesDetalhadas(exDiv) {
    const rows = Array.from(exDiv.querySelectorAll('.serie-planejada'));
    return rows.map((row, index) => ({
        numero: index + 1,
        repeticoes: row.querySelector('.serieReps')?.value?.trim() || ''
    }));
}

function getRepsFromSeriesDetalhadas(exDiv) {
    return getSeriesDetalhadas(exDiv).map(serie => serie.repeticoes);
}

function formatRepeticoesResumo(seriesDetalhadas = [], fallback = '') {
    const reps = seriesDetalhadas.map(serie => serie.repeticoes).filter(Boolean);
    if (!reps.length) return fallback || null;
    const unique = Array.from(new Set(reps));
    return unique.length === 1 ? unique[0] : reps.join(' / ');
}

function getExerciseSeriesPlan(ex = {}) {
    if (Array.isArray(ex.seriesDetalhadas) && ex.seriesDetalhadas.length) {
        return ex.seriesDetalhadas.map((serie, index) => ({
            numero: Number(serie.numero) || index + 1,
            repeticoes: serie.repeticoes ?? ''
        }));
    }

    const repsList = parseRepeticoesValue(ex.repeticoes);
    const count = normalizeSeriesCount(ex.series, repsList.length || 1);
    return expandRepsToSeries(count, repsList).map((repeticoes, index) => ({
        numero: index + 1,
        repeticoes
    }));
}

function formatExercisePrescription(ex = {}) {
    const plan = getExerciseSeriesPlan(ex);
    if (plan.length) {
        const reps = plan.map(serie => serie.repeticoes).filter(Boolean);
        const unique = Array.from(new Set(reps));
        if (unique.length === 1 && unique[0]) return `${plan.length}x${unique[0]}`;
        if (reps.length) return `${plan.length} séries (${reps.join(' / ')})`;
        return `${plan.length} séries`;
    }
    return `${ex.series || ''}x${ex.repeticoes || ''}`;
}

function renderSeriesDetalhesForExercise(exDiv, seriesValue, repsValues = []) {
    const seriesDetalhes = exDiv.querySelector('.seriesDetalhes');
    if (!seriesDetalhes) return;
    const currentValues = Array.isArray(repsValues) ? repsValues : parseRepeticoesValue(repsValues);
    const count = normalizeSeriesCount(seriesValue, currentValues.length);
    if (!count) {
        seriesDetalhes.innerHTML = '';
        return;
    }
    const reps = expandRepsToSeries(count, currentValues);
    seriesDetalhes.innerHTML = reps.map((rep, index) => `
        <label class="serie-planejada">
            <span>Serie ${index + 1}</span>
            <input type="text" class="serieReps" inputmode="numeric" placeholder="Reps" value="${escapeAttribute(rep)}" />
        </label>
    `).join('');
}

function updateProximoOptions() {
    const select = document.querySelector('#configFicha select[name="proximoTreino"]');
    if (!select) return;
    const dias = Array.from(document.querySelectorAll('#diasContainer .dia')).map((d, idx) => {
        const nome = d.querySelector('.nomeDia').value.trim();
        return nome || `Dia ${idx + 1}`;
    });
    select.innerHTML = dias.map((n, i) => `<option value="${i}">${n}</option>`).join('');
}

function createTab(idx, name) {
    const ul = document.getElementById('diaTabs');
    if (!ul) return;
    const li = document.createElement('li');
    li.dataset.idx = idx;
    li.textContent = name || `Dia ${idx + 1}`;
    li.addEventListener('click', () => activateDia(idx));
    ul.appendChild(li);
}

function updateTabName(idx, name) {
    const li = document.querySelector(`#diaTabs li[data-idx="${idx}"]`);
    if (li) li.textContent = name || `Dia ${idx + 1}`;
}

function activateDia(idx) {
    const dias = document.querySelectorAll('#diasContainer .dia');
    const tabs = document.querySelectorAll('#diaTabs li');
    dias.forEach((d, i) => { d.style.display = i === idx ? '' : 'none'; });
    tabs.forEach((t, i) => { t.classList.toggle('active', i === idx); });
    activeDiaIndex = idx;
}

function getDias() {
    return Array.from(document.querySelectorAll('#diasContainer .dia'));
}

function getDiaName(dia, idx) {
    const nome = dia.querySelector('.nomeDia')?.value?.trim();
    return nome || `Dia ${idx + 1}`;
}

function refreshDiaTabs(preferredIdx = activeDiaIndex) {
    const ul = document.getElementById('diaTabs');
    if (!ul) return;

    const dias = getDias();
    ul.innerHTML = '';
    dias.forEach((dia, idx) => {
        dia.dataset.idx = idx;
        const numero = dia.querySelector('.diaNumero');
        if (numero) numero.textContent = idx + 1;
        const removeBtn = dia.querySelector('.removeDia');
        if (removeBtn) {
            removeBtn.disabled = dias.length <= 1;
            removeBtn.title = dias.length <= 1 ? 'A ficha precisa ter pelo menos um dia' : 'Remover dia';
        }
        createTab(idx, getDiaName(dia, idx));
    });

    updateProximoOptions();

    if (dias.length) {
        const nextIdx = Math.min(Math.max(preferredIdx, 0), dias.length - 1);
        activateDia(nextIdx);
    }
}

function removeDia(diaDiv) {
    const dias = getDias();
    if (dias.length <= 1) return;

    const currentIdx = dias.indexOf(diaDiv);
    diaDiv.remove();
    refreshDiaTabs(Math.min(currentIdx, getDias().length - 1));
}

function resetDiasForm() {
    const diasContainer = document.getElementById('diasContainer');
    const tabs = document.getElementById('diaTabs');
    if (diasContainer) diasContainer.innerHTML = '';
    if (tabs) tabs.innerHTML = '';
    activeDiaIndex = 0;
    addDia();
}

export async function loadTreinosSection(alunoIdParam = '') {
    const content = document.getElementById("content");
    content.innerHTML = "<h2>Carregando...</h2>";
    try {
        const res = await fetchWithFreshToken('/api/users/alunos');
        const alunos = await res.json();
        ALUNOS_BY_ID = new Map((Array.isArray(alunos) ? alunos : []).map(aluno => [String(aluno.id), aluno]));
        EXERCICIOS_MAP = await fetchExerciciosMap();
        METODOS = await fetchMetodos();

        TODAS_CATEGORIAS = Object.keys(EXERCICIOS_MAP).sort((a, b) => a.localeCompare(b));
        TODOS_EXERCICIOS_OBJ = [];
        TODAS_CATEGORIAS.forEach(cat => {
            EXERCICIOS_MAP[cat].sort((a, b) => a.nome.localeCompare(b.nome));
            TODOS_EXERCICIOS_OBJ.push(...EXERCICIOS_MAP[cat]);
        });
        TODOS_EXERCICIOS = TODOS_EXERCICIOS_OBJ.map(e => e.nome);

        CAT_OPTIONS = TODAS_CATEGORIAS.map(c => `<option value="${c}">${c}</option>`).join('');
        GRUPO_OPTIONS = GRUPOS.slice().sort((a,b)=>a.localeCompare(b)).map(g => `<option value="${g}">${g}</option>`).join('');

        content.innerHTML = `
            <div id="alunoHeader" class="aluno-header"></div>
            <h2>Novo Treino</h2>
            <form id="novoTreinoForm">
                <h3>Aluno</h3>
                <select name="aluno" required>
                    <option value="">Selecione o aluno</option>
                    ${alunos.map(a => `<option value="${a.id}">${a.nome}</option>`).join('')}
                </select>
                <button type="button" id="gerarTreinoIA" disabled>Gerar treino com IA</button>
                <div id="configFicha" class="config-ficha">
                    <label>Qtd Treinos
                        <input type="number" name="qtdTreinos" value="1" min="1" />
                        <button type="button" id="incQtdTreinos">+</button>
                    </label>
                    <label>Próximo treino
                        <select name="proximoTreino"></select>
                    </label>
                    <label>Vencimento
                        <input type="date" name="vencimento" />
                    </label>
                </div>
                <h3>Nome da ficha</h3>
                <input type="text" name="nome" placeholder="Nome da ficha" required />
                <label class="treino-periodizacao">Periodização
                    <input type="text" name="periodizacao" placeholder="Ex: Hipertrofia - fase 1" />
                </label>
                <div id="treinoTabs" class="treino-tabs">
                    <ul id="diaTabs"></ul>
                    <button type="button" id="addDia" title="Adicionar novo treino">+</button>
                </div>
                <div id="diasContainer"></div>
                <button type="submit">Criar</button>
            </form>
            <button id="cancelEdit" class="hidden" type="button">Cancelar Edição</button>
            <div id="mensagemTreino"></div>
            <pre id="treinoGerado" class="treinoGerado"></pre>
            <h2>Treinos do Aluno</h2>
            <div id="listaTreinos"></div>
        `;

        document.getElementById('addDia').addEventListener('click', () => { addDia(); updateProximoOptions(); });
        addDia();
        updateProximoOptions();
        activateDia(0);

        const diasContainer = document.getElementById('diasContainer');
        diasContainer.addEventListener('input', e => {
            if (e.target.classList.contains('nomeDia')) {
                const idx = Array.from(diasContainer.children).indexOf(e.target.closest('.dia'));
                updateProximoOptions();
                updateTabName(idx, e.target.value.trim());
            }
        });

        const alunoSel = document.querySelector('#novoTreinoForm select[name="aluno"]');
        document.getElementById('incQtdTreinos').addEventListener('click', () => {
            const input = document.querySelector('#configFicha input[name="qtdTreinos"]');
            input.value = parseInt(input.value || '0') + 1;
        });
        const gerarBtn = document.getElementById('gerarTreinoIA');
        const urlAluno = alunoIdParam || new URLSearchParams(window.location.search).get('aluno') || '';
        if (urlAluno) alunoSel.value = urlAluno;
        const toggleGerar = () => { gerarBtn.disabled = !alunoSel.value; };
        const updateHeader = () => updateAlunoHeader(alunoSel.value);
        alunoSel.addEventListener('change', () => { loadTreinosAluno(alunoSel.value); toggleGerar(); updateHeader(); });
        toggleGerar();
        updateHeader();
        gerarBtn.addEventListener('click', () => gerarTreinoComIA(alunoSel.value));
        loadTreinosAluno(alunoSel.value);

        document.getElementById('cancelEdit').addEventListener('click', () => {
            const form = document.getElementById('novoTreinoForm');
            form.removeAttribute('data-editar');
            form.reset();
            resetDiasForm();
            document.getElementById('cancelEdit').classList.add('hidden');
        });

        document.getElementById('novoTreinoForm').addEventListener('submit', async e => {
            e.preventDefault();
            const form = e.target;
            const alunoId = form.aluno.value;
            const nomeTreino = form.nome.value;
            const dias = [];
            form.querySelectorAll('.dia').forEach((diaDiv, idx) => {
                const nomeDia = diaDiv.querySelector('.nomeDia').value || `Dia ${idx + 1}`;
                const descricao = diaDiv.querySelector('.descDia').value || '';
                const diaSemanaVal = diaDiv.querySelector('.diaSemana').value || null;
                const exercicios = [];
                diaDiv.querySelectorAll('.exercicio').forEach(exDiv => {
                    const seriesDetalhadas = getSeriesDetalhadas(exDiv);
                    exercicios.push({
                        categoria: exDiv.querySelector('.categoria').value || null,
                        nome: exDiv.querySelector('.nomeExercicio').value,
                        metodo: exDiv.querySelector('.metodo').value || null,
                        series: seriesDetalhadas.length || Number(exDiv.querySelector('.series').value) || null,
                        repeticoes: formatRepeticoesResumo(seriesDetalhadas, exDiv.querySelector('.repeticoes').value),
                        seriesDetalhadas,
                        carga: exDiv.querySelector('.carga').value ? Number(exDiv.querySelector('.carga').value) : undefined,
                        observacoes: exDiv.querySelector('.observacoes').value || ''
                    });
                });
                dias.push({ nome: nomeDia, descricao, diaSemana: diaSemanaVal, exercicios });
            });

            let url = `/api/users/alunos/${alunoId}/treinos`;
            let method = 'POST';
            if (form.dataset.editar) {
                url += `/${form.dataset.editar}`;
                method = 'PUT';
            }

            const body = {
                nome: nomeTreino,
                periodizacao: form.periodizacao.value.trim() || null,
                dias,
                qtdTreinos: parseInt(form.qtdTreinos.value) || 1,
                proximoTreino: form.proximoTreino.value || null,
                vencimento: form.vencimento.value || null
            };

            const resp = await fetchWithFreshToken(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            if (resp.ok) {
                form.reset();
                resetDiasForm();
                document.getElementById('mensagemTreino').textContent = 'Treino criado com sucesso!';
                form.removeAttribute('data-editar');
                document.getElementById('cancelEdit').classList.add('hidden');
                loadTreinosAluno(alunoId);
            } else {
                document.getElementById('mensagemTreino').textContent = 'Erro ao criar treino';
            }
        });
    } catch (err) {
        console.error('Erro ao carregar alunos para treino:', err);
        content.innerHTML = '<p style="color:red;">Erro ao carregar dados</p>';
    }
}

function addDia() {
    const diasContainer = document.getElementById('diasContainer');
    const diaIndex = diasContainer.children.length;
    const diaDiv = document.createElement('div');
    diaDiv.className = 'dia';
    diaDiv.dataset.idx = diaIndex;
    diaDiv.innerHTML = `
        <div class="dia-header">
            <h3>Dia <span class="diaNumero">${diaIndex + 1}</span></h3>
            <button type="button" class="removeDia">Remover dia</button>
        </div>
        <div class="dadosTreino">
            <input type="text" class="nomeDia" placeholder="Nome do treino" />
            <textarea class="descDia" placeholder="Descrição"></textarea>
            <select class="diaSemana">
                <option value="">Dia da semana</option>
                <option value="0">Domingo</option>
                <option value="1">Segunda</option>
                <option value="2">Terça</option>
                <option value="3">Quarta</option>
                <option value="4">Quinta</option>
                <option value="5">Sexta</option>
                <option value="6">Sábado</option>
            </select>
        </div>
        <div class="exercicios"></div>
        <button type="button" class="addExercicio">Adicionar Exercício</button>
    `;
    diasContainer.appendChild(diaDiv);
    const container = diaDiv.querySelector('.exercicios');
    diaDiv.querySelector('.addExercicio').addEventListener('click', () => addExercicio(container));
    diaDiv.querySelector('.removeDia').addEventListener('click', () => removeDia(diaDiv));
    addExercicio(container);
    refreshDiaTabs(diaIndex);
}

function addExercicio(container) {
    const allOptions = TODOS_EXERCICIOS.sort((a,b)=>a.localeCompare(b)).map(e => `<option value="${e}"></option>`).join('');
    if (!document.getElementById('exerciciosList')) {
        const dl = document.createElement('datalist');
        dl.id = 'exerciciosList';
        dl.innerHTML = allOptions;
        document.body.appendChild(dl);
    }
    const metodoOptions = METODOS.map(m => {
        const repsList = Array.isArray(m.repeticoes) ? m.repeticoes : (m.repeticoes ? [m.repeticoes] : []);
        const firstRep = repsList.length ? String(repsList[0]) : '';
        const obs = m.observacoes || '';
        const repsData = escapeAttribute(encodeURIComponent(JSON.stringify(repsList)));
        return `<option data-series="${escapeAttribute(m.series || '')}" data-repeticoes="${escapeAttribute(firstRep)}" data-repeticoes-list="${repsData}" data-observacoes="${escapeAttribute(obs)}">${escapeHtml(m.nome)}</option>`;
    }).join('');
    const exDiv = document.createElement('div');
    exDiv.className = 'exercicio';
    exDiv.innerHTML = `
        <select class="categoria">
            <option value="">Todas</option>
            ${CAT_OPTIONS}
        </select>
        <select class="grupo">
            <option value="">Todos os Grupos</option>
            ${GRUPO_OPTIONS}
        </select>
        <div class="buscaEx">
            <i class="fas fa-search"></i>
            <input type="text" class="nomeExercicio" list="exerciciosList" placeholder="Exercício" />
        </div>
        <select class="metodo">
            <option value="">Método</option>
            ${metodoOptions}
        </select>
        <input type="number" class="series" placeholder="Séries" />
        <input type="number" class="repeticoes" placeholder="Reps" />
        <div class="seriesDetalhes"></div>
        <input type="number" class="carga" placeholder="Sug. Carga" />
        <label class="bisetLbl"><input type="checkbox" class="biSet" /> bi-set</label>
        <input type="text" class="observacoes" placeholder="Observações" />
        <button type="button" class="clearExercicio">Limpar</button>
        <button type="button" class="removeExercicio">X</button>
    `;
    container.appendChild(exDiv);

    const categoriaSel = exDiv.querySelector('.categoria');
    const exercicioSel = exDiv.querySelector('.nomeExercicio');
    const grupoSel = exDiv.querySelector('.grupo');
    const metodoSel = exDiv.querySelector('.metodo');
    const seriesInput = exDiv.querySelector('.series');
    const repInput = exDiv.querySelector('.repeticoes');
    const obsInput = exDiv.querySelector('.observacoes');
    const seriesDetalhes = exDiv.querySelector('.seriesDetalhes');

    function renderSeriesDetalhes(seriesValue, repsValues = []) {
        renderSeriesDetalhesForExercise(exDiv, seriesValue, repsValues);
    }

    function syncSeriesDetalhesFromInputs() {
        const currentReps = getRepsFromSeriesDetalhadas(exDiv);
        const fallbackReps = repInput.value ? [repInput.value] : currentReps;
        renderSeriesDetalhes(seriesInput.value, fallbackReps);
    }

    function updateOptions() {
        const cat = categoriaSel.value;
        const grupo = grupoSel.value;
        let items = TODOS_EXERCICIOS_OBJ;
        if (cat) items = items.filter(e => e.categoria === cat);
        if (grupo) items = items.filter(e => {
            const gp = e.grupoMuscularPrincipal || '';
            const outros = Array.isArray(e.gruposMusculares) ? e.gruposMusculares : [];
            return gp === grupo || outros.includes(grupo);
        });
        const nomes = items.map(e => e.nome).sort((a,b)=>a.localeCompare(b));
        const dl = document.getElementById('exerciciosList');
        if (dl) dl.innerHTML = nomes.map(n => `<option value="${n}"></option>`).join('');
    }

    categoriaSel.addEventListener('change', updateOptions);
    grupoSel.addEventListener('change', updateOptions);
    updateOptions();

    metodoSel.addEventListener('change', () => {
        const opt = metodoSel.selectedOptions[0];
        if (!opt) return;
        const s = opt.dataset.series;
        const r = opt.dataset.repeticoes;
        const repsList = parseRepeticoesDataset(opt.dataset.repeticoesList);
        const o = opt.dataset.observacoes;
        if (s) seriesInput.value = s;
        if (r) repInput.value = r;
        if (o) obsInput.value = o;
        renderSeriesDetalhes(seriesInput.value, repsList.length ? repsList : (r ? [r] : []));
    });

    seriesInput.addEventListener('input', syncSeriesDetalhesFromInputs);
    repInput.addEventListener('input', () => {
        renderSeriesDetalhes(seriesInput.value, repInput.value ? [repInput.value] : []);
    });

    exDiv.querySelector('.clearExercicio').addEventListener('click', () => {
        exDiv.querySelectorAll('input, select').forEach(el => {
            if (el.classList.contains('nomeExercicio')) el.value = '';
            else if (el.type === 'checkbox') el.checked = false;
            else el.value = '';
        });
        seriesDetalhes.innerHTML = '';
    });

    exDiv.querySelector('.removeExercicio').addEventListener('click', () => {
        exDiv.remove();
    });

    return exDiv;
}

async function updateAlunoHeader(alunoId) {
    const header = document.getElementById('alunoHeader');
    if (!header) return;
    if (!alunoId) {
        header.innerHTML = '<p>Selecione o aluno</p>';
        return;
    }
    try {
        const res = await fetchWithFreshToken(`/api/users/alunos/${alunoId}`);
        if (!res.ok) throw new Error('Erro');
        const aluno = await res.json();
        ALUNOS_BY_ID.set(String(alunoId), aluno);
        const foto = aluno.fotoUrl || './img/profile-placeholder.png';
        const idadeBase = aluno.idade || calcularIdade(aluno.dataNascimento);
        const idade = idadeBase ? `${idadeBase} anos` : '';
        const sexo = aluno.genero || aluno.sexo || '';
        header.innerHTML = `
            <img src="${foto}" alt="Foto do aluno">
            <div>
                <h3>${aluno.nome || ''}</h3>
                <div class="aluno-cards">
                    <span class="info-card">${idade}</span>
                    <span class="info-card">${sexo}</span>
                </div>
            </div>`;
    } catch (err) {
        header.innerHTML = '<p>Erro ao carregar aluno</p>';
    }
}

async function loadTreinosAluno(alunoId) {
    const list = document.getElementById('listaTreinos');
    list.innerHTML = '';
    if (!alunoId) return;
    try {
        let aluno = ALUNOS_BY_ID.get(String(alunoId));
        if (!aluno) {
            const alunoRes = await fetchWithFreshToken(`/api/users/alunos/${alunoId}`);
            if (alunoRes.ok) {
                aluno = await alunoRes.json();
                ALUNOS_BY_ID.set(String(alunoId), aluno);
            }
        }
        const res = await fetchWithFreshToken(`/api/users/alunos/${alunoId}/treinos`);
        const treinos = await res.json();
        if (Array.isArray(treinos) && treinos.length) {
            list.innerHTML = treinos.map(t => renderTreinoAluno(t, alunoId, aluno)).join('');
            attachTreinoHandlers(alunoId, treinos, aluno);
        } else {
            list.innerHTML = '<p>Nenhum treino cadastrado.</p>';
        }
    } catch (err) {
        console.error('Erro ao carregar treinos:', err);
        list.innerHTML = '<p style="color:red;">Erro ao listar treinos</p>';
    }
}

function renderTreinoAluno(treino, alunoId, aluno = {}) {
    const periodizacao = treino.periodizacao
        ? `<p class="treino-meta"><strong>Periodização:</strong> ${escapeHtml(treino.periodizacao)}</p>`
        : '';
    const sessoes = Number(treino.sessoesRealizadas) || 0;
    const ultimaSessao = treino.ultimaSessaoEm
        ? `<span>Última sessão: ${formatDateLabel(treino.ultimaSessaoEm)}</span>`
        : '';
    const sessaoMeta = sessoes || ultimaSessao
        ? `<p class="treino-meta"><strong>Sessões:</strong> ${sessoes}${ultimaSessao ? ` · ${ultimaSessao}` : ''}</p>`
        : '';
    const registrarSessao = isPresencialAluno(aluno)
        ? '<button class="registrarSessao">Registrar sessão</button>'
        : '';
    const verSessoes = (isPresencialAluno(aluno) || sessoes > 0)
        ? '<button class="verSessoes">Ver sessoes</button>'
        : '';
    const dias = (treino.dias || []).map(d => {
        const exs = (d.exercicios || []).map(ex => `<li>${escapeHtml(ex.nome)} - ${escapeHtml(formatExercisePrescription(ex))}</li>`).join('');
        return `<div class="diaCard"><h4>${escapeHtml(d.nome)}</h4><ul>${exs}</ul></div>`;
    }).join('');
    return `<div class="treinoCard" data-id="${treino.id}"><h3>${escapeHtml(treino.nome)}</h3>${periodizacao}${sessaoMeta}${dias}<div class="treino-actions"><button class="editTreino">Editar</button> ${registrarSessao}${verSessoes}<button class="delTreino">Excluir</button></div></div>`;
}

function attachTreinoHandlers(alunoId, treinos, aluno = {}) {
    document.querySelectorAll('#listaTreinos .delTreino').forEach(btn => {
        btn.addEventListener('click', async () => {
            const card = btn.closest('.treinoCard');
            if (confirm('Excluir treino?')) {
                await fetchWithFreshToken(`/api/users/alunos/${alunoId}/treinos/${card.dataset.id}`, { method: 'DELETE' });
                loadTreinosAluno(alunoId);
            }
        });
    });

    document.querySelectorAll('#listaTreinos .editTreino').forEach(btn => {
        btn.addEventListener('click', () => {
            const card = btn.closest('.treinoCard');
            const treino = treinos.find(t => t.id === card.dataset.id);
            fillTreinoForm(alunoId, treino);
        });
    });

    document.querySelectorAll('#listaTreinos .registrarSessao').forEach(btn => {
        btn.addEventListener('click', () => {
            const card = btn.closest('.treinoCard');
            const treino = treinos.find(t => t.id === card.dataset.id);
            if (treino) openSessaoTreinoModal(alunoId, treino, aluno);
        });
    });

    document.querySelectorAll('#listaTreinos .verSessoes').forEach(btn => {
        btn.addEventListener('click', () => {
            const card = btn.closest('.treinoCard');
            const treino = treinos.find(t => t.id === card.dataset.id);
            if (treino) openSessaoTreinoModal(alunoId, treino, aluno, { focusHistory: true });
        });
    });
}

function renderSessaoHistorico(container, sessoes = []) {
    if (!container) return;
    if (!Array.isArray(sessoes) || !sessoes.length) {
        container.innerHTML = '<p>Nenhuma sessão registrada ainda.</p>';
        return;
    }

    container.innerHTML = sessoes.map(sessao => {
        const total = Array.isArray(sessao.exercicios) ? sessao.exercicios.length : 0;
        const concluidos = Array.isArray(sessao.exercicios)
            ? sessao.exercicios.filter(ex => ex.concluido !== false).length
            : 0;
        const dia = sessao.diaNome ? `<span>${escapeHtml(sessao.diaNome)}</span>` : '';
        const observacoes = sessao.observacoes ? `<small>${escapeHtml(sessao.observacoes)}</small>` : '';
        const exercicios = Array.isArray(sessao.exercicios) && sessao.exercicios.length
            ? `<div class="sessao-history-exercicios">${sessao.exercicios.map(ex => {
                const series = Array.isArray(ex.seriesExecutadas) && ex.seriesExecutadas.length
                    ? ex.seriesExecutadas.map(serie => {
                        const carga = serie.carga !== null && serie.carga !== undefined && serie.carga !== '' ? `${serie.carga}kg` : 'sem carga';
                        const reps = serie.repeticoes || serie.repeticoesPrevistas || '-';
                        return `<span>S${serie.numero || ''}: ${escapeHtml(reps)} rep - ${escapeHtml(carga)}</span>`;
                    }).join('')
                    : `<span>${escapeHtml(ex.repeticoes || ex.repeticoesPrevistas || '-')} rep - ${ex.carga !== null && ex.carga !== undefined ? `${escapeHtml(ex.carga)}kg` : 'sem carga'}</span>`;
                return `<div class="sessao-history-exercicio"><strong>${escapeHtml(ex.nome)}</strong>${series}</div>`;
            }).join('')}</div>`
            : '';
        return `
            <article class="sessao-history-item">
                <strong>${formatDateLabel(sessao.data || sessao.criadoEm)}</strong>
                ${dia}
                <span>${concluidos}/${total} exercícios</span>
                ${observacoes}
                ${exercicios}
            </article>
        `;
    }).join('');
}

async function carregarHistoricoSessoes(alunoId, treinoId, container) {
    if (!container) return;
    container.innerHTML = '<p>Carregando sessões...</p>';
    try {
        const res = await fetchWithFreshToken(`/api/users/alunos/${alunoId}/treinos/${treinoId}/sessoes`);
        if (!res.ok) throw new Error('Erro ao carregar sessões');
        const sessoes = await res.json();
        renderSessaoHistorico(container, sessoes);
    } catch (err) {
        console.error('Erro ao carregar sessões do treino:', err);
        container.innerHTML = '<p style="color:red;">Erro ao carregar sessões.</p>';
    }
}

function openSessaoTreinoModal(alunoId, treino, aluno = {}, options = {}) {
    document.querySelectorAll('.sessao-treino-modal').forEach(modal => modal.remove());

    const dias = Array.isArray(treino.dias) ? treino.dias : [];
    const proximoIndex = Number.parseInt(treino.proximoTreino, 10);
    const selectedIndex = Number.isInteger(proximoIndex) && proximoIndex >= 0 && proximoIndex < dias.length
        ? proximoIndex
        : 0;
    const alunoNome = aluno?.nome ? ` para ${escapeHtml(aluno.nome)}` : '';
    const diaOptions = dias.length
        ? dias.map((dia, idx) => `<option value="${idx}" ${idx === selectedIndex ? 'selected' : ''}>${escapeHtml(dia.nome || `Dia ${idx + 1}`)}</option>`).join('')
        : '<option value="">Sem dias cadastrados</option>';

    const modal = document.createElement('div');
    modal.className = 'modal sessao-treino-modal';
    modal.innerHTML = `
        <div class="modal-content sessao-treino-modal__content" role="dialog" aria-modal="true">
            <header class="sessao-treino-modal__header">
                <h3>Registrar sessão presencial${alunoNome}</h3>
                <button type="button" class="sessao-modal-close" aria-label="Fechar">&times;</button>
            </header>
            <form id="sessaoTreinoForm" class="sessao-treino-form">
                <label>Data
                    <input type="date" name="data" value="${getTodayInputValue()}" required />
                </label>
                <label>Dia da ficha
                    <select name="diaIndex" ${dias.length ? '' : 'disabled'}>${diaOptions}</select>
                </label>
                <div class="sessao-exercicios" data-role="sessao-exercicios"></div>
                <label>Observações da sessão
                    <textarea name="observacoes" placeholder="Resposta do aluno, ajustes de carga, dor, fadiga..."></textarea>
                </label>
                <div class="modal-actions">
                    <button type="submit" class="primary">Salvar sessão</button>
                    <button type="button" class="cancelModal">Cancelar</button>
                </div>
                <div class="sessao-feedback" data-role="feedback"></div>
            </form>
            <section class="sessao-history">
                <h4>Histórico recente</h4>
                <div data-role="sessao-history"></div>
            </section>
        </div>
    `;

    const close = () => modal.remove();
    modal.addEventListener('click', event => {
        if (event.target === modal) close();
    });
    modal.querySelector('.sessao-modal-close')?.addEventListener('click', close);
    modal.querySelector('.cancelModal')?.addEventListener('click', close);

    const form = modal.querySelector('#sessaoTreinoForm');
    const diaSelect = form.querySelector('[name="diaIndex"]');
    const exerciciosContainer = form.querySelector('[data-role="sessao-exercicios"]');
    const feedback = form.querySelector('[data-role="feedback"]');
    const historico = modal.querySelector('[data-role="sessao-history"]');

    const renderExercicios = () => {
        const idx = Number.parseInt(diaSelect.value, 10);
        const dia = dias[idx] || {};
        const exercicios = Array.isArray(dia.exercicios) ? dia.exercicios : [];
        if (!exercicios.length) {
            exerciciosContainer.innerHTML = '<p>Este dia não possui exercícios cadastrados.</p>';
            return;
        }

        exerciciosContainer.innerHTML = exercicios.map((ex, idxEx) => {
            const seriesPlan = getExerciseSeriesPlan(ex);
            const prescricao = formatExercisePrescription(ex);
            const seriesRows = seriesPlan.map((serie, idxSerie) => `
                <div class="sessao-serie" data-serie="${idxSerie}">
                    <span>Serie ${serie.numero || idxSerie + 1}</span>
                    <label><input type="checkbox" class="serieConcluida" checked /> Feita</label>
                    <input type="number" class="serieCargaRealizada" step="0.1" placeholder="Carga" />
                    <input type="text" class="serieRepsRealizadas" placeholder="Reps" value="${escapeAttribute(serie.repeticoes)}" />
                </div>
            `).join('');
            return `
                <div class="sessao-exercicio" data-index="${idxEx}">
                    <div class="sessao-exercicio__info">
                        <strong>${escapeHtml(ex.nome || `Exercício ${idxEx + 1}`)}</strong>
                        <span>${escapeHtml(prescricao)}</span>
                    </div>
                    <label class="sessao-check"><input type="checkbox" class="concluido" checked /> Feito</label>
                    <input type="text" class="obsExercicio" placeholder="Observações" />
                    <div class="sessao-series">${seriesRows}</div>
                </div>
            `;
        }).join('');

        exerciciosContainer.querySelectorAll('.sessao-exercicio').forEach(row => {
            const concluido = row.querySelector('.concluido');
            concluido?.addEventListener('change', () => {
                row.querySelectorAll('.serieConcluida').forEach(input => {
                    input.checked = concluido.checked;
                });
            });
        });
    };

    diaSelect?.addEventListener('change', renderExercicios);

    form.addEventListener('submit', async event => {
        event.preventDefault();
        if (!dias.length) return;

        const diaIndex = Number.parseInt(diaSelect.value, 10);
        const dia = dias[diaIndex] || {};
        const exerciciosPlanejados = Array.isArray(dia.exercicios) ? dia.exercicios : [];
        const exercicios = Array.from(form.querySelectorAll('.sessao-exercicio')).map((row, idxEx) => {
            const previsto = exerciciosPlanejados[idxEx] || {};
            const planoSeries = getExerciseSeriesPlan(previsto);
            const seriesExecutadas = Array.from(row.querySelectorAll('.sessao-serie')).map((serieRow, idxSerie) => {
                const cargaValor = serieRow.querySelector('.serieCargaRealizada')?.value;
                const plano = planoSeries[idxSerie] || {};
                return {
                    numero: plano.numero || idxSerie + 1,
                    repeticoesPrevistas: plano.repeticoes || '',
                    concluido: serieRow.querySelector('.serieConcluida')?.checked !== false,
                    carga: cargaValor ? Number(cargaValor) : null,
                    repeticoes: serieRow.querySelector('.serieRepsRealizadas')?.value?.trim() || ''
                };
            });
            return {
                nome: previsto.nome || `Exercício ${idxEx + 1}`,
                seriesPrevistas: seriesExecutadas.length || previsto.series || null,
                repeticoesPrevistas: formatRepeticoesResumo(seriesExecutadas.map(serie => ({ repeticoes: serie.repeticoesPrevistas })), previsto.repeticoes),
                cargaPrevista: previsto.carga !== undefined ? previsto.carga : null,
                concluido: row.querySelector('.concluido')?.checked !== false && seriesExecutadas.some(serie => serie.concluido),
                carga: null,
                repeticoes: formatRepeticoesResumo(seriesExecutadas.map(serie => ({ repeticoes: serie.repeticoes }))),
                seriesExecutadas,
                observacoes: row.querySelector('.obsExercicio')?.value?.trim() || ''
            };
        });

        const payload = {
            data: form.data.value,
            diaIndex,
            diaNome: dia.nome || `Dia ${diaIndex + 1}`,
            observacoes: form.observacoes.value.trim(),
            exercicios,
            realizadoPor: 'personal',
            origem: 'presencial'
        };

        feedback.textContent = 'Salvando sessão...';
        try {
            const res = await fetchWithFreshToken(`/api/users/alunos/${alunoId}/treinos/${treino.id}/sessoes`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (!res.ok) throw new Error('Erro ao salvar sessão');
            feedback.textContent = 'Sessão registrada com sucesso.';
            await carregarHistoricoSessoes(alunoId, treino.id, historico);
            await loadTreinosAluno(alunoId);
        } catch (err) {
            console.error('Erro ao registrar sessão:', err);
            feedback.textContent = 'Não foi possível salvar a sessão.';
        }
    });

    document.body.appendChild(modal);
    renderExercicios();
    carregarHistoricoSessoes(alunoId, treino.id, historico);
    if (options.focusHistory) {
        modal.querySelector('.sessao-history')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

function fillTreinoForm(alunoId, treino) {
    const form = document.getElementById('novoTreinoForm');
    form.aluno.value = alunoId;
    form.nome.value = treino.nome || '';
    if (form.periodizacao) form.periodizacao.value = treino.periodizacao || '';
    form.qtdTreinos.value = treino.qtdTreinos || 1;
    form.vencimento.value = treino.vencimento || '';
    if (treino.id) {
        form.dataset.editar = treino.id;
        document.getElementById('cancelEdit').classList.remove('hidden');
    } else {
        form.removeAttribute('data-editar');
        document.getElementById('cancelEdit').classList.add('hidden');
    }
    document.getElementById('diasContainer').innerHTML = '';
    document.getElementById('diaTabs').innerHTML = '';
    const dias = treino.dias || [];
    dias.forEach((dia, idx) => {
        addDia();
        const diaDiv = document.querySelectorAll('#diasContainer .dia')[idx];
        updateTabName(idx, dia.nome);
        diaDiv.querySelector('.nomeDia').value = dia.nome;
        if (dia.descricao) diaDiv.querySelector('.descDia').value = dia.descricao;
        if (dia.diaSemana !== undefined) diaDiv.querySelector('.diaSemana').value = dia.diaSemana;
        const container = diaDiv.querySelector('.exercicios');
        container.innerHTML = '';
        (dia.exercicios || []).forEach(() => addExercicio(container));
        Array.from(container.children).forEach((exDiv, i) => {
            const exData = dia.exercicios[i];
            exDiv.querySelector('.categoria').value = exData.categoria || '';
            exDiv.querySelector('.grupo').value = exData.grupoMuscularPrincipal || '';
            exDiv.querySelector('.nomeExercicio').value = exData.nome;
            exDiv.querySelector('.metodo').value = exData.metodo || '';
            exDiv.querySelector('.series').value = exData.series || '';
            exDiv.querySelector('.repeticoes').value = exData.repeticoes || '';
            renderSeriesDetalhesForExercise(exDiv, exData.series, getExerciseSeriesPlan(exData).map(serie => serie.repeticoes));
            if (exData.carga !== undefined) exDiv.querySelector('.carga').value = exData.carga;
            exDiv.querySelector('.observacoes').value = exData.observacoes || '';
        });
    });
    if (!dias.length) addDia();
    refreshDiaTabs(0);
    if (treino.proximoTreino !== undefined && form.proximoTreino) {
        form.proximoTreino.value = treino.proximoTreino;
    }
    form.scrollIntoView({ behavior: 'smooth' });
}

export async function loadMeusTreinos() {
    const content = document.getElementById('content');
    content.innerHTML = '<h2>Carregando...</h2>';
    try {
        const res = await fetchWithFreshToken('/api/users/me/treinos');
        const treinos = await res.json();
        if (!Array.isArray(treinos) || treinos.length === 0) {
            content.innerHTML = '<p>Nenhum treino encontrado.</p>';
            return;
        }
        content.innerHTML = `<h2>Meus Treinos</h2>${treinos.map(renderTreino).join('')}`;
    } catch (err) {
        console.error('Erro ao carregar treinos do aluno:', err);
        content.innerHTML = '<p style="color:red;">Erro ao carregar treinos</p>';
    }
}

function renderTreino(treino) {
    const periodizacao = treino.periodizacao
        ? `<p class="treino-meta"><strong>Periodização:</strong> ${escapeHtml(treino.periodizacao)}</p>`
        : '';
    const diasHtml = (treino.dias || []).map(d => {
        const exs = (d.exercicios || []).map(ex => {
            const carga = ex.carga ? ` - ${ex.carga}kg` : '';
            const obs = ex.observacoes ? ` (${ex.observacoes})` : '';
            return `<li>${escapeHtml(ex.nome)} - ${escapeHtml(formatExercisePrescription(ex))}${escapeHtml(carga)}${escapeHtml(obs)}</li>`;
        }).join('');
        return `<div class="diaCard"><h4>${escapeHtml(d.nome)}</h4><ul>${exs}</ul></div>`;
    }).join('');
    return `<div class="treinoCard"><h3>${escapeHtml(treino.nome)}</h3>${periodizacao}${diasHtml}</div>`;
}

export async function gerarTreinoComIA(alunoId) {
    if (!alunoId) return;
    const msg = document.getElementById('mensagemTreino');
    msg.textContent = 'Gerando treino...';
    try {
        const resp = await fetchWithFreshToken('/api/treino/gerar-ia', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ alunoId })
        });
        if (!resp.ok) throw new Error('Falha ao gerar treino');
        const data = await resp.json();
        if (!Array.isArray(data.dias)) throw new Error('Resposta inválida');
        fillTreinoForm(alunoId, { nome: '', dias: data.dias });
        msg.textContent = 'Treino gerado! Revise e clique em Criar.';
        const content = document.getElementById('treinoGerado');
        if (content) content.textContent = JSON.stringify(data.dias, null, 2);
    } catch (err) {
        console.error('Erro ao gerar treino com IA:', err);
        msg.textContent = 'Erro ao gerar treino com IA';
    }
}
