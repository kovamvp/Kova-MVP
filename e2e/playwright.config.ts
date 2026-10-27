import { defineConfig, devices } from '@playwright/test'

// Runs the real app locally: FastAPI on in-memory sample data with the fake model, and the Vite dev server.
const py = process.env.KOVA_PYTHON || (process.platform === 'win32' ? '.venv\\Scripts\\python' : '.venv/bin/python')
const chromium = process.env.PW_CHROMIUM // optional pre-installed browser (cloud sandbox)

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 45_000,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:5173',
    viewport: { width: 1440, height: 900 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    ...(chromium ? { launchOptions: { executablePath: chromium } } : {}),
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } }],
  webServer: [
    {
      command: `${py} -m uvicorn api.index:app --port 8000`,
      cwd: '..',
      url: 'http://localhost:8000/api/health',
      env: { KOVA_LLM: 'fake', DATABASE_URL: '', GROQ_API_KEY_AGENT: '', GROQ_API_KEY_SPEECH: '' },
      reuseExistingServer: false,
      timeout: 60_000,
    },
    { command: 'npm run dev -- --port 5173 --strictPort', cwd: '../web', url: 'http://localhost:5173', reuseExistingServer: false, timeout: 60_000 },
  ],
})
