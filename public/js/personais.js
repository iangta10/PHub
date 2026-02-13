import { fetchWithFreshToken } from './auth.js';

export async function loadPersonaisSection() {
    const content = document.getElementById('content');
    if (!content) return;

    content.innerHTML = `
        <section class="students-section">
            <div class="students-topbar">
                <h2>Personais cadastrados</h2>
                <button id="novoPersonalBtn" class="btn btn-primary">Novo personal</button>
            </div>
            <div id="personaisFeedback" style="margin-bottom: 12px;"></div>
            <div class="students-table-wrap">
                <table class="students-table" id="personaisTable">
                    <thead>
                        <tr>
                            <th>Nome</th>
                            <th>Email</th>
                            <th>Username</th>
                            <th>Ações</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr><td colspan="4">Carregando...</td></tr>
                    </tbody>
                </table>
            </div>
        </section>
    `;

    const createBtn = content.querySelector('#novoPersonalBtn');
    createBtn?.addEventListener('click', () => openPersonalModal());

    await renderPersonaisTable();
}

async function renderPersonaisTable() {
    const tbody = document.querySelector('#personaisTable tbody');
    const feedback = document.getElementById('personaisFeedback');
    if (!tbody) return;

    try {
        const res = await fetchWithFreshToken('/api/users/personais');
        if (!res.ok) {
            throw new Error('Não foi possível carregar os personais.');
        }

        const personais = await res.json();
        if (!Array.isArray(personais) || personais.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4">Nenhum personal cadastrado.</td></tr>';
            return;
        }

        tbody.innerHTML = personais.map(personal => `
            <tr>
                <td>${escapeHtml(personal.nome || '-')}</td>
                <td>${escapeHtml(personal.email || '-')}</td>
                <td>${escapeHtml(personal.username || '-')}</td>
                <td>
                    <button class="btn btn-sm editPersonalBtn" data-id="${personal.id}">Editar</button>
                    <button class="btn btn-sm deletePersonalBtn" data-id="${personal.id}" data-nome="${escapeHtml(personal.nome || personal.email || 'este personal')}">Remover</button>
                </td>
            </tr>
        `).join('');

        tbody.querySelectorAll('.editPersonalBtn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = btn.getAttribute('data-id');
                const found = personais.find(p => p.id === id);
                if (found) openPersonalModal(found);
            });
        });

        tbody.querySelectorAll('.deletePersonalBtn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = btn.getAttribute('data-id');
                const nome = btn.getAttribute('data-nome') || 'este personal';
                const confirmed = confirm(`Deseja realmente remover ${nome}?`);
                if (!confirmed) return;

                try {
                    const delRes = await fetchWithFreshToken(`/api/users/personais/${id}`, { method: 'DELETE' });
                    const payload = await delRes.json().catch(() => ({}));
                    if (!delRes.ok) throw new Error(payload.message || 'Erro ao remover personal');
                    setFeedback(feedback, 'Personal removido com sucesso.', false);
                    await renderPersonaisTable();
                } catch (err) {
                    setFeedback(feedback, err.message || 'Erro ao remover personal.', true);
                }
            });
        });
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="4">${escapeHtml(err.message || 'Erro ao carregar dados')}</td></tr>`;
        if (feedback) setFeedback(feedback, err.message || 'Erro ao carregar personais.', true);
    }
}

function openPersonalModal(personal = null) {
    const isEdit = Boolean(personal?.id);

    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 460px;">
            <h3>${isEdit ? 'Editar personal' : 'Novo personal'}</h3>
            <form id="personalForm">
                <label>Nome
                    <input type="text" name="nome" required value="${escapeAttribute(personal?.nome || '')}" />
                </label>
                <label>Email
                    <input type="email" name="email" required value="${escapeAttribute(personal?.email || '')}" />
                </label>
                <label>Username
                    <input type="text" name="username" value="${escapeAttribute(personal?.username || '')}" placeholder="personal" />
                </label>
                <div style="display:flex; gap: 8px; margin-top: 12px;">
                    <button type="submit" class="btn btn-primary">${isEdit ? 'Salvar' : 'Criar personal'}</button>
                    <button type="button" class="btn cancelModal">Cancelar</button>
                </div>
            </form>
        </div>
    `;

    const removeModal = () => modal.remove();
    modal.querySelector('.cancelModal')?.addEventListener('click', removeModal);
    modal.addEventListener('click', e => {
        if (e.target === modal) removeModal();
    });

    const form = modal.querySelector('#personalForm');
    form?.addEventListener('submit', async (event) => {
        event.preventDefault();
        const formData = new FormData(form);
        const payload = {
            nome: String(formData.get('nome') || '').trim(),
            email: String(formData.get('email') || '').trim(),
            username: String(formData.get('username') || '').trim()
        };

        try {
            const url = isEdit ? `/api/users/personais/${personal.id}` : '/api/users/personais';
            const method = isEdit ? 'PUT' : 'POST';
            const res = await fetchWithFreshToken(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.message || 'Não foi possível salvar o personal.');

            removeModal();
            await renderPersonaisTable();

            if (!isEdit && data.password) {
                alert(`Personal criado com sucesso.\n\nSenha gerada: ${data.password}\n\nCompartilhe com segurança.`);
            }
        } catch (err) {
            alert(err.message || 'Erro ao salvar personal.');
        }
    });

    document.body.appendChild(modal);
}

function setFeedback(container, message, isError) {
    if (!container) return;
    container.textContent = message;
    container.style.color = isError ? '#c0392b' : '#1e8449';
}

function escapeHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function escapeAttribute(value) {
    return escapeHtml(value).replace(/`/g, '&#96;');
}
