const express = require('express');
const router = express.Router();

router.use('/users', require('./users/register'));
router.use('/users', require('./users/alunos'));
router.use('/users', require('./users/role'));
router.use('/users', require('./users/check-aluno'));
router.use('/users', require('./users/profile'));
router.use('/users', require('./users/treinos'));
router.use('/users', require('./users/exercicios'));
router.use('/users', require('./users/metodos'));
router.use('/users', require('./users/admin-invite'));
router.use('/users', require('./users/anamnese'));
router.use('/users', require('./users/agenda'));
router.use('/users', require('./users/personal-page'));
router.use('/public', require('./public'));
router.use('/treino', require('./treino-ia'));


module.exports = router;
