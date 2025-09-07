import assert from 'assert';
import { redirectByRole } from '../public/js/roleRedirect.mjs';

assert.strictEqual(redirectByRole('aluno'), 'aluno.html');
assert.strictEqual(redirectByRole('personal'), 'dashboard.html');
assert.strictEqual(redirectByRole('admin'), 'dashboard.html');
assert.strictEqual(redirectByRole('desconhecido'), null);

console.log('roleRedirect tests passed');
