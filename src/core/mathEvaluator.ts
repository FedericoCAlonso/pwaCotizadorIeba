/**
 * mathEvaluator.ts - Parser y evaluador seguro de expresiones aritméticas
 * Diseñado para campos numéricos calculados tipo Excel/CAD (ej: 15*4 + 10.5 o = (12+4)/2).
 * NUNCA utiliza eval() ni Function() para garantizar 100% de seguridad.
 */

export interface MathEvalResult {
  value: number | null;
  isValid: boolean;
  isFormula: boolean;
  cleanFormula?: string;
  error?: string;
}

/**
 * Verifica si una cadena contiene sintaxis de fórmula o expresión aritmética.
 */
export function isFormulaString(raw: string): boolean {
  if (!raw || typeof raw !== 'string') return false;
  const trimmed = raw.trim();
  if (trimmed.startsWith('=')) return true;
  // Contiene operadores aritméticos típicos (+, -, *, /, ^, (, )) junto con números
  return /[+\-*/^()]/.test(trimmed) && /\d/.test(trimmed);
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
  str = str.replace(/(\d+),(\d+)/g, '$1.$2');
  str = str.replace(/(^|[+\-*/^(])\s*,(\d+)/g, '$10.$2');
  return str;
}

/**
 * Tokenizador seguro para expresiones aritméticas.
 */
type TokenType = 'NUMBER' | 'OP' | 'LPAREN' | 'RPAREN';
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

    // Operadores
    if (['+', '-', '*', '/', '^', '%'].includes(ch)) {
      tokens.push({ type: 'OP', value: ch });
      i++;
      continue;
    }

    // Números (enteros y decimales)
    if (/\d/.test(ch) || ch === '.') {
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
 * Parser de descenso recursivo seguro con precedencia de operadores PEMDAS.
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

  public parse(): number | null {
    if (this.tokens.length === 0) return null;
    const result = this.parseExpression();
    if (result === null || this.pos < this.tokens.length) {
      return null; // Quedaron tokens no consumidos
    }
    return result;
  }

  // Expresión: Suma y Resta
  private parseExpression(): number | null {
    let left = this.parseTerm();
    if (left === null) return null;

    while (this.pos < this.tokens.length) {
      const next = this.peek();
      if (next && next.type === 'OP' && (next.value === '+' || next.value === '-')) {
        this.get(); // Consumir operador
        const right = this.parseTerm();
        if (right === null) return null;
        left = next.value === '+' ? left + right : left - right;
      } else {
        break;
      }
    }
    return left;
  }

  // Término: Multiplicación, División y Módulo
  private parseTerm(): number | null {
    let left = this.parseFactor();
    if (left === null) return null;

    while (this.pos < this.tokens.length) {
      const next = this.peek();
      if (next && next.type === 'OP' && (next.value === '*' || next.value === '/' || next.value === '%')) {
        this.get(); // Consumir operador
        const right = this.parseFactor();
        if (right === null) return null;
        if (next.value === '*') {
          left = left * right;
        } else if (next.value === '/') {
          if (right === 0) return null; // Evitar división por cero
          left = left / right;
        } else if (next.value === '%') {
          if (right === 0) return null;
          left = left % right;
        }
      } else {
        break;
      }
    }
    return left;
  }

  // Factor: Exponenciación
  private parseFactor(): number | null {
    const base = this.parseUnary();
    if (base === null) return null;

    const next = this.peek();
    if (next && next.type === 'OP' && next.value === '^') {
      this.get(); // Consumir '^'
      const exp = this.parseFactor(); // Recursión por derecha para asociatividad
      if (exp === null) return null;
      return Math.pow(base, exp);
    }
    return base;
  }

  // Unario (+x, -x) y Primarios (números, paréntesis)
  private parseUnary(): number | null {
    const next = this.peek();
    if (!next) return null;

    // Soporte para signo unario: -5 o +10
    if (next.type === 'OP' && (next.value === '+' || next.value === '-')) {
      this.get();
      const val = this.parseUnary();
      if (val === null) return null;
      return next.value === '-' ? -val : val;
    }

    // Número simple
    if (next.type === 'NUMBER') {
      this.get();
      return typeof next.value === 'number' ? next.value : parseFloat(String(next.value));
    }

    // Paréntesis agrupados: ( exp )
    if (next.type === 'LPAREN') {
      this.get(); // Consumir '('
      const val = this.parseExpression();
      if (val === null) return null;
      const closing = this.get();
      if (!closing || closing.type !== 'RPAREN') return null; // Falta ')'
      return val;
    }

    return null;
  }
}

/**
 * Evalúa una cadena de texto matemática de forma segura.
 * Retorna el número resultante, o null si la sintaxis es inválida.
 * 
 * @example
 * evaluateMathExpression("15*4 + 10.5") -> { value: 70.5, isValid: true, isFormula: true, cleanFormula: "15*4 + 10.5" }
 * evaluateMathExpression("=(12 + 8) / 2") -> { value: 10, isValid: true, isFormula: true, cleanFormula: "(12 + 8) / 2" }
 * evaluateMathExpression("45") -> { value: 45, isValid: true, isFormula: false }
 */
export function evaluateMathExpression(
  input: string | number,
  scope?: Record<string, number>
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
      const val = scope[key] !== undefined && !isNaN(scope[key]) ? scope[key] : 0;
      const regex = new RegExp(`\\b${key}\\b`, 'gi');
      cleanFormula = cleanFormula.replace(regex, String(val));
    }
  }

  const isFormula = isFormulaString(raw) || (scope !== undefined && Object.keys(scope).length > 0);

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
      error: 'Caracteres no válidos en la expresión',
    };
  }

  try {
    const parser = new MathParser(tokens);
    const result = parser.parse();

    if (result === null || isNaN(result) || !isFinite(result)) {
      return {
        value: null,
        isValid: false,
        isFormula,
        cleanFormula,
        error: 'Expresión matemática incompleta o inválida',
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
 * Soporta operadores de comparación (<=, >=, ==, ===, !=, !==, <, >)
 * y operadores lógicos (&&, ||).
 *
 * @example
 * evaluateCondition("calibre_principal <= 25", { calibre_principal: 25 }) -> true
 * evaluateCondition("calibre_principal > 25 && calibre_principal <= 40", { calibre_principal: 32 }) -> true
 * evaluateCondition("requiere_certificacion == 1", { requiere_certificacion: 0 }) -> false
 * evaluateCondition("requiere_certificacion", { requiere_certificacion: 1 }) -> true
 */
export function evaluateCondition(
  condition?: string | null,
  scope?: Record<string, number>
): boolean {
  if (!condition || typeof condition !== 'string') return true;
  const trimmed = condition.trim();
  if (!trimmed) return true;

  // Split by OR ('||') first
  const orClauses = trimmed.split('||');
  for (const orClause of orClauses) {
    // Within each OR, split by AND ('&&')
    const andClauses = orClause.split('&&');
    let andResult = true;

    for (const andClause of andClauses) {
      const clause = andClause.trim();
      if (!clause) continue;

      let clauseResult = false;

      // Check comparison operators (longer operators first: <=, >=, ==, !=, <, >)
      const compMatch = clause.match(/^(.*?)(<=|>=|===|==|!==|!=|<|>)(.*)$/);
      if (compMatch) {
        const leftExpr = compMatch[1].trim();
        const op = compMatch[2].trim();
        const rightExpr = compMatch[3].trim();

        const leftRes = evaluateMathExpression(leftExpr, scope);
        const rightRes = evaluateMathExpression(rightExpr, scope);

        if (leftRes.isValid && rightRes.isValid && leftRes.value !== null && rightRes.value !== null) {
          const l = leftRes.value;
          const r = rightRes.value;

          switch (op) {
            case '<=': clauseResult = l <= r; break;
            case '>=': clauseResult = l >= r; break;
            case '==':
            case '===': clauseResult = Math.abs(l - r) < 1e-6; break;
            case '!=':
            case '!==': clauseResult = Math.abs(l - r) >= 1e-6; break;
            case '<': clauseResult = l < r; break;
            case '>': clauseResult = l > r; break;
            default: clauseResult = false;
          }
        }
      } else {
        // Truthiness check of single expression (e.g. "requiere_certificacion")
        const singleRes = evaluateMathExpression(clause, scope);
        if (singleRes.isValid && singleRes.value !== null) {
          clauseResult = singleRes.value > 0;
        } else {
          // If not a number, maybe it's boolean string
          if (clause.toLowerCase() === 'true' || clause === '1') clauseResult = true;
          else if (clause.toLowerCase() === 'false' || clause === '0') clauseResult = false;
          else clauseResult = false;
        }
      }

      if (!clauseResult) {
        andResult = false;
        break;
      }
    }

    if (andResult) {
      return true; // At least one OR branch succeeded
    }
  }

  return false;
}
