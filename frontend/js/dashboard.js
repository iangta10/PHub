import { fetchUserRole, fetchUserInfo, fetchWithFreshToken } from "./auth.js";

let USER_ROLE = 'personal';

document.querySelectorAll(".sidebar li").forEach(item => {
    item.addEventListener("click", async () => {
        const section = item.getAttribute("data-section");
        if (section) {
            if (section === "alunos") {
                const { loadAlunosSection } = await import("./alunos.js");
                loadAlunosSection();
            } else if (section === "treinos") {
                const { loadTreinosSection } = await import("./treinos.js");
                const aluno = new URLSearchParams(window.location.search).get('aluno') || '';
                loadTreinosSection(aluno);
           } else if (section === "exercicios") {
               const { loadExerciciosSection } = await import("./exercicios.js");
               loadExerciciosSection();
           } else if (section === "avaliacoes") {
               const { loadAvaliacoesSection } = await import("./avaliacoes.js");
               loadAvaliacoesSection();
            } else if (section === "agenda") {
                const { loadAgendaSection } = await import("./agenda.js");
                const aluno = new URLSearchParams(window.location.search).get('aluno') || '';
                loadAgendaSection(aluno);
            } else if (section === "meus-treinos") {
                const { loadMeusTreinos } = await import("./treinos.js");
                loadMeusTreinos();
            } else if (section === "perfil") {
                const { loadProfileSection } = await import("./profile.js");
                loadProfileSection();
            } else if (section === "home") {
                loadHomeSection();
            } else {
                loadSection(section);
            }
        } else if (item.id === "logoutBtn") {
            localStorage.removeItem("token");
            window.location.href = "login.html";
        }
    });
});

function loadSection(section) {
    const content = document.getElementById("content");
    content.innerHTML = `<h2>${capitalize(section)}</h2><p>Conteúdo do módulo "${section}" será carregado aqui...</p>`;
}

function loadHomeSection() {
    const content = document.getElementById("content");
    content.innerHTML = `
        <section class="welcome">
            <h2 id="welcomeMessage">Bem-vindo!</h2>
            <p id="daySummary">Você tem 0 avaliações e 0 aulas agendadas hoje.</p>
        </section>
        <section class="quick-access">
            <button class="quick-btn" data-action="novo-aluno"><i class="fas fa-user-plus"></i>Cadastrar novo aluno</button>
            <button class="quick-btn" data-action="nova-avaliacao"><i class="fas fa-notes-medical"></i>Nova avaliação</button>
            <button class="quick-btn" data-action="nova-aula"><i class="fas fa-calendar-plus"></i>Agendar aula</button>
            <button class="quick-btn" data-action="invite-link"><i class="fas fa-link"></i>Gerar link de convite</button>
            <button class="quick-btn" data-action="relatorio"><i class="fas fa-chart-line"></i>Relatorio mensal</button>
            <button class="quick-btn" data-action="criar-treino"><i class="fas fa-dumbbell"></i>Criar treino</button>
        </section>
        <section class="day-calendar">
            <h3>Agenda de Hoje</h3>
            <div class="calendar-placeholder">Sem atividades por enquanto.</div>
            <button class="view-month-btn">Ver mês completo</button>
        </section>
        <section class="students-summary">
            <h3>Alunos Ativos</h3>
            <ul class="students-list">
                <li>Exemplo de Aluno</li>
            </ul>
        </section>
    `;

    const novoAlunoBtn = content.querySelector('[data-action="novo-aluno"]');
    const novaAvalBtn = content.querySelector('[data-action="nova-avaliacao"]');
    const novaAulaBtn = content.querySelector('[data-action="nova-aula"]');
    const criarTreinoBtn = content.querySelector('[data-action="criar-treino"]');
    const inviteLinkBtn = content.querySelector('[data-action="invite-link"]');

    if (novoAlunoBtn) {
        novoAlunoBtn.addEventListener('click', async () => {
            const { showNovoAlunoModal } = await import('./alunos.js');
            showNovoAlunoModal();
        });
    }

    if (novaAvalBtn) {
        novaAvalBtn.addEventListener('click', () => {
            openAlunoSelectModal(id => window.location.href = `nova_avaliacao.html?id=${id}`);
        });
    }

    if (novaAulaBtn) {
        novaAulaBtn.addEventListener('click', () => {
            openAlunoSelectModal(id => window.location.href = `dashboard.html?section=agenda&aluno=${id}`);
        });
    }

    if (criarTreinoBtn) {
        criarTreinoBtn.addEventListener('click', () => {
            openAlunoSelectModal(id => window.location.href = `dashboard.html?section=treinos&aluno=${id}`);
        });
    }

    if (inviteLinkBtn) {
        inviteLinkBtn.addEventListener('click', async () => {
            try {
                const res = await fetchWithFreshToken('http://localhost:3000/users/personal-page');
                const page = await res.json();
                if (!page.slug) {
                    alert('Defina sua página em Perfil antes de gerar o link.');
                    return;
                }
                const link = `${window.location.origin}/personal_landing.html?slug=${encodeURIComponent(page.slug)}`;
                await navigator.clipboard.writeText(link);
                alert('Link copiado para a área de transferência.');
            } catch (err) {
                alert('Erro ao gerar link.');
            }
        });
    }
}

function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

async function openAlunoSelectModal(onSelect) {
    try {
        const res = await fetchWithFreshToken('http://localhost:3000/users/alunos');
        const alunos = await res.json();
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content">
                <h3>Selecione o aluno</h3>
                <select id="selAluno">
                    <option value="">Selecione</option>
                    ${alunos.map(a => `<option value="${a.id}">${a.nome}</option>`).join('')}
                </select>
                <div>
                    <button id="confirmSel">Selecionar</button>
                    <button type="button" class="cancelModal">Cancelar</button>
                </div>
            </div>`;
        document.body.appendChild(modal);
        const remove = () => modal.remove();
        modal.querySelector('.cancelModal').addEventListener('click', remove);
        modal.addEventListener('click', e => { if (e.target === modal) remove(); });
        modal.querySelector('#confirmSel').addEventListener('click', () => {
            const id = modal.querySelector('#selAluno').value;
            if (id) {
                remove();
                onSelect(id);
            }
        });
    } catch (err) {
        console.error('Erro ao carregar alunos:', err);
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    try {
        USER_ROLE = await fetchUserRole();
        const userInfo = await fetchUserInfo();
        const greet = document.getElementById('userGreeting');
        if (greet) {
            let name = userInfo && userInfo.nome ? userInfo.nome : '';
            let roleText = 'Personal';
            if (USER_ROLE === 'admin') {
                roleText = 'Admin';
            } else if (USER_ROLE === 'aluno') {
                roleText = 'Aluno';
            }
            greet.textContent = `Olá, ${name || roleText}`;
        }
        const params = new URLSearchParams(window.location.search);
        const sec = params.get('section');
        if (sec) {
            const li = document.querySelector(`.sidebar li[data-section="${sec}"]`);
            if (li) li.click();
        } else {
            loadHomeSection();
        }
    } catch (err) {
        console.error('Erro ao obter role:', err);
    }
});
