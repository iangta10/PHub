import { auth } from './firebase-config.js';
import { signInWithEmailAndPassword, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";

// Aguarda até que o Firebase defina o usuário logado
function waitForUser() {
    return new Promise((resolve, reject) => {
        if (auth.currentUser) {
            return resolve(auth.currentUser);
        }
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            unsubscribe();
            if (user) {
                resolve(user);
            } else {
                reject(new Error("Usuário não está logado."));
            }
        });
    });
}

// Atualiza token sempre antes de fazer uma requisição
async function getFreshIdToken() {
    const user = await waitForUser();
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

            const res = await fetch('/api/users/me', {
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
            if (userData.role === 'personal' || userData.role === 'admin') {
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

// Obtém a role do usuário logado
export async function fetchUserRole() {
    const res = await fetchWithFreshToken('/api/users/role');
    const data = await res.json();
    return data.role;
}

export async function fetchUserInfo() {
    const res = await fetchWithFreshToken('/api/users/me');
    if (!res.ok) return null;
    return await res.json();
}
