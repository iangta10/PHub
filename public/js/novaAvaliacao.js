import { fetchAlunoInfo, getAlunoId, renderOpcoes } from './avaliacao.js';

function calcularIdade(dataNascimento) {
    if (!dataNascimento) return '';
    const nasc = new Date(dataNascimento);
    if (Number.isNaN(nasc.getTime())) return '';
    const hoje = new Date();
    let idade = hoje.getFullYear() - nasc.getFullYear();
    const mes = hoje.getMonth() - nasc.getMonth();
    if (mes < 0 || (mes === 0 && hoje.getDate() < nasc.getDate())) {
        idade--;
    }
    return idade >= 0 ? idade : '';
}

async function carregarCabecalho(id) {
    if (!id) return;
    try {
        const aluno = await fetchAlunoInfo(id);
        if (!aluno) return;
        const nomeEl = document.getElementById('nomeAluno');
        const metaEl = document.getElementById('metaAluno');
        const fotoEl = document.getElementById('fotoAluno');
        const emailEl = document.querySelector('[data-aluno-email]');

        if (nomeEl) nomeEl.textContent = aluno.nome || '';
        if (metaEl) {
            const metaParts = [];
            const idade = aluno.idade || calcularIdade(aluno.dataNascimento);
            if (idade) metaParts.push(`${idade} anos`);
            const generoLabel = aluno.genero || aluno.sexo || '';
            if (generoLabel) metaParts.push(generoLabel);
            metaEl.textContent = metaParts.join(' • ');
        }
        if (emailEl) {
            emailEl.textContent = aluno.email || aluno.emailAddress || '—';
        }
        if (fotoEl) {
            const generoReferencia = (aluno.genero || aluno.sexo || '').toString().toLowerCase();
            const feminino = generoReferencia.startsWith('f');
            const defaultFoto = feminino ? './img/avatar-female.svg' : './img/avatar-male.svg';
            const fotoSrc = aluno.fotoUrl || defaultFoto;
            fotoEl.src = fotoSrc;
            fotoEl.alt = aluno.nome ? `Foto de ${aluno.nome}` : 'Foto do aluno';
            fotoEl.addEventListener('error', () => {
                fotoEl.src = defaultFoto;
            }, { once: true });
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
