import { fetchWithFreshToken } from './auth.js';

export async function loadAnamneseSection() {
    const content = document.getElementById('content');
    content.innerHTML = '<h2>Carregando...</h2>';

    try {
        const res = await fetchWithFreshToken('http://localhost:3000/users/alunos');
        const alunos = await res.json();
        render(content, alunos);
    } catch (err) {
        console.error('Erro ao carregar alunos:', err);
        content.innerHTML = '<p style="color:red;">Erro ao carregar dados</p>';
    }
}

function render(container, alunos) {
    const options = alunos.map(a => `<option value="${a.id}">${a.nome}</option>`).join('');
    container.innerHTML = `
        <h2>Anamnese</h2>
        <input type="text" id="searchAluno" placeholder="Buscar por nome..." />
        <select id="alunoSelect">
            <option value="">Selecione o aluno</option>
            ${options}
        </select>
        <form id="anamneseForm" class="hidden">
            <input type="email" name="email" placeholder="Endereço de e-mail" />
            <input type="text" name="nome" placeholder="Nome" />
            <input type="number" name="idade" placeholder="Idade" />
            <input type="text" name="genero" placeholder="Gênero" />
            <input type="number" step="0.01" name="altura" placeholder="Altura" />
            <input type="number" step="0.1" name="peso" placeholder="Peso" />
            <textarea name="objetivos" placeholder="Objetivos"></textarea>
            <textarea name="doencas" placeholder="Já teve ou tem alguma doença? Se sim, quais?"></textarea>
            <textarea name="doencasFamilia" placeholder="Alguém da família tem alguma doença? Se sim, quais?"></textarea>
            <textarea name="medicamentos" placeholder="Faz uso de medicamentos? Quais?"></textarea>
            <textarea name="cirurgias" placeholder="Já passou por cirurgias? Quais?"></textarea>
            <textarea name="doresLesoes" placeholder="Possui dores ou lesões?"></textarea>
            <textarea name="limitacoes" placeholder="Alguma limitação para exercícios físicos?"></textarea>
            <input type="text" name="fuma" placeholder="Você Fuma?" />
            <input type="text" name="bebe" placeholder="Você Bebe? Se sim, com qual frequência?" />
            <input type="text" name="qualidadeSono" placeholder="Qualidade do sono" />
            <input type="number" step="0.1" name="horasSono" placeholder="Horas de sono por noite" />
            <input type="text" name="nivelAtividade" placeholder="Nível de atividade física atual" />
            <input type="text" name="tiposExercicio" placeholder="Tipos de exercício que pratica ou já praticou" />
            <input type="text" name="frequenciaTreinos" placeholder="Frequência de treinos pretendida" />
            <input type="text" name="agua" placeholder="Consome água com frequência? (litros/dia)" />
            <input type="text" name="tempoObjetivos" placeholder="Em quanto tempo gostaria de alcançar seus objetivos?" />
            <input type="text" name="dispostoMudanca" placeholder="Está disposto(a) a mudar hábitos alimentares e de treino?" />
            <textarea name="comentarios" placeholder="Qualquer comentário ou observação que queira fazer"></textarea>
            <button type="submit">Salvar</button>
        </form>
        <div id="mensagemAnamnese"></div>
    `;

    const searchInput = document.getElementById('searchAluno');
    const alunoSelect = document.getElementById('alunoSelect');
    const form = document.getElementById('anamneseForm');

    searchInput.addEventListener('input', () => {
        const term = searchInput.value.toLowerCase();
        alunoSelect.innerHTML = '<option value="">Selecione o aluno</option>' +
            alunos.filter(a => a.nome && a.nome.toLowerCase().includes(term))
                  .map(a => `<option value="${a.id}">${a.nome}</option>`).join('');
    });

    alunoSelect.addEventListener('change', () => loadDadosAluno(alunoSelect.value, form));
    form.addEventListener('submit', e => salvarAnamnese(e, alunoSelect.value));
}

async function loadDadosAluno(alunoId, form) {
    form.reset();
    if (!alunoId) {
        form.classList.add('hidden');
        return;
    }
    try {
        const res = await fetchWithFreshToken(`http://localhost:3000/users/alunos/${alunoId}/anamnese`);
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
        const res = await fetchWithFreshToken(`http://localhost:3000/users/alunos/${alunoId}/anamnese`, {
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
