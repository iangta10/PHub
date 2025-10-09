import { fetchAlunoInfo, getAlunoId, getAvaliacaoId, renderOpcoes } from './avaliacao.js';
import { createEvaluation, deleteEvaluation, getEvaluation, listEvaluations, updateEvaluation } from './evaluationsApi.js';

function toDateInputValue(iso) {
    if (!iso) return '';
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '';
    return date.toISOString().slice(0, 10);
}

function toIsoDate(value) {
    if (!value) return null;
    const date = new Date(`${value}T00:00:00`);
    if (Number.isNaN(date.getTime())) return null;
    return date.toISOString();
}

function ensureQueryParam(name, value) {
    const url = new URL(window.location.href);
    if (value === null || value === undefined || value === '') {
        url.searchParams.delete(name);
    } else {
        url.searchParams.set(name, value);
    }
    window.history.replaceState({}, '', url.toString());
}

async function ensureEvaluation(alunoId) {
    if (!alunoId) return null;
    const existingParamId = getAvaliacaoId();
    if (existingParamId) {
        const existing = await getEvaluation(alunoId, existingParamId).catch(() => null);
        if (existing) {
            return { evaluation: existing, createdNow: false };
        }
    }

    try {
        const drafts = await listEvaluations(alunoId, { status: 'draft', limit: 1 });
        if (Array.isArray(drafts) && drafts.length) {
            ensureQueryParam('avaliacao', drafts[0].id);
            return { evaluation: drafts[0], createdNow: false };
        }
    } catch (err) {
        console.error('Erro ao buscar avaliações em rascunho:', err);
    }

    const created = await createEvaluation(alunoId, { status: 'draft' });
    ensureQueryParam('avaliacao', created.id);
    return { evaluation: created, createdNow: true };
}

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

document.addEventListener('DOMContentLoaded', async () => {
    const alunoId = getAlunoId();
    carregarCabecalho(alunoId);

    let avaliacaoAtual = null;
    let createdNow = false;

    try {
        const ensured = await ensureEvaluation(alunoId);
        avaliacaoAtual = ensured?.evaluation || null;
        createdNow = Boolean(ensured?.createdNow);
    } catch (err) {
        console.error('Erro ao inicializar avaliação:', err);
    }

    if (!avaliacaoAtual) {
        alert('Não foi possível iniciar a avaliação.');
        window.location.href = 'dashboard.html?section=avaliacoes';
        return;
    }

    renderOpcoes(alunoId, 'avaliacaoOpcoes', avaliacaoAtual.id);

    const proximaInput = document.getElementById('proximaAvaliacao');
    if (proximaInput && avaliacaoAtual.nextEvaluationAt) {
        proximaInput.value = toDateInputValue(avaliacaoAtual.nextEvaluationAt);
    }

    const finalizar = document.getElementById('finalizarAvaliacao');
    const cancelar = document.getElementById('cancelarAvaliacao');

    if (cancelar) {
        cancelar.addEventListener('click', async () => {
            try {
                if (avaliacaoAtual && avaliacaoAtual.status === 'draft' && createdNow) {
                    await deleteEvaluation(alunoId, avaliacaoAtual.id);
                }
            } catch (err) {
                console.error('Erro ao cancelar avaliação:', err);
            } finally {
                window.location.href = 'dashboard.html?section=avaliacoes';
            }
        });
    }

    if (finalizar) {
        finalizar.addEventListener('click', async () => {
            finalizar.disabled = true;
            try {
                const proxima = document.getElementById('proximaAvaliacao');
                const proximaIso = toIsoDate(proxima ? proxima.value : '');
                await updateEvaluation(alunoId, avaliacaoAtual.id, {
                    status: 'completed',
                    nextEvaluationAt: proximaIso,
                    completedAt: new Date().toISOString()
                });
                window.location.href = 'dashboard.html?section=avaliacoes';
            } catch (err) {
                console.error('Erro ao finalizar avaliação:', err);
                alert('Não foi possível finalizar a avaliação. Tente novamente.');
                finalizar.disabled = false;
            }
        });
    }
});
