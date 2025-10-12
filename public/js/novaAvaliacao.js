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

function toDateInputValueFromDate(date) {
    if (!(date instanceof Date)) return '';
    const time = date.getTime();
    if (Number.isNaN(time)) return '';
    const adjusted = new Date(time - date.getTimezoneOffset() * 60000);
    return adjusted.toISOString().slice(0, 10);
}

function getTodayInputValue() {
    return toDateInputValueFromDate(new Date());
}

function computeNextEvaluationDate(realizacaoValue, days = 60) {
    if (!realizacaoValue) return '';
    const baseDate = new Date(`${realizacaoValue}T00:00:00`);
    if (Number.isNaN(baseDate.getTime())) return '';
    baseDate.setDate(baseDate.getDate() + days);
    return toDateInputValueFromDate(baseDate);
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

    const realizacaoInput = document.getElementById('dataRealizacao');
    const proximaInput = document.getElementById('proximaAvaliacao');
    let proximaManual = Boolean(avaliacaoAtual.nextEvaluationAt);
    let proximaAutoValue = '';

    const updateNextEvaluation = ({ force = false } = {}) => {
        const realizacaoValue = realizacaoInput ? realizacaoInput.value : '';
        const nextValue = computeNextEvaluationDate(realizacaoValue);
        proximaAutoValue = nextValue;
        if (!proximaInput) return;
        const shouldApply = force
            || !proximaManual
            || proximaInput.dataset.auto === 'true'
            || proximaInput.value === ''
            || proximaInput.value === nextValue;
        if (shouldApply) {
            proximaInput.value = nextValue;
            proximaManual = false;
            proximaInput.dataset.auto = nextValue ? 'true' : 'false';
        }
    };

    const initialRealizacaoIso = avaliacaoAtual.completedAt || avaliacaoAtual.startedAt || avaliacaoAtual.createdAt || null;
    const initialRealizacaoValue = toDateInputValue(initialRealizacaoIso) || getTodayInputValue();
    if (realizacaoInput) {
        realizacaoInput.value = initialRealizacaoValue;
        const handleRealizacaoChange = () => updateNextEvaluation();
        realizacaoInput.addEventListener('input', handleRealizacaoChange);
        realizacaoInput.addEventListener('change', handleRealizacaoChange);
    }

    if (proximaInput) {
        if (avaliacaoAtual.nextEvaluationAt) {
            const storedValue = toDateInputValue(avaliacaoAtual.nextEvaluationAt);
            if (storedValue) {
                proximaInput.value = storedValue;
                proximaInput.dataset.auto = 'false';
            }
        } else {
            proximaInput.dataset.auto = 'true';
        }

        proximaInput.addEventListener('input', () => {
            if (proximaInput.value === proximaAutoValue) {
                proximaManual = false;
                proximaInput.dataset.auto = proximaAutoValue ? 'true' : 'false';
            } else {
                proximaManual = true;
                proximaInput.dataset.auto = 'false';
            }
        });
    }

    updateNextEvaluation({ force: !avaliacaoAtual.nextEvaluationAt });

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
                const realizacao = document.getElementById('dataRealizacao');
                const proxima = document.getElementById('proximaAvaliacao');
                const realizacaoIso = toIsoDate(realizacao ? realizacao.value : '');
                const proximaIso = toIsoDate(proxima ? proxima.value : '');
                await updateEvaluation(alunoId, avaliacaoAtual.id, {
                    status: 'completed',
                    nextEvaluationAt: proximaIso,
                    completedAt: realizacaoIso || new Date().toISOString()
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
