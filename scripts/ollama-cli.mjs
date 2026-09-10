#!/usr/bin/env node
import { parseArgs } from 'node:util';
import readline from 'node:readline';

const DEFAULT_HOST = process.env.OLLAMA_HOST || 'http://localhost:11434';
const DEFAULT_MODEL = process.env.OLLAMA_MODEL || 'gemma-64k:latest';

const options = {
  prompt: { type: 'string', short: 'p' },
  model: { type: 'string', short: 'm', default: DEFAULT_MODEL },
  system: { type: 'string', short: 's' },
  temperature: { type: 'string', short: 't', default: '0.2' },
  host: { type: 'string', default: DEFAULT_HOST },
  json: { type: 'boolean', default: false },
  'no-stream': { type: 'boolean', default: false },
  list: { type: 'boolean', short: 'l', default: false },
  help: { type: 'boolean', short: 'h', default: false },
};

function printHelp() {
  console.log(`
Uso: node scripts/ollama-cli.mjs [opciones] [prompt]

Opciones:
  -p, --prompt <texto>       Prompt a enviar al modelo
  -m, --model <nombre>       Modelo de Ollama (por defecto: ${DEFAULT_MODEL})
  -s, --system <texto>       Prompt de sistema opcional
  -t, --temperature <num>    Temperatura (por defecto: 0.2)
  --host <url>               URL de Ollama (por defecto: ${DEFAULT_HOST})
  --json                     Forzar salida en formato JSON
  --no-stream                Desactivar streaming de tokens en tiempo real
  -l, --list                 Listar modelos disponibles localmente
  -h, --help                 Mostrar esta ayuda

Ejemplos:
  node scripts/ollama-cli.mjs "Explica qué es un interruptor termomagnético curva C"
  node scripts/ollama-cli.mjs -m gemma4:e4b -p "¿Qué diferencia hay entre curva B y C?"
  cat catalogo.txt | node scripts/ollama-cli.mjs "Extrae y lista los ítems en formato JSON"
`);
}

async function readStdin() {
  if (process.stdin.isTTY) return '';
  const rl = readline.createInterface({ input: process.stdin, terminal: false });
  const lines = [];
  for await (const line of rl) {
    lines.push(line);
  }
  return lines.join('\n');
}

async function listModels(host) {
  try {
    const res = await fetch(`${host}/api/tags`);
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    const data = await res.json();
    console.log(`\nModelos disponibles en ${host}:\n`);
    for (const m of data.models || []) {
      const sizeGB = (m.size / (1024 * 1024 * 1024)).toFixed(2);
      console.log(` • ${m.name.padEnd(25)} [${sizeGB} GB] (modificado: ${m.modified_at?.slice(0, 10)})`);
    }
    console.log('');
  } catch (err) {
    console.error(`Error conectando a Ollama en ${host}:`, err.message);
    process.exit(1);
  }
}

async function main() {
  let parsed;
  try {
    parsed = parseArgs({ options, allowPositionals: true });
  } catch (err) {
    console.error('Error de sintaxis en argumentos:', err.message);
    printHelp();
    process.exit(1);
  }

  const { values, positionals } = parsed;

  if (values.help) {
    printHelp();
    return;
  }

  if (values.list) {
    await listModels(values.host);
    return;
  }

  const piped = await readStdin();
  const positionalPrompt = positionals.join(' ').trim();
  const explicitPrompt = values.prompt || '';

  let finalPrompt = '';
  if (piped && (explicitPrompt || positionalPrompt)) {
    const userInstruction = explicitPrompt || positionalPrompt;
    finalPrompt = `${userInstruction}\n\n--- ENTRADA DE DATOS ---\n${piped}`;
  } else if (piped) {
    finalPrompt = piped;
  } else {
    finalPrompt = explicitPrompt || positionalPrompt;
  }

  if (!finalPrompt) {
    console.error('Error: Debe especificar un prompt o pasar datos por tubería (stdin).');
    printHelp();
    process.exit(1);
  }

  const isStreaming = !values['no-stream'];
  const body = {
    model: values.model,
    prompt: finalPrompt,
    stream: isStreaming,
    options: {
      temperature: parseFloat(values.temperature) || 0.2,
    },
  };

  if (values.system) {
    body.system = values.system;
  }
  if (values.json) {
    body.format = 'json';
  }

  const startTime = Date.now();
  let response;
  try {
    response = await fetch(`${values.host}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch (err) {
    console.error(`\n[ERROR] No se pudo conectar a Ollama en ${values.host}:`, err.message);
    console.error('Verifica que Ollama esté iniciado (`ollama serve`).\n');
    process.exit(1);
  }

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`\n[ERROR HTTP ${response.status}]:`, errorText);
    process.exit(1);
  }

  if (!isStreaming) {
    const data = await response.json();
    console.log(data.response);
    const elapsedSec = ((Date.now() - startTime) / 1000).toFixed(2);
    const tokRate = data.eval_count && data.eval_duration ? (data.eval_count / (data.eval_duration / 1e9)).toFixed(2) : 'N/A';
    if (!values.json && process.stderr.isTTY) {
      console.error(`\n[Estadísticas: ${data.eval_count ?? 0} tokens | ${elapsedSec}s | ${tokRate} tok/s]`);
    }
    return;
  }

  // Streaming
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let totalTokens = 0;
  let evalDuration = 0;

  try {
    let buffer = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const parsedLine = JSON.parse(line);
          if (parsedLine.response) {
            process.stdout.write(parsedLine.response);
          }
          if (parsedLine.done) {
            totalTokens = parsedLine.eval_count ?? 0;
            evalDuration = parsedLine.eval_duration ?? 0;
          }
        } catch {
          // Ignorar fragmentos no JSON
        }
      }
    }
    console.log('');
    const elapsedSec = ((Date.now() - startTime) / 1000).toFixed(2);
    const tokRate = evalDuration > 0 ? (totalTokens / (evalDuration / 1e9)).toFixed(2) : 'N/A';
    if (process.stderr.isTTY) {
      console.error(`\n[Completado: ${totalTokens} tokens | ${elapsedSec}s total | ${tokRate} tok/s]`);
    }
  } catch (err) {
    console.error('\n[Error en streaming]:', err.message);
    process.exit(1);
  }
}

main();
