const SIXTY_DAYS_MS = 60 * 24 * 60 * 60 * 1000;
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

let fetchModulePromise;

async function fetchWithToken(url, options) {
    if (typeof window === "undefined") {
        throw new Error("fetchWithFreshToken indisponível fora do ambiente do navegador");
    }
    if (!fetchModulePromise) {
        fetchModulePromise = import("../auth.js");
    }
    const module = await fetchModulePromise;
    return module.fetchWithFreshToken(url, options);
}

function toDateValue(value) {
    if (!value && value !== 0) return null;
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date.toISOString();
}

function inferNextEvaluation(lastIso, index) {
    if (!lastIso) return null;
    const base = new Date(lastIso);
    if (Number.isNaN(base.getTime())) return null;
    const offset = (index % 3 + 1) * 30 * 24 * 60 * 60 * 1000;
    return new Date(base.getTime() + offset).toISOString();
}

function normalizeStudent(raw, index = 0) {
    const id = String(raw?.id || raw?.uid || raw?.userId || `student-${index}`);
    const name = raw?.name || raw?.nome || raw?.displayName || "Aluno sem nome";
    const avatarUrl = raw?.avatarUrl || raw?.avatar || raw?.photoURL || raw?.fotoUrl || "";

    const lastEvaluation = toDateValue(
        raw?.lastEvaluationAt ||
        raw?.ultimaAvaliacao ||
        raw?.avaliacao?.ultima ||
        raw?.avaliacoes?.[0]?.data ||
        raw?.avaliacoes?.[0]?.date ||
        raw?.ultima_avaliacao ||
        raw?.avaliacao?.lastEvaluationAt
    );

    let nextEvaluation = toDateValue(
        raw?.nextEvaluationAt ||
        raw?.proximaAvaliacao ||
        raw?.avaliacao?.proxima ||
        raw?.avaliacoes?.[0]?.proxima ||
        raw?.avaliacoes?.[0]?.nextEvaluationAt ||
        raw?.avaliacao?.nextEvaluationAt
    );

    if (!nextEvaluation) {
        nextEvaluation = inferNextEvaluation(lastEvaluation, index);
    }

    const hasDraftEvaluation = Boolean(
        raw?.hasDraftEvaluation ||
        raw?.avaliacao?.draft ||
        raw?.avaliacoes?.some?.((item) => item?.status === "draft" || item?.situacao === "rascunho")
    );

    return {
        id,
        name,
        avatarUrl,
        lastEvaluationAt: lastEvaluation,
        nextEvaluationAt: nextEvaluation,
        hasDraftEvaluation
    };
}

function buildFallbackDataset(count = 12) {
    const now = Date.now();
    const baseNames = [
        "Ana Clara", "Bruno Costa", "Carla Mendes", "Diego Ribeiro", "Eduarda Lima",
        "Felipe Souza", "Gabriela Torres", "Henrique Alves", "Isabela Martins", "João Pedro",
        "Larissa Rocha", "Marcos Vinícius"
    ];

    return Array.from({ length: count }).map((_, index) => {
        const name = baseNames[index % baseNames.length];
        const hasEvaluation = index % 3 !== 0;
        const overdue = index % 4 === 0;
        const upcoming = !overdue && index % 4 === 1;

        const lastDate = hasEvaluation
            ? new Date(now - (overdue ? (SIXTY_DAYS_MS + (index + 3) * 24 * 60 * 60 * 1000) : (index + 5) * 24 * 60 * 60 * 1000))
            : null;

        let nextDate = null;
        if (hasEvaluation && !overdue) {
            nextDate = new Date(now + (upcoming ? (index % 5 + 1) * 24 * 60 * 60 * 1000 : (index + 12) * 24 * 60 * 60 * 1000));
        }

        return {
            id: `mock-eval-${index + 1}`,
            name: `${name} ${index + 1}`,
            avatarUrl: "",
            lastEvaluationAt: lastDate ? lastDate.toISOString() : null,
            nextEvaluationAt: nextDate ? nextDate.toISOString() : null,
            hasDraftEvaluation: index % 5 === 0 && hasEvaluation
        };
    });
}

function ensureDataset(rawList) {
    const list = Array.isArray(rawList) ? rawList : [];
    if (list.length === 0) {
        return buildFallbackDataset();
    }
    return list.map((item, index) => normalizeStudent(item, index));
}

export async function listEvaluationStudents() {
    try {
        const res = await fetchWithToken('/api/users/alunos');
        if (!res.ok) {
            throw new Error(`Falha ao carregar alunos (${res.status})`);
        }
        const data = await res.json();
        return ensureDataset(data);
    } catch (err) {
        console.error('Erro ao obter alunos para avaliações:', err);
        return ensureDataset([]);
    }
}

export { SIXTY_DAYS_MS, SEVEN_DAYS_MS };
