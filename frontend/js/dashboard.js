import { fetchUserRole } from "./auth.js";

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
            } else if (section === "anamnese") {
                const { loadAnamneseSection } = await import("./anamnese.js");
                loadAnamneseSection();
            } else if (section === "meus-treinos") {
                const { loadMeusTreinos } = await import("./treinos.js");
                loadMeusTreinos();
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

function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

document.addEventListener('DOMContentLoaded', async () => {
    try {
        USER_ROLE = await fetchUserRole();
        const greet = document.getElementById('userGreeting');
        if (greet) {
            let roleText = 'Personal';
            if (USER_ROLE === 'admin') {
                roleText = 'Admin';
            } else if (USER_ROLE === 'aluno') {
                roleText = 'Aluno';
            }
            greet.textContent = `Olá, ${roleText}`;
        }
    } catch (err) {
        console.error('Erro ao obter role:', err);
    }
});
