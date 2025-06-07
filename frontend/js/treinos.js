import { fetchWithFreshToken } from "./auth.js";

export async function loadTreinosSection() {
    const content = document.getElementById("content");
    content.innerHTML = "<h2>Carregando...</h2>";

    try {
        const res = await fetchWithFreshToken('http://localhost:3000/users/alunos');
        const alunos = await res.json();

        content.innerHTML = `
            <h2>Novo Treino</h2>
            <form id="novoTreinoForm">
                <select name="aluno" required>
                    <option value="">Selecione o aluno</option>
                    ${alunos.map(a => `<option value="${a.id}">${a.nome}</option>`).join('')}
                </select>
                <input type="text" name="nome" placeholder="Nome do treino" required />
                <textarea name="exercicios" placeholder="Exercícios (um por linha)"></textarea>
                <button type="submit">Criar</button>
            </form>
            <div id="mensagemTreino"></div>
        `;

        document.getElementById('novoTreinoForm').addEventListener('submit', async e => {
            e.preventDefault();
            const form = e.target;
            const alunoId = form.aluno.value;
            const nome = form.nome.value;
            const exercicios = form.exercicios.value.split('\n').filter(l => l.trim());
            const resp = await fetchWithFreshToken(`http://localhost:3000/users/alunos/${alunoId}/treinos`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nome, exercicios })
            });
            if (resp.ok) {
                form.reset();
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

        content.innerHTML = `
            <h2>Meus Treinos</h2>
            <ul>
                ${treinos.map(t => `<li><strong>${t.nome}</strong><br>${(t.exercicios || []).join('<br>')}</li>`).join('')}
            </ul>
        `;
    } catch (err) {
        console.error('Erro ao carregar treinos do aluno:', err);
        content.innerHTML = '<p style="color:red;">Erro ao carregar treinos</p>';
    }
}
