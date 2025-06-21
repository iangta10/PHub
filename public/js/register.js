import { auth } from './firebase-config.js';
import { createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";

const btnAluno = document.getElementById('btnAluno');
const btnPersonal = document.getElementById('btnPersonal');
const personalFields = document.getElementById('personalFields');
const alunoFields = document.getElementById('alunoFields');
let selectedType = 'aluno';

const urlParams = new URLSearchParams(window.location.search);
const personalSlug = urlParams.get('personal');
const plan = urlParams.get('plan');

if (btnAluno && btnPersonal) {
    btnAluno.addEventListener('click', () => {
        selectedType = 'aluno';
        btnAluno.classList.add('active');
        btnPersonal.classList.remove('active');
        if (personalFields) personalFields.classList.add('hidden');
        if (alunoFields) alunoFields.classList.remove('hidden');
    });

    btnPersonal.addEventListener('click', () => {
        selectedType = 'personal';
        btnPersonal.classList.add('active');
        btnAluno.classList.remove('active');
        if (personalFields) personalFields.classList.remove('hidden');
        if (alunoFields) alunoFields.classList.add('hidden');
    });
}

if (personalSlug) {
    selectedType = 'aluno';
    if (document.querySelector('.user-type-selector')) {
        document.querySelector('.user-type-selector').style.display = 'none';
    }
    if (personalFields) personalFields.style.display = 'none';
}

const registerForm = document.getElementById('registerForm');
if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = e.target.email.value;
        const password = e.target.password.value;
        const username = e.target.username ? e.target.username.value : '';
        const codigo = e.target.codigo ? e.target.codigo.value : '';
        const nome = e.target.nome ? e.target.nome.value : '';

        try {
            const cred = await createUserWithEmailAndPassword(auth, email, password);
            const token = await cred.user.getIdToken();

            const res = await fetch('http://localhost:3000/users/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ email, username, tipo: selectedType, codigo, nome, personalSlug, aulasPorSemana: plan })
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.message || 'Falha no registro');
            }

            alert('Conta criada com sucesso!');
            window.location.href = 'login.html';
        } catch (err) {
            alert('Erro ao registrar: ' + err.message);
        }
    });
}
