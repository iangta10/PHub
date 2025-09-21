import { fetchWithFreshToken, fetchUserInfo, getCurrentUser } from "./auth.js";
import { StudentsTable } from "./components/studentsTable.js";
import { listStudents, bulkAction, clearStudentsCache } from "./dataProviders/studentsProvider.mjs";

let personalContextPromise;
let studentsTableInstance = null;

async function getPersonalContext() {
    if (!personalContextPromise) {
        personalContextPromise = (async () => {
            const [userInfo, authUser] = await Promise.all([
                fetchUserInfo().catch(() => null),
                getCurrentUser().catch(() => null)
            ]);
            return {
                id: authUser?.uid || userInfo?.id || null,
                nome: userInfo?.nome || authUser?.displayName || '',
                email: userInfo?.email || authUser?.email || ''
            };
        })();
    }
    return personalContextPromise;
}

export async function loadAlunosSection() {
    const content = document.getElementById("content");
    if (!content) return;
    content.innerHTML = "";
    const container = document.createElement('div');
    container.className = 'students-host';
    content.appendChild(container);

    if (studentsTableInstance) {
        studentsTableInstance = null;
    }

    studentsTableInstance = new StudentsTable({
        root: container,
        provider: {
            listStudents,
            bulkAction
        },
        onCreateStudent: () => {
            showNovoAlunoModal(async () => {
                clearStudentsCache();
                await studentsTableInstance?.reload({ preservePage: false });
            });
        },
        onGenerateForm: async () => {
            const personal = await getPersonalContext();
            if (!personal || !personal.id) {
                alert('Não foi possível gerar o formulário. Faça login novamente e tente outra vez.');
                return;
            }
            showAnamneseFormModal(personal);
        },
        onViewStudent: (id) => {
            if (id) {
                showAlunoDetails(id);
            }
        },
        onEditStudent: async (id) => {
            if (!id) return;
            await openEditAlunoFromList(id);
        },
        onOpenTrainings: (id) => {
            if (id) {
                window.location.href = `dashboard.html?section=treinos&aluno=${id}`;
            }
        },
        onOpenAgenda: (id) => {
            if (id) {
                window.location.href = `dashboard.html?section=agenda&aluno=${id}`;
            }
        }
    });

    await studentsTableInstance.init();
}

function showAnamneseFormModal(personal) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content">
            <h3>Gerar formulário de anamnese</h3>
            <p>Escolha o tipo de formulário que deseja enviar para o aluno.</p>
            <div class="modal-actions">
                <button type="button" class="quick-btn" data-form-type="apenas-treino">Apenas treino</button>
                <button type="button" class="quick-btn" data-form-type="dieta-treino">Dieta e treino</button>
            </div>
            <div class="modal-link-container hidden">
                <p>Link gerado:</p>
                <div class="modal-link-row">
                    <input type="text" class="modal-link-input" readonly />
                    <button type="button" data-action="copy">Copiar link</button>
                </div>
                <div class="modal-link-actions">
                    <button type="button" data-action="open">Abrir formulário</button>
                </div>
                <span class="modal-feedback hidden"></span>
            </div>
            <button type="button" data-action="close">Fechar</button>
        </div>
    `;

    const closeModal = () => {
        modal.remove();
        document.removeEventListener('keydown', handleKeyDown);
    };

    const handleKeyDown = (evt) => {
        if (evt.key === 'Escape') {
            closeModal();
        }
    };

    const buildLink = (type) => {
        const url = new URL(`${window.location.origin}/formulario_anamnese.html`);
        url.searchParams.set('personalId', personal.id);
        url.searchParams.set('type', type);
        if (personal.nome) {
            url.searchParams.set('personalName', personal.nome);
        }
        return url.toString();
    };

    const actions = modal.querySelectorAll('[data-form-type]');
    const linkContainer = modal.querySelector('.modal-link-container');
    const linkInput = modal.querySelector('.modal-link-input');
    const feedback = modal.querySelector('.modal-feedback');

    actions.forEach(btn => {
        btn.addEventListener('click', () => {
            const link = buildLink(btn.dataset.formType);
            linkInput.value = link;
            linkContainer.dataset.link = link;
            linkContainer.classList.remove('hidden');
            feedback.classList.add('hidden');
            feedback.textContent = '';
        });
    });

    const copyBtn = modal.querySelector('[data-action="copy"]');
    if (copyBtn) {
        copyBtn.addEventListener('click', async () => {
            const link = linkContainer.dataset.link;
            if (!link) return;
            try {
                if (navigator.clipboard?.writeText) {
                    await navigator.clipboard.writeText(link);
                } else {
                    linkInput.focus();
                    linkInput.select();
                    document.execCommand('copy');
                }
                feedback.textContent = 'Link copiado para a área de transferência!';
                feedback.classList.remove('hidden');
                feedback.classList.remove('error');
            } catch (err) {
                console.error('Erro ao copiar link:', err);
                feedback.textContent = 'Não foi possível copiar automaticamente. Copie o link manualmente.';
                feedback.classList.remove('hidden');
                feedback.classList.add('error');
            }
        });
    }

    const openBtn = modal.querySelector('[data-action="open"]');
    if (openBtn) {
        openBtn.addEventListener('click', () => {
            const link = linkContainer.dataset.link;
            if (link) {
                window.open(link, '_blank');
            }
        });
    }

    const closeBtn = modal.querySelector('[data-action="close"]');
    if (closeBtn) {
        closeBtn.addEventListener('click', closeModal);
    }

    modal.addEventListener('click', (event) => {
        if (event.target === modal) {
            closeModal();
        }
    });

    document.addEventListener('keydown', handleKeyDown);
    document.body.appendChild(modal);
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

async function openEditAlunoFromList(id) {
    try {
        const res = await fetchWithFreshToken(`/api/users/alunos/${id}`);
        if (!res.ok) {
            throw new Error('Erro ao buscar aluno');
        }
        const aluno = await res.json();
        showEditAlunoForm(aluno);
    } catch (err) {
        console.error('Erro ao abrir edição do aluno:', err);
        alert('Não foi possível carregar os dados do aluno.');
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
                clearStudentsCache();
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
