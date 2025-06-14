import { getAlunoId, renderOpcoes } from './avaliacao.js';
import { fetchWithFreshToken } from './auth.js';

async function carregarCabecalho(id) {
    if (!id) return;
    try {
        const res = await fetchWithFreshToken(`http://localhost:3000/users/alunos/${id}`);
        if (res.ok) {
            const aluno = await res.json();
            const nomeEl = document.getElementById('nomeAluno');
            const idadeEl = document.getElementById('idadeAluno');
            const sexoEl = document.getElementById('sexoAluno');
            const fotoEl = document.getElementById('fotoAluno');
            if (nomeEl) nomeEl.textContent = aluno.nome || '';
            if (idadeEl && aluno.idade) idadeEl.textContent = `${aluno.idade} anos`;
            if (sexoEl && aluno.sexo) sexoEl.textContent = aluno.sexo;
            if (fotoEl && aluno.fotoUrl) fotoEl.src = aluno.fotoUrl;
        }
    } catch (err) {
        console.error('Erro ao carregar aluno', err);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const id = getAlunoId();
    carregarCabecalho(id);
    renderOpcoes(id, 'avaliacaoOpcoes');

    const finalizar = document.getElementById('finalizarAvaliacao');
    const cancelar = document.getElementById('cancelarAvaliacao');

    if (cancelar) {
        cancelar.addEventListener('click', () => {
            window.location.href = 'dashboard.html?section=avaliacoes';
        });
    }

    if (finalizar) {
        finalizar.addEventListener('click', () => {
            const proxima = document.getElementById('proximaAvaliacao');
            const avaliacao = {
                id: Date.now(),
                data: new Date().toISOString(),
                proxima: proxima ? proxima.value : ''
            };
            const chave = `avaliacoes_${id}`;
            const lista = JSON.parse(localStorage.getItem(chave) || '[]');
            lista.push(avaliacao);
            localStorage.setItem(chave, JSON.stringify(lista));
            window.location.href = 'dashboard.html?section=avaliacoes';
        });
    }
});
