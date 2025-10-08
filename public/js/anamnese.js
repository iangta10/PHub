import { fetchWithFreshToken } from './auth.js';
import { loadAvaliacaoFisicaSection } from './avaliacaoFisica.js';

export async function loadAnamneseSection(alunoId = null) {
    const content = document.getElementById('content');
    content.innerHTML = '<h2>Carregando...</h2>';

    try {
        const res = await fetchWithFreshToken('/api/users/alunos');
        const alunos = await res.json();
        render(content, alunos, alunoId);
    } catch (err) {
        console.error('Erro ao carregar alunos:', err);
        content.innerHTML = '<p style="color:red;">Erro ao carregar dados</p>';
    }
}

function render(container, alunos, selectedId) {
    const options = alunos.map(a => `<option value="${a.id}">${a.nome}</option>`).join('');
    container.innerHTML = `
        <div class="avaliacao-container">
            <header class="avaliacao-header">
                <h2>Anamnese</h2>
                <section class="aluno-info" aria-label="Informações do aluno">
                    <div class="aluno-info-item">
                        <span class="aluno-info-label">Nome</span>
                        <span class="aluno-info-value" data-aluno-nome></span>
                    </div>
                    <div class="aluno-info-item">
                        <span class="aluno-info-label">Idade</span>
                        <span class="aluno-info-value" data-aluno-idade></span>
                    </div>
                    <div class="aluno-info-item">
                        <span class="aluno-info-label">Gênero</span>
                        <span class="aluno-info-value" data-aluno-genero></span>
                    </div>
                </section>
            </header>
            <div class="avaliacao-controls">
                <input type="text" id="searchAluno" placeholder="Buscar por nome..." />
                <select id="alunoSelect">
                    <option value="">Selecione o aluno</option>
                    ${options}
                </select>
            </div>
            <form id="anamneseForm" class="hidden avaliacao-grid">
            <div class="form-field"><label for="email">Endereço de e-mail</label><input id="email" type="email" name="email" placeholder="Endereço de e-mail" /></div>
            <div class="form-field"><label for="nome">Nome</label><input id="nome" type="text" name="nome" placeholder="Nome" /></div>
            <div class="form-field"><label for="idade">Idade</label><input id="idade" type="number" name="idade" placeholder="Idade" /></div>
            <div class="form-field"><label for="genero">Gênero</label><input id="genero" type="text" name="genero" placeholder="Gênero" /></div>
            <div class="form-field"><label for="altura">Altura</label><input id="altura" type="number" step="0.01" name="altura" placeholder="Altura" /></div>
            <div class="form-field"><label for="peso">Peso</label><input id="peso" type="number" step="0.1" name="peso" placeholder="Peso" /></div>
            <div class="form-field"><label for="objetivos">Objetivos</label><textarea id="objetivos" name="objetivos" placeholder="Objetivos"></textarea></div>
            <div class="form-field"><label for="doencas">Já teve ou tem alguma doença? Se sim, quais?</label><textarea id="doencas" name="doencas" placeholder="Já teve ou tem alguma doença? Se sim, quais?"></textarea></div>
            <div class="form-field"><label for="doencasFamilia">Alguém da família tem alguma doença? Se sim, quais?</label><textarea id="doencasFamilia" name="doencasFamilia" placeholder="Alguém da família tem alguma doença? Se sim, quais?"></textarea></div>
            <div class="form-field"><label for="medicamentos">Faz uso de medicamentos? Quais?</label><textarea id="medicamentos" name="medicamentos" placeholder="Faz uso de medicamentos? Quais?"></textarea></div>
            <div class="form-field"><label for="cirurgias">Já passou por cirurgias? Quais?</label><textarea id="cirurgias" name="cirurgias" placeholder="Já passou por cirurgias? Quais?"></textarea></div>
            <div class="form-field"><label for="doresLesoes">Possui dores ou lesões?</label><textarea id="doresLesoes" name="doresLesoes" placeholder="Possui dores ou lesões?"></textarea></div>
            <div class="form-field"><label for="limitacoes">Alguma limitação para exercícios físicos?</label><textarea id="limitacoes" name="limitacoes" placeholder="Alguma limitação para exercícios físicos?"></textarea></div>
            <div class="form-field"><label for="fuma">Você Fuma?</label><input id="fuma" type="text" name="fuma" placeholder="Você Fuma?" /></div>
            <div class="form-field"><label for="bebe">Você Bebe? Se sim, com qual frequência?</label><input id="bebe" type="text" name="bebe" placeholder="Você Bebe? Se sim, com qual frequência?" /></div>
            <div class="form-field"><label for="qualidadeSono">Qualidade do sono</label><input id="qualidadeSono" type="text" name="qualidadeSono" placeholder="Qualidade do sono" /></div>
            <div class="form-field"><label for="horasSono">Horas de sono por noite</label><input id="horasSono" type="number" step="0.1" name="horasSono" placeholder="Horas de sono por noite" /></div>
            <div class="form-field"><label for="nivelAtividade">Nível de atividade física atual</label><input id="nivelAtividade" type="text" name="nivelAtividade" placeholder="Nível de atividade física atual" /></div>
            <div class="form-field"><label for="tiposExercicio">Tipos de exercício que pratica ou já praticou</label><input id="tiposExercicio" type="text" name="tiposExercicio" placeholder="Tipos de exercício que pratica ou já praticou" /></div>
            <div class="form-field"><label for="frequenciaTreinos">Frequência de treinos pretendida</label><input id="frequenciaTreinos" type="text" name="frequenciaTreinos" placeholder="Frequência de treinos pretendida" /></div>
            <div class="form-field"><label for="agua">Consome água com frequência? (litros/dia)</label><input id="agua" type="text" name="agua" placeholder="Consome água com frequência? (litros/dia)" /></div>
            <div class="form-field"><label for="tempoObjetivos">Em quanto tempo gostaria de alcançar seus objetivos?</label><input id="tempoObjetivos" type="text" name="tempoObjetivos" placeholder="Em quanto tempo gostaria de alcançar seus objetivos?" /></div>
            <div class="form-field"><label for="dispostoMudanca">Está disposto(a) a mudar hábitos alimentares e de treino?</label><input id="dispostoMudanca" type="text" name="dispostoMudanca" placeholder="Está disposto(a) a mudar hábitos alimentares e de treino?" /></div>
            <div class="form-field" style="grid-column: span 2;"><label for="comentarios">Qualquer comentário ou observação que queira fazer</label><textarea id="comentarios" name="comentarios" placeholder="Qualquer comentário ou observação que queira fazer"></textarea></div>
            <div class="form-actions">
                <button type="submit">Salvar</button>
                <button type="button" id="proximoAnamnese">Próximo</button>
            </div>
        </form>
        <div id="mensagemAnamnese"></div>
        </div>
    `;

    const searchInput = document.getElementById('searchAluno');
    const alunoSelect = document.getElementById('alunoSelect');
    const form = document.getElementById('anamneseForm');
    const alunoInfoEls = {
        nome: container.querySelector('[data-aluno-nome]'),
        idade: container.querySelector('[data-aluno-idade]'),
        genero: container.querySelector('[data-aluno-genero]')
    };

    searchInput.addEventListener('input', () => {
        const term = searchInput.value.toLowerCase();
        alunoSelect.innerHTML = '<option value="">Selecione o aluno</option>' +
            alunos.filter(a => a.nome && a.nome.toLowerCase().includes(term))
                  .map(a => `<option value="${a.id}">${a.nome}</option>`).join('');
    });

    alunoSelect.addEventListener('change', () => loadDadosAluno(alunoSelect.value, form, alunoInfoEls));
    form.addEventListener('submit', e => salvarAnamnese(e, alunoSelect.value));
    document.getElementById('proximoAnamnese').addEventListener('click', () => {
        if (alunoSelect.value) loadAvaliacaoFisicaSection(alunoSelect.value);
    });

    if (selectedId) {
        alunoSelect.value = selectedId;
        loadDadosAluno(selectedId, form, alunoInfoEls);
    }
}

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

function atualizarAlunoInfo(infoEls, aluno) {
    if (!infoEls) return;
    const nomeEl = infoEls.nome;
    const idadeEl = infoEls.idade;
    const generoEl = infoEls.genero;
    const genero = aluno ? (aluno.genero || aluno.sexo || '') : '';
    const idadeValor = aluno ? (aluno.idade || calcularIdade(aluno.dataNascimento)) : '';
    if (nomeEl) nomeEl.textContent = aluno?.nome || '';
    if (idadeEl) idadeEl.textContent = idadeValor ? `${idadeValor} anos` : '';
    if (generoEl) generoEl.textContent = genero || '';
}

function limparAlunoInfo(infoEls) {
    if (!infoEls) return;
    Object.values(infoEls).forEach(el => {
        if (el) el.textContent = '';
    });
}

async function loadDadosAluno(alunoId, form, infoEls) {
    form.reset();
    limparAlunoInfo(infoEls);
    if (!alunoId) {
        form.classList.add('hidden');
        return;
    }
    try {
        const alunoRes = await fetchWithFreshToken(`/api/users/alunos/${alunoId}`);
        let aluno = null;
        if (alunoRes.ok) {
            aluno = await alunoRes.json();
            atualizarAlunoInfo(infoEls, aluno);
            if (form.nome) form.nome.value = aluno.nome || '';
            if (form.email) form.email.value = aluno.email || '';
            const genero = aluno.genero || aluno.sexo || '';
            if (form.genero) form.genero.value = genero;
            const idade = aluno.idade || calcularIdade(aluno.dataNascimento);
            if (form.idade) form.idade.value = idade || '';
        } else {
            atualizarAlunoInfo(infoEls, null);
        }
        const res = await fetchWithFreshToken(`/api/users/alunos/${alunoId}/anamnese`);
        if (res.ok) {
            const data = await res.json();
            if (data) {
                Object.keys(data).forEach(k => { if (form[k]) form[k].value = data[k]; });
            }
        }
        form.classList.remove('hidden');
    } catch (err) {
        console.error('Erro ao carregar anamnese:', err);
    }
}

async function salvarAnamnese(e, alunoId) {
    e.preventDefault();
    if (!alunoId) return;
    const form = e.target;
    const dados = {};
    Array.from(form.elements).forEach(el => {
        if (el.name) dados[el.name] = el.value;
    });
    try {
        const res = await fetchWithFreshToken(`/api/users/alunos/${alunoId}/anamnese`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dados)
        });
        document.getElementById('mensagemAnamnese').textContent = res.ok ? 'Anamnese salva' : 'Erro ao salvar anamnese';
    } catch (err) {
        console.error('Erro ao salvar anamnese:', err);
        document.getElementById('mensagemAnamnese').textContent = 'Erro ao salvar anamnese';
    }
}
