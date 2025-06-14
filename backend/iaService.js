const { InferenceClient } = require('@huggingface/inference');
const client = new InferenceClient(process.env.HF_TOKEN);

async function gerarTreinoIA(aluno) {
  const prompt = `
    Crie um plano de treino semanal para um aluno com os seguintes dados:
    - Nome: ${aluno.nome}
    - Idade: ${aluno.idade}
    - Altura: ${aluno.altura}
    - Peso: ${aluno.peso}
    - Objetivo: ${aluno.objetivo}
    - Frequência semanal: ${aluno.frequencia}x

    Liste os exercícios em formato de tabela, com dia da semana, grupo muscular, exercícios, séries e repetições.
  `;

  const chat = await client.chatCompletion({
    provider: "featherless-ai",
    model: "mistralai/Magistral-Small-2506",
    messages: [{ role: "user", content: prompt }],
  });

  return chat.choices[0].message.content;
}

module.exports = { gerarTreinoIA };
