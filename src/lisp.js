// lisp.js — Tiny Lisp interpreter

// Tokenizer
export function tokenize(input) {
  const tokens = [];
  let i = 0;
  while (i < input.length) {
    if (/\s/.test(input[i])) { i++; continue; }
    if (input[i] === ';') { while (i < input.length && input[i] !== '\n') i++; continue; }
    if (input[i] === '(' || input[i] === ')' || input[i] === "'") { tokens.push(input[i++]); continue; }
    if (input[i] === '"') {
      let str = '';
      i++;
      while (i < input.length && input[i] !== '"') {
        if (input[i] === '\\') { i++; str += input[i]; } else str += input[i];
        i++;
      }
      i++;
      tokens.push({ type: 'string', value: str });
      continue;
    }
    let token = '';
    while (i < input.length && !/[\s()"]/.test(input[i])) token += input[i++];
    tokens.push(token);
  }
  return tokens;
}

// Parser
export function parse(tokens) {
  if (tokens.length === 0) throw new Error('Unexpected EOF');
  const token = tokens.shift();

  if (token === '(') {
    const list = [];
    while (tokens[0] !== ')') {
      if (tokens.length === 0) throw new Error('Missing )');
      list.push(parse(tokens));
    }
    tokens.shift();
    return list;
  }
  if (token === ')') throw new Error('Unexpected )');
  if (token === "'") return ['quote', parse(tokens)];
  if (typeof token === 'object') return token; // string literal
  return atom(token);
}

function atom(token) {
  const num = Number(token);
  if (!isNaN(num) && token !== '') return num;
  if (token === '#t') return true;
  if (token === '#f') return false;
  if (token === 'nil') return null;
  return Symbol.for(token);
}

// Environment
export class Env {
  constructor(params = [], args = [], outer = null) {
    this.data = new Map();
    this.outer = outer;
    for (let i = 0; i < params.length; i++) this.data.set(params[i], args[i]);
  }
  find(name) {
    if (this.data.has(name)) return this;
    if (this.outer) return this.outer.find(name);
    throw new Error(`Undefined: ${Symbol.keyFor(name) || name}`);
  }
  get(name) { return this.find(name).data.get(name); }
  set(name, val) { this.data.set(name, val); }
}

// Standard environment
export function standardEnv() {
  const env = new Env();
  const s = (n) => Symbol.for(n);
  env.set(s('+'), (a, b) => a + b);
  env.set(s('-'), (a, b) => b === undefined ? -a : a - b);
  env.set(s('*'), (a, b) => a * b);
  env.set(s('/'), (a, b) => a / b);
  env.set(s('%'), (a, b) => a % b);
  env.set(s('>'), (a, b) => a > b);
  env.set(s('<'), (a, b) => a < b);
  env.set(s('>='), (a, b) => a >= b);
  env.set(s('<='), (a, b) => a <= b);
  env.set(s('='), (a, b) => a === b);
  env.set(s('not'), (a) => !a);
  env.set(s('and'), (a, b) => a && b);
  env.set(s('or'), (a, b) => a || b);
  env.set(s('car'), (l) => l[0]);
  env.set(s('cdr'), (l) => l.slice(1));
  env.set(s('cons'), (a, b) => [a, ...b]);
  env.set(s('list'), (...args) => args);
  env.set(s('length'), (l) => l.length);
  env.set(s('null?'), (l) => l === null || (Array.isArray(l) && l.length === 0));
  env.set(s('number?'), (x) => typeof x === 'number');
  env.set(s('string?'), (x) => typeof x === 'string' || (x && x.type === 'string'));
  env.set(s('list?'), (x) => Array.isArray(x));
  env.set(s('abs'), Math.abs);
  env.set(s('max'), Math.max);
  env.set(s('min'), Math.min);
  const applyFn = (fn, args) => {
    if (typeof fn === 'function') return fn(...args);
    if (fn && fn.params) {
      const callEnv = new Env(fn.params, args, fn.env);
      return evaluate(fn.body, callEnv);
    }
    throw new Error('Not a function');
  };
  env.set(s('map'), (fn, l) => l.map(x => applyFn(fn, [x])));
  env.set(s('filter'), (fn, l) => l.filter(x => applyFn(fn, [x])));
  env.set(s('reduce'), (fn, init, l) => l.reduce((a, b) => applyFn(fn, [a, b]), init));
  env.set(s('append'), (...lists) => lists.flat());
  env.set(s('display'), (...args) => console.log(...args));
  return env;
}

// Evaluator
export function evaluate(expr, env) {
  // Symbol lookup
  if (typeof expr === 'symbol') return env.get(expr);
  // Literal
  if (!Array.isArray(expr)) {
    if (expr && typeof expr === 'object' && expr.type === 'string') return expr.value;
    return expr;
  }
  // Empty list
  if (expr.length === 0) return null;

  const [first, ...rest] = expr;
  const op = typeof first === 'symbol' ? Symbol.keyFor(first) : null;

  switch (op) {
    case 'quote': return rest[0];
    case 'if': return evaluate(rest[0], env) ? evaluate(rest[1], env) : (rest[2] !== undefined ? evaluate(rest[2], env) : null);
    case 'define': {
      if (Array.isArray(rest[0])) {
        // (define (name params...) body)
        const [nameParams, ...body] = rest;
        const [name, ...params] = nameParams;
        const lambda = { params: params.map(p => Symbol.keyFor(p) ? p : p), body: body.length === 1 ? body[0] : [Symbol.for('begin'), ...body], env };
        env.set(name, lambda);
      } else {
        env.set(rest[0], evaluate(rest[1], env));
      }
      return null;
    }
    case 'set!': {
      env.find(rest[0]).data.set(rest[0], evaluate(rest[1], env));
      return null;
    }
    case 'lambda': {
      const [params, ...body] = rest;
      return { params, body: body.length === 1 ? body[0] : [Symbol.for('begin'), ...body], env };
    }
    case 'begin': {
      let result = null;
      for (const e of rest) result = evaluate(e, env);
      return result;
    }
    case 'let': {
      const bindings = rest[0];
      const body = rest.slice(1);
      const letEnv = new Env([], [], env);
      for (const [name, val] of bindings) letEnv.set(name, evaluate(val, env));
      let result = null;
      for (const e of body) result = evaluate(e, letEnv);
      return result;
    }
    case 'cond': {
      for (const clause of rest) {
        if (Symbol.keyFor(clause[0]) === 'else' || evaluate(clause[0], env)) {
          return evaluate(clause[1], env);
        }
      }
      return null;
    }
    default: {
      const proc = evaluate(first, env);
      const args = rest.map(a => evaluate(a, env));
      if (typeof proc === 'function') return proc(...args);
      if (proc && proc.params) {
        const callEnv = new Env(proc.params, args, proc.env);
        return evaluate(proc.body, callEnv);
      }
      throw new Error(`Not a function: ${JSON.stringify(proc)}`);
    }
  }
}

// Convenience: run a string
export function run(code, env) {
  if (!env) env = standardEnv();
  const tokens = tokenize(code);
  let result = null;
  while (tokens.length > 0) result = evaluate(parse(tokens), env);
  return result;
}
