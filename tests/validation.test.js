const { loadValidation, runner } = require('./helpers');
const { check, done } = runner('field validation');

const app = loadValidation();
const read = v => { app.box.value = v; return app.readCount('studyMin', 'blank'); };

console.log('\nblank is rejected, zero is not');
check('blank is rejected', !!read('').err, true);
check('whitespace only is rejected', !!read('   ').err, true);
check('zero is accepted', read('0').value, 0);
check('zero reports no error', read('0').err, undefined);
check('a normal value is accepted', read('45').value, 45);
check('padding is tolerated', read('  30 ').value, 30);
check('negative is rejected', !!read('-5').err, true);
check('non-numeric is rejected', !!read('abc').err, true);

done();
