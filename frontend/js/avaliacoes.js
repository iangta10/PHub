import { fetchWithFreshToken } from './auth.js';

export async function loadAvaliacoesSection() {
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
        <h2>Avaliação Física</h2>
        <input type="text" id="searchAlunoAvaliacao" placeholder="Buscar por nome..." />
        <select id="alunoSelectAvaliacao">
            <option value="">Selecione o aluno</option>
            ${options}
        </select>
        <div id="avaliacoesList"></div>
        <button id="novaAvaliacao" class="hidden">Nova Avaliação</button>
    `;

    const searchInput = document.getElementById('searchAlunoAvaliacao');
    const alunoSelect = document.getElementById('alunoSelectAvaliacao');
    const listDiv = document.getElementById('avaliacoesList');
    const novaBtn = document.getElementById('novaAvaliacao');

    searchInput.addEventListener('input', () => {
        const term = searchInput.value.toLowerCase();
        alunoSelect.innerHTML = '<option value="">Selecione o aluno</option>' +
            alunos.filter(a => a.nome && a.nome.toLowerCase().includes(term))
                  .map(a => `<option value="${a.id}">${a.nome}</option>`).join('');
    });

    alunoSelect.addEventListener('change', () => {
        const alunoId = alunoSelect.value;
        if (alunoId) {
            loadAvaliacoesAluno(alunoId, listDiv);
            novaBtn.classList.remove('hidden');
            novaBtn.dataset.id = alunoId;
        } else {
            listDiv.innerHTML = '';
            novaBtn.classList.add('hidden');
        }
    });

    novaBtn.addEventListener('click', () => {
        window.location.href = `avaliacao.html?id=${novaBtn.dataset.id}`;
    });
}

async function loadAvaliacoesAluno(alunoId, container) {
    container.innerHTML = '<p>Carregando avalia\u00e7\u00f5es...</p>';
    try {
        const res = await fetchWithFreshToken(`http://localhost:3000/users/alunos/${alunoId}/avaliacoes`);
        const avaliacoes = await res.json();
        if (!avaliacoes || avaliacoes.length === 0) {
            container.innerHTML = '<p>Nenhuma avalia\u00e7\u00e3o encontrada.</p>';
            return;
        }
        container.innerHTML = '<ul>' +
            avaliacoes.map(a => `<li>${new Date(a.data).toLocaleDateString()}</li>`).join('') +
            '</ul>';
    } catch (err) {
        console.error(err);
        container.innerHTML = '<p style="color:red;">Erro ao carregar avalia\u00e7\u00f5es</p>';
    }
}
