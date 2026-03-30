import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { run, lispToString, NIL, LispList } from '../src/index.js';

function ev(code) { return run(code); }
function evStr(code) { return lispToString(run(code)); }

describe('Arithmetic', () => {
  it('addition', () => assert.equal(ev('(+ 1 2 3)'), 6));
  it('subtraction', () => assert.equal(ev('(- 10 3)'), 7));
  it('multiplication', () => assert.equal(ev('(* 2 3 4)'), 24));
  it('division', () => assert.equal(ev('(/ 10 2)'), 5));
  it('nested', () => assert.equal(ev('(+ (* 2 3) (- 10 4))'), 12));
  it('negation', () => assert.equal(ev('(- 5)'), -5));
  it('modulo', () => assert.equal(ev('(modulo 10 3)'), 1));
});

describe('Comparison', () => {
  it('equal', () => assert.equal(ev('(= 5 5)'), true));
  it('not equal', () => assert.equal(ev('(= 5 3)'), false));
  it('less than', () => assert.equal(ev('(< 3 5)'), true));
  it('greater than', () => assert.equal(ev('(> 5 3)'), true));
});

describe('Define', () => {
  it('variable', () => assert.equal(ev('(define x 42) x'), 42));
  it('function', () => assert.equal(ev('(define (square x) (* x x)) (square 5)'), 25));
  it('recursive', () => assert.equal(ev('(define (fact n) (if (= n 0) 1 (* n (fact (- n 1))))) (fact 5)'), 120));
});

describe('Lambda', () => {
  it('basic', () => assert.equal(ev('((lambda (x) (* x x)) 5)'), 25));
  it('closure', () => assert.equal(ev('(define (adder n) (lambda (x) (+ n x))) ((adder 10) 5)'), 15));
  it('higher-order', () => {
    const result = ev('(define (twice f x) (f (f x))) (twice (lambda (x) (+ x 1)) 5)');
    assert.equal(result, 7);
  });
});

describe('If/Cond', () => {
  it('if true', () => assert.equal(ev('(if (> 5 3) 1 2)'), 1));
  it('if false', () => assert.equal(ev('(if (< 5 3) 1 2)'), 2));
  it('cond', () => assert.equal(ev('(cond ((= 1 2) 10) ((= 1 1) 20) (else 30))'), 20));
});

describe('Let', () => {
  it('local binding', () => assert.equal(ev('(let ((x 5) (y 3)) (+ x y))'), 8));
});

describe('Lists', () => {
  it('list constructor', () => assert.equal(evStr("(list 1 2 3)"), '(1 2 3)'));
  it('car', () => assert.equal(ev("(car (list 1 2 3))"), 1));
  it('cdr', () => assert.equal(evStr("(cdr (list 1 2 3))"), '(2 3)'));
  it('cons', () => assert.equal(evStr("(cons 0 (list 1 2))"), '(0 1 2)'));
  it('length', () => assert.equal(ev("(length (list 1 2 3))"), 3));
  it('append', () => assert.equal(evStr("(append (list 1 2) (list 3 4))"), '(1 2 3 4)'));
  it('reverse', () => assert.equal(evStr("(reverse (list 1 2 3))"), '(3 2 1)'));
  it('map', () => assert.equal(evStr("(map (lambda (x) (* x 2)) (list 1 2 3))"), '(2 4 6)'));
  it('filter', () => assert.equal(evStr("(filter (lambda (x) (> x 2)) (list 1 2 3 4))"), '(3 4)'));
  it('reduce', () => assert.equal(ev("(reduce + 0 (list 1 2 3 4))"), 10));
});

describe('Quote', () => {
  it('quote list', () => assert.equal(evStr("'(1 2 3)"), '(1 2 3)'));
  it('quote symbol', () => assert.equal(evStr("'hello"), 'hello'));
});

describe('Boolean logic', () => {
  it('and', () => assert.equal(ev('(and #t #t)'), true));
  it('and short-circuit', () => assert.equal(ev('(and #f #t)'), false));
  it('or', () => assert.equal(ev('(or #f #t)'), true));
  it('not', () => assert.equal(ev('(not #f)'), true));
});

describe('Type predicates', () => {
  it('number?', () => assert.equal(ev('(number? 5)'), true));
  it('string?', () => assert.equal(ev('(string? "hello")'), true));
  it('list?', () => assert.equal(ev('(list? (list 1 2))'), true));
  it('null?', () => assert.equal(ev('(null? nil)'), true));
  it('procedure?', () => assert.equal(ev('(procedure? +)'), true));
});

describe('Strings', () => {
  it('string-append', () => assert.equal(ev('(string-append "hello" " " "world")'), 'hello world'));
  it('string-length', () => assert.equal(ev('(string-length "hello")'), 5));
  it('substring', () => assert.equal(ev('(substring "hello" 1 3)'), 'el'));
});

describe('Math', () => {
  it('sqrt', () => assert.equal(ev('(sqrt 16)'), 4));
  it('abs', () => assert.equal(ev('(abs -5)'), 5));
  it('pi', () => assert.ok(Math.abs(ev('pi') - Math.PI) < 0.001));
});

describe('Complex programs', () => {
  it('fibonacci', () => {
    const code = `
      (define (fib n)
        (if (<= n 1) n
          (+ (fib (- n 1)) (fib (- n 2)))))
      (fib 10)
    `;
    assert.equal(ev(code), 55);
  });

  it('map + filter + reduce', () => {
    const code = `
      (reduce + 0
        (filter (lambda (x) (> x 5))
          (map (lambda (x) (* x x))
            (list 1 2 3 4 5))))
    `;
    assert.equal(ev(code), 9 + 16 + 25); // 50
  });

  it('set! mutation', () => {
    assert.equal(ev('(define x 1) (set! x 42) x'), 42);
  });

  it('begin', () => {
    assert.equal(ev('(begin (define x 1) (define y 2) (+ x y))'), 3);
  });
});
