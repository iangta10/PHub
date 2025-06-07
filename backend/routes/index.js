const express = require('express');
const router = express.Router();

router.use('/users', require('./users/register'));
router.use('/users', require('./users/alunos'));
router.use('/users', require('./users/role'));
router.use('/users', require('./users/check-aluno'));
router.use('/users', require('./users/profile'));


module.exports = router;
