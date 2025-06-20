import { fetchWithFreshToken } from "./auth.js";

export async function loadAgendaSection(alunoParam = '') {
    const content = document.getElementById('content');
    content.innerHTML = '<h2>Carregando agenda...</h2>';

    const hoje = new Date();
    let currentMonth = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), 1));

    async function render() {
        const inicio = new Date(currentMonth);
        const fim = new Date(Date.UTC(currentMonth.getUTCFullYear(), currentMonth.getUTCMonth() + 1, 0));
        const url = `http://localhost:3000/users/agenda/aulas?inicio=${inicio.toISOString()}&fim=${fim.toISOString()}` + (alunoParam ? `&aluno=${alunoParam}` : '');
        const resp = await fetchWithFreshToken(url);
        const eventos = await resp.json();
        content.innerHTML = `
            <h2>Agenda</h2>
            <div class="agenda-controls">
                <button id="prevMes">&#9664;</button>
                <span id="mesAtual"></span>
                <button id="nextMes">&#9654;</button>
            </div>
            <div id="calendario" class="calendario"></div>
            <button id="novoAgendamento">Novo agendamento</button>
        `;
        document.getElementById('prevMes').addEventListener('click', () => { currentMonth.setUTCMonth(currentMonth.getUTCMonth() - 1); render(); });
        document.getElementById('nextMes').addEventListener('click', () => { currentMonth.setUTCMonth(currentMonth.getUTCMonth() + 1); render(); });
        document.getElementById('novoAgendamento').addEventListener('click', showNovoAgendamentoModal);
        document.getElementById('mesAtual').textContent = currentMonth.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
        desenharCalendario(inicio, fim, eventos);
    }

    async function showNovoAgendamentoModal() {
        try {
            const resp = await fetchWithFreshToken('http://localhost:3000/users/alunos');
            const alunos = await resp.json();
            const modal = document.createElement('div');
            modal.className = 'modal';
            modal.innerHTML = `
                <div class="modal-content">
                    <h3>Novo Agendamento</h3>
                    <form id="formAgendamento">
                        <select name="aluno" required>
                            <option value="">Selecione o aluno</option>
                            ${alunos.map(a => `<option value="${a.id}">${a.nome}</option>`).join('')}
                        </select>
                        <input type="date" name="dia" required />
                        <input type="time" name="inicio" required />
                        <input type="time" name="fim" required />
                        <div>
                            <button type="submit">Agendar</button>
                            <button type="button" class="cancelModal">Cancelar</button>
                        </div>
                    </form>
                </div>`;
            document.body.appendChild(modal);
            const remove = () => modal.remove();
            modal.addEventListener('click', e => { if (e.target === modal) remove(); });
            modal.querySelector('.cancelModal').addEventListener('click', remove);
            modal.querySelector('#formAgendamento').addEventListener('submit', async e => {
                e.preventDefault();
                const form = e.target;
                const dia = form.dia.value;
                const inicio = `${dia}T${form.inicio.value}:00.000Z`;
                const fim = `${dia}T${form.fim.value}:00.000Z`;
                const body = { alunoId: form.aluno.value, inicio, fim };
                const r = await fetchWithFreshToken('http://localhost:3000/users/agenda/aulas', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body)
                });
                if (r.ok) {
                    remove();
                    render();
                } else {
                    alert('Erro ao agendar aula');
                }
            });
        } catch (err) {
            console.error('Erro ao abrir modal:', err);
        }
    }

    function desenharCalendario(inicio, fim, eventos) {
        const cal = document.getElementById('calendario');
        cal.innerHTML = '';
        const diasNoMes = fim.getUTCDate();
        const primeiroDiaSemana = new Date(inicio).getUTCDay();
        const grid = document.createElement('div');
        grid.className = 'cal-grid';
        cal.appendChild(grid);
        const nomesDias = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'];
        nomesDias.forEach(n => {
            const h = document.createElement('div');
            h.className = 'cal-head';
            h.textContent = n;
            grid.appendChild(h);
        });
        for (let i = 0; i < primeiroDiaSemana; i++) {
            grid.appendChild(document.createElement('div'));
        }
        for (let dia = 1; dia <= diasNoMes; dia++) {
            const cell = document.createElement('div');
            cell.className = 'cal-cell';
            cell.innerHTML = `<span class="cal-dia">${dia}</span>`;
            const dataStr = new Date(Date.UTC(inicio.getUTCFullYear(), inicio.getUTCMonth(), dia)).toISOString().substring(0,10);
            eventos.filter(ev => ev.inicio.startsWith(dataStr)).forEach(ev => {
                const div = document.createElement('div');
                div.className = `evt ${ev.status || ev.tipo}`;
                div.textContent = ev.alunoNome || ev.tipo;
                cell.appendChild(div);
            });
            grid.appendChild(cell);
        }
    }

    render();
}
