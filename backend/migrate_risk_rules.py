import sys
sys.path.insert(0, '.')
from app.database.database import engine
from sqlalchemy import text

conn = engine.connect()

cols_result = conn.execute(text('PRAGMA table_info(risk_rules)')).fetchall()
existing = [r[1] for r in cols_result]
print('Current cols:', existing)

additions = [
    ('name',            'VARCHAR'),
    ('condition_type',  'VARCHAR'),
    ('condition_value', 'FLOAT'),
    ('action_type',     'VARCHAR'),
    ('action_value',    'FLOAT'),
    ('trigger_count',   'INTEGER'),
    ('last_triggered',  'DATETIME'),
    ('created_at',      'DATETIME'),
    ('notes',           'TEXT'),
]

for col, typ in additions:
    if col not in existing:
        conn.execute(text(f'ALTER TABLE risk_rules ADD COLUMN {col} {typ}'))
        conn.commit()
        print(f'Added: {col}')
    else:
        print(f'Skip: {col}')

print('Final cols:', [r[1] for r in conn.execute(text('PRAGMA table_info(risk_rules)')).fetchall()])
conn.close()
print('Migration complete')


