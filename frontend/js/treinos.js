import { fetchWithFreshToken } from "./auth.js";
import { fetchExerciciosMap, fetchMetodos } from "./exercicios.js";

let EXERCICIOS_MAP = {};
let TODAS_CATEGORIAS = [];
let TODOS_EXERCICIOS = [];
let METODOS = [];

export async function loadTreinosSection() {
    const content = document.getElementById("content");
    content.innerHTML = "<h2>Carregando...</h2>";
    try {
        const res = await fetchWithFreshToken('http://localhost:3000/users/alunos');
        const alunos = await res.json();
        EXERCICIOS_MAP = await fetchExerciciosMap();
        METODOS = await fetchMetodos();
        TODAS_CATEGORIAS = Object.keys(EXERCICIOS_MAP);
        TODOS_EXERCICIOS = TODAS_CATEGORIAS.flatMap(c => EXERCICIOS_MAP[c].map(e => e.nome));
        const catOptions = TODAS_CATEGORIAS.map(c => `<option value="${c}">${c}</option>`).join('');

        content.innerHTML = `
            <h2>Novo Treino</h2>
            <form id="novoTreinoForm">
                <select name="aluno" required>
                    <option value="">Selecione o aluno</option>
                    ${alunos.map(a => `<option value="${a.id}">${a.nome}</option>`).join('')}
                </select>
                <input type="text" name="nome" placeholder="Nome da ficha" required />
                <div id="diasContainer"></div>
                <button type="button" id="addDia">Adicionar Dia</button>
                <button type="submit">Criar</button>
            </form>
            <div id="mensagemTreino"></div>
        `;

        document.getElementById('addDia').addEventListener('click', () => addDia(catOptions));
        addDia(catOptions);

        document.getElementById('novoTreinoForm').addEventListener('submit', async e => {
            e.preventDefault();
            const form = e.target;
            const alunoId = form.aluno.value;
            const nomeTreino = form.nome.value;
            const dias = [];
            form.querySelectorAll('.dia').forEach((diaDiv, idx) => {
                const nomeDia = diaDiv.querySelector('.nomeDia').value || `Dia ${idx + 1}`;
                const exercicios = [];
                diaDiv.querySelectorAll('.exercicio').forEach(exDiv => {
                    exercicios.push({
                        categoria: exDiv.querySelector('.categoria').value || null,
                        nome: exDiv.querySelector('.nomeExercicio').value,
                        series: Number(exDiv.querySelector('.series').value) || null,
                        repeticoes: Number(exDiv.querySelector('.repeticoes').value) || null,
                        carga: exDiv.querySelector('.carga').value ? Number(exDiv.querySelector('.carga').value) : undefined,
                        observacoes: exDiv.querySelector('.observacoes').value || ''
                    });
                });
                dias.push({ nome: nomeDia, exercicios });
            });

            const resp = await fetchWithFreshToken(`http://localhost:3000/users/alunos/${alunoId}/treinos`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nome: nomeTreino, dias })
            });
            if (resp.ok) {
                form.reset();
                document.getElementById('diasContainer').innerHTML = '';
                addDia(catOptions);
                document.getElementById('mensagemTreino').textContent = 'Treino criado com sucesso!';
            } else {
                document.getElementById('mensagemTreino').textContent = 'Erro ao criar treino';
            }
        });
    } catch (err) {
        console.error('Erro ao carregar alunos para treino:', err);
        content.innerHTML = '<p style="color:red;">Erro ao carregar dados</p>';
    }
}

function addDia(catOptions) {
    const diasContainer = document.getElementById('diasContainer');
    const diaIndex = diasContainer.children.length;
    const diaDiv = document.createElement('div');
    diaDiv.className = 'dia';
    diaDiv.innerHTML = `
        <h3>Dia ${diaIndex + 1}</h3>
        <input type="text" class="nomeDia" placeholder="Nome do treino" />
        <div class="exercicios"></div>
        <button type="button" class="addExercicio">Adicionar Exercício</button>
    `;
    diasContainer.appendChild(diaDiv);
    const container = diaDiv.querySelector('.exercicios');
    diaDiv.querySelector('.addExercicio').addEventListener('click', () => addExercicio(container, catOptions));
    addExercicio(container, catOptions);
}

function addExercicio(container, catOptions) {
    const allOptions = TODOS_EXERCICIOS.map(e => `<option value="${e}">${e}</option>`).join('');
    const exDiv = document.createElement('div');
    exDiv.className = 'exercicio';
    exDiv.innerHTML = `
        <select class="categoria">
            <option value="">Todas</option>
            ${catOptions}
        </select>
        <select class="nomeExercicio">${allOptions}</select>
        <select class="metodo">
            <option value="">Método</option>
            ${METODOS.map(m => `<option value="${m.series || ''}|${m.repeticoes || ''}">${m.nome}</option>`).join('')}
        </select>
        <input type="number" class="series" placeholder="Séries" />
        <input type="number" class="repeticoes" placeholder="Repetições" />
        <input type="number" class="carga" placeholder="Carga (opcional)" />
        <input type="text" class="observacoes" placeholder="Observações" />
        <button type="button" class="removeExercicio">X</button>
    `;
    container.appendChild(exDiv);

    const categoriaSel = exDiv.querySelector('.categoria');
    const exercicioSel = exDiv.querySelector('.nomeExercicio');
    const metodoSel = exDiv.querySelector('.metodo');
    const seriesInput = exDiv.querySelector('.series');
    const repInput = exDiv.querySelector('.repeticoes');

    categoriaSel.addEventListener('change', () => {
        const cat = categoriaSel.value;
        const items = cat ? (EXERCICIOS_MAP[cat] || []).map(e => e.nome) : TODOS_EXERCICIOS;
        exercicioSel.innerHTML = items.map(e => `<option value="${e}">${e}</option>`).join('');
    });

    metodoSel.addEventListener('change', () => {
        const [s, r] = metodoSel.value.split('|');
        if (s) seriesInput.value = s;
        if (r) repInput.value = r;
    });

    exDiv.querySelector('.removeExercicio').addEventListener('click', () => {
        exDiv.remove();
    });
}

export async function loadMeusTreinos() {
    const content = document.getElementById('content');
    content.innerHTML = '<h2>Carregando...</h2>';
    try {
        const res = await fetchWithFreshToken('http://localhost:3000/users/me/treinos');
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
    const diasHtml = (treino.dias || []).map(d => {
        const exs = (d.exercicios || []).map(ex => {
            const carga = ex.carga ? ` - ${ex.carga}kg` : '';
            const obs = ex.observacoes ? ` (${ex.observacoes})` : '';
            return `<li>${ex.nome} - ${ex.series || ''}x${ex.repeticoes || ''}${carga}${obs}</li>`;
        }).join('');
        return `<li><strong>${d.nome}</strong><ul>${exs}</ul></li>`;
    }).join('');
    return `<div class="treino"><strong>${treino.nome}</strong><ul>${diasHtml}</ul></div>`;
}
