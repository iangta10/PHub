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


module.exports = router;
