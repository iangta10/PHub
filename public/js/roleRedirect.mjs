export function redirectByRole(role) {
    const r = (role || '').toLowerCase();
    if (r === 'personal' || r === 'admin') {
        return 'dashboard.html';
    }
    if (r === 'aluno') {
        return 'aluno.html';
    }
    return null;
}
