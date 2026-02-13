const CACHE_TTL = 5 * 60 * 1000;
const STATUS_LABELS = {
    ativo: "Ativo",
    pendente: "Pendente",
    inativo: "Inativo"
};
const PLAN_LABELS = {
    mensal: "Mensal",
    trimestral: "Trimestral",
    semestral: "Semestral",
    "sem-plano": "sem plano",
    "sem plano": "sem plano"
};

const NO_PLAN_LABEL = "sem plano";
const NO_PLAN_KEY = "sem-plano";

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

function parseOptionalDate(value) {
    if (!value) return null;
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date.toISOString();
}

function normalizeFilterValue(value) {
    if (value === undefined || value === null) return "";
    const normalized = value.toString().trim().toLowerCase();
    if (!normalized) return "";
    if (normalized === "sem plano" || normalized === NO_PLAN_KEY) {
        return NO_PLAN_KEY;
    }
    return normalized;
}

function normalizePlanInfo(rawPlan) {
    const filters = new Set();
    if (!rawPlan) {
        filters.add(NO_PLAN_KEY);
        return {
            key: NO_PLAN_KEY,
            label: NO_PLAN_LABEL,
            display: NO_PLAN_LABEL,
            filters: Array.from(filters)
        };
    }
    if (typeof rawPlan === "string") {
        const key = normalizeFilterValue(rawPlan);
        if (key) filters.add(key);
        const resolved = PLAN_LABELS[key] || rawPlan;
        const display = resolved || NO_PLAN_LABEL;
        return {
            key: key || NO_PLAN_KEY,
            label: resolved || display,
            display,
            filters: Array.from(filters.size ? filters : [NO_PLAN_KEY])
        };
    }
    if (typeof rawPlan === "object") {
        const candidateValues = [
            rawPlan.id,
            rawPlan.slug,
            rawPlan.identificador,
            rawPlan.codigo,
            rawPlan.nome,
            rawPlan.name,
            rawPlan.tipo,
            rawPlan.type,
            rawPlan.category
        ];
        candidateValues.forEach(value => {
            const normalized = normalizeFilterValue(value);
            if (normalized) filters.add(normalized);
        });
        const durationValues = [
            rawPlan.duracao,
            rawPlan.duração,
            rawPlan.duration,
            rawPlan.periodo,
            rawPlan.period,
            rawPlan.meses ? `${rawPlan.meses} meses` : null
        ];
        durationValues.forEach(value => {
            const normalized = normalizeFilterValue(value);
            if (normalized) filters.add(normalized);
        });
        const price = rawPlan.preco || rawPlan.price;
        const name = rawPlan.nome || rawPlan.name;
        const duration = rawPlan.duracao || rawPlan.duração || rawPlan.duration;
        const displayParts = [name, duration, price].filter(Boolean);
        const display = displayParts.join(" - ") || rawPlan.label || name || "";
        const nameFilter = normalizeFilterValue(name);
        const durationFilter = normalizeFilterValue(duration);
        let label = display
            || (nameFilter && PLAN_LABELS[nameFilter])
            || (durationFilter && PLAN_LABELS[durationFilter])
            || NO_PLAN_LABEL;
        if (!filters.size) {
            if (durationFilter) {
                filters.add(durationFilter);
            } else if (nameFilter) {
                filters.add(nameFilter);
            }
        }
        if (!filters.size) {
            filters.add(NO_PLAN_KEY);
        }
        const key = Array.from(filters)[0] || NO_PLAN_KEY;
        const resolvedDisplay = display || label || NO_PLAN_LABEL;
        return {
            key,
            label: label || NO_PLAN_LABEL,
            display: resolvedDisplay,
            filters: Array.from(filters)
        };
    }
    return {
        key: NO_PLAN_KEY,
        label: NO_PLAN_LABEL,
        display: NO_PLAN_LABEL,
        filters: [NO_PLAN_KEY]
    };
}

function normalizeStudent(raw, index = 0) {
    const fallbackOffset = index * 36_000_000; // 10 horas entre registros
    const id = String(raw.id || raw.uid || raw.userId || `student-${index}`);
    const nome = raw.nome || raw.name || raw.displayName || "Aluno sem nome";
    const email = raw.email || raw.contato?.email || raw.contact?.email || "";
    const statusKey = (raw.status || raw.situacao || "ativo").toString().toLowerCase();
    const rawPlan = raw.plano ?? raw.plan ?? raw.membershipPlan ?? null;
    const planInfo = normalizePlanInfo(rawPlan);
    const planObject = rawPlan && typeof rawPlan === "object" ? rawPlan : null;
    const joinedAt = parseDate(raw.criadoEm || raw.createdAt || raw.dataCadastro, fallbackOffset + 7_200_000);
    const lastActivity = parseDate(raw.ultimaAtividade || raw.lastActivity || raw.updatedAt, fallbackOffset);
    const planStart = parseOptionalDate(raw.inicioPlano || planObject?.inicio || planObject?.inicioPlano || planObject?.start || planObject?.startDate);
    const planDueDate = parseOptionalDate(raw.vencimentoPlano || planObject?.vencimento || planObject?.vencimentoPlano || planObject?.fim || planObject?.endDate);
    return {
        id,
        name: nome,
        email,
        avatar: raw.fotoUrl || raw.avatar || raw.photoURL || "",
        status: STATUS_LABELS[statusKey] ? statusKey : "ativo",
        statusLabel: STATUS_LABELS[statusKey] || STATUS_LABELS.ativo,
        plan: planInfo.key || NO_PLAN_KEY,
        planLabel: planInfo.label || PLAN_LABELS[planInfo.key] || NO_PLAN_LABEL,
        planDisplay: planInfo.display || planInfo.label || NO_PLAN_LABEL,
        planFilters: Array.isArray(planInfo.filters) && planInfo.filters.length ? planInfo.filters : [planInfo.key || NO_PLAN_KEY],
        joinedAt,
        lastActivity,
        planStart,
        planDueDate
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
        const planKeys = ["mensal", "trimestral", "semestral"];
        const status = statusKeys[index % statusKeys.length];
        const plan = planKeys[index % planKeys.length];
        const startDate = new Date(base - 30 * 86_400_000);
        const dueDate = new Date(base + 30 * 86_400_000);
        return {
            id: `mock-${index}`,
            name: `Aluno Exemplo ${index + 1}`,
            email: `aluno${index + 1}@exemplo.com`,
            avatar: "",
            status,
            statusLabel: STATUS_LABELS[status],
            plan,
            planLabel: PLAN_LABELS[plan],
            planDisplay: PLAN_LABELS[plan],
            planFilters: [plan],
            joinedAt: new Date(base - 604_800_000).toISOString(),
            lastActivity: new Date(base - 12 * 3_600_000).toISOString(),
            planStart: startDate.toISOString(),
            planDueDate: dueDate.toISOString()
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

function removeFromCache(ids) {
    if (!Array.isArray(cache.data) || !Array.isArray(ids) || !ids.length) {
        return;
    }
    const idSet = new Set(ids.map(value => String(value)));
    cache = {
        data: cache.data.filter(item => {
            const candidate = item?.id ?? item?.uid ?? item?.userId;
            if (candidate === undefined || candidate === null) {
                return true;
            }
            return !idSet.has(String(candidate));
        }),
        fetchedAt: Date.now()
    };
}


function updateStatusInCache(ids, status) {
    if (!Array.isArray(cache.data) || !Array.isArray(ids) || !ids.length || !status) {
        return;
    }
    const idSet = new Set(ids.map(value => String(value)));
    const statusKey = String(status).toLowerCase();
    const statusLabel = STATUS_LABELS[statusKey] || status;
    cache = {
        data: cache.data.map(item => {
            const candidate = item?.id ?? item?.uid ?? item?.userId;
            if (candidate === undefined || candidate === null || !idSet.has(String(candidate))) {
                return item;
            }
            return {
                ...item,
                status: statusKey,
                statusLabel
            };
        }),
        fetchedAt: Date.now()
    };
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
        if (planFilters.length) {
            const itemPlans = Array.isArray(item.planFilters) && item.planFilters.length
                ? item.planFilters
                : [item.plan];
            const normalizedPlans = itemPlans
                .filter(Boolean)
                .map(value => value.toString().toLowerCase());
            const hasMatch = normalizedPlans.some(planValue => planFilters.includes(planValue));
            if (!hasMatch) {
                return false;
            }
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
            case "dueDate": {
                const getTime = value => {
                    if (!value) return null;
                    const date = new Date(value);
                    return Number.isNaN(date.getTime()) ? null : date.getTime();
                };
                const aTime = getTime(a.planDueDate);
                const bTime = getTime(b.planDueDate);
                if (aTime === null && bTime === null) return 0;
                if (aTime === null) return order === 1 ? 1 : -1;
                if (bTime === null) return order === 1 ? -1 : 1;
                return (aTime - bTime) * order;
            }
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
        const result = await response.json();
        if (type === "delete") {
            removeFromCache(ids);
        }
        if (type === "deactivate") {
            updateStatusInCache(ids, "inativo");
        }
        return result;
    } catch (error) {
        console.error("Falha ao executar ação em massa:", error);
        throw error;
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
