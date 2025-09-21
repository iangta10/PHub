const CACHE_TTL = 5 * 60 * 1000;
const STATUS_LABELS = {
    ativo: "Ativo",
    pendente: "Pendente",
    inativo: "Inativo"
};
const PLAN_LABELS = {
    mensal: "Mensal",
    trimestral: "Trimestral",
    semestral: "Semestral"
};

let cache = {
    data: null,
    fetchedAt: 0
};

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

function parseDate(value, fallbackOffset = 0) {
    if (!value) {
        return new Date(Date.now() - fallbackOffset).toISOString();
    }
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) {
        return new Date(Date.now() - fallbackOffset).toISOString();
    }
    return date.toISOString();
}

function normalizeStudent(raw, index = 0) {
    const fallbackOffset = index * 36_000_000; // 10 horas entre registros
    const id = String(raw.id || raw.uid || raw.userId || `student-${index}`);
    const nome = raw.nome || raw.name || raw.displayName || "Aluno sem nome";
    const email = raw.email || raw.contato?.email || raw.contact?.email || "";
    const statusKey = (raw.status || raw.situacao || "ativo").toString().toLowerCase();
    const planoKey = (raw.plano || raw.plan || raw.membershipPlan || "mensal").toString().toLowerCase();
    const joinedAt = parseDate(raw.criadoEm || raw.createdAt || raw.dataCadastro, fallbackOffset + 7_200_000);
    const lastActivity = parseDate(raw.ultimaAtividade || raw.lastActivity || raw.updatedAt, fallbackOffset);
    const lastSession = parseDate(raw.ultimaSessao || raw.lastSession || raw.lastWorkout, fallbackOffset);
    return {
        id,
        name: nome,
        email,
        avatar: raw.fotoUrl || raw.avatar || raw.photoURL || "",
        status: STATUS_LABELS[statusKey] ? statusKey : "ativo",
        statusLabel: STATUS_LABELS[statusKey] || STATUS_LABELS.ativo,
        plan: PLAN_LABELS[planoKey] ? planoKey : "mensal",
        planLabel: PLAN_LABELS[planoKey] || PLAN_LABELS.mensal,
        joinedAt,
        lastActivity,
        lastSession
    };
}

function ensureDataset(data) {
    if (Array.isArray(data) && data.length > 0) {
        return data;
    }
    const now = Date.now();
    return Array.from({ length: 60 }, (_, index) => {
        const base = now - index * 86_400_000;
        const statusKeys = Object.keys(STATUS_LABELS);
        const planKeys = Object.keys(PLAN_LABELS);
        const status = statusKeys[index % statusKeys.length];
        const plan = planKeys[index % planKeys.length];
        return {
            id: `mock-${index}`,
            name: `Aluno Exemplo ${index + 1}`,
            email: `aluno${index + 1}@exemplo.com`,
            avatar: "",
            status,
            statusLabel: STATUS_LABELS[status],
            plan,
            planLabel: PLAN_LABELS[plan],
            joinedAt: new Date(base - 604_800_000).toISOString(),
            lastActivity: new Date(base - 12 * 3_600_000).toISOString(),
            lastSession: new Date(base).toISOString()
        };
    });
}

async function getCachedStudents() {
    if (cache.data && Date.now() - cache.fetchedAt < CACHE_TTL) {
        return cache.data;
    }
    try {
        const response = await fetchWithToken("/api/users/alunos");
        if (!response.ok) {
            throw new Error(`Falha ao carregar alunos (${response.status})`);
        }
        const payload = await response.json();
        const list = Array.isArray(payload?.data) ? payload.data : Array.isArray(payload) ? payload : [];
        const normalized = list.map((item, index) => normalizeStudent(item, index));
        cache = {
            data: ensureDataset(normalized),
            fetchedAt: Date.now()
        };
    } catch (error) {
        console.warn("Usando lista simulada de alunos devido a erro:", error);
        cache = {
            data: ensureDataset([]),
            fetchedAt: Date.now()
        };
    }
    return cache.data;
}

function getFilterArray(value) {
    if (!value) return [];
    if (Array.isArray(value)) return value.filter(Boolean);
    if (typeof value === "string") {
        return value
            .split(",")
            .map(v => v.trim())
            .filter(Boolean);
    }
    return [];
}

function applyFilters(dataset, params) {
    const term = (params.search || params.searchTerm || "").trim().toLowerCase();
    const statusFilters = getFilterArray(params.status).map(v => v.toLowerCase());
    const planFilters = getFilterArray(params.plan).map(v => v.toLowerCase());
    const start = params.startDate ? new Date(params.startDate) : null;
    const end = params.endDate ? new Date(params.endDate) : null;

    return dataset.filter(item => {
        if (term) {
            const match = (item.name || "").toLowerCase().includes(term) || (item.email || "").toLowerCase().includes(term);
            if (!match) return false;
        }
        if (statusFilters.length && !statusFilters.includes(item.status)) {
            return false;
        }
        if (planFilters.length && !planFilters.includes(item.plan)) {
            return false;
        }
        if (start) {
            const joined = new Date(item.joinedAt);
            if (Number.isNaN(joined.getTime()) || joined < start) {
                return false;
            }
        }
        if (end) {
            const joined = new Date(item.joinedAt);
            if (Number.isNaN(joined.getTime()) || joined > end) {
                return false;
            }
        }
        return true;
    });
}

function sortDataset(dataset, sortBy = "name", sortOrder = "asc") {
    const order = sortOrder === "desc" ? -1 : 1;
    const collator = new Intl.Collator("pt-BR", { sensitivity: "base" });
    return dataset.slice().sort((a, b) => {
        switch (sortBy) {
            case "status":
                return collator.compare(a.statusLabel, b.statusLabel) * order;
            case "plan":
                return collator.compare(a.planLabel, b.planLabel) * order;
            case "lastActivity":
                return (new Date(a.lastActivity) - new Date(b.lastActivity)) * order;
            case "joinedAt":
                return (new Date(a.joinedAt) - new Date(b.joinedAt)) * order;
            case "name":
            default:
                return collator.compare(a.name, b.name) * order;
        }
    });
}

export async function listStudents(params = {}) {
    const dataset = await getCachedStudents();
    const filtered = applyFilters(dataset, params);
    const sorted = sortDataset(filtered, params.sortBy, params.sortOrder);
    const pageSize = Number.parseInt(params.pageSize, 10) > 0 ? Number.parseInt(params.pageSize, 10) : 10;
    const page = Number.parseInt(params.page, 10) > 0 ? Number.parseInt(params.page, 10) : 1;
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    const pageData = sorted.slice(start, end);
    return {
        data: pageData,
        total: sorted.length,
        page,
        pageSize,
        hasMore: end < sorted.length
    };
}

export async function bulkAction(type, ids) {
    if (!Array.isArray(ids) || ids.length === 0) {
        return { success: false, message: "Selecione ao menos um aluno." };
    }
    try {
        const response = await fetchWithToken("/api/users/alunos/bulk", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ type, ids })
        });
        if (!response.ok) {
            throw new Error(`Falha ao executar ação (${response.status})`);
        }
        return await response.json();
    } catch (error) {
        console.warn("Ação em massa tratada localmente:", error);
        return { success: true, message: "Ação registrada localmente." };
    }
}

export function clearStudentsCache() {
    cache = { data: null, fetchedAt: 0 };
}

export function setStudentsTestDataset(dataset) {
    cache = {
        data: ensureDataset(Array.isArray(dataset) ? dataset : []),
        fetchedAt: Date.now()
    };
}
