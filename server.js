require('dotenv').config();

const { Hono } = require('hono');
const { serve } = require('@hono/node-server');
const { serveStatic } = require('@hono/node-server/serve-static');
const mqtt = require('mqtt');

const app = new Hono();

// ─── MQTT クライアント ───────────────────────────────────────────────────────

const MQTT_PUBLISH_TIMEOUT_MS = 5000;

let mqttClient = null;

const mqttHost = process.env.MQTT_HOST;
const mqttPort = process.env.MQTT_PORT;
const mqttProtocol = process.env.MQTT_PROTOCOL; // 'mqtts' or 'wss'
const mqttUsername = process.env.MQTT_USERNAME;
const mqttPassword = process.env.MQTT_PASSWORD;

if (mqttHost && mqttPort && mqttProtocol) {
  const brokerUrl = `${mqttProtocol}://${mqttHost}:${mqttPort}`;
  mqttClient = mqtt.connect(brokerUrl, {
    username: mqttUsername,
    password: mqttPassword,
  });

  mqttClient.on('connect', () => {
    console.log('[mqtt] connected to', brokerUrl);
    // 接続確立を通知（QoS 0 / retain なし）
    mqttClient.publish('codeengine/connected', JSON.stringify({ type: 'connected' }), (err) => {
      if (err) console.error('[mqtt] failed to publish connected:', err.message);
      else console.log('[mqtt] published codeengine/connected');
    });
  });
  mqttClient.on('reconnect', () => {
    console.log('[mqtt] reconnecting...');
  });
  mqttClient.on('offline', () => {
    console.log('[mqtt] offline');
  });
  // error リスナー未登録だと Node.js の未処理例外でクラッシュするため必須
  mqttClient.on('error', (err) => {
    console.error('[mqtt] error:', err.message);
  });
} else {
  console.warn('[mqtt] MQTT_HOST / MQTT_PORT / MQTT_PROTOCOL が未設定のため MQTT クライアントを起動しません');
}

/**
 * MQTT publish をラップしてタイムアウト付きの Promise を返す。
 * QoS 0 / retain なし（デモ用途につき既定値のまま）。
 */
function mqttPublish(topic, payload) {
  return new Promise((resolve, reject) => {
    if (!mqttClient || !mqttClient.connected) {
      return reject(new Error('mqtt not connected'));
    }
    const timer = setTimeout(() => {
      reject(new Error('timeout'));
    }, MQTT_PUBLISH_TIMEOUT_MS);

    mqttClient.publish(topic, payload, (err) => {
      clearTimeout(timer);
      if (err) reject(err);
      else resolve();
    });
  });
}

// ─── ルーティング ────────────────────────────────────────────────────────────

app.post('/api/led/on', async (c) => {
  try {
    await mqttPublish('codeengine/3d/click/on', JSON.stringify({ type: 'click', value: 'on' }));
    console.log('[api/led/on] published');
    return c.json({ ok: true });
  } catch (err) {
    console.error('[api/led/on]', err.message);
    return c.json({ ok: false, error: err.message }, 500);
  }
});

app.post('/api/led/off', async (c) => {
  try {
    await mqttPublish('codeengine/3d/click/off', JSON.stringify({ type: 'click', value: 'off' }));
    console.log('[api/led/off] published');
    return c.json({ ok: true });
  } catch (err) {
    console.error('[api/led/off]', err.message);
    return c.json({ ok: false, error: err.message }, 500);
  }
});

app.get('/api/hello', (c) => {
  return c.json({ message: 'Hello from Hono!' });
});

app.use('/*', serveStatic({ root: './public' }));

// ─── サーバー起動 ────────────────────────────────────────────────────────────

// IBM Code Engine はコンテナに PORT 環境変数を自動設定するため、必ず process.env.PORT を優先すること
const port = process.env.PORT || 8080;

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`app listening at http://localhost:${info.port}`);
});

// Code Engine がコンテナ停止時に送る SIGTERM を受けて MQTT 接続をクリーンに閉じる
process.on('SIGTERM', () => {
  console.log('[server] SIGTERM received, shutting down...');
  if (mqttClient) mqttClient.end();
  process.exit(0);
});
