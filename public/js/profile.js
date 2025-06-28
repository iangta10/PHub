import { fetchWithFreshToken } from './auth.js';

export async function loadProfileSection() {
    const content = document.getElementById('content');
    content.innerHTML = '<h2>Carregando...</h2>';
    try {
        const [userRes, pageRes] = await Promise.all([
            fetchWithFreshToken('/api/users/me'),
            fetchWithFreshToken('/api/users/personal-page')
        ]);
        const user = await userRes.json();
        const page = await pageRes.json();
        render(content, user, page);
    } catch (err) {
        console.error('Erro ao carregar perfil:', err);
        content.innerHTML = '<p style="color:red;">Erro ao carregar dados</p>';
    }
}

function render(container, user, page) {
    container.innerHTML = `
        <h2>Meu Perfil</h2>
        <p><strong>Email:</strong> ${user.email}</p>
        <p><strong>Nome de usuário:</strong> ${user.username || ''}</p>
        <button id="editPageBtn">Editar Página de Apresentação</button>
        <div id="pageEditor" class="hidden"></div>
    `;
    document.getElementById('editPageBtn').addEventListener('click', () => showPageEditor(page));
}

function showPageEditor(page) {
    const editor = document.getElementById('pageEditor');
    editor.classList.remove('hidden');
    editor.innerHTML = `
        <h3>Landing Page</h3>
        <input type="text" id="pageSlug" placeholder="Slug" value="${page.slug || ''}" />
        <input type="text" id="pageDisplay" placeholder="Nome de exibição" value="${page.displayName || ''}" />
        <input type="text" id="pagePhoto" placeholder="URL da foto" value="${page.photoUrl || ''}" />
        <textarea id="pageDesc" placeholder="Descrição">${page.description || ''}</textarea>
        <div id="planList"></div>
        <button id="addPlanBtn">Adicionar Plano</button>
        <button id="savePage">Salvar</button>
    `;

    const planList = document.getElementById('planList');
    const planos = Array.isArray(page.planos) ? page.planos : [];
    const renderPlans = () => {
        planList.innerHTML = planos.map((p, i) => `
            <div class="plan" data-index="${i}">
                <input type="text" class="planNome" placeholder="Nome" value="${p.nome || ''}" />
                <input type="number" class="planAulas" placeholder="Aulas/semana" value="${p.aulasPorSemana || 1}" />
                <input type="text" class="planValor" placeholder="Valor" value="${p.valor || ''}" />
                <button class="removePlan">Remover</button>
            </div>
        `).join('');
        planList.querySelectorAll('.removePlan').forEach(btn => {
            btn.addEventListener('click', () => {
                const idx = parseInt(btn.parentElement.dataset.index);
                planos.splice(idx, 1);
                renderPlans();
            });
        });
    };
    renderPlans();

    document.getElementById('addPlanBtn').addEventListener('click', () => {
        planos.push({ nome: '', aulasPorSemana: 1, valor: '' });
        renderPlans();
    });

    document.getElementById('savePage').addEventListener('click', async () => {
        const body = {
            slug: document.getElementById('pageSlug').value.trim(),
            displayName: document.getElementById('pageDisplay').value.trim(),
            photoUrl: document.getElementById('pagePhoto').value.trim(),
            description: document.getElementById('pageDesc').value.trim(),
            planos: planos.map(row => ({
                nome: row.nome || document.querySelectorAll('.planNome')[planos.indexOf(row)].value,
                aulasPorSemana: parseInt(document.querySelectorAll('.planAulas')[planos.indexOf(row)].value) || 1,
                valor: document.querySelectorAll('.planValor')[planos.indexOf(row)].value
            }))
        };
        try {
            await fetchWithFreshToken('/api/users/personal-page', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            alert('Página salva');
        } catch (err) {
            alert('Erro ao salvar página');
        }
    });
}
