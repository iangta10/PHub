import { fetchWithFreshToken } from "./auth.js";

export async function loadAlunosSection() {
    const content = document.getElementById("content");
    content.innerHTML = "<h2>Carregando alunos...</h2>";

    try {
        const res = await fetchWithFreshToken('http://localhost:3000/users/alunos');
        const alunos = await res.json();

        content.innerHTML = `
            <h2>Meus Alunos</h2>
            <input type="text" id="searchAluno" placeholder="Buscar por nome..." />
            <ul id="alunoList">
                ${alunos.map(aluno => `
                    <li><strong>${aluno.nome}</strong> (${aluno.email})</li>
                `).join('')}
            </ul>
        `;

        const searchInput = document.getElementById('searchAluno');
        const list = document.getElementById('alunoList');
        searchInput.addEventListener('input', () => {
            const term = searchInput.value.toLowerCase();
            list.innerHTML = alunos
                .filter(a => a.nome && a.nome.toLowerCase().includes(term))
                .map(aluno => `<li><strong>${aluno.nome}</strong> (${aluno.email})</li>`)
                .join('');
        });
    } catch (err) {
        console.error("Erro ao buscar alunos:", err);
        content.innerHTML = `<p style="color:red;">Erro ao carregar alunos</p>`;
    }
}
