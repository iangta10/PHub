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
    container.innerHTML = `
        <h2>Avaliações de Alunos</h2>
        <div class="autocomplete-wrapper">
            <input type="text" id="searchAlunoAvaliacao" placeholder="Digite o nome do aluno..." autocomplete="off" />
            <ul id="alunoSugestoes" class="autocomplete-list hidden"></ul>
        </div>
        <div id="painelAluno"></div>
        <div id="avaliacoesList"></div>
        <button id="novaAvaliacao" class="hidden">Nova Avaliação</button>
    `;

    const input = document.getElementById('searchAlunoAvaliacao');
    const sugList = document.getElementById('alunoSugestoes');
    const painel = document.getElementById('painelAluno');
    const listDiv = document.getElementById('avaliacoesList');
    const novaBtn = document.getElementById('novaAvaliacao');

    let idx = -1;

    input.addEventListener('input', () => {
        const term = input.value.toLowerCase();
        const matches = alunos.filter(a => a.nome && a.nome.toLowerCase().includes(term));
        if (!term || matches.length === 0) {
            sugList.classList.add('hidden');
            sugList.innerHTML = '';
            return;
        }
        sugList.innerHTML = matches.map((a, i) => `<li data-id="${a.id}" data-index="${i}">${a.nome}</li>`).join('');
        sugList.classList.remove('hidden');
        idx = -1;
    });

    input.addEventListener('keydown', e => {
        const items = sugList.querySelectorAll('li');
        if (!items.length) return;
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            idx = (idx + 1) % items.length;
            updateHighlight(items);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            idx = (idx - 1 + items.length) % items.length;
            updateHighlight(items);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (idx >= 0) items[idx].click();
        }
    });

    sugList.addEventListener('click', e => {
        if (e.target.tagName === 'LI') {
            const id = e.target.dataset.id;
            const nome = e.target.textContent;
            input.value = nome;
            sugList.innerHTML = '';
            sugList.classList.add('hidden');
            mostrarAvaliacoes(id, nome);
        }
    });

    function updateHighlight(items) {
        items.forEach(li => li.classList.remove('active'));
        if (idx >= 0) items[idx].classList.add('active');
    }

    async function mostrarAvaliacoes(alunoId, nome) {
        painel.innerHTML = `<h3>${nome}</h3>`;
        novaBtn.dataset.id = alunoId;
        novaBtn.classList.remove('hidden');
        listDiv.innerHTML = '<p>Carregando avaliações...</p>';
        let avaliacoes = [];
        try {
            const res = await fetchWithFreshToken(`http://localhost:3000/users/alunos/${alunoId}/avaliacoes`);
            if (res.ok) {
                avaliacoes = await res.json();
            }
        } catch (err) {
            console.error(err);
        }

        const locais = JSON.parse(localStorage.getItem(`avaliacoes_${alunoId}`) || '[]');
        avaliacoes = avaliacoes.concat(locais);

        if (!avaliacoes || avaliacoes.length === 0) {
            listDiv.innerHTML = '<p class="sem-avaliacoes">Este aluno ainda não possui avaliações cadastradas.</p>';
            return;
        }

        listDiv.innerHTML = avaliacoes.map(a => `
            <div class="avaliacao-card">
                <span>${new Date(a.data).toLocaleDateString()}</span>
                <div>
                    <button class="btn-visualizar" data-id="${a.id || ''}">Visualizar</button>
                    <button class="btn-editar" data-id="${a.id || ''}">Editar</button>
                    <button class="btn-excluir" data-id="${a.id || ''}">Excluir</button>
                </div>
            </div>
        `).join('');

        listDiv.querySelectorAll('.btn-visualizar').forEach(btn => {
            btn.addEventListener('click', () => {
                const avalId = btn.dataset.id;
                window.location.href = `visualizar_avaliacao.html?alunoId=${alunoId}&avaliacaoId=${avalId}`;
            });
        });
        listDiv.querySelectorAll('.btn-editar').forEach(btn => {
            btn.addEventListener('click', () => {
                const avalId = btn.dataset.id;
                localStorage.setItem(`currentAvalId_${alunoId}`, avalId);
                window.location.href = `nova_avaliacao.html?id=${alunoId}`;
            });
        });
        listDiv.querySelectorAll('.btn-excluir').forEach(btn => {
            btn.addEventListener('click', () => {
                if (confirm('Deseja excluir esta avaliação?')) {
                    const avalId = btn.dataset.id;
                    const chave = `avaliacoes_${alunoId}`;
                    const lista = JSON.parse(localStorage.getItem(chave) || '[]').filter(a => String(a.id) !== avalId);
                    localStorage.setItem(chave, JSON.stringify(lista));
                    const partes = ['anamnese','composicao','perimetria','flexibilidade','postural'];
                    partes.forEach(p => localStorage.removeItem(`avaliacao_${alunoId}_${avalId}_${p}`));
                    mostrarAvaliacoes(alunoId, nome);
                }
            });
        });
    }

    novaBtn.addEventListener('click', () => {
        if (novaBtn.dataset.id) {
            window.location.href = `nova_avaliacao.html?id=${novaBtn.dataset.id}`;
        }
    });
}

