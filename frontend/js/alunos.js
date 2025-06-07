import { fetchWithFreshToken } from "./auth.js";

export async function loadAlunosSection() {
    const content = document.getElementById("content");
    content.innerHTML = "<h2>Carregando alunos...</h2>";

    try {
        const res = await fetchWithFreshToken('http://localhost:3000/users/alunos');
        const alunos = await res.json();

        content.innerHTML = `
            <h2>Meus Alunos</h2>
            <ul>
                ${alunos.map(aluno => `
                    <li><strong>${aluno.nome}</strong> (${aluno.email})</li>
                `).join('')}
            </ul>
        `;
    } catch (err) {
        console.error("Erro ao buscar alunos:", err);
        content.innerHTML = `<p style="color:red;">Erro ao carregar alunos</p>`;
    }
}
