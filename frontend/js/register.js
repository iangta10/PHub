import { auth } from './firebase-config.js';
import { createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";

const btnAluno = document.getElementById('btnAluno');
const btnPersonal = document.getElementById('btnPersonal');
const personalFields = document.getElementById('personalFields');
let selectedType = 'aluno';

if (btnAluno && btnPersonal) {
    btnAluno.addEventListener('click', () => {
        selectedType = 'aluno';
        btnAluno.classList.add('active');
        btnPersonal.classList.remove('active');
        if (personalFields) personalFields.classList.add('hidden');
    });

    btnPersonal.addEventListener('click', () => {
        selectedType = 'personal';
        btnPersonal.classList.add('active');
        btnAluno.classList.remove('active');
        if (personalFields) personalFields.classList.remove('hidden');
    });
}

const registerForm = document.getElementById('registerForm');
if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = e.target.email.value;
        const password = e.target.password.value;
        const username = e.target.username ? e.target.username.value : '';
        const codigo = e.target.codigo ? e.target.codigo.value : '';

        try {
            const cred = await createUserWithEmailAndPassword(auth, email, password);
            const token = await cred.user.getIdToken();

            const res = await fetch('http://localhost:3000/users/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ email, username, tipo: selectedType, codigo })
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
