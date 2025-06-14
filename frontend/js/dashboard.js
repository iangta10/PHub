import { fetchUserRole, fetchUserInfo } from "./auth.js";

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
                loadTreinosSection();
            } else if (section === "exercicios") {
                const { loadExerciciosSection } = await import("./exercicios.js");
                loadExerciciosSection();
            } else if (section === "avaliacoes") {
                const { loadAvaliacoesSection } = await import("./avaliacoes.js");
                loadAvaliacoesSection();
            } else if (section === "meus-treinos") {
                const { loadMeusTreinos } = await import("./treinos.js");
                loadMeusTreinos();
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
            <button class="quick-btn" data-action="nova-aula"><i class="fas fa-calendar-plus"></i>Nova aula agendada</button>
            <button class="quick-btn" data-action="fichas"><i class="fas fa-folder-open"></i>Ver fichas dos alunos</button>
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
}

function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
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
