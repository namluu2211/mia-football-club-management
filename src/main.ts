import { bootstrapApplication } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { AppComponent } from './app/app.component';
import { appRoutes } from './app/app.routes';
import { environment } from './environments/environment';
import { silenceConsoleInProduction } from './app/utils/console-silencer';

silenceConsoleInProduction(environment.production);

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch] as string));
}

function showBootstrapError(err: unknown): void {
  const message = err instanceof Error ? err.message : String(err);
  document.body.innerHTML = `
    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;
                background:linear-gradient(135deg,#ef4444 0%,#dc2626 100%);color:#fff;
                font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;text-align:center;padding:20px;">
      <h1>⚠️ Application Bootstrap Failed</h1>
      <div style="background:rgba(0,0,0,.2);padding:20px;border-radius:8px;margin:20px 0;max-width:600px;">
        <h3>Error Details:</h3>
        <pre style="text-align:left;overflow-x:auto;font-size:14px;">${escapeHtml(message)}</pre>
      </div>
      <p>Please check the browser console for more details.</p>
      <button onclick="location.reload()" style="background:#fff;color:#dc2626;border:none;padding:12px 24px;
              border-radius:6px;font-weight:600;cursor:pointer;margin-top:20px;">Reload Application</button>
    </div>`;
}

bootstrapApplication(AppComponent, { providers: [provideRouter(appRoutes)] })
  .then(() => document.querySelector('.app-loading')?.remove())
  .catch(err => {
    console.error('❌ Bootstrap error:', err);
    showBootstrapError(err);
  });