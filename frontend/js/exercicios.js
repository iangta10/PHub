import { fetchWithFreshToken } from "./auth.js";

export async function loadExerciciosSection() {
    const content = document.getElementById("content");
    content.innerHTML = "<h2>Carregando...</h2>";

    try {
        const [exRes, metRes] = await Promise.all([
            fetchWithFreshToken('http://localhost:3000/users/exercicios'),
            fetchWithFreshToken('http://localhost:3000/users/metodos')
        ]);
        const exercicios = await exRes.json();
        const metodos = await metRes.json();
        renderForms(content, exercicios, metodos);
    } catch (err) {
        console.error('Erro ao carregar dados de exercícios:', err);
        content.innerHTML = '<p style="color:red;">Erro ao carregar dados</p>';
    }
}

function renderForms(container, exercicios, metodos) {
    container.innerHTML = `
        <h2>Exercícios Personalizados</h2>
        <form id="novoExercicio">
            <input type="text" name="nome" placeholder="Nome" required />
            <input type="text" name="categoria" placeholder="Categoria" />
            <input type="number" name="seriesPadrao" placeholder="Séries padrão(opcional)" />
            <input type="number" name="repeticoesPadrao" placeholder="Repetições padrão(opcional)" />
            <button type="submit">Criar</button>
        </form>
        <ul id="listaExercicios">${exercicios.map(e => `<li>${e.nome}</li>`).join('')}</ul>
        <h2>Métodos de Treino</h2>
        <form id="novoMetodo">
            <input type="text" name="nome" placeholder="Nome" required />
            <input type="number" name="series" placeholder="Séries" />
            <input type="number" name="repeticoes" placeholder="Repetições" />
            <button type="submit">Criar</button>
        </form>
        <ul id="listaMetodos">${metodos.map(m => `<li>${m.nome}</li>`).join('')}</ul>
    `;

    document.getElementById('novoExercicio').addEventListener('submit', async e => {
        e.preventDefault();
        const form = e.target;
        const body = {
            nome: form.nome.value,
            categoria: form.categoria.value,
            seriesPadrao: form.seriesPadrao.value,
            repeticoesPadrao: form.repeticoesPadrao.value
        };
        const resp = await fetchWithFreshToken('http://localhost:3000/users/exercicios', {
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
            repeticoes: form.repeticoes.value
        };
        const resp = await fetchWithFreshToken('http://localhost:3000/users/metodos', {
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
}

export async function fetchExerciciosMap() {
    const res = await fetchWithFreshToken('http://localhost:3000/users/exercicios');
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
    const res = await fetchWithFreshToken('http://localhost:3000/users/metodos');
    return await res.json();
}
