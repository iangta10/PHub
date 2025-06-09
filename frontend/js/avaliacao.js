import { fetchWithFreshToken } from './auth.js';

function getAlunoId() {
    const params = new URLSearchParams(window.location.search);
    return params.get('id');
}

async function loadAlunoInfo(id) {
    if (!id) return;
    try {
        const res = await fetchWithFreshToken(`http://localhost:3000/users/alunos/${id}`);
        if (res.ok) {
            const aluno = await res.json();
            document.getElementById('alunoInfo').textContent = `${aluno.nome || ''} - ${aluno.email || ''}`;
        }
    } catch (err) {
        console.error('Erro ao carregar aluno', err);
    }
}

function renderOpcoes(id) {
    const opcoes = [
        { titulo: 'Anamnese', icone: 'fa-notes-medical', link: `anamnese_form.html?id=${id}` },
        { titulo: 'Composição Corporal', icone: 'fa-weight', link: `composicao.html?id=${id}` },
        { titulo: 'Perimetria', icone: 'fa-ruler-horizontal', link: `perimetria.html?id=${id}` },
        { titulo: 'Postural', icone: 'fa-user-alt', link: `postural.html?id=${id}` },
        { titulo: 'Flexibilidade', icone: 'fa-arrows-alt-v', link: `flexibilidade.html?id=${id}` },
        { titulo: 'Força', icone: 'fa-dumbbell', link: `forca.html?id=${id}` }
    ];

    const container = document.getElementById('avaliacaoOpcoes');
    container.innerHTML = opcoes.map(o => `
        <a class="box-opcao" href="${o.link}">
            <i class="fas ${o.icone}"></i>
            <span>${o.titulo}</span>
        </a>
    `).join('');
}

document.addEventListener('DOMContentLoaded', () => {
    const id = getAlunoId();
    loadAlunoInfo(id);
    renderOpcoes(id);
});
