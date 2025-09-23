import { fetchWithFreshToken, fetchUserInfo, getCurrentUser } from "./auth.js";
import { StudentsTable } from "./components/studentsTable.js";
import { listStudents, bulkAction, clearStudentsCache } from "./dataProviders/studentsProvider.mjs";

const PLAN_OPTIONS = [
    { id: 'treino-mensal', nome: 'Treino', duracao: 'Mensal', preco: 'R$80', meses: 1 },
    { id: 'treino-trimestral', nome: 'Treino', duracao: 'Trimestral', preco: 'R$70/mês', meses: 3 },
    { id: 'treino-semestral', nome: 'Treino', duracao: 'Semestral', preco: 'R$60/mês', meses: 6 },
    { id: 'treino-dieta-mensal', nome: 'Treino e dieta', duracao: 'Mensal', preco: 'R$150', meses: 1 },
    { id: 'treino-dieta-trimestral', nome: 'Treino e dieta', duracao: 'Trimestral', preco: 'R$135/mês', meses: 3 },
    { id: 'treino-dieta-semestral', nome: 'Treino e dieta', duracao: 'Semestral', preco: 'R$120/mês', meses: 6 },
    { id: 'presencial-1x-mensal', nome: 'Presencial 1x por semana', duracao: 'Mensal', preco: 'R$200', meses: 1 },
    { id: 'presencial-1x-trimestral', nome: 'Presencial 1x por semana', duracao: 'Trimestral', preco: 'R$180/mês', meses: 3 },
    { id: 'presencial-1x-semestral', nome: 'Presencial 1x por semana', duracao: 'Semestral', preco: 'R$160/mês', meses: 6 },
    { id: 'presencial-2x-mensal', nome: 'Presencial 2x por semana', duracao: 'Mensal', preco: 'R$400', meses: 1 },
    { id: 'presencial-2x-trimestral', nome: 'Presencial 2x por semana', duracao: 'Trimestral', preco: 'R$360/mês', meses: 3 },
    { id: 'presencial-2x-semestral', nome: 'Presencial 2x por semana', duracao: 'Semestral', preco: 'R$320/mês', meses: 6 },
    { id: 'presencial-3x-mensal', nome: 'Presencial 3x por semana', duracao: 'Mensal', preco: 'R$600', meses: 1 },
    { id: 'presencial-3x-trimestral', nome: 'Presencial 3x por semana', duracao: 'Trimestral', preco: 'R$540/mês', meses: 3 },
    { id: 'presencial-3x-semestral', nome: 'Presencial 3x por semana', duracao: 'Semestral', preco: 'R$480/mês', meses: 6 },
    { id: 'presencial-4x-mensal', nome: 'Presencial 4x por semana', duracao: 'Mensal', preco: 'R$800', meses: 1 },
    { id: 'presencial-4x-trimestral', nome: 'Presencial 4x por semana', duracao: 'Trimestral', preco: 'R$720/mês', meses: 3 },
    { id: 'presencial-4x-semestral', nome: 'Presencial 4x por semana', duracao: 'Semestral', preco: 'R$640/mês', meses: 6 },
    { id: 'presencial-5x-mensal', nome: 'Presencial 5x por semana', duracao: 'Mensal', preco: 'R$1000', meses: 1 },
    { id: 'presencial-5x-trimestral', nome: 'Presencial 5x por semana', duracao: 'Trimestral', preco: 'R$900/mês', meses: 3 },
    { id: 'presencial-5x-semestral', nome: 'Presencial 5x por semana', duracao: 'Semestral', preco: 'R$800/mês', meses: 6 }
];

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
        const planoDescricao = aluno.plano ? `${aluno.plano.nome} - ${aluno.plano.duracao} (${aluno.plano.preco})` : '';
        const inicioPlano = aluno.inicioPlano ? new Date(aluno.inicioPlano).toLocaleDateString() : '';
        const vencimentoPlano = aluno.vencimentoPlano ? new Date(aluno.vencimentoPlano).toLocaleDateString() : '';
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
                        ${(planoDescricao || inicioPlano || vencimentoPlano) ? `
                        <div class="aluno-cards">
                            ${planoDescricao ? `<span class="info-card">${planoDescricao}</span>` : ''}
                            ${inicioPlano ? `<span class="info-card">Início: ${inicioPlano}</span>` : ''}
                            ${vencimentoPlano ? `<span class="info-card">Vencimento: ${vencimentoPlano}</span>` : ''}
                        </div>` : ''}
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

                ${(planoDescricao || inicioPlano || vencimentoPlano) ? `
                <section class="perfil-section">
                    <h3>Plano</h3>
                    ${planoDescricao ? `<p><strong>Plano:</strong> ${planoDescricao}</p>` : ''}
                    ${inicioPlano ? `<p><strong>Início:</strong> ${inicioPlano}</p>` : ''}
                    ${vencimentoPlano ? `<p><strong>Vencimento:</strong> ${vencimentoPlano}</p>` : ''}
                </section>` : ''}

                <section class="perfil-section">
                    <h3>Objetivos</h3>
                    <p><strong>Objetivo principal:</strong> ${aluno.objetivo || ''}</p>
                </section>

                ${aluno.observacoes ? `
                <section class="perfil-section">
                    <h3>Observações</h3>
                    <p>${aluno.observacoes}</p>
                </section>` : ''}

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
    const matchingPlan = aluno.plano
        ? PLAN_OPTIONS.find(opt => opt.id === aluno.plano.id)
            || PLAN_OPTIONS.find(opt => opt.nome === aluno.plano.nome && opt.duracao === aluno.plano.duracao)
        : null;
    const selectedPlanId = matchingPlan?.id || '';
    const statusNormalized = (aluno.status || '').toString().toLowerCase();
    const initialStatus = statusNormalized === 'inativo' ? 'inativo'
        : statusNormalized === 'ativo' ? 'ativo'
            : statusNormalized === 'pendente' ? 'pendente' : 'ativo';
    const isStatusActive = initialStatus === 'ativo';
    const isStatusInactive = initialStatus === 'inativo';
    const statusLabel = aluno.statusLabel || aluno.status || '';

    const planOptionsHtml = PLAN_OPTIONS.map(option => `
                <option value="${option.id}" ${option.id === selectedPlanId ? 'selected' : ''}>
                    ${option.nome} - ${option.duracao} - ${option.preco}
                </option>`).join('');
    content.innerHTML = `
        <h2>Editar Aluno</h2>
        <form id="editAlunoForm">
            <div class="form-field">
                <label for="editAlunoNome">Nome</label>
                <input id="editAlunoNome" type="text" name="nome" value="${aluno.nome || ''}" />
            </div>
            <div class="form-field">
                <label for="editAlunoEmail">Email</label>
                <input id="editAlunoEmail" type="email" name="email" value="${aluno.email || ''}" />
            </div>
            <div class="form-field">
                <label for="editAlunoTelefone">Telefone</label>
                <input id="editAlunoTelefone" type="text" name="telefone" value="${aluno.telefone || ''}" />
            </div>
            <div class="form-field status-field">
                <span>Status</span>
                <div class="status-buttons" role="group" aria-label="Status do aluno">
                    <button type="button" class="status-button${isStatusActive ? ' active' : ''}" data-status="ativo">Ativo</button>
                    <button type="button" class="status-button${isStatusInactive ? ' active' : ''}" data-status="inativo">Inativo</button>
                </div>
                <input type="hidden" name="status" value="${initialStatus}" />
                ${initialStatus !== 'ativo' && initialStatus !== 'inativo' && statusLabel ? `<small>Status atual: ${statusLabel}</small>` : ''}
            </div>
            <div class="form-field">
                <label for="editAlunoDataNascimento">Data de nascimento</label>
                <input id="editAlunoDataNascimento" type="date" name="dataNascimento" value="${aluno.dataNascimento || ''}" />
            </div>
            <div class="form-field">
                <label for="editAlunoSexo">Sexo</label>
                <input id="editAlunoSexo" type="text" name="sexo" value="${aluno.sexo || ''}" />
            </div>
            <div class="form-field">
                <label for="editAlunoFotoUrl">URL da foto</label>
                <input id="editAlunoFotoUrl" type="text" name="fotoUrl" value="${aluno.fotoUrl || ''}" />
            </div>
            <div class="form-field">
                <label for="editAlunoPlano">Plano</label>
                <select id="editAlunoPlano" name="plano">
                    <option value="">Selecione um plano</option>
                    ${planOptionsHtml}
                </select>
                <small class="plan-info" data-plan-info></small>
            </div>
            <div class="form-field">
                <label for="editAlunoInicioPlano">Início do plano</label>
                <input id="editAlunoInicioPlano" type="date" name="inicioPlano" value="${aluno.inicioPlano || ''}" />
            </div>
            <div class="form-field">
                <label for="editAlunoVencimentoPlano">Vencimento do plano</label>
                <input id="editAlunoVencimentoPlano" type="date" name="vencimentoPlano" value="${aluno.vencimentoPlano || ''}" readonly />
            </div>
            <div class="form-field">
                <label for="editAlunoObjetivo">Objetivo</label>
                <textarea id="editAlunoObjetivo" name="objetivo">${aluno.objetivo || ''}</textarea>
            </div>
            <div class="form-field">
                <label for="editAlunoObservacoes">Observações</label>
                <textarea id="editAlunoObservacoes" name="observacoes">${aluno.observacoes || ''}</textarea>
            </div>
            <button type="submit">Salvar</button>
            <button type="button" id="cancelEdit">Cancelar</button>
        </form>
    `;

    document.getElementById('cancelEdit').addEventListener('click', () => showAlunoDetails(aluno.id));
    const form = document.getElementById('editAlunoForm');

    const planSelect = form.querySelector('#editAlunoPlano');
    const planInfo = form.querySelector('[data-plan-info]');
    const inicioPlanoInput = form.querySelector('#editAlunoInicioPlano');
    const vencimentoPlanoInput = form.querySelector('#editAlunoVencimentoPlano');
    const statusInput = form.querySelector('input[name="status"]');
    const statusButtons = form.querySelectorAll('.status-button');

    statusButtons.forEach(button => {
        button.addEventListener('click', () => {
            const value = button.dataset.status;
            if (!value || !statusInput) return;
            statusInput.value = value;
            statusButtons.forEach(btn => btn.classList.toggle('active', btn === button));
        });
    });

    const updatePlanDetails = (shouldCalculateEnd = false, { ensureStartDate = false } = {}) => {
        const selectedPlan = PLAN_OPTIONS.find(opt => opt.id === planSelect.value);
        if (planInfo) {
            planInfo.textContent = selectedPlan
                ? `${selectedPlan.nome} - ${selectedPlan.duracao} - ${selectedPlan.preco}`
                : 'Selecione um plano para visualizar os detalhes';
        }
        if (!selectedPlan) {
            if (shouldCalculateEnd) {
                vencimentoPlanoInput.value = '';
            }
            return;
        }
        if (shouldCalculateEnd) {
            if (ensureStartDate && !inicioPlanoInput.value) {
                const hoje = new Date();
                const iso = new Date(hoje.getTime() - hoje.getTimezoneOffset() * 60000).toISOString().split('T')[0];
                inicioPlanoInput.value = iso;
            }
            if (inicioPlanoInput.value) {
                const dataInicio = new Date(inicioPlanoInput.value);
                const dataFim = new Date(dataInicio);
                dataFim.setMonth(dataFim.getMonth() + selectedPlan.meses);
                const isoFim = new Date(dataFim.getTime() - dataFim.getTimezoneOffset() * 60000).toISOString().split('T')[0];
                vencimentoPlanoInput.value = isoFim;
            } else {
                vencimentoPlanoInput.value = '';
            }
        }
    };

    updatePlanDetails(!vencimentoPlanoInput.value && !!planSelect.value);

    planSelect.addEventListener('change', () => updatePlanDetails(true, { ensureStartDate: true }));
    inicioPlanoInput.addEventListener('change', () => updatePlanDetails(true));

    form.addEventListener('submit', async e => {
        e.preventDefault();
        const data = {
            nome: form.nome.value,
            email: form.email.value,
            telefone: form.telefone.value,
            dataNascimento: form.dataNascimento.value,
            sexo: form.sexo.value,
            fotoUrl: form.fotoUrl.value,
            objetivo: form.objetivo.value,
            observacoes: form.observacoes.value,
            status: statusInput?.value || initialStatus || 'ativo'
        };
        const planoSelecionado = PLAN_OPTIONS.find(opt => opt.id === form.plano.value);
        data.plano = planoSelecionado ? {
            id: planoSelecionado.id,
            nome: planoSelecionado.nome,
            duracao: planoSelecionado.duracao,
            preco: planoSelecionado.preco
        } : null;
        data.inicioPlano = form.inicioPlano.value || null;
        data.vencimentoPlano = form.vencimentoPlano.value || null;
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
    const planOptionsHtml = PLAN_OPTIONS.map(option => `
                    <option value="${option.id}">${option.nome} - ${option.duracao} - ${option.preco}</option>
                `).join('');

    modal.innerHTML = `
        <div class="modal-content">
            <form id="novoAlunoForm" class="novo-aluno-form">
                <h3>Novo Aluno</h3>
                <div class="form-field">
                    <label for="novoAlunoNome">Nome</label>
                    <input id="novoAlunoNome" type="text" name="nome" placeholder="Nome" required />
                </div>
                <div class="form-field">
                    <label for="novoAlunoEmail">Email</label>
                    <input id="novoAlunoEmail" type="email" name="email" placeholder="Email" />
                </div>
                <div class="form-field">
                    <label for="novoAlunoObservacoes">Observações</label>
                    <textarea id="novoAlunoObservacoes" name="observacoes" placeholder="Observações"></textarea>
                </div>
                <div class="complete-fields" data-complete hidden>
                    <div class="form-field">
                        <label for="novoAlunoTelefone">Telefone</label>
                        <input id="novoAlunoTelefone" type="text" name="telefone" placeholder="Telefone" />
                    </div>
                    <div class="form-field">
                        <label for="novoAlunoDataNascimento">Data de nascimento</label>
                        <input id="novoAlunoDataNascimento" type="date" name="dataNascimento" />
                    </div>
                    <div class="form-field">
                        <label for="novoAlunoSexo">Sexo</label>
                        <input id="novoAlunoSexo" type="text" name="sexo" placeholder="Sexo" />
                    </div>
                    <div class="form-field">
                        <label for="novoAlunoFotoUrl">URL da foto</label>
                        <input id="novoAlunoFotoUrl" type="text" name="fotoUrl" placeholder="https://..." />
                    </div>
                    <div class="form-field">
                        <label for="novoAlunoAulas">Aulas por semana</label>
                        <input id="novoAlunoAulas" type="number" min="1" name="aulasPorSemana" placeholder="2" />
                    </div>
                    <div class="form-field">
                        <label for="novoAlunoObjetivo">Objetivo</label>
                        <textarea id="novoAlunoObjetivo" name="objetivo" placeholder="Objetivo do aluno"></textarea>
                    </div>
                    <div class="form-field">
                        <label for="novoAlunoPlano">Plano</label>
                        <select id="novoAlunoPlano" name="plano">
                            <option value="">Selecione um plano</option>
                            ${planOptionsHtml}
                        </select>
                        <small class="plan-info" data-plan-info>Selecione um plano para visualizar os detalhes</small>
                    </div>
                    <div class="form-field">
                        <label for="novoAlunoInicioPlano">Início do plano</label>
                        <input id="novoAlunoInicioPlano" type="date" name="inicioPlano" />
                    </div>
                    <div class="form-field">
                        <label for="novoAlunoVencimentoPlano">Vencimento do plano</label>
                        <input id="novoAlunoVencimentoPlano" type="date" name="vencimentoPlano" readonly />
                    </div>
                </div>
                <div class="modal-actions">
                    <button type="button" data-action="show-complete">Cadastro completo</button>
                    <button type="submit">Salvar</button>
                    <button type="button" class="cancelModal">Cancelar</button>
                </div>
            </form>
        </div>`;

    document.body.appendChild(modal);

    const remove = () => {
        modal.remove();
        document.removeEventListener('keydown', handleKeyDown);
    };

    const handleKeyDown = (evt) => {
        if (evt.key === 'Escape') {
            remove();
        }
    };

    document.addEventListener('keydown', handleKeyDown);

    const cancelBtn = modal.querySelector('.cancelModal');
    cancelBtn?.addEventListener('click', remove);

    modal.addEventListener('click', e => {
        if (e.target === modal) {
            remove();
        }
    });

    const form = modal.querySelector('#novoAlunoForm');
    const completeSection = modal.querySelector('[data-complete]');
    const showCompleteBtn = modal.querySelector('[data-action="show-complete"]');
    const planSelect = form.querySelector('#novoAlunoPlano');
    const planInfo = form.querySelector('[data-plan-info]');
    const inicioPlanoInput = form.querySelector('#novoAlunoInicioPlano');
    const vencimentoPlanoInput = form.querySelector('#novoAlunoVencimentoPlano');

    if (showCompleteBtn && completeSection) {
        showCompleteBtn.addEventListener('click', () => {
            completeSection.hidden = false;
            showCompleteBtn.remove();
            form.classList.add('is-complete');
            setTimeout(() => {
                form.querySelector('#novoAlunoTelefone')?.focus();
            }, 0);
        });
    }

    const updatePlanDetails = (shouldCalculateEnd = false, { ensureStartDate = false } = {}) => {
        if (!planSelect) return;
        const selectedPlan = PLAN_OPTIONS.find(opt => opt.id === planSelect.value);
        if (planInfo) {
            planInfo.textContent = selectedPlan
                ? `${selectedPlan.nome} - ${selectedPlan.duracao} - ${selectedPlan.preco}`
                : 'Selecione um plano para visualizar os detalhes';
        }
        if (!selectedPlan) {
            if (shouldCalculateEnd && vencimentoPlanoInput) {
                vencimentoPlanoInput.value = '';
            }
            return;
        }
        if (shouldCalculateEnd && inicioPlanoInput && vencimentoPlanoInput) {
            if (ensureStartDate && !inicioPlanoInput.value) {
                const hoje = new Date();
                const iso = new Date(hoje.getTime() - hoje.getTimezoneOffset() * 60000).toISOString().split('T')[0];
                inicioPlanoInput.value = iso;
            }
            if (inicioPlanoInput.value) {
                const dataInicio = new Date(inicioPlanoInput.value);
                const dataFim = new Date(dataInicio);
                dataFim.setMonth(dataFim.getMonth() + selectedPlan.meses);
                const isoFim = new Date(dataFim.getTime() - dataFim.getTimezoneOffset() * 60000).toISOString().split('T')[0];
                vencimentoPlanoInput.value = isoFim;
            } else {
                vencimentoPlanoInput.value = '';
            }
        }
    };

    updatePlanDetails(false);

    planSelect?.addEventListener('change', () => updatePlanDetails(true, { ensureStartDate: true }));
    inicioPlanoInput?.addEventListener('change', () => updatePlanDetails(true));

    form.addEventListener('submit', async e => {
        e.preventDefault();
        const nome = form.nome.value.trim();
        if (!nome) {
            alert('Informe o nome do aluno.');
            form.nome.focus();
            return;
        }

        const body = {
            nome,
            observacoes: form.observacoes.value.trim()
        };

        const email = form.email.value.trim();
        if (email) {
            body.email = email;
        }

        const telefone = form.telefone.value.trim();
        if (telefone) {
            body.telefone = telefone;
        }

        const dataNascimento = form.dataNascimento.value;
        if (dataNascimento) {
            body.dataNascimento = dataNascimento;
        }

        const sexo = form.sexo.value.trim();
        if (sexo) {
            body.sexo = sexo;
        }

        const fotoUrl = form.fotoUrl.value.trim();
        if (fotoUrl) {
            body.fotoUrl = fotoUrl;
        }

        const aulasPorSemana = form.aulasPorSemana.value;
        if (aulasPorSemana) {
            const aulas = Number(aulasPorSemana);
            if (!Number.isNaN(aulas)) {
                body.aulasPorSemana = aulas;
            }
        }

        const objetivo = form.objetivo.value.trim();
        if (objetivo) {
            body.objetivo = objetivo;
        }

        const planoSelecionado = PLAN_OPTIONS.find(opt => opt.id === form.plano.value);
        if (planoSelecionado) {
            body.plano = {
                id: planoSelecionado.id,
                nome: planoSelecionado.nome,
                duracao: planoSelecionado.duracao,
                preco: planoSelecionado.preco
            };
        }

        const inicioPlano = form.inicioPlano.value;
        if (inicioPlano) {
            body.inicioPlano = inicioPlano;
        }

        const vencimentoPlano = form.vencimentoPlano.value;
        if (vencimentoPlano) {
            body.vencimentoPlano = vencimentoPlano;
        }

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
