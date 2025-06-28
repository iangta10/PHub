import { fetchWithFreshToken } from "./auth.js";

export async function loadAlunosSection() {
    const content = document.getElementById("content");
    content.innerHTML = "<h2>Carregando alunos...</h2>";

    try {
        const res = await fetchWithFreshToken('/api/users/alunos');
        const alunos = await res.json();

        content.innerHTML = `
            <h2>Meus Alunos</h2>
            <button id="btnNovoAluno" class="quick-btn">Cadastrar novo aluno</button>
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
        const btnNovo = document.getElementById('btnNovoAluno');
        if (btnNovo) btnNovo.addEventListener('click', () => showNovoAlunoModal(loadAlunosSection));
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

function calcularIdade(data) {
    if (!data) return '';
    const nasc = new Date(data);
    const hoje = new Date();
    let idade = hoje.getFullYear() - nasc.getFullYear();
    const m = hoje.getMonth() - nasc.getMonth();
    if (m < 0 || (m === 0 && hoje.getDate() < nasc.getDate())) idade--;
    return idade;
}

function getAvaliacoesResumo(alunoId) {
    const lista = JSON.parse(localStorage.getItem(`avaliacoes_${alunoId}`) || '[]');
    return lista.map(a => {
        const comp = JSON.parse(localStorage.getItem(`avaliacao_${alunoId}_${a.id}_composicao`) || '{}');
        const peso = comp.peso || '';
        const altura = comp.altura || '';
        const imc = peso && altura ? (Number(peso) / ((Number(altura) / 100) ** 2)).toFixed(2) : '';
        return {
            data: a.data,
            peso,
            altura,
            imc,
            gordura: comp.gordura || comp.percentualGordura || '',
            fc: comp.fcRepouso || comp.fc || ''
        };
    }).sort((a,b)=>new Date(b.data)-new Date(a.data));
}

function renderAvalRow(a) {
    return `<tr><td>${new Date(a.data).toLocaleDateString()}</td><td>${a.peso || '-'}</td><td>${a.altura || '-'}</td><td>${a.imc || '-'}</td><td>${a.gordura || '-'}</td><td>${a.fc || '-'}</td></tr>`;
}

async function fetchHistoricoTreinos(alunoId) {
    try {
        const res = await fetchWithFreshToken(`/api/users/alunos/${alunoId}/treinos`);
        if (res.ok) return await res.json();
    } catch (err) {
        console.error('Erro ao buscar treinos:', err);
    }
    return [];
}

async function showAlunoDetails(id) {
    const content = document.getElementById('content');
    content.innerHTML = '<h2>Carregando...</h2>';
    try {
        const res = await fetchWithFreshToken(`/api/users/alunos/${id}`);
        if (!res.ok) throw new Error('Erro ao buscar aluno');
        const aluno = await res.json();

        const idade = calcularIdade(aluno.dataNascimento);
        const avaliacoes = getAvaliacoesResumo(id);
        const treinos = await fetchHistoricoTreinos(id);
        const modalRows = avaliacoes.map(a => renderAvalRow(a)).join('') || '<tr><td colspan="6">Nenhuma avaliação</td></tr>';
        const tableRows = avaliacoes.slice(0, 3).map(a => renderAvalRow(a)).join('') || '<tr><td colspan="6">Nenhuma avaliação</td></tr>';

        content.innerHTML = `
            <div class="aluno-perfil">
                <div class="dados-pessoais">
                    <img src="${aluno.fotoUrl || './img/profile-placeholder.png'}" alt="Foto do aluno">
                    <div>
                        <h2>${aluno.nome || ''}</h2>
                        <div class="aluno-cards">
                            ${idade ? `<span class="info-card">${idade} anos</span>` : ''}
                            ${aluno.sexo ? `<span class="info-card">${aluno.sexo}</span>` : ''}
                        </div>
                        <p>${aluno.telefone || ''}</p>
                        <p>${aluno.email || ''}</p>
                    </div>
                </div>

                <section class="perfil-section">
                    <h3>Histórico de Avaliações Físicas e de Saúde</h3>
                    <table class="avaliacoes-table">
                        <thead>
                            <tr><th>Data</th><th>Peso</th><th>Altura</th><th>IMC</th><th>% Gordura</th><th>FC Repouso</th></tr>
                        </thead>
                        <tbody id="tableAvalResumo">${tableRows}</tbody>
                    </table>
                    <button id="abrirHistCompleto">Ver histórico completo</button>
                </section>

                <section class="perfil-section">
                    <h3>Objetivos</h3>
                    <p><strong>Objetivo principal:</strong> ${aluno.objetivo || ''}</p>
                    <p><strong>Metas específicas:</strong> ${aluno.metas || ''}</p>
                    <p><strong>Prazo:</strong> ${aluno.prazoMeta || ''}</p>
                    <p>${aluno.motivacao || ''}</p>
                </section>

                <section class="perfil-section">
                    <h3>Histórico de Treinos</h3>
                    <div id="treinosHist">
                        ${treinos.map(t => `<div><strong>${new Date(t.criadoEm).toLocaleDateString()}</strong> - ${t.nome}</div>`).join('') || '<p>Nenhum treino cadastrado.</p>'}
                    </div>
                </section>

                <div class="perfil-actions">
                    <button id="editAluno">Editar</button>
                    <button id="deleteAluno">Remover</button>
                    <button id="voltarAlunos">Voltar</button>
                </div>
            </div>

            <div id="histCompletoModal" class="modal hidden">
                <div class="modal-content">
                    <h3>Histórico Completo de Avaliações</h3>
                    <table class="avaliacoes-table">
                        <thead>
                            <tr><th>Data</th><th>Peso</th><th>Altura</th><th>IMC</th><th>% Gordura</th><th>FC Repouso</th></tr>
                        </thead>
                        <tbody>${modalRows}</tbody>
                    </table>
                    <button class="fecharModal">Fechar</button>
                </div>
            </div>
        `;

        document.getElementById('editAluno').addEventListener('click', () => showEditAlunoForm(aluno));
        document.getElementById('deleteAluno').addEventListener('click', async () => {
            if (confirm('Tem certeza que deseja remover este aluno?')) {
                const delRes = await fetchWithFreshToken(`/api/users/alunos/${id}`, { method: 'DELETE' });
                if (delRes.ok) {
                    loadAlunosSection();
                } else {
                    alert('Erro ao remover aluno');
                }
            }
        });
        document.getElementById('voltarAlunos').addEventListener('click', loadAlunosSection);
        document.getElementById('abrirHistCompleto').addEventListener('click', () => {
            document.getElementById('histCompletoModal').classList.remove('hidden');
        });
        document.querySelector('#histCompletoModal .fecharModal').addEventListener('click', () => {
            document.getElementById('histCompletoModal').classList.add('hidden');
        });
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
            <input type="text" name="telefone" value="${aluno.telefone || ''}" placeholder="Telefone" />
            <input type="date" name="dataNascimento" value="${aluno.dataNascimento || ''}" />
            <input type="text" name="sexo" value="${aluno.sexo || ''}" placeholder="Sexo" />
            <input type="text" name="fotoUrl" value="${aluno.fotoUrl || ''}" placeholder="URL da foto" />
            <textarea name="objetivo" placeholder="Objetivo">${aluno.objetivo || ''}</textarea>
            <textarea name="metas" placeholder="Metas">${aluno.metas || ''}</textarea>
            <input type="text" name="prazoMeta" value="${aluno.prazoMeta || ''}" placeholder="Prazo" />
            <textarea name="motivacao" placeholder="Motivação">${aluno.motivacao || ''}</textarea>
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
            telefone: form.telefone.value,
            dataNascimento: form.dataNascimento.value,
            sexo: form.sexo.value,
            fotoUrl: form.fotoUrl.value,
            objetivo: form.objetivo.value,
            metas: form.metas.value,
            prazoMeta: form.prazoMeta.value,
            motivacao: form.motivacao.value,
            observacoes: form.observacoes.value
        };
        const res = await fetchWithFreshToken(`/api/users/alunos/${aluno.id}`, {
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

export function showNovoAlunoModal(callback) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content">
            <form id="novoAlunoForm">
                <h3>Novo Aluno</h3>
                <input type="text" name="nome" placeholder="Nome" required />
                <input type="email" name="email" placeholder="Email" />
                <textarea name="observacoes" placeholder="Observações"></textarea>
                <div>
                    <button type="submit">Cadastrar</button>
                    <button type="button" class="cancelModal">Cancelar</button>
                </div>
            </form>
        </div>`;
    document.body.appendChild(modal);
    const remove = () => modal.remove();
    modal.querySelector('.cancelModal').addEventListener('click', remove);
    modal.addEventListener('click', e => { if (e.target === modal) remove(); });
    modal.querySelector('#novoAlunoForm').addEventListener('submit', async e => {
        e.preventDefault();
        const form = e.target;
        const body = {
            nome: form.nome.value,
            email: form.email.value,
            observacoes: form.observacoes.value
        };
        try {
            const res = await fetchWithFreshToken('/api/users/alunos', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            if (res.ok) {
                remove();
                if (callback) callback();
            } else {
                alert('Erro ao cadastrar aluno');
            }
        } catch (err) {
            console.error('Erro ao cadastrar aluno:', err);
            alert('Erro ao cadastrar aluno');
        }
    });
}
