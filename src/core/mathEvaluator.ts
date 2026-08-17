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
export function evaluateMathExpression(input: string | number): MathEvalResult {
  if (typeof input === 'number') {
    if (isNaN(input) || !isFinite(input)) return { value: null, isValid: false, isFormula: false };
    return { value: input, isValid: true, isFormula: false };
  }

  if (!input || typeof input !== 'string' || !input.trim()) {
    return { value: null, isValid: false, isFormula: false };
  }

  const raw = input.trim();
  const isFormula = isFormulaString(raw);
  const cleanFormula = sanitizeMathString(raw);

  // Si es simplemente un número simple
  if (!isFormula && /^-?\d+(\.\d+)?$/.test(cleanFormula)) {
    const num = parseFloat(cleanFormula);
    return {
      value: isNaN(num) ? null : num,
      isValid: !isNaN(num),
      isFormula: false,
    };
  }

  const tokens = tokenize(raw);
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
