import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { tokenize, parse, run, standardEnv } from '../src/index.js';

describe('Tokenizer', () => {
  it('should tokenize simple expression', () => {
    const tokens = tokenize('(+ 1 2)');
    assert.deepEqual(tokens, ['(', '+', '1', '2', ')']);
  });
  it('should handle nested', () => {
    const tokens = tokenize('(+ (* 2 3) 4)');
    assert.equal(tokens.length, 9);
  });
  it('should handle strings', () => {
    const tokens = tokenize('(print "hello world")');
    assert.equal(tokens[2].value, 'hello world');
  });
});

describe('Parser', () => {
  it('should parse numbers', () => {
    assert.equal(parse(tokenize('42')), 42);
  });
  it('should parse lists', () => {
    const result = parse(tokenize('(+ 1 2)'));
    assert.equal(Array.isArray(result), true);
    assert.equal(result.length, 3);
  });
  it('should parse booleans', () => {
    assert.equal(parse(tokenize('#t')), true);
    assert.equal(parse(tokenize('#f')), false);
  });
});

describe('Arithmetic', () => {
  it('should add', () => assert.equal(run('(+ 1 2)'), 3));
  it('should subtract', () => assert.equal(run('(- 10 3)'), 7));
  it('should multiply', () => assert.equal(run('(* 4 5)'), 20));
  it('should divide', () => assert.equal(run('(/ 10 2)'), 5));
  it('should nest', () => assert.equal(run('(+ (* 2 3) (- 10 4))'), 12));
});

describe('Comparisons', () => {
  it('should compare', () => {
    assert.equal(run('(> 5 3)'), true);
    assert.equal(run('(< 5 3)'), false);
    assert.equal(run('(= 5 5)'), true);
  });
});

describe('define', () => {
  it('should define variable', () => assert.equal(run('(begin (define x 42) x)'), 42));
  it('should define function', () => assert.equal(run('(begin (define (square x) (* x x)) (square 5))'), 25));
});

describe('lambda', () => {
  it('should create and call lambda', () => {
    assert.equal(run('((lambda (x) (* x x)) 7)'), 49);
  });
  it('should close over env', () => {
    assert.equal(run('(begin (define (make-adder n) (lambda (x) (+ n x))) ((make-adder 10) 5))'), 15);
  });
});

describe('if', () => {
  it('should branch on true', () => assert.equal(run('(if #t 1 2)'), 1));
  it('should branch on false', () => assert.equal(run('(if #f 1 2)'), 2));
  it('should handle condition', () => assert.equal(run('(if (> 5 3) "yes" "no")'), 'yes'));
});

describe('let', () => {
  it('should bind locals', () => assert.equal(run('(let ((a 1) (b 2)) (+ a b))'), 3));
});

describe('Lists', () => {
  it('should create list', () => assert.deepEqual(run('(list 1 2 3)'), [1, 2, 3]));
  it('should car/cdr', () => {
    assert.equal(run('(car (list 1 2 3))'), 1);
    assert.deepEqual(run('(cdr (list 1 2 3))'), [2, 3]);
  });
  it('should cons', () => assert.deepEqual(run('(cons 0 (list 1 2))'), [0, 1, 2]));
  it('should map', () => {
    assert.deepEqual(run('(begin (define (double x) (* x 2)) (map double (list 1 2 3)))'), [2, 4, 6]);
  });
});

describe('Recursion', () => {
  it('should compute factorial', () => {
    assert.equal(run(`
      (begin
        (define (fact n)
          (if (<= n 1) 1 (* n (fact (- n 1)))))
        (fact 5))
    `), 120);
  });
  it('should compute fibonacci', () => {
    assert.equal(run(`
      (begin
        (define (fib n)
          (if (<= n 1) n (+ (fib (- n 1)) (fib (- n 2)))))
        (fib 10))
    `), 55);
  });
});
