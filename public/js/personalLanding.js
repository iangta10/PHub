async function loadPage() {
    const params = new URLSearchParams(window.location.search);
    const slug = params.get('slug');
    if (!slug) {
        document.getElementById('landingContainer').textContent = 'Personal não encontrado';
        return;
    }
    try {
        const res = await fetch(`http://localhost:3000/public/personal/${slug}`);
        if (!res.ok) throw new Error('not found');
        const page = await res.json();
        render(page, slug);
    } catch (err) {
        document.getElementById('landingContainer').textContent = 'Erro ao carregar página';
    }
}

function render(page, slug) {
    const container = document.getElementById('landingContainer');
    const planos = Array.isArray(page.planos) ? page.planos : [];
    container.innerHTML = `
        <h1>${page.displayName || ''}</h1>
        ${page.photoUrl ? `<img src="${page.photoUrl}" alt="Foto" style="max-width:100%;"/>` : ''}
        <p>${page.description || ''}</p>
        <div id="planos"></div>
    `;
    const planosDiv = document.getElementById('planos');
    planosDiv.innerHTML = planos.map((p, i) => `
        <div class="plan" data-index="${i}">
            <h3>${p.nome || ''}</h3>
            <p>${p.valor ? 'R$ '+p.valor : ''}</p>
            <button class="buy" data-aulas="${p.aulasPorSemana}">Assinar</button>
        </div>
    `).join('');
    planosDiv.querySelectorAll('.buy').forEach(btn => {
        btn.addEventListener('click', () => {
            const aulas = btn.dataset.aulas;
            if (confirm('Simular pagamento do plano?')) {
                window.location.href = `register.html?personal=${slug}&plan=${aulas}`;
            }
        });
    });
}

document.addEventListener('DOMContentLoaded', loadPage);
