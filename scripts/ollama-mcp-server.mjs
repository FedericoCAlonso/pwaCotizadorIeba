#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

const OLLAMA_HOST = process.env.OLLAMA_HOST || 'http://localhost:11434';
const DEFAULT_MODEL = process.env.OLLAMA_MODEL || 'gemma-64k:latest';

const server = new Server(
  {
    name: 'cotizador-ollama-bridge',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Registrar lista de herramientas
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'consultar_gemma_local',
        description:
          'Ejecuta una consulta contra el modelo local gemma-64k (o gemma4:e4b) vía Ollama para ahorrar tokens en la nube. Útil para análisis de grandes textos, generación de código boilerplate, documentación o tareas que no requieran los modelos cloud.',
        inputSchema: {
          type: 'object',
          properties: {
            prompt: {
              type: 'string',
              description: 'La consulta, instrucción o tarea detallada para el modelo local.',
            },
            system: {
              type: 'string',
              description: 'Instrucción de sistema (rol, directivas o formato).',
            },
            model: {
              type: 'string',
              description: `Nombre del modelo en Ollama (por defecto: "${DEFAULT_MODEL}").`,
            },
            temperature: {
              type: 'number',
              description: 'Temperatura para la respuesta (0.0 a 1.0, por defecto 0.2).',
            },
          },
          required: ['prompt'],
        },
      },
      {
        name: 'extraer_json_con_gemma',
        description:
          'Utiliza el modelo local gemma-64k con restricción de formato JSON para estructurar datos no procesados (listas de precios, catálogos, tablas, especificaciones) sin gastar tokens cloud.',
        inputSchema: {
          type: 'object',
          properties: {
            datos: {
              type: 'string',
              description: 'El texto o datos en bruto a estructurar.',
            },
            esquema_o_instruccion: {
              type: 'string',
              description: 'Instrucciones sobre la estructura JSON esperada (campos, tipos, claves).',
            },
            model: {
              type: 'string',
              description: `Nombre del modelo en Ollama (por defecto: "${DEFAULT_MODEL}").`,
            },
          },
          required: ['datos', 'esquema_o_instruccion'],
        },
      },
      {
        name: 'listar_modelos_ollama',
        description: 'Lista los modelos disponibles en el servidor local de Ollama junto con sus tamaños.',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
    ],
  };
});

// Manejar ejecución de herramientas
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    if (name === 'listar_modelos_ollama') {
      const res = await fetch(`${OLLAMA_HOST}/api/tags`);
      if (!res.ok) {
        return {
          content: [
            {
              type: 'text',
              text: `Error al conectar con Ollama (${res.status} ${res.statusText}). Asegúrate de que ollama esté corriendo.`,
            },
          ],
          isError: true,
        };
      }
      const data = await res.json();
      const models = (data.models || []).map((m) => ({
        nombre: m.name,
        tamanioGB: (m.size / (1024 * 1024 * 1024)).toFixed(2),
        modificado: m.modified_at,
      }));
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(models, null, 2),
          },
        ],
      };
    }

    if (name === 'consultar_gemma_local') {
      const prompt = args?.prompt;
      const system = args?.system;
      const model = args?.model || DEFAULT_MODEL;
      const temperature = typeof args?.temperature === 'number' ? args.temperature : 0.2;

      const body = {
        model,
        prompt,
        stream: false,
        options: { temperature },
      };
      if (system) body.system = system;

      const startTime = Date.now();
      const res = await fetch(`${OLLAMA_HOST}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errText = await res.text();
        return {
          content: [
            {
              type: 'text',
              text: `Error de Ollama (${res.status}): ${errText}`,
            },
          ],
          isError: true,
        };
      }

      const data = await res.json();
      const elapsedSec = ((Date.now() - startTime) / 1000).toFixed(2);
      const tokRate =
        data.eval_count && data.eval_duration
          ? (data.eval_count / (data.eval_duration / 1e9)).toFixed(2)
          : 'N/A';

      const footer = `\n\n---\n*[Ollama ${model} | ${data.eval_count ?? 0} tokens | ${elapsedSec}s | ${tokRate} tok/s]*`;

      return {
        content: [
          {
            type: 'text',
            text: (data.response || '') + footer,
          },
        ],
      };
    }

    if (name === 'extraer_json_con_gemma') {
      const datos = args?.datos;
      const instruction = args?.esquema_o_instruccion;
      const model = args?.model || DEFAULT_MODEL;

      const fullPrompt = `Extrae y estructura la siguiente información en formato JSON estricto según estas especificaciones:\n${instruction}\n\nDATOS A PROCESAR:\n${datos}`;

      const res = await fetch(`${OLLAMA_HOST}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          prompt: fullPrompt,
          format: 'json',
          stream: false,
          options: { temperature: 0.1 },
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        return {
          content: [
            {
              type: 'text',
              text: `Error de Ollama (${res.status}): ${errText}`,
            },
          ],
          isError: true,
        };
      }

      const data = await res.json();
      return {
        content: [
          {
            type: 'text',
            text: data.response || '{}',
          },
        ],
      };
    }

    return {
      content: [
        {
          type: 'text',
          text: `Herramienta desconocida: ${name}`,
        },
      ],
      isError: true,
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Excepción ejecutando herramienta ${name}: ${error.message}`,
        },
      ],
      isError: true,
    };
  }
});

async function run() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write(`Servidor MCP Ollama iniciado en ${OLLAMA_HOST} con modelo por defecto ${DEFAULT_MODEL}\n`);
}

run().catch((error) => {
  process.stderr.write(`Fallo fatal al iniciar servidor MCP: ${error}\n`);
  process.exit(1);
});
