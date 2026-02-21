const { app, safeStorage } = require('electron');
const fs = require('fs');
const path = require('path');
const https = require('https');

function decryptStoredToken(value) {
  if (typeof value !== 'string' || !value) return null;
  if (value.startsWith('v1:')) {
    const buf = Buffer.from(value.slice(3), 'base64');
    return safeStorage.decryptString(buf);
  }
  if (value.startsWith('plain:')) return value.slice(6);
  return value;
}

function request(url, token) {
  return new Promise((resolve) => {
    const req = https.request(
      url,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => resolve({ status: res.statusCode, body: data }));
      }
    );
    req.on('error', (err) => resolve({ status: 0, body: String(err) }));
    req.end();
  });
}

app.whenReady().then(async () => {
  try {
    const cfgPath = path.join(process.env.APPDATA || '', 'sgm-desktop', 'config.json');
    const cfgRaw = fs.readFileSync(cfgPath, 'utf8');
    const cfg = JSON.parse(cfgRaw);
    const token = decryptStoredToken(cfg.token);
    if (!token) {
      console.log('NO_TOKEN');
      app.quit();
      return;
    }

    const url = 'https://sgm-api-bq.duckdns.org/tramites/cmlv5m5tk000d1hsc1sjsp0t3/payments';
    const out = await request(url, token);
    console.log(`STATUS=${out.status}`);
    console.log(out.body);
  } catch (e) {
    console.log('SCRIPT_ERROR');
    console.log(String(e && e.stack ? e.stack : e));
  } finally {
    app.quit();
  }
});
