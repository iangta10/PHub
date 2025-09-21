import assert from "node:assert/strict";
import { listStudents, setStudentsTestDataset, clearStudentsCache } from "../public/js/dataProviders/studentsProvider.mjs";

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

function createDataset(count = 60) {
    return Array.from({ length: count }, (_, index) => {
        const statusKeys = Object.keys(STATUS_LABELS);
        const planKeys = Object.keys(PLAN_LABELS);
        const status = statusKeys[index % statusKeys.length];
        const plan = planKeys[index % planKeys.length];
        const base = new Date(Date.UTC(2024, 0, 1 + index));
        return {
            id: `mock-${index + 1}`,
            name: `Aluno ${index + 1}`,
            email: `aluno${index + 1}@exemplo.com`,
            status,
            statusLabel: STATUS_LABELS[status],
            plan,
            planLabel: PLAN_LABELS[plan],
            joinedAt: base.toISOString(),
            lastActivity: new Date(base.getTime() + 2_592_000).toISOString(),
            lastSession: new Date(base.getTime() + 86_400_000).toISOString(),
            avatar: ""
        };
    });
}

async function runTests() {
    clearStudentsCache();
    setStudentsTestDataset(createDataset());

    const paginationFirst = await listStudents({ page: 1, pageSize: 10 });
    assert.equal(paginationFirst.data.length, 10, "primeira página deve ter 10 registros");
    assert.equal(paginationFirst.page, 1, "página atual deve ser 1");
    assert.equal(paginationFirst.hasMore, true, "deve haver mais páginas");

    const paginationSecond = await listStudents({ page: 2, pageSize: 10 });
    assert.equal(paginationSecond.data.length, 10, "segunda página deve ter 10 registros");
    assert.notDeepEqual(
        paginationFirst.data.map(item => item.id),
        paginationSecond.data.map(item => item.id),
        "páginas diferentes devem ter registros diferentes"
    );

    const sortedStatus = await listStudents({ sortBy: "status", sortOrder: "asc", pageSize: 50 });
    const obtained = sortedStatus.data.map(item => item.statusLabel);
    const expectedOrder = [...obtained].sort((a, b) => new Intl.Collator("pt-BR").compare(a, b));
    assert.deepEqual(obtained, expectedOrder, "ordenar por status deve respeitar ordem alfabética");

    const filtered = await listStudents({ status: ["ativo"], plan: ["mensal"], searchTerm: "Aluno 1", pageSize: 50 });
    assert(filtered.data.length > 0, "filtro combinado deve retornar resultados");
    filtered.data.forEach(item => {
        assert.equal(item.status, "ativo", "todos os registros devem estar ativos");
        assert.equal(item.plan, "mensal", "todos os registros devem ser do plano mensal");
        const matches = item.name.toLowerCase().includes("aluno 1") || item.email.toLowerCase().includes("aluno 1");
        assert(matches, "termo de busca deve permanecer aplicado");
    });

    const dateFiltered = await listStudents({
        startDate: "2024-02-01",
        endDate: "2024-03-01",
        pageSize: 100
    });
    assert(dateFiltered.data.length > 0, "filtro por data deve retornar dados");
    dateFiltered.data.forEach(item => {
        const joined = new Date(item.joinedAt);
        assert(joined >= new Date("2024-02-01") && joined <= new Date("2024-03-01"), "data deve estar dentro do intervalo");
    });

    console.log("studentsTableInteractions.test: ok");
}

runTests().catch(err => {
    console.error("studentsTableInteractions.test: fail");
    console.error(err);
    process.exitCode = 1;
});
