import { fetchWithFreshToken } from './auth.js';

export function loadAvaliacaoFisicaSection(alunoId) {
    const content = document.getElementById('content');
    content.innerHTML = `
        <h2>Avaliação Física</h2>
        <form id="avaliacaoFisicaForm">
            <input type="number" step="0.1" name="peso" placeholder="Peso (kg)" />
            <input type="number" step="0.01" name="altura" placeholder="Altura (m)" />
            <textarea name="dobras" placeholder="Dobras cutâneas"></textarea>
            <textarea name="perimetria" placeholder="Perimetria"></textarea>
            <button type="submit">Salvar</button>
        </form>
        <div id="msgAvalFisica"></div>
    `;

    const form = document.getElementById('avaliacaoFisicaForm');
    form.addEventListener('submit', e => salvarAvaliacaoFisica(e, alunoId));
}

async function salvarAvaliacaoFisica(e, alunoId) {
    e.preventDefault();
    const dados = {};
    const form = e.target;
    Array.from(form.elements).forEach(el => {
        if (el.name) dados[el.name] = el.value;
    });
    try {
        const res = await fetchWithFreshToken(`http://localhost:3000/users/alunos/${alunoId}/avaliacoes`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dados)
        });
        document.getElementById('msgAvalFisica').textContent = res.ok ? 'Avaliação salva' : 'Erro ao salvar avaliação';
    } catch (err) {
        console.error('Erro ao salvar avaliação:', err);
        document.getElementById('msgAvalFisica').textContent = 'Erro ao salvar avaliação';
    }
}
