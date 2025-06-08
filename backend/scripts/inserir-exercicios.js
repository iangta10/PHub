const fs = require('fs');
const path = require('path');
const admin = require('../firebase-admin');

async function main() {
  const filePath = path.join(__dirname, 'exercicios.json');
  const raw = fs.readFileSync(filePath, 'utf8');
  const exercicios = JSON.parse(raw);

  if (!Array.isArray(exercicios)) {
    throw new Error('exercicios.json deve conter um array de exercicios');
  }

  const db = admin.firestore();
  const batch = db.batch();

  exercicios.forEach(ex => {
    const docRef = db.collection('exerciciosSistema').doc();
    batch.set(docRef, {
      nome: ex.nome,
      categoria: ex.categoria || null,
      grupoMuscularPrincipal: ex.grupoMuscularPrincipal || null,
      gruposMusculares: Array.isArray(ex.gruposMusculares) ? ex.gruposMusculares : [],
      criadoEm: new Date().toISOString()
    });
  });

  await batch.commit();
  console.log(`Inseridos ${exercicios.length} exercicios`);
}

main().then(() => process.exit()).catch(err => {
  console.error('Erro ao inserir exercicios:', err);
  process.exit(1);
});
