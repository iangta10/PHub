import { getAlunoId, loadAlunoInfo, renderOpcoes } from './avaliacao.js';
import { fetchWithFreshToken } from './auth.js';

async function carregarAvaliacoes(id) {
    const container = document.getElementById('avaliacoesFeitas');
    if (!container) return;
    container.innerHTML = '<p>Carregando avaliações...</p>';
    try {
        const res = await fetchWithFreshToken(`http://localhost:3000/users/alunos/${id}/avaliacoes`);
        const avaliacoes = await res.json();
        if (!avaliacoes || avaliacoes.length === 0) {
            container.innerHTML = '<p>Nenhuma avaliação encontrada.</p>';
            return;
        }
        container.innerHTML = '<ul>' +
            avaliacoes.map(a => `<li>${new Date(a.data).toLocaleDateString()}</li>`).join('') +
            '</ul>';
    } catch (err) {
        console.error(err);
        container.innerHTML = '<p style="color:red;">Erro ao carregar avaliações</p>';
    }
}

function setupNovaAvaliacao(id) {
    const btn = document.getElementById('novaAvaliacaoBtn');
    if (!btn) return;
    btn.addEventListener('click', () => {
        btn.classList.add('hidden');
        const lista = document.getElementById('avaliacoesFeitas');
        if (lista) lista.classList.add('hidden');
        renderOpcoes(id, 'avaliacaoOpcoes');
        const opcoes = document.getElementById('avaliacaoOpcoes');
        if (opcoes) opcoes.classList.remove('hidden');
    });
}

document.addEventListener('DOMContentLoaded', () => {
    const id = getAlunoId();
    loadAlunoInfo(id, 'alunoHeader');
    carregarAvaliacoes(id);
    setupNovaAvaliacao(id);
});
