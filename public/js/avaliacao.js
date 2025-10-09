import { fetchWithFreshToken } from './auth.js';

const alunoCache = new Map();

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

export function getAlunoId() {
    const params = new URLSearchParams(window.location.search);
    return params.get('id');
}

export function getAvaliacaoId() {
    const params = new URLSearchParams(window.location.search);
    return params.get('avaliacao');
}

export async function fetchAlunoInfo(id) {
    if (!id) return null;
    if (!alunoCache.has(id)) {
        const promise = fetchWithFreshToken(`/api/users/alunos/${id}`)
            .then(async res => {
                if (!res.ok) {
                    throw new Error(`Falha ao carregar aluno (${res.status})`);
                }
                return res.json();
            })
            .catch(err => {
                alunoCache.delete(id);
                throw err;
            });
        alunoCache.set(id, promise);
    }
    try {
        return await alunoCache.get(id);
    } catch (err) {
        console.error('Erro ao carregar aluno', err);
        return null;
    }
}

export async function loadAlunoInfo(id, targetId = 'alunoInfo') {
    if (!id) return;
    try {
        const aluno = await fetchAlunoInfo(id);
        if (!aluno) return;
        const target = document.getElementById(targetId);
        if (!target) return;

        const nomeEl = target.querySelector('[data-aluno-nome]');
        const idadeEl = target.querySelector('[data-aluno-idade]');
        const generoEl = target.querySelector('[data-aluno-genero]');
        const emailEl = target.querySelector('[data-aluno-email]');

        if (nomeEl) nomeEl.textContent = aluno.nome || aluno.name || '';

        if (idadeEl) {
            const idade = aluno.idade || calcularIdade(aluno.dataNascimento);
            idadeEl.textContent = idade ? `${idade} anos` : '—';
        }

        if (generoEl) {
            const genero = aluno.genero || aluno.sexo || '';
            generoEl.textContent = genero || '—';
        }

        if (emailEl) {
            emailEl.textContent = aluno.email || aluno.emailAddress || '—';
        }

        if (!nomeEl && !idadeEl && !generoEl && !emailEl && target.dataset.preserve !== 'true') {
            const partes = [aluno.nome, aluno.email].filter(Boolean);
            target.textContent = partes.length ? partes.join(' - ') : '';
        }
    } catch (err) {
        console.error('Erro ao carregar aluno', err);
    }
}

export function renderOpcoes(id, containerId = 'avaliacaoOpcoes', avaliacaoId = null) {
    const opcoes = [
        { titulo: 'Anamnese', icone: 'fa-notes-medical', link: 'anamnese_form.html' },
        { titulo: 'Composição Corporal', icone: 'fa-weight', link: 'composicao.html' },
        { titulo: 'Perimetria', icone: 'fa-ruler-horizontal', link: 'perimetria.html' },
        { titulo: 'Postural', icone: 'fa-user-alt', link: 'postural.html' },
        { titulo: 'Flexibilidade', icone: 'fa-arrows-alt-v', link: 'flexibilidade.html' },
        { titulo: 'Força', icone: 'fa-dumbbell', link: 'forca.html' }
    ];

    const container = document.getElementById(containerId);
    if (container) {
        container.innerHTML = opcoes.map(o => {
            const searchParams = new URLSearchParams();
            if (id) searchParams.set('id', id);
            if (avaliacaoId) searchParams.set('avaliacao', avaliacaoId);
            const href = `${o.link}?${searchParams.toString()}`;
            return `
            <a class="box-opcao" href="${href}">
                <i class="fas ${o.icone}"></i>
                <span>${o.titulo}</span>
            </a>
        `;
        }).join('');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const id = getAlunoId();
    const avaliacaoId = getAvaliacaoId();
    const opcoes = document.getElementById('avaliacaoOpcoes');
    if (opcoes) {
        if (opcoes.dataset.autoloadInfo !== 'false') {
            loadAlunoInfo(id);
        }
        renderOpcoes(id, 'avaliacaoOpcoes', avaliacaoId);
    }
});
