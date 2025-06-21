import { fetchWithFreshToken } from "./auth.js";

export async function loadAgendaSection(alunoParam = '') {
    const content = document.getElementById('content');
    content.innerHTML = '<h2>Carregando agenda...</h2>';

    const hoje = new Date();
    let currentMonth = new Date(hoje.getFullYear(), hoje.getMonth(), 1);

    async function render() {
        const inicio = new Date(currentMonth);
        const fim = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
        const url = `http://localhost:3000/users/agenda/aulas?inicio=${inicio.toISOString()}&fim=${fim.toISOString()}` + (alunoParam ? `&aluno=${alunoParam}` : '');
        const [respAulas, respDisp] = await Promise.all([
            fetchWithFreshToken(url),
            fetchWithFreshToken('http://localhost:3000/users/agenda/disponibilidade')
        ]);
        const aulas = await respAulas.json();
        const disponibilidade = await respDisp.json();
        const eventos = aulas.concat(expandirDisponibilidade(disponibilidade, inicio, fim));
        content.innerHTML = `
            <h2>Agenda</h2>
            <div class="agenda-controls">
                <button id="prevMes">&#9664;</button>
                <span id="mesAtual"></span>
                <button id="nextMes">&#9654;</button>
            </div>
            <div id="calendario" class="calendario"></div>
            <button id="novoAgendamento">Novo agendamento</button>
            <button id="editarDisponibilidade">Editar disponibilidade</button>
            <ul id="proximasAulas" class="lista-aulas"></ul>
        `;
        document.getElementById('prevMes').addEventListener('click', () => { currentMonth.setMonth(currentMonth.getMonth() - 1); render(); });
        document.getElementById('nextMes').addEventListener('click', () => { currentMonth.setMonth(currentMonth.getMonth() + 1); render(); });
        document.getElementById('novoAgendamento').addEventListener('click', showNovoAgendamentoModal);
        document.getElementById('editarDisponibilidade').addEventListener('click', showDisponibilidadeModal);
        document.getElementById('mesAtual').textContent = currentMonth.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
        desenharCalendario(inicio, fim, eventos);
        mostrarProximasAulas(eventos);
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

    async function showDisponibilidadeModal() {
        try {
            const resp = await fetchWithFreshToken('http://localhost:3000/users/agenda/disponibilidade');
            const disp = await resp.json();
            const semana = disp.filter(d => d.diaSemana !== undefined);
            const modal = document.createElement('div');
            modal.className = 'modal';
            const dias = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'];
            modal.innerHTML = `
                <div class="modal-content">
                    <div class="disp-container">
                        <div class="disp-semanal">
                            <h3>Disponibilidade Semanal</h3>
                            <form id="formDisp">
                                ${dias.map((n,i)=>{
                                    const item = semana.find(d=>d.diaSemana===i) || {};
                                    const checked = item.inicio ? 'checked' : '';
                                    return `<div class="dia-semana">
                                        <label><input type="checkbox" name="chk${i}" ${checked}> ${n}</label>
                                        <input type="time" name="hora${i}" value="${item.inicio||''}" />
                                    </div>`;
                                }).join('')}
                                <div>
                                    <button type="submit">Salvar</button>
                                    <button type="button" class="cancelModal">Fechar</button>
                                </div>
                            </form>
                        </div>
                        <div class="disp-ajustes">
                            <h3>Dia Específico</h3>
                            <ul id="ajustesList">
                                ${disp.filter(d=>d.dia).map(d=>`<li data-id="${d.id}">${d.dia} ${d.inicio}-${d.fim} <button class="remAjuste">Excluir</button></li>`).join('')}
                            </ul>
                            <form id="novoAjusteForm">
                                <input type="date" name="dia" required />
                                <input type="time" name="inicio" required />
                                <input type="time" name="fim" required />
                                <button type="submit">Adicionar</button>
                            </form>
                        </div>
                    </div>
                </div>`;
            document.body.appendChild(modal);
            const remove = () => modal.remove();
            modal.addEventListener('click', e=>{ if(e.target===modal) remove(); });
            modal.querySelector('.cancelModal').addEventListener('click', remove);
            modal.querySelector('#formDisp').addEventListener('submit', async e=>{
                e.preventDefault();
                const form = e.target;
                for(let i=0;i<7;i++){
                    const checked = form[`chk${i}`].checked;
                    const hora = form[`hora${i}`].value;
                    const item = semana.find(d=>d.diaSemana===i);
                    if(checked && hora){
                        const body = {diaSemana:i,inicio:hora,fim:hora};
                        if(item){
                            await fetchWithFreshToken(`http://localhost:3000/users/agenda/disponibilidade/${item.id}`,{
                                method:'PUT',
                                headers:{'Content-Type':'application/json'},
                                body: JSON.stringify(body)
                            });
                        }else{
                            await fetchWithFreshToken('http://localhost:3000/users/agenda/disponibilidade',{
                                method:'POST',
                                headers:{'Content-Type':'application/json'},
                                body: JSON.stringify(body)
                            });
                        }
                    }else if(item){
                        await fetchWithFreshToken(`http://localhost:3000/users/agenda/disponibilidade/${item.id}`,{
                            method:'DELETE'
                        });
                    }
                }
                remove();
                render();
            });
            modal.querySelector('#novoAjusteForm').addEventListener('submit', async e=>{
                e.preventDefault();
                const form = e.target;
                const body = {
                    dia: form.dia.value,
                    inicio: form.inicio.value,
                    fim: form.fim.value
                };
                await fetchWithFreshToken('http://localhost:3000/users/agenda/disponibilidade',{
                    method:'POST',
                    headers:{'Content-Type':'application/json'},
                    body: JSON.stringify(body)
                });
                remove();
                render();
            });
            modal.querySelectorAll('.remAjuste').forEach(btn=>{
                btn.addEventListener('click', async ()=>{
                    const id = btn.parentElement.getAttribute('data-id');
                    await fetchWithFreshToken(`http://localhost:3000/users/agenda/disponibilidade/${id}`,{ method:'DELETE' });
                    remove();
                    render();
                });
            });
        } catch(err){
            console.error('Erro ao editar disponibilidade:', err);
        }
    }

    function expandirDisponibilidade(lista, inicio, fim){
        const eventos = [];
        const start = new Date(inicio);
        start.setUTCHours(0,0,0,0);
        const end = new Date(fim);
        end.setUTCHours(23,59,59,999);
        lista.forEach(item=>{
            if(item.dia){
                const d = new Date(item.dia);
                if(d>=start && d<=end){
                    const diaStr = item.dia;
                    eventos.push({
                        tipo:'disponibilidade',
                        inicio:`${diaStr}T${item.inicio}:00.000Z`,
                        fim:`${diaStr}T${item.fim}:00.000Z`
                    });
                }
            } else if(item.diaSemana!==undefined){
                const c = new Date(start);
                while(c<=end){
                    if(c.getUTCDay()===item.diaSemana){
                        const dstr = c.toISOString().substring(0,10);
                        eventos.push({
                            tipo:'disponibilidade',
                            inicio:`${dstr}T${item.inicio}:00.000Z`,
                            fim:`${dstr}T${item.fim}:00.000Z`
                        });
                    }
                    c.setUTCDate(c.getUTCDate()+1);
                }
            }
        });
        return eventos;
    }

    function desenharCalendario(inicio, fim, eventos) {
        const cal = document.getElementById('calendario');
        cal.innerHTML = '';
        const diasNoMes = fim.getDate();
        const primeiroDiaSemana = new Date(inicio).getDay();
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
            const dataStr = new Date(Date.UTC(inicio.getFullYear(), inicio.getMonth(), dia)).toISOString().substring(0,10);
            eventos.filter(ev => ev.inicio.startsWith(dataStr)).forEach(ev => {
                const div = document.createElement('div');
                div.className = `evt ${ev.status || ev.tipo}`;
                div.textContent = ev.alunoNome || ev.tipo;
                cell.appendChild(div);
            });
            grid.appendChild(cell);
        }
    }

    function mostrarProximasAulas(eventos) {
        const lista = document.getElementById('proximasAulas');
        if (!lista) return;
        const agora = new Date();
        const proximas = eventos
            .filter(ev => ev.tipo === 'aula' && new Date(ev.inicio) >= agora)
            .sort((a, b) => new Date(a.inicio) - new Date(b.inicio))
            .slice(0, 5);
        if (proximas.length === 0) {
            lista.innerHTML = '<li>Sem aulas futuras</li>';
            return;
        }
        lista.innerHTML = proximas.map(ev => {
            const data = new Date(ev.inicio).toLocaleString('pt-BR', {
                dateStyle: 'short',
                timeStyle: 'short'
            });
            const aluno = ev.alunoNome ? ` - ${ev.alunoNome}` : '';
            return `<li>${data}${aluno}</li>`;
        }).join('');
    }

    render();
}
