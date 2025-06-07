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
                    <li data-id="${aluno.id}"><strong>${aluno.nome}</strong> (${aluno.email})</li>
                `).join('')}
            </ul>
        `;

        const searchInput = document.getElementById('searchAluno');
        const list = document.getElementById('alunoList');
        searchInput.addEventListener('input', () => {
            const term = searchInput.value.toLowerCase();
            list.innerHTML = alunos
                .filter(a => a.nome && a.nome.toLowerCase().includes(term))
                .map(aluno => `<li data-id="${aluno.id}"><strong>${aluno.nome}</strong> (${aluno.email})</li>`)
                .join('');
            attachAlunoHandlers();
        });
        attachAlunoHandlers();
    } catch (err) {
        console.error("Erro ao buscar alunos:", err);
        content.innerHTML = `<p style="color:red;">Erro ao carregar alunos</p>`;
    }
}

function attachAlunoHandlers() {
    document.querySelectorAll('#alunoList li').forEach(li => {
        li.addEventListener('click', () => showAlunoDetails(li.dataset.id));
    });
}

async function showAlunoDetails(id) {
    const content = document.getElementById('content');
    content.innerHTML = '<h2>Carregando...</h2>';
    try {
        const res = await fetchWithFreshToken(`http://localhost:3000/users/alunos/${id}`);
        if (!res.ok) throw new Error('Erro ao buscar aluno');
        const aluno = await res.json();

        content.innerHTML = `
            <h2>${aluno.nome}</h2>
            <p><strong>Email:</strong> ${aluno.email || ''}</p>
            <p><strong>Observações:</strong> ${aluno.observacoes || ''}</p>
            <button id="editAluno">Editar</button>
            <button id="deleteAluno">Remover</button>
            <button id="voltarAlunos">Voltar</button>
        `;

        document.getElementById('editAluno').addEventListener('click', () => showEditAlunoForm(aluno));
        document.getElementById('deleteAluno').addEventListener('click', async () => {
            if (confirm('Tem certeza que deseja remover este aluno?')) {
                const delRes = await fetchWithFreshToken(`http://localhost:3000/users/alunos/${id}`, { method: 'DELETE' });
                if (delRes.ok) {
                    loadAlunosSection();
                } else {
                    alert('Erro ao remover aluno');
                }
            }
        });
        document.getElementById('voltarAlunos').addEventListener('click', loadAlunosSection);
    } catch (err) {
        console.error(err);
        content.innerHTML = '<p style="color:red;">Erro ao carregar aluno</p>';
    }
}

function showEditAlunoForm(aluno) {
    const content = document.getElementById('content');
    content.innerHTML = `
        <h2>Editar Aluno</h2>
        <form id="editAlunoForm">
            <input type="text" name="nome" value="${aluno.nome || ''}" placeholder="Nome" />
            <input type="email" name="email" value="${aluno.email || ''}" placeholder="Email" />
            <textarea name="observacoes" placeholder="Observações">${aluno.observacoes || ''}</textarea>
            <button type="submit">Salvar</button>
            <button type="button" id="cancelEdit">Cancelar</button>
        </form>
    `;

    document.getElementById('cancelEdit').addEventListener('click', () => showAlunoDetails(aluno.id));
    document.getElementById('editAlunoForm').addEventListener('submit', async e => {
        e.preventDefault();
        const form = e.target;
        const data = {
            nome: form.nome.value,
            email: form.email.value,
            observacoes: form.observacoes.value
        };
        const res = await fetchWithFreshToken(`http://localhost:3000/users/alunos/${aluno.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (res.ok) {
            showAlunoDetails(aluno.id);
        } else {
            alert('Erro ao atualizar aluno');
        }
    });
}
