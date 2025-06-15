const fs = require('fs');
const path = require('path');
const admin = require('../firebase-admin');

const jsonPath = process.argv[2] || path.join(__dirname, 'sample-exercises.json');
const personalId = process.argv[3];

async function main() {
  try {
    const data = fs.readFileSync(jsonPath, 'utf8');
    const exercises = JSON.parse(data);
    const db = admin.firestore();

    for (const ex of exercises) {
      const collection = personalId
        ? db.collection('users').doc(personalId).collection('exercicios')
        : db.collection('exerciciosSistema');

      const doc = {
        nome: ex.nome || '',
        categoria: ex.categoria || null,
        grupoMuscularPrincipal: ex.grupoMuscularPrincipal || null,
        gruposMusculares: Array.isArray(ex.gruposMusculares) ? ex.gruposMusculares : [],
        criadoEm: new Date().toISOString(),
      };

      await collection.add(doc);
      console.log(`Inserido: ${doc.nome}`);
    }

    console.log('Concluído.');
    process.exit(0);
  } catch (err) {
    console.error('Erro ao inserir exercícios:', err);
    process.exit(1);
  }
}

main();
