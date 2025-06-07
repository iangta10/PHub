import { auth } from './firebase-config.js';
import { signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";

// Atualiza token sempre antes de fazer uma requisição
async function getFreshIdToken() {
    const user = auth.currentUser;
    if (!user) throw new Error("Usuário não está logado.");
    return await user.getIdToken(true); // força refresh
}

// LOGIN
const loginForm = document.querySelector("#loginForm");
if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = e.target.email.value;
        const password = e.target.password.value;

        try {
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            const idToken = await userCredential.user.getIdToken();
            localStorage.setItem('token', idToken);

            const res = await fetch('http://localhost:3000/users/me', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${idToken}`
                }
            });

            if (!res.ok) {
                throw new Error('Falha ao obter dados do usuário');
            }

            const userData = await res.json();
            console.log(userData);

            // O backend retorna a propriedade `role` indicando o tipo de usuário
            if (userData.role === 'personal') {
                window.location.href = 'dashboard.html';
            } else if (userData.role === 'aluno') {
                window.location.href = 'aluno.html';
            } else {
                alert('Tipo de usuário desconhecido');
            }
        } catch (err) {
            alert("Erro ao fazer login: " + err.message);
        }
    });
}

// Atualiza o token antes de chamadas protegidas
export async function fetchWithFreshToken(url, options = {}) {
    const idToken = await getFreshIdToken();
    const updatedOptions = {
        ...options,
        headers: {
            ...options.headers,
            'Authorization': `Bearer ${idToken}`
        }
    };
    return fetch(url, updatedOptions);
}
