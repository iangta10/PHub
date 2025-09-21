const STORAGE_KEY = "phub_students_table_preferences";
const DEFAULT_VISIBLE_COLUMNS = {
    name: true,
    email: true,
    status: true,
    plan: true,
    lastSession: true,
    actions: true
};

const COLUMN_DEFINITIONS = [
    { key: "name", label: "Aluno", sortable: true, sortKey: "name" },
    { key: "email", label: "Email", sortable: false },
    { key: "status", label: "Status", sortable: true, sortKey: "status" },
    { key: "plan", label: "Plano", sortable: true, sortKey: "plan" },
    { key: "lastSession", label: "Última sessão", sortable: true, sortKey: "lastActivity" },
    { key: "actions", label: "Ações", sortable: false }
];

function formatDate(value) {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "-";
    return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

function formatDateTime(value) {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "-";
    return date.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function initialsFromName(name) {
    if (!name) return "PH";
    return name
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map(part => part[0]?.toUpperCase() || "")
        .join("") || "PH";
}

function safeJSONParse(value, fallback) {
    try {
        return JSON.parse(value);
    } catch (err) {
        return fallback;
    }
}

export class StudentsTable {
    constructor({
        root,
        provider,
        storage = typeof window !== "undefined" ? window.localStorage : null,
        debounceMs = 350,
        rowHeight = 72,
        overscan = 6,
        onCreateStudent,
        onGenerateForm,
        onViewStudent,
        onEditStudent,
        onOpenTrainings,
        onOpenAgenda
    }) {
        if (!root) {
            throw new Error("StudentsTable requer um elemento raiz");
        }
        if (!provider || typeof provider.listStudents !== "function") {
            throw new Error("StudentsTable requer um provider com listStudents");
        }
        this.root = root;
        this.provider = provider;
        this.storage = storage;
        this.debounceMs = debounceMs;
        this.rowHeight = rowHeight;
        this.overscan = overscan;
        this.handlers = {
            onCreateStudent,
            onGenerateForm,
            onViewStudent,
            onEditStudent,
            onOpenTrainings,
            onOpenAgenda
        };
        this.state = {
            searchTerm: "",
            status: [],
            plan: [],
            startDate: "",
            endDate: "",
            sortBy: "name",
            sortOrder: "asc",
            page: 1,
            pageSize: 10,
            visibleColumns: { ...DEFAULT_VISIBLE_COLUMNS },
            selection: new Set()
        };
        this.records = [];
        this.total = 0;
        this.hasMore = false;
        this.loading = false;
        this.renderedRange = { start: -1, end: -1 };
        this.viewMode = "page";
        this.ids = {};
        this.elements = {};
        this.debounceTimer = null;
    }

    async init() {
        this.restorePreferences();
        this.renderLayout();
        this.syncControlsWithState();
        this.bindEvents();
        await this.fetchPage({ reset: true });
    }

    async reload({ preservePage = true } = {}) {
        const page = preservePage ? this.state.page : 1;
        await this.fetchPage({ page, reset: !preservePage });
    }

    getRecordsSnapshot() {
        return this.records.slice();
    }

    restorePreferences() {
        if (!this.storage) return;
        const raw = this.storage.getItem(STORAGE_KEY);
        if (!raw) return;
        const data = safeJSONParse(raw, null);
        if (!data) return;
        if (typeof data.searchTerm === "string") this.state.searchTerm = data.searchTerm;
        if (Array.isArray(data.status)) this.state.status = data.status;
        if (Array.isArray(data.plan)) this.state.plan = data.plan;
        if (typeof data.startDate === "string") this.state.startDate = data.startDate;
        if (typeof data.endDate === "string") this.state.endDate = data.endDate;
        if (typeof data.sortBy === "string") this.state.sortBy = data.sortBy;
        if (typeof data.sortOrder === "string") this.state.sortOrder = data.sortOrder;
        if (Number.isInteger(data.pageSize)) this.state.pageSize = data.pageSize;
        if (data.visibleColumns) {
            this.state.visibleColumns = {
                ...DEFAULT_VISIBLE_COLUMNS,
                ...data.visibleColumns
            };
        }
    }

    persistPreferences() {
        if (!this.storage) return;
        const payload = {
            searchTerm: this.state.searchTerm,
            status: this.state.status,
            plan: this.state.plan,
            startDate: this.state.startDate,
            endDate: this.state.endDate,
            sortBy: this.state.sortBy,
            sortOrder: this.state.sortOrder,
            pageSize: this.state.pageSize,
            visibleColumns: this.state.visibleColumns
        };
        this.storage.setItem(STORAGE_KEY, JSON.stringify(payload));
    }

    renderLayout() {
        const unique = Math.random().toString(36).slice(2, 8);
        this.ids = {
            search: `students-search-${unique}`,
            sort: `students-sort-${unique}`,
            pageSize: `students-page-size-${unique}`,
            selectAll: `students-select-all-${unique}`,
            filters: `students-filters-${unique}`,
            description: `students-description-${unique}`
        };
        const columnToggles = COLUMN_DEFINITIONS.filter(col => col.key !== "actions").map(col => `
            <label class="column-option">
                <input type="checkbox" data-column-toggle="${col.key}" ${this.state.visibleColumns[col.key] !== false ? "checked" : ""} />
                <span>${col.label}</span>
            </label>
        `).join("");

        const statusOptions = [
            { value: "ativo", label: "Ativo" },
            { value: "pendente", label: "Pendente" },
            { value: "inativo", label: "Inativo" }
        ].map(option => `
            <label class="chip">
                <input type="checkbox" value="${option.value}" data-filter-status ${this.state.status.includes(option.value) ? "checked" : ""} />
                <span>${option.label}</span>
            </label>
        `).join("");

        const planOptions = [
            { value: "mensal", label: "Mensal" },
            { value: "trimestral", label: "Trimestral" },
            { value: "semestral", label: "Semestral" }
        ].map(option => `
            <label class="chip">
                <input type="checkbox" value="${option.value}" data-filter-plan ${this.state.plan.includes(option.value) ? "checked" : ""} />
                <span>${option.label}</span>
            </label>
        `).join("");

        const headerCells = COLUMN_DEFINITIONS.map(col => {
            if (col.key === "actions") {
                return `<th scope="col" data-column="${col.key}" class="column-actions">${col.label}</th>`;
            }
            const sortable = col.sortable ? ` data-sort="${col.sortKey || col.key}" role="columnheader" tabindex="0" aria-sort="none"` : "";
            const sortIcon = col.sortable ? '<span class="sort-indicator" aria-hidden="true"></span>' : "";
            return `<th scope="col" data-column="${col.key}" class="${col.sortable ? "sortable" : ""}"${sortable}>${col.label}${sortIcon}</th>`;
        }).join("");

        const columnSpan = COLUMN_DEFINITIONS.length + 1;

        this.root.innerHTML = `
            <section class="students-page" data-theme="dark">
                <header class="students-toolbar" role="region" aria-labelledby="${this.ids.description}">
                    <div class="toolbar-left">
                        <div>
                            <h2>Meus Alunos</h2>
                            <p id="${this.ids.description}" class="toolbar-description">Gerencie seus alunos, filtros e ações em massa.</p>
                        </div>
                        <div class="bulk-actions" data-element="bulk-actions" hidden>
                            <span data-element="bulk-count" aria-live="polite"></span>
                            <div class="bulk-buttons">
                                <button type="button" class="btn ghost" data-bulk="anamnese">Enviar formulário de anamnese</button>
                                <button type="button" class="btn ghost" data-bulk="invite">Convidar para sessão</button>
                                <button type="button" class="btn danger" data-bulk="deactivate">Desativar</button>
                            </div>
                        </div>
                    </div>
                    <div class="toolbar-right">
                        <button type="button" class="btn accent" data-action="create">Cadastrar novo aluno</button>
                        <button type="button" class="btn outline" data-action="anamnese">Gerar formulário de anamnese</button>
                    </div>
                </header>

                <section class="students-controls" aria-labelledby="${this.ids.filters}">
                    <h3 id="${this.ids.filters}" class="sr-only">Filtros da tabela</h3>
                    <div class="controls-row">
                        <div class="control search-control">
                            <label for="${this.ids.search}">Buscar</label>
                            <div class="search-wrapper">
                                <span class="search-icon" aria-hidden="true">🔍</span>
                                <input id="${this.ids.search}" type="search" placeholder="Buscar por nome ou email" autocomplete="off" value="${this.state.searchTerm}" />
                            </div>
                        </div>
                        <div class="control sort-control">
                            <label for="${this.ids.sort}">Ordenar por</label>
                            <div class="sort-group">
                                <select id="${this.ids.sort}">
                                    <option value="name">Nome</option>
                                    <option value="joinedAt">Data de entrada</option>
                                    <option value="lastActivity">Últimas atividades</option>
                                    <option value="status">Status</option>
                                    <option value="plan">Plano</option>
                                </select>
                                <button type="button" class="btn icon" data-action="toggle-sort" aria-label="Alternar ordem de ordenação">
                                    <span data-element="sort-icon" aria-hidden="true"></span>
                                </button>
                            </div>
                        </div>
                        <div class="control page-size-control">
                            <label for="${this.ids.pageSize}">Itens por página</label>
                            <select id="${this.ids.pageSize}">
                                <option value="10">10</option>
                                <option value="25">25</option>
                                <option value="50">50</option>
                            </select>
                        </div>
                        <details class="control column-control">
                            <summary>Colunas</summary>
                            <fieldset>
                                <legend class="sr-only">Escolha as colunas visíveis</legend>
                                ${columnToggles}
                            </fieldset>
                        </details>
                    </div>
                    <div class="controls-row responsive">
                        <fieldset class="control chip-group">
                            <legend>Status</legend>
                            ${statusOptions}
                        </fieldset>
                        <fieldset class="control chip-group">
                            <legend>Plano</legend>
                            ${planOptions}
                        </fieldset>
                        <div class="control date-range">
                            <label>Período de cadastro</label>
                            <div class="date-inputs">
                                <label>
                                    <span class="sr-only">Data inicial</span>
                                    <input type="date" data-filter="startDate" value="${this.state.startDate}" />
                                </label>
                                <span aria-hidden="true">—</span>
                                <label>
                                    <span class="sr-only">Data final</span>
                                    <input type="date" data-filter="endDate" value="${this.state.endDate}" />
                                </label>
                            </div>
                        </div>
                    </div>
                </section>

                <section class="students-table-section">
                    <div class="students-table-wrapper">
                        <div class="students-table-scroll" tabindex="0" role="region" aria-live="polite" aria-describedby="${this.ids.description}">
                            <table class="students-table" role="grid">
                                <caption class="sr-only">Tabela com a lista de alunos</caption>
                                <thead>
                                    <tr>
                                        <th scope="col" class="select-column">
                                            <span class="sr-only">Selecionar todos</span>
                                            <input type="checkbox" id="${this.ids.selectAll}" data-element="select-all" aria-label="Selecionar todos os alunos carregados" />
                                        </th>
                                        ${headerCells}
                                    </tr>
                                </thead>
                                <tbody class="students-table-body">
                                    <tr class="spacer" data-element="top-spacer" aria-hidden="true"><td colspan="${columnSpan}"></td></tr>
                                    <tr class="spacer" data-element="bottom-spacer" aria-hidden="true"><td colspan="${columnSpan}"></td></tr>
                                </tbody>
                            </table>
                        </div>
                        <div class="students-empty" data-state="empty" hidden>
                            <p>Nenhum aluno encontrado com os filtros selecionados.</p>
                            <button type="button" class="btn outline" data-action="reset-filters">Limpar filtros</button>
                        </div>
                        <div class="students-error" data-state="error" hidden>
                            <p>Não foi possível carregar os alunos.</p>
                            <button type="button" class="btn accent" data-action="retry">Tentar novamente</button>
                        </div>
                        <div class="students-skeleton" data-state="loading" aria-hidden="true">
                            ${Array.from({ length: 6 }).map(() => '<div class="skeleton-row"></div>').join("")}
                        </div>
                    </div>
                </section>

                <footer class="students-footer">
                    <div class="pagination-info" data-element="pagination-info" aria-live="polite"></div>
                    <div class="pagination-controls">
                        <button type="button" class="btn ghost" data-pagination="prev">Anterior</button>
                        <button type="button" class="btn ghost" data-pagination="next">Próxima</button>
                        <button type="button" class="btn accent" data-action="load-more">Carregar mais</button>
                    </div>
                </footer>
                <div class="students-feedback" data-element="feedback" role="status" aria-live="polite"></div>
            </section>
        `;

        this.elements = {
            searchInput: this.root.querySelector(`#${this.ids.search}`),
            sortSelect: this.root.querySelector(`#${this.ids.sort}`),
            sortToggle: this.root.querySelector('[data-action="toggle-sort"]'),
            sortIcon: this.root.querySelector('[data-element="sort-icon"]'),
            pageSizeSelect: this.root.querySelector(`#${this.ids.pageSize}`),
            columnToggles: this.root.querySelectorAll('[data-column-toggle]'),
            statusFilters: this.root.querySelectorAll('input[data-filter-status]'),
            planFilters: this.root.querySelectorAll('input[data-filter-plan]'),
            startDate: this.root.querySelector('input[data-filter="startDate"]'),
            endDate: this.root.querySelector('input[data-filter="endDate"]'),
            selectAll: this.root.querySelector('[data-element="select-all"]'),
            tableBody: this.root.querySelector('.students-table-body'),
            topSpacer: this.root.querySelector('[data-element="top-spacer"]'),
            bottomSpacer: this.root.querySelector('[data-element="bottom-spacer"]'),
            scrollContainer: this.root.querySelector('.students-table-scroll'),
            emptyState: this.root.querySelector('[data-state="empty"]'),
            errorState: this.root.querySelector('[data-state="error"]'),
            skeleton: this.root.querySelector('[data-state="loading"]'),
            retryButton: this.root.querySelector('[data-action="retry"]'),
            resetFilters: this.root.querySelector('[data-action="reset-filters"]'),
            paginationInfo: this.root.querySelector('[data-element="pagination-info"]'),
            paginationPrev: this.root.querySelector('[data-pagination="prev"]'),
            paginationNext: this.root.querySelector('[data-pagination="next"]'),
            loadMore: this.root.querySelector('[data-action="load-more"]'),
            bulkActions: this.root.querySelector('[data-element="bulk-actions"]'),
            bulkCount: this.root.querySelector('[data-element="bulk-count"]'),
            feedback: this.root.querySelector('[data-element="feedback"]'),
            toolbar: this.root.querySelector('.students-toolbar')
        };

        this.headerCells = Array.from(this.root.querySelectorAll('thead th[data-sort]'));
    }

    syncControlsWithState() {
        if (this.elements.sortSelect) {
            this.elements.sortSelect.value = this.state.sortBy;
        }
        if (this.elements.pageSizeSelect) {
            this.elements.pageSizeSelect.value = String(this.state.pageSize);
        }
        if (this.elements.sortIcon) {
            this.elements.sortIcon.textContent = this.state.sortOrder === "asc" ? "⬆" : "⬇";
        }
        this.updateColumnVisibility();
    }

    bindEvents() {
        this.elements.searchInput?.addEventListener('input', () => {
            if (this.debounceTimer) {
                clearTimeout(this.debounceTimer);
            }
            this.debounceTimer = setTimeout(() => {
                this.state.searchTerm = this.elements.searchInput.value;
                this.state.page = 1;
                this.persistPreferences();
                this.fetchPage({ reset: true });
            }, this.debounceMs);
        });

        this.elements.sortSelect?.addEventListener('change', () => {
            this.state.sortBy = this.elements.sortSelect.value;
            this.state.page = 1;
            this.persistPreferences();
            this.fetchPage({ reset: true });
        });

        this.elements.sortToggle?.addEventListener('click', () => {
            this.state.sortOrder = this.state.sortOrder === "asc" ? "desc" : "asc";
            if (this.elements.sortIcon) {
                this.elements.sortIcon.textContent = this.state.sortOrder === "asc" ? "⬆" : "⬇";
            }
            this.persistPreferences();
            this.fetchPage({ reset: true });
        });

        this.headerCells.forEach(cell => {
            cell.addEventListener('click', () => this.handleHeaderSort(cell));
            cell.addEventListener('keydown', event => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    this.handleHeaderSort(cell);
                }
            });
        });

        this.elements.pageSizeSelect?.addEventListener('change', () => {
            this.state.pageSize = Number.parseInt(this.elements.pageSizeSelect.value, 10) || 10;
            this.state.page = 1;
            this.persistPreferences();
            this.fetchPage({ reset: true });
        });

        this.elements.columnToggles.forEach(toggle => {
            toggle.addEventListener('change', () => {
                const key = toggle.getAttribute('data-column-toggle');
                const isChecked = toggle.checked;
                this.state.visibleColumns[key] = isChecked;
                this.persistPreferences();
                this.updateColumnVisibility();
            });
        });

        this.elements.statusFilters.forEach(input => {
            input.addEventListener('change', () => {
                const value = input.value;
                if (input.checked) {
                    if (!this.state.status.includes(value)) {
                        this.state.status.push(value);
                    }
                } else {
                    this.state.status = this.state.status.filter(item => item !== value);
                }
                this.state.page = 1;
                this.persistPreferences();
                this.fetchPage({ reset: true });
            });
        });

        this.elements.planFilters.forEach(input => {
            input.addEventListener('change', () => {
                const value = input.value;
                if (input.checked) {
                    if (!this.state.plan.includes(value)) {
                        this.state.plan.push(value);
                    }
                } else {
                    this.state.plan = this.state.plan.filter(item => item !== value);
                }
                this.state.page = 1;
                this.persistPreferences();
                this.fetchPage({ reset: true });
            });
        });

        this.elements.startDate?.addEventListener('change', () => {
            this.state.startDate = this.elements.startDate.value;
            this.state.page = 1;
            this.persistPreferences();
            this.fetchPage({ reset: true });
        });

        this.elements.endDate?.addEventListener('change', () => {
            this.state.endDate = this.elements.endDate.value;
            this.state.page = 1;
            this.persistPreferences();
            this.fetchPage({ reset: true });
        });

        this.elements.selectAll?.addEventListener('change', () => {
            const shouldSelect = this.elements.selectAll.checked;
            if (shouldSelect) {
                this.records.forEach(record => this.state.selection.add(record.id));
            } else {
                this.state.selection.clear();
            }
            this.updateSelectionUI();
        });

        this.elements.scrollContainer?.addEventListener('scroll', () => {
            this.updateVirtualRows();
        });

        this.elements.loadMore?.addEventListener('click', () => {
            if (this.hasMore && !this.loading) {
                this.fetchPage({ page: this.state.page + 1, append: true });
            }
        });

        this.elements.paginationPrev?.addEventListener('click', () => {
            if (this.state.page > 1 && !this.loading) {
                this.fetchPage({ page: this.state.page - 1, reset: true });
            }
        });

        this.elements.paginationNext?.addEventListener('click', () => {
            if (this.hasMore && !this.loading) {
                this.fetchPage({ page: this.state.page + 1, reset: true });
            }
        });

        this.elements.retryButton?.addEventListener('click', () => {
            this.fetchPage({ page: this.state.page || 1, reset: true });
        });

        this.elements.resetFilters?.addEventListener('click', () => {
            this.resetFilters();
        });

        this.root.querySelector('[data-action="create"]')?.addEventListener('click', () => {
            if (typeof this.handlers.onCreateStudent === 'function') {
                this.handlers.onCreateStudent();
            }
        });

        this.root.querySelector('[data-action="anamnese"]')?.addEventListener('click', () => {
            if (typeof this.handlers.onGenerateForm === 'function') {
                this.handlers.onGenerateForm();
            }
        });

        this.root.querySelectorAll('[data-bulk]').forEach(button => {
            button.addEventListener('click', () => {
                const type = button.getAttribute('data-bulk');
                this.executeBulkAction(type);
            });
        });
    }

    resetFilters() {
        this.state.searchTerm = "";
        this.state.status = [];
        this.state.plan = [];
        this.state.startDate = "";
        this.state.endDate = "";
        this.state.page = 1;
        this.persistPreferences();
        this.renderLayout();
        this.syncControlsWithState();
        this.bindEvents();
        this.fetchPage({ reset: true });
    }

    handleHeaderSort(cell) {
        const sortKey = cell.getAttribute('data-sort');
        if (!sortKey) return;
        if (this.state.sortBy === sortKey) {
            this.state.sortOrder = this.state.sortOrder === "asc" ? "desc" : "asc";
        } else {
            this.state.sortBy = sortKey;
            this.state.sortOrder = sortKey === "name" ? "asc" : "desc";
        }
        this.persistPreferences();
        this.updateHeaderSortIndicators();
        this.fetchPage({ reset: true });
    }

    updateHeaderSortIndicators() {
        this.headerCells.forEach(cell => {
            const sortKey = cell.getAttribute('data-sort');
            if (!sortKey) return;
            let aria = 'none';
            if (this.state.sortBy === sortKey) {
                aria = this.state.sortOrder === 'asc' ? 'ascending' : 'descending';
            }
            cell.setAttribute('aria-sort', aria);
            const indicator = cell.querySelector('.sort-indicator');
            if (indicator) {
                indicator.textContent = aria === 'ascending' ? '▲' : aria === 'descending' ? '▼' : '';
            }
        });
    }

    async fetchPage({ page = 1, reset = false, append = false } = {}) {
        this.loading = true;
        this.showSkeleton();
        this.clearError();
        try {
            const params = {
                searchTerm: this.state.searchTerm,
                status: this.state.status,
                plan: this.state.plan,
                startDate: this.state.startDate,
                endDate: this.state.endDate,
                sortBy: this.state.sortBy,
                sortOrder: this.state.sortOrder,
                pageSize: this.state.pageSize,
                page
            };
            const result = await this.provider.listStudents(params);
            this.total = Number.isInteger(result.total) ? result.total : result.data.length;
            this.hasMore = Boolean(result.hasMore);
            this.state.page = Number.isInteger(result.page) ? result.page : page;
            if (append) {
                this.records = this.records.concat(result.data || []);
                this.viewMode = 'append';
            } else {
                this.records = result.data || [];
                this.viewMode = 'page';
                this.state.selection.clear();
                if (this.elements.scrollContainer) {
                    this.elements.scrollContainer.scrollTop = 0;
                }
            }
            this.persistPreferences();
            this.renderRows();
            this.updateSelectionUI();
            this.updateHeaderSortIndicators();
            this.updatePaginationControls();
            this.toggleEmptyState();
        } catch (error) {
            console.error('Erro ao carregar alunos:', error);
            this.showError();
        } finally {
            this.loading = false;
            this.hideSkeleton();
        }
    }

    renderRows() {
        if (!this.elements.tableBody) return;
        this.renderedRange = { start: -1, end: -1 };
        this.updateVirtualRows(true);
    }

    updateVirtualRows(force = false) {
        if (!this.elements.scrollContainer || !this.elements.tableBody) return;
        const total = this.records.length;
        const containerHeight = this.elements.scrollContainer.clientHeight || 1;
        const visibleCount = Math.ceil(containerHeight / this.rowHeight) + this.overscan * 2;
        const scrollTop = this.elements.scrollContainer.scrollTop;
        let start = Math.floor(scrollTop / this.rowHeight) - this.overscan;
        if (start < 0) start = 0;
        let end = start + visibleCount;
        if (end > total) end = total;
        if (!force && this.renderedRange.start === start && this.renderedRange.end === end) {
            return;
        }
        this.renderedRange = { start, end };
        const fragment = document.createDocumentFragment();
        for (let index = start; index < end; index += 1) {
            const record = this.records[index];
            fragment.appendChild(this.buildRow(record, index));
        }
        const { topSpacer, bottomSpacer, tableBody } = this.elements;
        if (!topSpacer || !bottomSpacer) return;
        // Remove existing rendered rows
        let node = topSpacer.nextSibling;
        while (node && node !== bottomSpacer) {
            const next = node.nextSibling;
            tableBody.removeChild(node);
            node = next;
        }
        tableBody.insertBefore(fragment, bottomSpacer);
        topSpacer.style.height = `${start * this.rowHeight}px`;
        bottomSpacer.style.height = `${(total - end) * this.rowHeight}px`;
        this.updateColumnVisibility();
    }

    buildRow(record, index) {
        const row = document.createElement('tr');
        row.className = 'students-row';
        row.setAttribute('role', 'row');
        row.dataset.id = record.id;
        row.style.height = `${this.rowHeight}px`;

        const selectCell = document.createElement('td');
        selectCell.className = 'cell checkbox-cell';
        selectCell.dataset.column = 'select';
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'row-checkbox';
        checkbox.setAttribute('aria-label', `Selecionar ${record.name}`);
        checkbox.checked = this.state.selection.has(record.id);
        checkbox.addEventListener('change', () => {
            if (checkbox.checked) {
                this.state.selection.add(record.id);
            } else {
                this.state.selection.delete(record.id);
            }
            this.updateSelectionUI();
        });
        selectCell.appendChild(checkbox);
        row.appendChild(selectCell);

        const nameCell = document.createElement('td');
        nameCell.className = 'cell name-cell';
        nameCell.dataset.column = 'name';
        const identity = document.createElement('div');
        identity.className = 'identity';
        const avatar = document.createElement('div');
        avatar.className = 'avatar';
        if (record.avatar) {
            const img = document.createElement('img');
            img.src = record.avatar;
            img.alt = `Avatar de ${record.name}`;
            avatar.appendChild(img);
        } else {
            const fallback = document.createElement('span');
            fallback.textContent = initialsFromName(record.name);
            avatar.appendChild(fallback);
        }
        const details = document.createElement('div');
        details.className = 'identity-details';
        const nameLabel = document.createElement('span');
        nameLabel.className = 'identity-name';
        nameLabel.textContent = record.name;
        const joinInfo = document.createElement('span');
        joinInfo.className = 'identity-meta';
        joinInfo.textContent = `Entrou em ${formatDate(record.joinedAt)}`;
        details.appendChild(nameLabel);
        details.appendChild(joinInfo);
        identity.appendChild(avatar);
        identity.appendChild(details);
        nameCell.appendChild(identity);
        row.appendChild(nameCell);

        const emailCell = document.createElement('td');
        emailCell.className = 'cell email-cell';
        emailCell.dataset.column = 'email';
        if (record.email) {
            const link = document.createElement('a');
            link.href = `mailto:${record.email}`;
            link.textContent = record.email;
            link.className = 'email-link';
            emailCell.appendChild(link);
        } else {
            emailCell.textContent = '—';
        }
        row.appendChild(emailCell);

        const statusCell = document.createElement('td');
        statusCell.className = 'cell status-cell';
        statusCell.dataset.column = 'status';
        const statusPill = document.createElement('span');
        statusPill.className = 'status-pill';
        statusPill.dataset.status = record.status;
        statusPill.textContent = record.statusLabel || record.status;
        statusCell.appendChild(statusPill);
        row.appendChild(statusCell);

        const planCell = document.createElement('td');
        planCell.className = 'cell plan-cell';
        planCell.dataset.column = 'plan';
        planCell.textContent = record.planLabel || record.plan || '—';
        row.appendChild(planCell);

        const lastCell = document.createElement('td');
        lastCell.className = 'cell last-session-cell';
        lastCell.dataset.column = 'lastSession';
        lastCell.textContent = formatDateTime(record.lastSession || record.lastActivity);
        row.appendChild(lastCell);

        const actionsCell = document.createElement('td');
        actionsCell.className = 'cell actions-cell';
        actionsCell.dataset.column = 'actions';
        const actions = [
            { key: 'view', label: 'Ver', handler: this.handlers.onViewStudent },
            { key: 'edit', label: 'Editar', handler: this.handlers.onEditStudent },
            { key: 'trainings', label: 'Treinos', handler: this.handlers.onOpenTrainings },
            { key: 'agenda', label: 'Agenda', handler: this.handlers.onOpenAgenda }
        ];
        actions.forEach(action => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'btn subtle';
            button.textContent = action.label;
            button.setAttribute('aria-label', `${action.label} ${record.name}`);
            button.addEventListener('click', () => {
                if (typeof action.handler === 'function') {
                    action.handler(record.id, record);
                }
            });
            actionsCell.appendChild(button);
        });
        row.appendChild(actionsCell);

        return row;
    }

    updateSelectionUI() {
        const totalVisible = this.records.length;
        const selectedCount = Array.from(this.state.selection).filter(id => this.records.some(record => record.id === id)).length;
        if (this.elements.selectAll) {
            this.elements.selectAll.indeterminate = selectedCount > 0 && selectedCount < totalVisible;
            this.elements.selectAll.checked = totalVisible > 0 && selectedCount === totalVisible;
        }
        if (this.elements.bulkActions) {
            if (selectedCount > 0) {
                this.elements.bulkActions.hidden = false;
                if (this.elements.bulkCount) {
                    this.elements.bulkCount.textContent = `${selectedCount} selecionado${selectedCount > 1 ? 's' : ''}`;
                }
            } else {
                this.elements.bulkActions.hidden = true;
            }
        }
    }

    async executeBulkAction(type) {
        if (!this.provider.bulkAction) {
            return;
        }
        const ids = Array.from(this.state.selection);
        if (!ids.length) {
            this.showFeedback('Selecione ao menos um aluno.', 'warning');
            return;
        }
        try {
            const response = await this.provider.bulkAction(type, ids);
            const message = response?.message || 'Ação executada com sucesso.';
            this.showFeedback(message, 'success');
            this.state.selection.clear();
            this.updateSelectionUI();
        } catch (error) {
            console.error('Erro na ação em massa:', error);
            this.showFeedback('Não foi possível concluir a ação.', 'error');
        }
    }

    updatePaginationControls() {
        const isAppend = this.viewMode === 'append';
        const startItem = isAppend ? 1 : (this.state.page - 1) * this.state.pageSize + 1;
        const endItem = isAppend ? this.records.length : Math.min(this.state.page * this.state.pageSize, this.total);
        if (this.elements.paginationInfo) {
            if (this.total === 0) {
                this.elements.paginationInfo.textContent = 'Nenhum aluno encontrado.';
            } else {
                this.elements.paginationInfo.textContent = `Exibindo ${startItem} - ${endItem} de ${this.total}`;
            }
        }
        if (this.elements.paginationPrev) {
            this.elements.paginationPrev.disabled = this.state.page <= 1 || this.loading;
        }
        if (this.elements.paginationNext) {
            this.elements.paginationNext.disabled = !this.hasMore || this.loading;
        }
        if (this.elements.loadMore) {
            this.elements.loadMore.disabled = !this.hasMore || this.loading;
        }
    }

    toggleEmptyState() {
        const isEmpty = this.records.length === 0 && !this.loading;
        if (this.elements.emptyState) {
            this.elements.emptyState.hidden = !isEmpty;
        }
        if (this.elements.scrollContainer) {
            this.elements.scrollContainer.classList.toggle('is-hidden', isEmpty);
        }
    }

    showError() {
        if (this.elements.errorState) {
            this.elements.errorState.hidden = false;
        }
        if (this.elements.scrollContainer) {
            this.elements.scrollContainer.classList.add('is-hidden');
        }
    }

    clearError() {
        if (this.elements.errorState) {
            this.elements.errorState.hidden = true;
        }
        if (this.elements.scrollContainer) {
            this.elements.scrollContainer.classList.remove('is-hidden');
        }
    }

    showSkeleton() {
        if (this.elements.skeleton) {
            this.elements.skeleton.classList.add('visible');
        }
    }

    hideSkeleton() {
        if (this.elements.skeleton) {
            this.elements.skeleton.classList.remove('visible');
        }
    }

    updateColumnVisibility() {
        COLUMN_DEFINITIONS.forEach(column => {
            if (column.key === 'actions') {
                return;
            }
            const visible = this.state.visibleColumns[column.key] !== false;
            const selector = `[data-column="${column.key}"]`;
            this.root.querySelectorAll(selector).forEach(element => {
                element.classList.toggle('is-hidden', !visible);
            });
        });
    }

    showFeedback(message, type = 'info') {
        if (!this.elements.feedback) return;
        this.elements.feedback.textContent = message;
        this.elements.feedback.dataset.type = type;
        this.elements.feedback.classList.add('visible');
        setTimeout(() => {
            this.elements.feedback?.classList.remove('visible');
        }, 4000);
    }
}
