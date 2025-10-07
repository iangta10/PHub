import { getAlunoId, renderOpcoes } from './avaliacao.js';
import { fetchWithFreshToken } from './auth.js';

function updateMainOffset() {
    const header = document.querySelector('.page-header');
    if (!header) return;
    const offset = header.getBoundingClientRect().height + 20;
    document.documentElement.style.setProperty('--page-header-offset', `${offset}px`);
}

async function carregarCabecalho(id) {
    if (!id) return;
    try {
        const res = await fetchWithFreshToken(`/api/users/alunos/${id}`);
        if (res.ok) {
            const aluno = await res.json();
            const nomeEl = document.getElementById('nomeAluno');
            const metaEl = document.getElementById('metaAluno');
            const fotoEl = document.getElementById('fotoAluno');
            if (nomeEl) nomeEl.textContent = aluno.nome || '';
            if (metaEl) {
                const metaParts = [];
                if (aluno.idade) metaParts.push(`${aluno.idade} anos`);
                if (aluno.sexo) metaParts.push(aluno.sexo);
                metaEl.textContent = metaParts.join(' • ');
            }
            if (fotoEl) {
                const genero = (aluno.sexo || '').toString().toLowerCase();
                const feminino = genero.startsWith('f');
                const defaultFoto = feminino ? './img/avatar-female.svg' : './img/avatar-male.svg';
                const fotoSrc = aluno.fotoUrl || defaultFoto;
                fotoEl.src = fotoSrc;
                fotoEl.alt = aluno.nome ? `Foto de ${aluno.nome}` : 'Foto do aluno';
                fotoEl.addEventListener('error', () => {
                    fotoEl.src = defaultFoto;
                }, { once: true });
            }
            updateMainOffset();
        }
    } catch (err) {
        console.error('Erro ao carregar aluno', err);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const id = getAlunoId();
    carregarCabecalho(id);
    renderOpcoes(id, 'avaliacaoOpcoes');

    updateMainOffset();
    window.addEventListener('resize', updateMainOffset);

    const header = document.querySelector('.page-header');
    if (header && 'ResizeObserver' in window) {
        const observer = new ResizeObserver(() => updateMainOffset());
        observer.observe(header);
    }

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
