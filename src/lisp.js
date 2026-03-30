// Lisp Interpreter — S-expression based, Scheme-inspired
// Supports: numbers, strings, booleans, symbols, lists, lambda, define, if, cond, let, quote, and/or

// ===== Types =====
export const NIL = { type: 'nil', toString: () => 'nil' };

export class LispSymbol {
  constructor(name) { this.name = name; }
  toString() { return this.name; }
}

export class LispList {
  constructor(items = []) { this.items = items; }
  get length() { return this.items.length; }
  get(i) { return this.items[i]; }
  toString() { return `(${this.items.map(lispToString).join(' ')})`; }
}

export class LispLambda {
  constructor(params, body, env) {
    this.params = params;
    this.body = body;
    this.env = env;
  }
  toString() { return `<lambda (${this.params.join(' ')})>`; }
}

export function lispToString(val) {
  if (val === NIL) return 'nil';
  if (val === true) return '#t';
  if (val === false) return '#f';
  if (typeof val === 'number') return String(val);
  if (typeof val === 'string') return `"${val}"`;
  if (val instanceof LispSymbol) return val.name;
  if (val instanceof LispList) return val.toString();
  if (val instanceof LispLambda) return val.toString();
  if (typeof val === 'function') return '<builtin>';
  return String(val);
}

// ===== Tokenizer =====
export function tokenize(input) {
  const tokens = [];
  let i = 0;

  while (i < input.length) {
    const ch = input[i];

    // Skip whitespace
    if (/\s/.test(ch)) { i++; continue; }

    // Skip comments
    if (ch === ';') { while (i < input.length && input[i] !== '\n') i++; continue; }

    // Parens
    if (ch === '(' || ch === ')') { tokens.push(ch); i++; continue; }

    // Quote shorthand
    if (ch === "'") { tokens.push("'"); i++; continue; }

    // String
    if (ch === '"') {
      let str = '';
      i++;
      while (i < input.length && input[i] !== '"') {
        if (input[i] === '\\') { i++; str += input[i]; }
        else str += input[i];
        i++;
      }
      i++; // Skip closing "
      tokens.push({ type: 'string', value: str });
      continue;
    }

    // Number or symbol
    let token = '';
    while (i < input.length && !/[\s()'";\[\]]/.test(input[i])) {
      token += input[i]; i++;
    }

    if (/^-?\d+(\.\d+)?$/.test(token)) {
      tokens.push({ type: 'number', value: parseFloat(token) });
    } else if (token === '#t') {
      tokens.push({ type: 'boolean', value: true });
    } else if (token === '#f') {
      tokens.push({ type: 'boolean', value: false });
    } else if (token === 'nil') {
      tokens.push({ type: 'nil' });
    } else {
      tokens.push({ type: 'symbol', value: token });
    }
  }

  return tokens;
}

// ===== Parser =====
export function parseTokens(tokens) {
  let pos = 0;

  function parseExpr() {
    if (pos >= tokens.length) throw new Error('Unexpected end of input');
    const token = tokens[pos];

    if (token === "'") {
      pos++;
      const expr = parseExpr();
      return new LispList([new LispSymbol('quote'), expr]);
    }

    if (token === '(') {
      pos++;
      const items = [];
      while (pos < tokens.length && tokens[pos] !== ')') {
        items.push(parseExpr());
      }
      if (pos >= tokens.length) throw new Error('Missing closing paren');
      pos++; // Skip )
      return new LispList(items);
    }

    if (token === ')') throw new Error('Unexpected )');

    pos++;
    if (token.type === 'number') return token.value;
    if (token.type === 'string') return token.value;
    if (token.type === 'boolean') return token.value;
    if (token.type === 'nil') return NIL;
    if (token.type === 'symbol') return new LispSymbol(token.value);

    throw new Error(`Unknown token: ${JSON.stringify(token)}`);
  }

  const exprs = [];
  while (pos < tokens.length) exprs.push(parseExpr());
  return exprs;
}

export function read(input) {
  return parseTokens(tokenize(input));
}

// ===== Environment =====
export class Environment {
  constructor(parent = null) {
    this.bindings = new Map();
    this.parent = parent;
  }

  get(name) {
    if (this.bindings.has(name)) return this.bindings.get(name);
    if (this.parent) return this.parent.get(name);
    throw new Error(`Undefined: ${name}`);
  }

  set(name, value) {
    this.bindings.set(name, value);
  }

  // Set in the scope where the var was defined
  update(name, value) {
    if (this.bindings.has(name)) { this.bindings.set(name, value); return; }
    if (this.parent) { this.parent.update(name, value); return; }
    throw new Error(`Undefined: ${name}`);
  }
}

// ===== Evaluator =====
export function evaluate(expr, env) {
  // Numbers, strings, booleans
  if (typeof expr === 'number' || typeof expr === 'string' || typeof expr === 'boolean') return expr;
  if (expr === NIL) return NIL;

  // Symbol lookup
  if (expr instanceof LispSymbol) return env.get(expr.name);

  // List (function call or special form)
  if (expr instanceof LispList) {
    if (expr.length === 0) return NIL;

    const first = expr.get(0);

    // Special forms
    if (first instanceof LispSymbol) {
      switch (first.name) {
        case 'quote': return expr.get(1);

        case 'if': {
          const cond = evaluate(expr.get(1), env);
          return (cond !== false && cond !== NIL)
            ? evaluate(expr.get(2), env)
            : (expr.length > 3 ? evaluate(expr.get(3), env) : NIL);
        }

        case 'cond': {
          for (let i = 1; i < expr.length; i++) {
            const clause = expr.get(i);
            if (clause.get(0) instanceof LispSymbol && clause.get(0).name === 'else') {
              return evaluate(clause.get(1), env);
            }
            if (evaluate(clause.get(0), env) !== false && evaluate(clause.get(0), env) !== NIL) {
              return evaluate(clause.get(1), env);
            }
          }
          return NIL;
        }

        case 'define': {
          if (expr.get(1) instanceof LispSymbol) {
            const val = evaluate(expr.get(2), env);
            env.set(expr.get(1).name, val);
            return val;
          }
          // Function shorthand: (define (f x y) body)
          if (expr.get(1) instanceof LispList) {
            const name = expr.get(1).get(0).name;
            const params = expr.get(1).items.slice(1).map(p => p.name);
            const body = expr.items.slice(2);
            const fn = new LispLambda(params, body, env);
            env.set(name, fn);
            return fn;
          }
          throw new Error('Invalid define');
        }

        case 'set!': {
          const val = evaluate(expr.get(2), env);
          env.update(expr.get(1).name, val);
          return val;
        }

        case 'lambda': {
          const params = expr.get(1).items.map(p => p.name);
          const body = expr.items.slice(2);
          return new LispLambda(params, body, env);
        }

        case 'let': {
          const childEnv = new Environment(env);
          const bindings = expr.get(1);
          for (const b of bindings.items) {
            childEnv.set(b.get(0).name, evaluate(b.get(1), env));
          }
          let result = NIL;
          for (let i = 2; i < expr.length; i++) result = evaluate(expr.get(i), childEnv);
          return result;
        }

        case 'begin': {
          let result = NIL;
          for (let i = 1; i < expr.length; i++) result = evaluate(expr.get(i), env);
          return result;
        }

        case 'and': {
          let result = true;
          for (let i = 1; i < expr.length; i++) {
            result = evaluate(expr.get(i), env);
            if (result === false || result === NIL) return false;
          }
          return result;
        }

        case 'or': {
          for (let i = 1; i < expr.length; i++) {
            const val = evaluate(expr.get(i), env);
            if (val !== false && val !== NIL) return val;
          }
          return false;
        }

        case 'do': {
          // (do ((var init step) ...) (test result) body...)
          const vars = expr.get(1);
          const test = expr.get(2);
          const childEnv = new Environment(env);
          // Init
          for (const binding of vars.items) {
            childEnv.set(binding.get(0).name, evaluate(binding.get(1), env));
          }
          // Loop
          while (true) {
            if (evaluate(test.get(0), childEnv) !== false && evaluate(test.get(0), childEnv) !== NIL) {
              return test.length > 1 ? evaluate(test.get(1), childEnv) : NIL;
            }
            for (let i = 3; i < expr.length; i++) evaluate(expr.get(i), childEnv);
            // Step
            const newVals = [];
            for (const binding of vars.items) {
              if (binding.length > 2) newVals.push([binding.get(0).name, evaluate(binding.get(2), childEnv)]);
            }
            for (const [name, val] of newVals) childEnv.set(name, val);
          }
        }
      }
    }

    // Function call
    const fn = evaluate(first, env);
    const args = expr.items.slice(1).map(a => evaluate(a, env));

    if (typeof fn === 'function') return fn(...args);

    if (fn instanceof LispLambda) {
      const callEnv = new Environment(fn.env);
      for (let i = 0; i < fn.params.length; i++) {
        callEnv.set(fn.params[i], args[i] !== undefined ? args[i] : NIL);
      }
      let result = NIL;
      for (const bodyExpr of fn.body) result = evaluate(bodyExpr, callEnv);
      return result;
    }

    throw new Error(`Not a function: ${lispToString(fn)}`);
  }

  throw new Error(`Cannot evaluate: ${JSON.stringify(expr)}`);
}

// ===== Standard Library =====
export function createGlobalEnv() {
  const env = new Environment();

  // Arithmetic
  env.set('+', (...args) => args.reduce((a, b) => a + b, 0));
  env.set('-', (a, ...rest) => rest.length ? rest.reduce((acc, b) => acc - b, a) : -a);
  env.set('*', (...args) => args.reduce((a, b) => a * b, 1));
  env.set('/', (a, b) => a / b);
  env.set('modulo', (a, b) => a % b);
  env.set('abs', Math.abs);
  env.set('max', Math.max);
  env.set('min', Math.min);
  env.set('sqrt', Math.sqrt);
  env.set('expt', Math.pow);

  // Comparison
  env.set('=', (a, b) => a === b);
  env.set('<', (a, b) => a < b);
  env.set('>', (a, b) => a > b);
  env.set('<=', (a, b) => a <= b);
  env.set('>=', (a, b) => a >= b);
  env.set('equal?', (a, b) => JSON.stringify(a) === JSON.stringify(b));

  // Boolean
  env.set('not', a => a === false || a === NIL);

  // List operations
  env.set('list', (...args) => new LispList(args));
  env.set('cons', (a, b) => {
    if (b instanceof LispList) return new LispList([a, ...b.items]);
    return new LispList([a, b]);
  });
  env.set('car', a => a instanceof LispList && a.length > 0 ? a.get(0) : NIL);
  env.set('cdr', a => a instanceof LispList ? new LispList(a.items.slice(1)) : NIL);
  env.set('length', a => a instanceof LispList ? a.length : (typeof a === 'string' ? a.length : 0));
  env.set('append', (...lists) => new LispList(lists.flatMap(l => l instanceof LispList ? l.items : [l])));
  env.set('reverse', a => new LispList([...a.items].reverse()));
  env.set('map', (fn, lst) => {
    const result = lst.items.map(item => {
      if (typeof fn === 'function') return fn(item);
      if (fn instanceof LispLambda) {
        const callEnv = new Environment(fn.env);
        callEnv.set(fn.params[0], item);
        let r = NIL;
        for (const b of fn.body) r = evaluate(b, callEnv);
        return r;
      }
    });
    return new LispList(result);
  });
  env.set('filter', (fn, lst) => {
    const result = lst.items.filter(item => {
      if (typeof fn === 'function') return fn(item);
      if (fn instanceof LispLambda) {
        const callEnv = new Environment(fn.env);
        callEnv.set(fn.params[0], item);
        let r = NIL;
        for (const b of fn.body) r = evaluate(b, callEnv);
        return r !== false && r !== NIL;
      }
    });
    return new LispList(result);
  });
  env.set('reduce', (fn, init, lst) => {
    return lst.items.reduce((acc, item) => {
      if (typeof fn === 'function') return fn(acc, item);
      if (fn instanceof LispLambda) {
        const callEnv = new Environment(fn.env);
        callEnv.set(fn.params[0], acc);
        callEnv.set(fn.params[1], item);
        let r = NIL;
        for (const b of fn.body) r = evaluate(b, callEnv);
        return r;
      }
    }, init);
  });

  // Type predicates
  env.set('number?', a => typeof a === 'number');
  env.set('string?', a => typeof a === 'string');
  env.set('symbol?', a => a instanceof LispSymbol);
  env.set('list?', a => a instanceof LispList);
  env.set('null?', a => a === NIL || (a instanceof LispList && a.length === 0));
  env.set('boolean?', a => typeof a === 'boolean');
  env.set('procedure?', a => typeof a === 'function' || a instanceof LispLambda);

  // String
  env.set('string-append', (...args) => args.join(''));
  env.set('string-length', a => a.length);
  env.set('substring', (s, start, end) => s.slice(start, end));
  env.set('number->string', a => String(a));
  env.set('string->number', a => parseFloat(a));

  // I/O
  env.set('display', (...args) => { /* silent in tests */ });
  env.set('newline', () => { /* silent */ });

  // Math
  env.set('pi', Math.PI);
  env.set('e', Math.E);
  env.set('floor', Math.floor);
  env.set('ceil', Math.ceil);
  env.set('round', Math.round);
  env.set('sin', Math.sin);
  env.set('cos', Math.cos);
  env.set('tan', Math.tan);
  env.set('log', Math.log);

  // Apply
  env.set('apply', (fn, args) => {
    const items = args instanceof LispList ? args.items : [args];
    if (typeof fn === 'function') return fn(...items);
    if (fn instanceof LispLambda) {
      const callEnv = new Environment(fn.env);
      for (let i = 0; i < fn.params.length; i++) callEnv.set(fn.params[i], items[i] || NIL);
      let r = NIL;
      for (const b of fn.body) r = evaluate(b, callEnv);
      return r;
    }
  });

  return env;
}

// ===== REPL helper =====
export function run(code) {
  const env = createGlobalEnv();
  const exprs = read(code);
  let result = NIL;
  for (const expr of exprs) result = evaluate(expr, env);
  return result;
}
