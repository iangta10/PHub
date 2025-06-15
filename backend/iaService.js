const { InferenceClient } = require('@huggingface/inference');
const client = new InferenceClient(process.env.HF_TOKEN);

async function gerarTreinoIA(aluno) {
  const objetivo = aluno.objetivo || aluno.objetivos || '';
  const frequencia = aluno.frequencia || aluno.frequenciaTreinos || '';

  const prompt = `Gere um plano de treino em JSON no seguinte formato:\n` +
    `{"dias":[{"dia":"Segunda","grupo":"Peito","exercicios":[{"nome":"Supino","series":3,"repeticoes":12}]}]}\n` +
    `Use apenas esse formato e considere os dados a seguir:\n` +
    `Nome: ${aluno.nome || ''}\n` +
    `Idade: ${aluno.idade || ''}\n` +
    `Altura: ${aluno.altura || ''}\n` +
    `Peso: ${aluno.peso || ''}\n` +
    `Objetivo: ${objetivo}\n` +
    `Frequencia: ${frequencia}`;

  const chat = await client.chatCompletion({
    provider: "featherless-ai",
    model: "mistralai/Magistral-Small-2506",
    messages: [{ role: "user", content: prompt }],
  });

  const text = chat.choices[0].message.content.trim();
  try {
    return JSON.parse(text);
  } catch (err) {
    throw new Error('Resposta de IA inválida');
  }
}

module.exports = { gerarTreinoIA };
