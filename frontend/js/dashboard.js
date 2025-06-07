document.querySelectorAll(".sidebar li").forEach(item => {
    item.addEventListener("click", async () => {
        const section = item.getAttribute("data-section");
        if (section) {
            if (section === "alunos") {
                const { loadAlunosSection } = await import("./alunos.js");
                loadAlunosSection();
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
