import mysql2 from 'mysql2/promise';

const conn = await mysql2.createConnection(process.env.DATABASE_URL);

// system_settingsテーブル作成（minValue/maxValueはTiDBの予約語回避のためバッククォート）
await conn.execute(`
  CREATE TABLE IF NOT EXISTS system_settings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    \`key\` VARCHAR(128) NOT NULL UNIQUE,
    value VARCHAR(512) NOT NULL,
    label VARCHAR(256) NOT NULL,
    description TEXT,
    category VARCHAR(64) NOT NULL DEFAULT 'general',
    unit VARCHAR(32),
    valueType ENUM('integer','float','string','boolean') NOT NULL DEFAULT 'string',
    min_value VARCHAR(32),
    max_value VARCHAR(32),
    updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  )
`);
console.log('Table system_settings created');

// デフォルト設定値を挿入
const defaults = [
  ['gps_internal_interval_sec', '2', 'GPS内部送信間隔', 'タブレットからサーバーへGPS位置情報を送信する間隔（heartbeat）', 'gps', '秒', 'integer', '1', '60'],
  ['gps_external_interval_sec', '10', 'GPS外部送信間隔', '外部バスロケ画面への位置情報反映間隔', 'gps', '秒', 'integer', '5', '120'],
  ['stop_detection_radius_m', '30', '停留所判定距離', 'この距離以内に入ると停留所通過と判定する半径', 'stop', 'm', 'integer', '10', '200'],
  ['early_departure_distance_m', '300', '早発判定開始距離', 'この距離以内に入ったとき早発チェックを開始する距離', 'stop', 'm', 'integer', '50', '1000'],
  ['early_departure_seconds', '20', '早発判定秒数', '次停留所の予定通過時刻のN秒前に到達する場合に早発警告を出す', 'stop', '秒', 'integer', '5', '120'],
  ['gps_high_accuracy', 'true', 'GPS高精度モード', 'GPS取得時に高精度モード（enableHighAccuracy）を使用する', 'gps', '', 'boolean', null, null],
  ['gps_max_age_ms', '5000', 'GPS最大キャッシュ時間', 'GPS位置情報のキャッシュ有効期間（ミリ秒）', 'gps', 'ms', 'integer', '0', '30000'],
  ['heartbeat_offline_retry_sec', '10', 'オフライン時再試行間隔', 'オフライン時にheartbeatを再試行する間隔', 'gps', '秒', 'integer', '5', '60'],
];

for (const [key, value, label, description, category, unit, valueType, minVal, maxVal] of defaults) {
  await conn.execute(
    `INSERT INTO system_settings (\`key\`, value, label, description, category, unit, valueType, min_value, max_value)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE value = VALUES(value)`,
    [key, value, label, description, category, unit, valueType, minVal, maxVal]
  );
}
console.log('Default settings inserted');

const [rows] = await conn.execute('SELECT `key`, value, label, category FROM system_settings ORDER BY category, id');
console.log('Settings:', JSON.stringify(rows, null, 2));

await conn.end();
