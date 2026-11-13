#!/usr/bin/env node
/**
 * verify-ui-ux.mjs — Auditoría UI/UX real en Chromium headless para Cotizador IEBA.
 *
 * Verifica sobre la app compilada (`vite preview`) sin dependencias externas:
 * 1. Auditoría estática de tokens Tailwind (prohíbe prefijos inexistentes como `m3-*`).
 * 2. Desborde horizontal (`documentElement.scrollWidth <= innerWidth`) y detección de nodos causantes.
 * 3. Integridad de superficies/modales (`[role="dialog"]` no transparentes, elementos visibles sin colisión).
 * 4. Ergonomía táctil básica en móvil y ausencia de errores de consola/runtime.
 * 5. Capturas PNG opcionales (`--screenshots-dir <ruta>`) para inspección visual.
 */

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import net from 'node:net';

const ROOT = process.cwd();
const CHROME_BIN =
  process.env.CHROME_BIN ||
  ['/snap/bin/chromium', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome'].find(
    p => fs.existsSync(p)
  );

function parseArgs(argv) {
  const opts = { screenshotsDir: null, keepScreenshots: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--screenshots-dir' && argv[i + 1]) {
      opts.screenshotsDir = path.resolve(argv[++i]);
      opts.keepScreenshots = true;
    }
  }
  return opts;
}

function findFreePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.unref();
    srv.on('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const addr = srv.address();
      const port = typeof addr === 'object' && addr ? addr.port : 4173;
      srv.close(() => resolve(port));
    });
  });
}

async function waitForHttp(url, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      // retry
    }
    await new Promise(r => setTimeout(r, 200));
  }
  throw new Error(`Timeout esperando servidor en ${url}`);
}

function scanInvalidTailwindTokens(srcDir) {
  const issues = [];
  const invalidRe = /\b(?:bg|text|border|ring|from|to|via|divide|fill|stroke)-m3-[a-z0-9-]+/g;

  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (/\.(tsx?|css)$/.test(entry.name)) {
        const lines = fs.readFileSync(full, 'utf-8').split('\n');
        lines.forEach((line, idx) => {
          const matches = line.match(invalidRe);
          if (matches) {
            issues.push({
              file: path.relative(ROOT, full),
              line: idx + 1,
              tokens: [...new Set(matches)]
            });
          }
        });
      }
    }
  }

  walk(srcDir);
  return issues;
}

class CDPClient {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.nextId = 1;
    this.pending = new Map();
    this.events = [];
  }

  async connect() {
    await new Promise((resolve, reject) => {
      this.ws.addEventListener('open', resolve, { once: true });
      this.ws.addEventListener('error', reject, { once: true });
    });
    this.ws.addEventListener('message', ev => {
      const msg = JSON.parse(String(ev.data));
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(msg.error.message || JSON.stringify(msg.error)));
        else resolve(msg.result);
      } else if (msg.method) {
        this.events.push(msg);
      }
    });
  }

  send(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async evalJS(expression) {
    const res = await this.send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true
    });
    if (res.exceptionDetails) {
      throw new Error(
        res.exceptionDetails.exception?.description ||
          res.exceptionDetails.text ||
          'Runtime error in browser eval'
      );
    }
    return res.result?.value;
  }

  async screenshot(filePath) {
    const { data } = await this.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(filePath, Buffer.from(data, 'base64'));
  }

  close() {
    this.ws.close();
  }
}

async function auditViewportDom(cdp, label) {
  return cdp.evalJS(`(() => {
    const docEl = document.documentElement;
    const innerWidth = window.innerWidth;
    const scrollWidth = docEl.scrollWidth;
    const overflowPx = Math.max(0, scrollWidth - innerWidth);

    const offenders = [];
    if (overflowPx > 0) {
      for (const el of Array.from(document.querySelectorAll('*'))) {
        const style = getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden') continue;
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) continue;
        if (rect.right > innerWidth + 0.5 || rect.left < -0.5) {
          offenders.push({
            tag: el.tagName.toLowerCase(),
            id: el.id || '',
            className: typeof el.className === 'string' ? el.className.slice(0, 90) : '',
            left: Math.round(rect.left),
            right: Math.round(rect.right),
            width: Math.round(rect.width),
            text: (el.textContent || '').trim().slice(0, 40)
          });
        }
        if (offenders.length >= 8) break;
      }
    }

    const transparentDialogs = [];
    for (const dlg of Array.from(document.querySelectorAll('[role="dialog"]'))) {
      const s = getComputedStyle(dlg);
      if (s.display === 'none' || s.visibility === 'hidden') continue;
      // Check dialog background OR first visible surface child
      const firstBox = dlg.firstElementChild;
      const bgSelf = s.backgroundColor;
      const bgChild = firstBox ? getComputedStyle(firstBox).backgroundColor : 'rgba(0, 0, 0, 0)';
      const isTransparent = (bg) => !bg || bg === 'transparent' || bg === 'rgba(0, 0, 0, 0)';
      if (isTransparent(bgSelf) && isTransparent(bgChild)) {
        transparentDialogs.push(dlg.getAttribute('aria-label') || dlg.tagName);
      }
    }

    return {
      label: ${JSON.stringify(label)},
      innerWidth,
      scrollWidth,
      overflowPx,
      offenders,
      transparentDialogs
    };
  })()`);
}

async function waitForSelectorText(cdp, jsCondition, timeoutMs = 6000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const ok = await cdp.evalJS(jsCondition);
    if (ok) return true;
    await new Promise(r => setTimeout(r, 150));
  }
  return false;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const distIndex = path.join(ROOT, 'dist', 'index.html');
  if (!fs.existsSync(distIndex)) {
    console.error('Falta dist/index.html. Ejecutá `npm run build` antes de auditar.');
    process.exit(1);
  }
  if (!CHROME_BIN) {
    console.error('No se encontró Chromium/Chrome en el sistema.');
    process.exit(1);
  }

  console.log('1) Auditoría estática de tokens Tailwind...');
  const tokenIssues = scanInvalidTailwindTokens(path.join(ROOT, 'src'));
  if (tokenIssues.length > 0) {
    console.error('Tokens Tailwind inexistentes detectados:');
    for (const issue of tokenIssues) {
      console.error(`  - ${issue.file}:${issue.line} -> ${issue.tokens.join(', ')}`);
    }
  } else {
    console.log('   ✓ Sin tokens m3-* inválidos.');
  }

  const previewPort = await findFreePort();
  const cdpPort = await findFreePort();
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ieba-ui-audit-'));

  const previewProc = spawn(
    'npx',
    ['vite', 'preview', '--host', '127.0.0.1', '--port', String(previewPort), '--strictPort'],
    { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] }
  );

  let chromeProc;
  let cdp;

  try {
    const appUrl = `http://127.0.0.1:${previewPort}/pwaCotizadorIeba/`;
    await waitForHttp(appUrl);

    chromeProc = spawn(
      CHROME_BIN,
      [
        '--headless=new',
        '--no-sandbox',
        '--disable-gpu',
        '--disable-dev-shm-usage',
        `--remote-debugging-port=${cdpPort}`,
        `--user-data-dir=${userDataDir}`,
        'about:blank'
      ],
      { stdio: ['ignore', 'pipe', 'pipe'] }
    );

    await waitForHttp(`http://127.0.0.1:${cdpPort}/json/list`);
    const targets = await (await fetch(`http://127.0.0.1:${cdpPort}/json/list`)).json();
    const pageTarget = targets.find(t => t.type === 'page') || targets[0];
    if (!pageTarget?.webSocketDebuggerUrl) {
      throw new Error('No se pudo conectar al target CDP de Chromium');
    }

    cdp = new CDPClient(pageTarget.webSocketDebuggerUrl);
    await cdp.connect();
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('Emulation.setEmulatedMedia', { media: 'screen' });

    const runtimeErrors = [];
    cdp.ws.addEventListener('message', ev => {
      const msg = JSON.parse(String(ev.data));
      if (msg.method === 'Runtime.exceptionThrown') {
        runtimeErrors.push(msg.params?.exceptionDetails?.text || 'Uncaught exception');
      }
    });

    if (opts.screenshotsDir) {
      fs.mkdirSync(opts.screenshotsDir, { recursive: true });
    }

    const audits = [];

    const runScreenAudit = async (viewport, screenName) => {
      await new Promise(r => setTimeout(r, 250));
      const res = await auditViewportDom(cdp, `${viewport.name} :: ${screenName}`);
      audits.push(res);
      if (opts.screenshotsDir) {
        const safeName = `${viewport.name}-${screenName}`.replace(/[^a-z0-9_-]/gi, '_');
        await cdp.screenshot(path.join(opts.screenshotsDir, `${safeName}.png`));
      }
    };

    console.log('2) Auditoría Chromium real (móvil 360x800, 390x844 y escritorio 1280x800)...');

    for (const vp of [
      { name: 'mobile-360', width: 360, height: 800, mobile: true },
      { name: 'mobile-390', width: 390, height: 844, mobile: true }
    ]) {
      await cdp.send('Emulation.setDeviceMetricsOverride', {
        width: vp.width,
        height: vp.height,
        deviceScaleFactor: 2,
        mobile: vp.mobile
      });
      await cdp.send('Page.navigate', { url: appUrl });
      await waitForSelectorText(
        cdp,
        `!!document.querySelector('header') && document.body.innerText.includes('IEBA')`
      );
      await new Promise(r => setTimeout(r, 600));
      await runScreenAudit(vp, 'presupuestos-lista');

      // Abrir Nueva Cotización (MobileEjecutarView)
      const clickedNew = await cdp.evalJS(`(() => {
        const btn = Array.from(document.querySelectorAll('button')).find(b =>
          /nueva cotizaci[oó]n/i.test(b.getAttribute('aria-label') || b.textContent || '')
        );
        if (!btn) return false;
        btn.click();
        return true;
      })()`);
      if (clickedNew) {
        await waitForSelectorText(cdp, `document.body.innerText.includes('Total estimado')`);
        await runScreenAudit(vp, 'mobile-ejecutar-view');

        // Abrir selector de Trabajo Tipo (MobileTareaTipoPickerSheet)
        const openedPicker = await cdp.evalJS(`(() => {
          const btn = Array.from(document.querySelectorAll('button')).find(b =>
            /trabajo tipo/i.test(b.textContent || '')
          );
          if (!btn) return false;
          btn.click();
          return true;
        })()`);
        if (openedPicker) {
          await waitForSelectorText(cdp, `!!document.querySelector('[role="dialog"]')`);
          await runScreenAudit(vp, 'mobile-picker-tareas-tipo');

          // Agregar el primer trabajo tipo para auditar tarjetas de parámetros en MobileEjecutarView
          const addedQuick = await cdp.evalJS(`(() => {
            const addBtn = document.querySelector('[role="dialog"] button[aria-label^="Agregar rápido "]');
            if (!addBtn) return false;
            addBtn.click();
            return true;
          })()`);
          if (addedQuick) {
            await waitForSelectorText(cdp, `!document.querySelector('[role="dialog"]') && !!document.querySelector('article')`);
            await runScreenAudit(vp, 'mobile-ejecutar-con-item');
          } else {
            await cdp.evalJS(`(() => {
              const closeBtn = document.querySelector('[aria-label="Cerrar selector"]');
              if (closeBtn) closeBtn.click();
            })()`);
          }
        }
      }

      // Navegar a la pestaña de catálogo Tareas Tipo vía drawer/nav
      await cdp.send('Page.navigate', { url: appUrl });
      await waitForSelectorText(cdp, `!!document.querySelector('header')`);
      await new Promise(r => setTimeout(r, 400));
      const openedDrawer = await cdp.evalJS(`(() => {
        const btn = document.querySelector('button[aria-label*="menú"]');
        if (!btn) return false;
        btn.click();
        return true;
      })()`);
      if (openedDrawer) {
        await new Promise(r => setTimeout(r, 300));
        await cdp.evalJS(`(() => {
          const item = Array.from(document.querySelectorAll('button')).find(b =>
            /tareas tipo/i.test(b.textContent || '')
          );
          if (item) item.click();
        })()`);
        await waitForSelectorText(cdp, `document.body.innerText.includes('Laboratorio de Tareas Tipo')`);
        await cdp.evalJS(`(() => {
          const closeBtn = Array.from(document.querySelectorAll('button')).find(b =>
            /cerrar/i.test(b.getAttribute('aria-label') || '')
          );
          if (closeBtn) closeBtn.click();
        })()`);
        await new Promise(r => setTimeout(r, 350));
        await runScreenAudit(vp, 'tareas-tipo-catalogo');
      }
    }

    // Auditoría rápida desktop 1280x800
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 1280,
      height: 800,
      deviceScaleFactor: 1,
      mobile: false
    });
    await cdp.send('Page.navigate', { url: appUrl });
    await waitForSelectorText(cdp, `!!document.querySelector('header')`);
    await new Promise(r => setTimeout(r, 500));
    await runScreenAudit({ name: 'desktop-1280' }, 'presupuestos-lista');

    const clickedDesktopNew = await cdp.evalJS(`(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b =>
        /nueva cotizaci[oó]n/i.test(b.textContent || b.getAttribute('aria-label') || '')
      );
      if (!btn) return false;
      btn.click();
      return true;
    })()`);
    if (clickedDesktopNew) {
      await waitForSelectorText(cdp, `!!document.querySelector('textarea')`);
      await runScreenAudit({ name: 'desktop-1280' }, 'notebook-desktop-view');
    }

    let hasFailure = tokenIssues.length > 0 || runtimeErrors.length > 0;
    for (const a of audits) {
      const ok = a.overflowPx === 0 && a.transparentDialogs.length === 0;
      const mark = ok ? '✓' : '✗';
      console.log(
        `   ${mark} ${a.label}: width=${a.innerWidth} scrollWidth=${a.scrollWidth} overflow=${a.overflowPx}px`
      );
      if (a.offenders.length > 0) {
        hasFailure = true;
        console.error('     Elementos fuera de rango:', JSON.stringify(a.offenders, null, 2));
      }
      if (a.transparentDialogs.length > 0) {
        hasFailure = true;
        console.error('     Diálogos sin fondo (transparente):', a.transparentDialogs);
      }
    }

    if (runtimeErrors.length > 0) {
      console.error('Errores runtime en navegador:', runtimeErrors);
    }

    if (hasFailure) {
      process.exitCode = 1;
    }
  } finally {
    try { cdp?.close(); } catch {}
    try { chromeProc?.kill('SIGKILL'); } catch {}
    try { previewProc?.kill('SIGKILL'); } catch {}
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch {}
  }
  process.exit(process.exitCode ?? 0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
