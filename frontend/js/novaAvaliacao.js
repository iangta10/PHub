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

    const back = document.getElementById('backBtn');
    if (back) back.addEventListener('click', () => window.history.back());
});
