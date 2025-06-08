import { fetchWithFreshToken } from "./auth.js";

export async function loadExerciciosSection(filters = {}) {
    const content = document.getElementById("content");
    content.innerHTML = "<h2>Carregando...</h2>";

    try {
        const query = new URLSearchParams(filters).toString();
        const [exRes, metRes] = await Promise.all([
            fetchWithFreshToken(`http://localhost:3000/users/exercicios?${query}`),
            fetchWithFreshToken('http://localhost:3000/users/metodos')
        ]);
        const exercicios = await exRes.json();
        const metodos = await metRes.json();
        renderForms(content, exercicios, metodos);
    } catch (err) {
        console.error('Erro ao carregar dados de exercícios:', err);
        content.innerHTML = '<p style="color:red;">Erro ao carregar dados</p>';
    }
}

function renderForms(container, exercicios, metodos) {
    const exerciciosOptions = exercicios.map(e => `<option value="${e.nome}"></option>`).join('');
    container.innerHTML = `
        <h2>Exercícios Personalizados</h2>
        <form id="novoExercicio">
            <input type="text" name="nome" list="exerciciosOptions" placeholder="Nome" required />
            <datalist id="exerciciosOptions">${exerciciosOptions}</datalist>
            <div class= "exerciseOptions">
                <h3 id="exercicioTitle">Categoria<h3/>
                <select name="categoria">
                    <option value="Musculação">Musculação</option>
                    <option value="Cardio">Cardio</option>
                    <option value="Mobilidade">Mobilidade</option>
                    <option value="Alongamento">Alongamento</option>
                </select>
            </div>
            <div class= "exerciseOptions">
                <h3 id="exercicioTitle" >Grupo Muscular Principal<h3/>
                <select name="grupoPrincipal">
                <option value="Peito">Peito</option>
                <option value="Costas">Costas</option>
                <option value="Bíceps">Bíceps</option>
                <option value="Tríceps">Tríceps</option>
                <option value="Ombros">Ombros</option>
                <option value="Quadríceps">Quadríceps</option>
                <option value="Posteriores">Posteriores</option>
                <option value="Panturrilha">Panturrilha</option>
                <option value="Abdômen">Abdômen</option>
                <option value="Glúteos">Glúteos</option>
                </select>
            </div>
            <div class= "exerciseOptions">
                <h3 id="exercicioTitle">Outros Grupos Se Houver<h3/>
                <select name="grupos" multiple>
                    <option value="Peito">Peito</option>
                    <option value="Costas">Costas</option>
                    <option value="Bíceps">Bíceps</option>
                    <option value="Tríceps">Tríceps</option>
                    <option value="Ombros">Ombros</option>
                    <option value="Quadríceps">Quadríceps</option>
                    <option value="Posteriores">Posteriores</option>
                    <option value="Panturrilha">Panturrilha</option>
                    <option value="Abdômen">Abdômen</option>
                    <option value="Glúteos">Glúteos</option>
                </select>
            </div>            
            <button type="submit">Criar</button>
        </form>
        <h2>Métodos de Treino</h2>
        <form id="novoMetodo">
            <input type="text" name="nome" placeholder="Nome" required />
            <input type="number" name="series" placeholder="Séries" />
            <input type="number" name="repeticoes" placeholder="Repetições" />
            <input type="text" name="observacoes" placeholder="Observações" />
            <button type="submit">Criar</button>
        </form>
        <ul id="listaMetodos">${metodos.map(m => `<li data-id="${m.id}" data-global="${m.global}">${m.nome} <button class="editMetodo">Editar</button> <button class="delMetodo">Excluir</button></li>`).join('')}</ul>
        <h2>Buscar Exercícios</h2>
        <div id="filtros">
            <input type="text" id="fCategoria" placeholder="Categoria" />
            <input type="text" id="fGrupo" placeholder="Grupo muscular" />
            <button id="buscarEx">Buscar</button>
        </div>
        <ul id="listaExercicios">${exercicios.map(e => `<li data-id="${e.id}" data-global="${e.global}">${e.nome} (${e.categoria || ''}) <button class="editEx">Editar</button> <button class="delEx">Excluir</button></li>`).join('')}</ul>
    `;

    document.getElementById('novoExercicio').addEventListener('submit', async e => {
        e.preventDefault();
        const form = e.target;
        const grupos = Array.from(form.grupos.selectedOptions).map(o => o.value);
        const body = {
            nome: form.nome.value,
            categoria: form.categoria.value,
            grupoMuscularPrincipal: form.grupoPrincipal.value,
            gruposMusculares: grupos
        };
        const resp = await fetchWithFreshToken('http://localhost:3000/users/exercicios', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        if (resp.ok) {
            loadExerciciosSection();
        } else {
            alert('Erro ao criar exercício');
        }
    });

    document.getElementById('novoMetodo').addEventListener('submit', async e => {
        e.preventDefault();
        const form = e.target;
        const body = {
            nome: form.nome.value,
            series: form.series.value,
            repeticoes: form.repeticoes.value,
            observacoes: form.observacoes.value
        };
        const resp = await fetchWithFreshToken('http://localhost:3000/users/metodos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        if (resp.ok) {
            loadExerciciosSection();
        } else {
            alert('Erro ao criar método');
        }
    });

    document.querySelectorAll('#listaMetodos .delMetodo').forEach(btn => {
        btn.addEventListener('click', async () => {
            const li = btn.parentElement;
            if (confirm('Excluir método?')) {
                await fetchWithFreshToken(`http://localhost:3000/users/metodos/${li.dataset.id}?global=${li.dataset.global}`, { method: 'DELETE' });
                loadExerciciosSection();
            }
        });
    });

    document.querySelectorAll('#listaMetodos .editMetodo').forEach(btn => {
        btn.addEventListener('click', async () => {
            const li = btn.parentElement;
            const nome = prompt('Nome', li.firstChild.textContent.trim());
            if (nome === null) return;
            await fetchWithFreshToken(`http://localhost:3000/users/metodos/${li.dataset.id}?global=${li.dataset.global}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nome })
            });
            loadExerciciosSection();
        });
    });

    document.getElementById('buscarEx').addEventListener('click', () => {
        const categoria = document.getElementById('fCategoria').value;
        const grupo = document.getElementById('fGrupo').value;
        loadExerciciosSection({ categoria, grupo });
    });

    document.querySelectorAll('#listaExercicios .delEx').forEach(btn => {
        btn.addEventListener('click', async () => {
            const li = btn.parentElement;
            if (confirm('Excluir exercício?')) {
                await fetchWithFreshToken(`http://localhost:3000/users/exercicios/${li.dataset.id}?global=${li.dataset.global}`, { method: 'DELETE' });
                loadExerciciosSection();
            }
        });
    });

    document.querySelectorAll('#listaExercicios .editEx').forEach(btn => {
        btn.addEventListener('click', async () => {
            const li = btn.parentElement;
            const nomeAtual = li.firstChild.textContent.trim();
            const novoNome = prompt('Nome', nomeAtual);
            if (novoNome === null) return;
            await fetchWithFreshToken(`http://localhost:3000/users/exercicios/${li.dataset.id}?global=${li.dataset.global}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nome: novoNome })
            });
            loadExerciciosSection();
        });
    });
}

export async function fetchExerciciosMap() {
    const res = await fetchWithFreshToken('http://localhost:3000/users/exercicios');
    const exercicios = await res.json();
    const map = {};
    exercicios.forEach(e => {
        const cat = e.categoria || 'Outros';
        if (!map[cat]) map[cat] = [];
        map[cat].push(e);
    });
    return map;
}

export async function fetchMetodos() {
    const res = await fetchWithFreshToken('http://localhost:3000/users/metodos');
    return await res.json();
}
