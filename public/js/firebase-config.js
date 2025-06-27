import { initializeApp } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyBlgxw8ve3hZpItzeDbOC3M7H24fuLLU5Q",
    authDomain: "personal-project-70578.firebaseapp.com",
    projectId: "personal-project-70578",
    storageBucket: "personal-project-70578.firebasestorage.app",
    messagingSenderId: "110580645956",
    appId: "1:110580645956:web:19c11187655f125ebdfc11",
    measurementId: "G-BNQBB74KZV"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
