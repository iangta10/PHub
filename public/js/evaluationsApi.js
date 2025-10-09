import { fetchWithFreshToken } from './auth.js';

function buildQuery(params = {}) {
    const search = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
        if (value === undefined || value === null || value === '') return;
        search.append(key, value);
    });
    const query = search.toString();
    return query ? `?${query}` : '';
}

export async function listEvaluations(studentId, params = {}) {
    if (!studentId) throw new Error('studentId é obrigatório');
    const query = buildQuery(params);
    const res = await fetchWithFreshToken(`/api/users/alunos/${studentId}/avaliacoes${query}`);
    if (!res.ok) {
        throw new Error(`Falha ao listar avaliações (${res.status})`);
    }
    return res.json();
}

export async function getEvaluation(studentId, evaluationId) {
    if (!studentId || !evaluationId) throw new Error('studentId e evaluationId são obrigatórios');
    const res = await fetchWithFreshToken(`/api/users/alunos/${studentId}/avaliacoes/${evaluationId}`);
    if (res.status === 404) {
        return null;
    }
    if (!res.ok) {
        throw new Error(`Falha ao obter avaliação (${res.status})`);
    }
    return res.json();
}

export async function createEvaluation(studentId, payload = {}) {
    if (!studentId) throw new Error('studentId é obrigatório');
    const res = await fetchWithFreshToken(`/api/users/alunos/${studentId}/avaliacoes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    if (!res.ok) {
        throw new Error(`Falha ao criar avaliação (${res.status})`);
    }
    return res.json();
}

export async function updateEvaluation(studentId, evaluationId, payload = {}) {
    if (!studentId || !evaluationId) throw new Error('studentId e evaluationId são obrigatórios');
    const res = await fetchWithFreshToken(`/api/users/alunos/${studentId}/avaliacoes/${evaluationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    if (!res.ok) {
        throw new Error(`Falha ao atualizar avaliação (${res.status})`);
    }
    return res.json();
}

export async function deleteEvaluation(studentId, evaluationId) {
    if (!studentId || !evaluationId) throw new Error('studentId e evaluationId são obrigatórios');
    const res = await fetchWithFreshToken(`/api/users/alunos/${studentId}/avaliacoes/${evaluationId}`, {
        method: 'DELETE'
    });
    if (!res.ok) {
        throw new Error(`Falha ao remover avaliação (${res.status})`);
    }
    return res.json();
}

export async function saveEvaluationSection(studentId, evaluationId, sectionId, data) {
    if (!studentId || !evaluationId || !sectionId) {
        throw new Error('studentId, evaluationId e sectionId são obrigatórios');
    }
    const res = await fetchWithFreshToken(`/api/users/alunos/${studentId}/avaliacoes/${evaluationId}/sections/${sectionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data })
    });
    if (!res.ok) {
        throw new Error(`Falha ao salvar seção (${res.status})`);
    }
    return res.json();
}
