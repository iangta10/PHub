import { auth } from './firebase-config.js';
import { signInWithEmailAndPassword, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";
import { redirectByRole } from './roleRedirect.mjs';

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
    const loginBtn = loginForm.querySelector('#loginBtn');
    const errorBox = document.getElementById('loginError');
    let submitting = false;

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (submitting) return;
        submitting = true;
        errorBox.textContent = '';
        if (loginBtn) {
            loginBtn.disabled = true;
            loginBtn.setAttribute('aria-busy', 'true');
        }

        const email = e.target.email.value;
        const password = e.target.password.value;

        try {
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            let idToken = await userCredential.user.getIdToken(true);
            localStorage.setItem('token', idToken);

            const makeAuthRequest = async (token) => fetch('/api/users/me', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            let res = await makeAuthRequest(idToken);

            if (res.status === 401 || res.status === 403) {
                idToken = await userCredential.user.getIdToken(true);
                localStorage.setItem('token', idToken);
                res = await makeAuthRequest(idToken);
            }

            if (!res.ok) {
                let message = 'Falha ao obter dados do usuário';
                try {
                    const errorPayload = await res.json();
                    if (errorPayload?.message) {
                        message = errorPayload.message;
                    }
                } catch (parseError) {
                    // ignore parse error
                }
                throw new Error(message);
            }

            const userData = await res.json();
            const destination = redirectByRole(userData.role);
            if (destination) {
                window.location.href = destination;
            } else {
                throw new Error('Tipo de usuário desconhecido');
            }
        } catch (err) {
            if (errorBox) {
                errorBox.textContent = "Erro ao fazer login: " + err.message;
            }
            if (loginBtn) {
                loginBtn.disabled = false;
            }
        } finally {
            submitting = false;
            if (loginBtn) {
                loginBtn.removeAttribute('aria-busy');
            }
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

export async function getCurrentUser() {
    return await waitForUser();
}
