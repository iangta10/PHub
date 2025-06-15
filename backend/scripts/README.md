# Scripts de apoio

## bulkAddExercises.js

Script para inserir vários exercícios de uma vez no Firestore.

### Uso

```bash
node bulkAddExercises.js [arquivo_json] [personalId]
```

- **arquivo_json**: Caminho para o arquivo contendo o array de exercícios (padrão: `sample-exercises.json`).
- **personalId**: ID do personal caso queira inserir na coleção de um usuário. Quando omitido, os exercícios são adicionados na coleção global `exerciciosSistema`.

### Exemplo

```bash
node bulkAddExercises.js sample-exercises.json
```

### Formato do arquivo JSON

```json
[
  {
    "nome": "Supino Reto",
    "categoria": "Força",
    "grupoMuscularPrincipal": "Peito",
    "gruposMusculares": ["Tríceps", "Ombros"]
  }
]
```

Use `sample-exercises.json` como modelo para criar seus próprios arquivos.
