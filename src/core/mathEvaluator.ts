/**
 * mathEvaluator.ts - Parser y evaluador seguro de expresiones aritméticas y lógicas
 * Diseñado para campos numéricos calculados tipo Excel/CAD y fórmulas paramétricas.
 * Soporta operadores aritméticos (+, -, *, /, ^, %), relacionales (<, <=, >, >=),
 * de igualdad (==, ===, =, !=, !==, <>), lógicos (&&, ||, !, and, or, not),
 * operador ternario (? :) y funciones matemáticas / condicionales (ceil, floor, round, min, max, si, if, etc.).
 * NUNCA utiliza eval() ni Function() para garantizar 100% de seguridad.
 */

export interface MathEvalResult {
  value: number | null;
  isValid: boolean;
  isFormula: boolean;
  cleanFormula?: string;
  error?: string;
}

export const SUPPORTED_FUNCTIONS = new Set([
  'ceil', 'techo',
  'floor', 'piso',
  'round', 'redondear',
  'trunc', 'int', 'entero',
  'abs', 'absoluto',
  'min', 'minimo',
  'max', 'maximo',
  'sqrt', 'raiz',
  'si', 'if'
]);

export const RESERVED_KEYWORDS = new Set([
  ...SUPPORTED_FUNCTIONS,
  'and', 'or', 'not',
  'true', 'false'
]);

/**
 * Verifica si una cadena contiene sintaxis de fórmula o expresión aritmética/lógica.
 */
export function isFormulaString(raw: string): boolean {
  if (!raw || typeof raw !== 'string') return false;
  const trimmed = raw.trim();
  if (trimmed.startsWith('=')) return true;
  // Contiene operadores típicos (+, -, *, /, ^, %, ?, :, <, >, =, !, &, |) junto con operandos
  if (/[+\-*/^%?<>!=&|]/.test(trimmed) && (/\d/.test(trimmed) || /true|false/i.test(trimmed))) {
    return true;
  }
  // Llamada a función soportada ej: ceil(10/2) o si(x>1, 2, 3)
  const funcRegex = new RegExp(`\\b(${Array.from(SUPPORTED_FUNCTIONS).join('|')})\\s*\\(`, 'i');
  return funcRegex.test(trimmed);
}

/**
 * Normaliza una cadena de texto sustituyendo comas decimales y limpiando caracteres no permitidos.
 */
export function sanitizeMathString(raw: string): string {
  if (!raw) return '';
  let str = raw.trim();
  if (str.startsWith('=')) {
    str = str.substring(1).trim();
  }
  // Reemplaza comas decimales tipo "12,5" o ",5" por punto "12.5"
  str = str.replace(/(\d+),(\d+)(?!\s*[,;a-zA-Z\d])/g, '$1.$2');
  str = str.replace(/(^|[+\-*/^%?<>!=&(,:|])\s*,(\d+)/g, '$10.$2');
  return str;
}

/**
 * Tokenizador seguro para expresiones aritméticas, lógicas y ternarias.
 */
type TokenType =
  | 'NUMBER'
  | 'OP_ADD'         // +, -
  | 'OP_MUL'         // *, /, %
  | 'OP_POW'         // ^
  | 'OP_REL'         // <, <=, >, >=
  | 'OP_EQ'          // ==, ===, =, !=, !==, <>
  | 'OP_AND'         // &&, and
  | 'OP_OR'          // ||, or
  | 'OP_NOT'         // !, not
  | 'QUESTION'       // ?
  | 'COLON'          // :
  | 'LPAREN'         // (
  | 'RPAREN'         // )
  | 'COMMA'          // ,, ;
  | 'FUNC';          // ceil, max, si, etc.

interface Token {
  type: TokenType;
  value: string | number;
}

function tokenize(input: string): Token[] | null {
  const sanitized = sanitizeMathString(input);
  const tokens: Token[] = [];
  let i = 0;

  while (i < sanitized.length) {
    const ch = sanitized[i];

    // Ignorar espacios en blanco
    if (/\s/.test(ch)) {
      i++;
      continue;
    }

    // Paréntesis
    if (ch === '(') {
      tokens.push({ type: 'LPAREN', value: '(' });
      i++;
      continue;
    }
    if (ch === ')') {
      tokens.push({ type: 'RPAREN', value: ')' });
      i++;
      continue;
    }

    // Separador de argumentos (coma o punto y coma)
    if (ch === ',' || ch === ';') {
      tokens.push({ type: 'COMMA', value: ',' });
      i++;
      continue;
    }

    // Operador ternario
    if (ch === '?') {
      tokens.push({ type: 'QUESTION', value: '?' });
      i++;
      continue;
    }
    if (ch === ':') {
      tokens.push({ type: 'COLON', value: ':' });
      i++;
      continue;
    }

    // Operadores lógicos de 2 caracteres (||, &&)
    if (ch === '|' && sanitized[i + 1] === '|') {
      tokens.push({ type: 'OP_OR', value: '||' });
      i += 2;
      continue;
    }
    if (ch === '&' && sanitized[i + 1] === '&') {
      tokens.push({ type: 'OP_AND', value: '&&' });
      i += 2;
      continue;
    }

    // Operadores de igualdad / desigualdad de 3 caracteres (===, !==)
    if (sanitized.startsWith('===', i)) {
      tokens.push({ type: 'OP_EQ', value: '==' });
      i += 3;
      continue;
    }
    if (sanitized.startsWith('!==', i)) {
      tokens.push({ type: 'OP_EQ', value: '!=' });
      i += 3;
      continue;
    }

    // Operadores de 2 caracteres (==, !=, <>, <=, >=)
    if (sanitized.startsWith('==', i)) {
      tokens.push({ type: 'OP_EQ', value: '==' });
      i += 2;
      continue;
    }
    if (sanitized.startsWith('!=', i)) {
      tokens.push({ type: 'OP_EQ', value: '!=' });
      i += 2;
      continue;
    }
    if (sanitized.startsWith('<>', i)) {
      tokens.push({ type: 'OP_EQ', value: '!=' });
      i += 2;
      continue;
    }
    if (sanitized.startsWith('<=', i)) {
      tokens.push({ type: 'OP_REL', value: '<=' });
      i += 2;
      continue;
    }
    if (sanitized.startsWith('>=', i)) {
      tokens.push({ type: 'OP_REL', value: '>=' });
      i += 2;
      continue;
    }

    // Operadores relacionales de 1 carácter (<, >)
    if (ch === '<') {
      tokens.push({ type: 'OP_REL', value: '<' });
      i++;
      continue;
    }
    if (ch === '>') {
      tokens.push({ type: 'OP_REL', value: '>' });
      i++;
      continue;
    }

    // Igualdad simple de 1 carácter (= estilo Excel / asignación condicional)
    if (ch === '=') {
      tokens.push({ type: 'OP_EQ', value: '==' });
      i++;
      continue;
    }

    // Negación lógica (!)
    if (ch === '!') {
      tokens.push({ type: 'OP_NOT', value: '!' });
      i++;
      continue;
    }

    // Operadores aritméticos
    if (ch === '+' || ch === '-') {
      tokens.push({ type: 'OP_ADD', value: ch });
      i++;
      continue;
    }
    if (ch === '*' || ch === '/' || ch === '%') {
      tokens.push({ type: 'OP_MUL', value: ch });
      i++;
      continue;
    }
    if (ch === '^') {
      tokens.push({ type: 'OP_POW', value: '^' });
      i++;
      continue;
    }

    // Identificadores (funciones, palabras clave booleanas y lógicas: and, or, not, true, false, etc.)
    if (/[a-zA-Z_]/.test(ch)) {
      let ident = '';
      while (i < sanitized.length && /[a-zA-Z0-9_]/.test(sanitized[i])) {
        ident += sanitized[i];
        i++;
      }
      const lower = ident.toLowerCase();

      if (lower === 'true') {
        tokens.push({ type: 'NUMBER', value: 1 });
        continue;
      }
      if (lower === 'false') {
        tokens.push({ type: 'NUMBER', value: 0 });
        continue;
      }
      if (lower === 'and') {
        tokens.push({ type: 'OP_AND', value: '&&' });
        continue;
      }
      if (lower === 'or') {
        tokens.push({ type: 'OP_OR', value: '||' });
        continue;
      }
      if (lower === 'not') {
        tokens.push({ type: 'OP_NOT', value: '!' });
        continue;
      }
      if (SUPPORTED_FUNCTIONS.has(lower)) {
        tokens.push({ type: 'FUNC', value: lower });
        continue;
      }

      return null; // Identificador no reconocido o variable no sustituida
    }

    // Números (enteros y decimales)
    if (/\d/.test(ch) || (ch === '.' && /\d/.test(sanitized[i + 1] || ''))) {
      let numStr = '';
      let hasDot = false;
      while (i < sanitized.length && (/\d/.test(sanitized[i]) || sanitized[i] === '.')) {
        if (sanitized[i] === '.') {
          if (hasDot) return null; // Número inválido con dos puntos
          hasDot = true;
        }
        numStr += sanitized[i];
        i++;
      }
      const numVal = parseFloat(numStr);
      if (isNaN(numVal)) return null;
      tokens.push({ type: 'NUMBER', value: numVal });
      continue;
    }

    // Carácter no permitido detectado
    return null;
  }

  return tokens;
}

/**
 * Nodos del Árbol de Sintaxis Abstracta (AST).
 */
type ASTNode =
  | { type: 'Literal'; value: number }
  | { type: 'Unary'; op: string; argument: ASTNode }
  | { type: 'Binary'; op: string; left: ASTNode; right: ASTNode }
  | { type: 'Ternary'; condition: ASTNode; consequent: ASTNode; alternate: ASTNode }
  | { type: 'Call'; name: string; args: ASTNode[] };

/**
 * Parser de descenso recursivo seguro con precedencia estándar (K&R / C / JavaScript).
 */
class MathParser {
  private tokens: Token[];
  private pos = 0;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  private peek(): Token | undefined {
    return this.tokens[this.pos];
  }

  private get(): Token | undefined {
    return this.tokens[this.pos++];
  }

  public parse(): ASTNode | null {
    if (this.tokens.length === 0) return null;
    const ast = this.parseTernary();
    if (ast === null || this.pos < this.tokens.length) {
      return null; // Quedaron tokens no consumidos o error de sintaxis
    }
    return ast;
  }

  // 1. Ternario: cond ? consequent : alternate (asociatividad por derecha)
  private parseTernary(): ASTNode | null {
    const cond = this.parseLogicalOr();
    if (cond === null) return null;

    const next = this.peek();
    if (next && next.type === 'QUESTION') {
      this.get(); // Consumir '?'
      const consequent = this.parseTernary(); // Right-associative
      if (consequent === null) return null;

      const colon = this.get();
      if (!colon || colon.type !== 'COLON') return null; // Falta ':'

      const alternate = this.parseTernary(); // Right-associative
      if (alternate === null) return null;

      return {
        type: 'Ternary',
        condition: cond,
        consequent,
        alternate
      };
    }

    return cond;
  }

  // 2. Lógico OR: a || b, a or b
  private parseLogicalOr(): ASTNode | null {
    let left = this.parseLogicalAnd();
    if (left === null) return null;

    while (this.pos < this.tokens.length) {
      const next = this.peek();
      if (next && next.type === 'OP_OR') {
        const op = String(this.get()!.value);
        const right = this.parseLogicalAnd();
        if (right === null) return null;
        left = { type: 'Binary', op, left, right };
      } else {
        break;
      }
    }
    return left;
  }

  // 3. Lógico AND: a && b, a and b
  private parseLogicalAnd(): ASTNode | null {
    let left = this.parseEquality();
    if (left === null) return null;

    while (this.pos < this.tokens.length) {
      const next = this.peek();
      if (next && next.type === 'OP_AND') {
        const op = String(this.get()!.value);
        const right = this.parseEquality();
        if (right === null) return null;
        left = { type: 'Binary', op, left, right };
      } else {
        break;
      }
    }
    return left;
  }

  // 4. Igualdad / Desigualdad: ==, !=, =, <>, ===, !==
  private parseEquality(): ASTNode | null {
    let left = this.parseRelational();
    if (left === null) return null;

    while (this.pos < this.tokens.length) {
      const next = this.peek();
      if (next && next.type === 'OP_EQ') {
        const op = String(this.get()!.value);
        const right = this.parseRelational();
        if (right === null) return null;
        left = { type: 'Binary', op, left, right };
      } else {
        break;
      }
    }
    return left;
  }

  // 5. Relacionales: <, <=, >, >=
  private parseRelational(): ASTNode | null {
    let left = this.parseAdditive();
    if (left === null) return null;

    while (this.pos < this.tokens.length) {
      const next = this.peek();
      if (next && next.type === 'OP_REL') {
        const op = String(this.get()!.value);
        const right = this.parseAdditive();
        if (right === null) return null;
        left = { type: 'Binary', op, left, right };
      } else {
        break;
      }
    }
    return left;
  }

  // 6. Aditivo: +, -
  private parseAdditive(): ASTNode | null {
    let left = this.parseMultiplicative();
    if (left === null) return null;

    while (this.pos < this.tokens.length) {
      const next = this.peek();
      if (next && next.type === 'OP_ADD') {
        const op = String(this.get()!.value);
        const right = this.parseMultiplicative();
        if (right === null) return null;
        left = { type: 'Binary', op, left, right };
      } else {
        break;
      }
    }
    return left;
  }

  // 7. Multiplicativo: *, /, %
  private parseMultiplicative(): ASTNode | null {
    let left = this.parseFactor();
    if (left === null) return null;

    while (this.pos < this.tokens.length) {
      const next = this.peek();
      if (next && next.type === 'OP_MUL') {
        const op = String(this.get()!.value);
        const right = this.parseFactor();
        if (right === null) return null;
        left = { type: 'Binary', op, left, right };
      } else {
        break;
      }
    }
    return left;
  }

  // 8. Factor / Potencia: ^ (asociatividad por derecha)
  private parseFactor(): ASTNode | null {
    const base = this.parseUnary();
    if (base === null) return null;

    const next = this.peek();
    if (next && next.type === 'OP_POW') {
      const op = String(this.get()!.value);
      const exp = this.parseFactor(); // Recursión por derecha
      if (exp === null) return null;
      return { type: 'Binary', op, left: base, right: exp };
    }
    return base;
  }

  // 9. Unarios (+x, -x, !x, not x) y Primarios (números, paréntesis, llamadas a función)
  private parseUnary(): ASTNode | null {
    const next = this.peek();
    if (!next) return null;

    // Unario aritmético (+, -)
    if (next.type === 'OP_ADD') {
      const op = String(this.get()!.value);
      const arg = this.parseUnary();
      if (arg === null) return null;
      return { type: 'Unary', op, argument: arg };
    }

    // Unario lógico (!, not)
    if (next.type === 'OP_NOT') {
      const op = String(this.get()!.value);
      const arg = this.parseUnary();
      if (arg === null) return null;
      return { type: 'Unary', op, argument: arg };
    }

    // Llamadas a función: ceil(...), floor(...), si(...), min(...), etc.
    if (next.type === 'FUNC') {
      const funcToken = this.get()!;
      const funcName = String(funcToken.value).toLowerCase();

      const openParen = this.get();
      if (!openParen || openParen.type !== 'LPAREN') return null; // Esperaba '('

      const args: ASTNode[] = [];
      if (this.peek() && this.peek()!.type !== 'RPAREN') {
        const firstArg = this.parseTernary();
        if (firstArg === null) return null;
        args.push(firstArg);

        while (this.peek() && this.peek()!.type === 'COMMA') {
          this.get(); // Consumir ',' o ';'
          const nextArg = this.parseTernary();
          if (nextArg === null) return null;
          args.push(nextArg);
        }
      }

      const closeParen = this.get();
      if (!closeParen || closeParen.type !== 'RPAREN') return null; // Falta ')'

      return { type: 'Call', name: funcName, args };
    }

    // Número simple
    if (next.type === 'NUMBER') {
      const token = this.get()!;
      const numVal = typeof token.value === 'number' ? token.value : parseFloat(String(token.value));
      return { type: 'Literal', value: numVal };
    }

    // Paréntesis agrupados: ( exp )
    if (next.type === 'LPAREN') {
      this.get(); // Consumir '('
      const inner = this.parseTernary();
      if (inner === null) return null;
      const closing = this.get();
      if (!closing || closing.type !== 'RPAREN') return null; // Falta ')'
      return inner;
    }

    return null;
  }
}

/**
 * Evaluación recursiva del AST con cortocircuito para operadores lógicos y ternarios.
 */
function evaluateAST(node: ASTNode): number | null {
  switch (node.type) {
    case 'Literal':
      return node.value;

    case 'Unary': {
      const argVal = evaluateAST(node.argument);
      if (argVal === null || isNaN(argVal)) return null;
      if (node.op === '-') return -argVal;
      if (node.op === '+') return +argVal;
      if (node.op === '!' || node.op === 'not') {
        return (argVal === 0 || isNaN(argVal)) ? 1 : 0;
      }
      return null;
    }

    case 'Binary': {
      // Operadores lógicos con cortocircuito (Short-circuit)
      if (node.op === '&&' || node.op === 'and') {
        const leftVal = evaluateAST(node.left);
        if (leftVal === null) return null;
        if (leftVal === 0) return 0; // Short-circuit: falso directo
        const rightVal = evaluateAST(node.right);
        if (rightVal === null) return null;
        return rightVal !== 0 ? 1 : 0;
      }

      if (node.op === '||' || node.op === 'or') {
        const leftVal = evaluateAST(node.left);
        if (leftVal === null) return null;
        if (leftVal !== 0) return 1; // Short-circuit: verdadero directo
        const rightVal = evaluateAST(node.right);
        if (rightVal === null) return null;
        return rightVal !== 0 ? 1 : 0;
      }

      // Operadores aritméticos, relacionales y de igualdad
      const left = evaluateAST(node.left);
      const right = evaluateAST(node.right);
      if (left === null || right === null || isNaN(left) || isNaN(right)) return null;

      switch (node.op) {
        case '+': return left + right;
        case '-': return left - right;
        case '*': return left * right;
        case '/':
          if (Math.abs(right) < 1e-12) return null; // Evitar división por cero
          return left / right;
        case '%':
          if (Math.abs(right) < 1e-12) return null;
          return left % right;
        case '^': return Math.pow(left, right);

        case '<': return left < right ? 1 : 0;
        case '<=': return left <= right ? 1 : 0;
        case '>': return left > right ? 1 : 0;
        case '>=': return left >= right ? 1 : 0;

        case '==':
        case '===':
        case '=':
          return Math.abs(left - right) < 1e-9 ? 1 : 0;
        case '!=':
        case '!==':
        case '<>':
          return Math.abs(left - right) >= 1e-9 ? 1 : 0;

        default:
          return null;
      }
    }

    case 'Ternary': {
      const condVal = evaluateAST(node.condition);
      if (condVal === null || isNaN(condVal)) return null;
      const isTruthy = condVal !== 0;
      // Evaluación con cortocircuito de la rama correspondiente
      return isTruthy ? evaluateAST(node.consequent) : evaluateAST(node.alternate);
    }

    case 'Call': {
      const name = node.name.toLowerCase();
      // Soporte para funciones condicionales tipo Excel: si(cond, si_verdadero, si_falso) / if(...)
      if (name === 'si' || name === 'if') {
        if (node.args.length < 2) return null;
        const condVal = evaluateAST(node.args[0]);
        if (condVal === null || isNaN(condVal)) return null;
        const isTruthy = condVal !== 0;
        if (isTruthy) {
          return evaluateAST(node.args[1]);
        } else {
          return node.args.length >= 3 ? evaluateAST(node.args[2]) : 0;
        }
      }

      // Otras funciones matemáticas
      const evaluatedArgs: number[] = [];
      for (const argNode of node.args) {
        const argVal = evaluateAST(argNode);
        if (argVal === null || isNaN(argVal)) return null;
        evaluatedArgs.push(argVal);
      }
      return evaluateFunction(name, evaluatedArgs);
    }

    default:
      return null;
  }
}

function evaluateFunction(funcName: string, args: number[]): number | null {
  if (args.length === 0) return null;

  switch (funcName) {
    case 'ceil':
    case 'techo':
      return Math.ceil(args[0]);

    case 'floor':
    case 'piso':
      return Math.floor(args[0]);

    case 'trunc':
    case 'int':
    case 'entero':
      return Math.trunc(args[0]);

    case 'round':
    case 'redondear':
      if (args.length >= 2) {
        const decimals = Math.max(0, Math.round(args[1]));
        const factor = Math.pow(10, decimals);
        return Math.round(args[0] * factor) / factor;
      }
      return Math.round(args[0]);

    case 'abs':
    case 'absoluto':
      return Math.abs(args[0]);

    case 'sqrt':
    case 'raiz':
      if (args[0] < 0) return null; // Raíz negativa
      return Math.sqrt(args[0]);

    case 'min':
    case 'minimo':
      return Math.min(...args);

    case 'max':
    case 'maximo':
      return Math.max(...args);

    default:
      return null;
  }
}

/**
 * Evalúa una cadena de texto matemática o lógica de forma segura.
 * Retorna el número resultante, o null si la sintaxis es inválida.
 * 
 * @example
 * evaluateMathExpression("bocas > 10 ? bocas * 1.2 : bocas * 1.0", { bocas: 15 }) -> { value: 18, isValid: true }
 * evaluateMathExpression("ceil(14 / 4)") -> { value: 4, isValid: true }
 * evaluateMathExpression("si(bocas > 5, 20, 10)", { bocas: 8 }) -> { value: 20, isValid: true }
 */
export function evaluateMathExpression(
  input: string | number,
  scope?: Record<string, number | boolean>
): MathEvalResult {
  if (typeof input === 'number') {
    if (isNaN(input) || !isFinite(input)) return { value: null, isValid: false, isFormula: false };
    return { value: input, isValid: true, isFormula: false };
  }

  if (!input || typeof input !== 'string' || !input.trim()) {
    return { value: null, isValid: false, isFormula: false };
  }

  const raw = input.trim();
  let cleanFormula = sanitizeMathString(raw);

  // Si se proporciona un scope de variables, sustituirlas de forma segura
  if (scope && Object.keys(scope).length > 0) {
    const sortedKeys = Object.keys(scope).sort((a, b) => b.length - a.length);
    for (const key of sortedKeys) {
      if (RESERVED_KEYWORDS.has(key.toLowerCase())) continue; // Proteger palabras reservadas
      const rawVal = scope[key];
      let numVal = 0;
      if (typeof rawVal === 'boolean') {
        numVal = rawVal ? 1 : 0;
      } else if (typeof rawVal === 'number' && !isNaN(rawVal)) {
        numVal = rawVal;
      }
      const regex = new RegExp(`\\b${key}\\b`, 'gi');
      cleanFormula = cleanFormula.replace(regex, String(numVal));
    }
  }

  const isFormula = isFormulaString(raw) || (scope !== undefined && Object.keys(scope).length > 0) || /[a-zA-Z_]\w*\s*\(/.test(cleanFormula);

  // Si es simplemente un número simple
  if (!isFormula && /^-?\d+(\.\d+)?$/.test(cleanFormula)) {
    const num = parseFloat(cleanFormula);
    return {
      value: isNaN(num) ? null : num,
      isValid: !isNaN(num),
      isFormula: false,
    };
  }

  const tokens = tokenize(cleanFormula);
  if (!tokens || tokens.length === 0) {
    return {
      value: null,
      isValid: false,
      isFormula,
      cleanFormula,
      error: 'Caracteres no válidos en la expresión o variable no definida',
    };
  }

  try {
    const parser = new MathParser(tokens);
    const ast = parser.parse();

    if (!ast) {
      return {
        value: null,
        isValid: false,
        isFormula,
        cleanFormula,
        error: 'Expresión matemática o lógica incompleta / sintaxis inválida',
      };
    }

    const result = evaluateAST(ast);
    if (result === null || isNaN(result) || !isFinite(result)) {
      return {
        value: null,
        isValid: false,
        isFormula,
        cleanFormula,
        error: 'Error de evaluación o división por cero',
      };
    }

    // Redondear a un máximo de 6 decimales para evitar problemas de coma flotante binaria (ej: 0.1+0.2)
    const rounded = Number(Math.round(Number(result + 'e+6')) + 'e-6');

    return {
      value: rounded,
      isValid: true,
      isFormula,
      cleanFormula,
    };
  } catch (err) {
    return {
      value: null,
      isValid: false,
      isFormula,
      cleanFormula,
      error: 'Error de evaluación',
    };
  }
}

/**
 * Evalúa una condición lógica o de comparación de forma segura.
 * Soporta operadores de comparación (<=, >=, ==, ===, =, !=, !==, <>, <, >),
 * operadores lógicos (&&, ||, and, or, not, !) y operador ternario.
 *
 * @example
 * evaluateCondition("calibre_principal <= 25", { calibre_principal: 25 }) -> true
 * evaluateCondition("calibre_principal > 25 && calibre_principal <= 40", { calibre_principal: 32 }) -> true
 * evaluateCondition("requiere_certificacion == 1", { requiere_certificacion: 0 }) -> false
 * evaluateCondition("requiere_certificacion", { requiere_certificacion: 1 }) -> true
 */
export function evaluateCondition(
  condition?: string | null,
  scope?: Record<string, number | boolean>
): boolean {
  if (!condition || typeof condition !== 'string') return true;
  const trimmed = condition.trim();
  if (!trimmed) return true;

  const res = evaluateMathExpression(trimmed, scope);
  if (res.isValid && res.value !== null) {
    return res.value !== 0;
  }
  return false;
}

