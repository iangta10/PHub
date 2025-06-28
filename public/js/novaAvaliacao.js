import { getAlunoId, renderOpcoes } from './avaliacao.js';
import { fetchWithFreshToken } from './auth.js';

async function carregarCabecalho(id) {
    if (!id) return;
    try {
        const res = await fetchWithFreshToken(`/api/users/alunos/${id}`);
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

    // cria/recupera id da avaliacao em andamento
    let avalId = localStorage.getItem(`currentAvalId_${id}`);
    if (!avalId) {
        avalId = Date.now().toString();
        localStorage.setItem(`currentAvalId_${id}`, avalId);
    } else {
        const lista = JSON.parse(localStorage.getItem(`avaliacoes_${id}`) || '[]');
        const existente = lista.find(a => a.id === avalId);
        if (existente && document.getElementById('proximaAvaliacao')) {
            document.getElementById('proximaAvaliacao').value = existente.proxima || '';
        }
    }

    const finalizar = document.getElementById('finalizarAvaliacao');
    const cancelar = document.getElementById('cancelarAvaliacao');

    if (cancelar) {
        cancelar.addEventListener('click', () => {
            localStorage.removeItem(`currentAvalId_${id}`);
            window.location.href = 'dashboard.html?section=avaliacoes';
        });
    }

    if (finalizar) {
        finalizar.addEventListener('click', () => {
            const avalId = localStorage.getItem(`currentAvalId_${id}`);
            const proxima = document.getElementById('proximaAvaliacao');
            const avaliacao = {
                id: avalId,
                data: new Date().toISOString(),
                proxima: proxima ? proxima.value : ''
            };
            const chave = `avaliacoes_${id}`;
            const lista = JSON.parse(localStorage.getItem(chave) || '[]');
            const idx = lista.findIndex(a => a.id === avalId);
            if (idx >= 0) {
                lista[idx] = avaliacao;
            } else {
                lista.push(avaliacao);
            }
            localStorage.setItem(chave, JSON.stringify(lista));
            localStorage.removeItem(`currentAvalId_${id}`);
            window.location.href = 'dashboard.html?section=avaliacoes';
        });
    }
});
