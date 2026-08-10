#!/usr/bin/env python3
"""
sync_grants_to_supabase.py — mirror the grant-app SQLite into Supabase app_* tables.

Runs ON THE LAPTOP (where the DB and Supabase credentials live). Feeds the
Phase A cloud read view (grant-view-api edge function + Cloudflare Pages SPA).

Reads:
  ~/.openclaw/workspace/vault/grants/grants.db          (read-only)
  ~/.openclaw/workspace/vault/grants/grant_lessons.md
  ~/.openclaw/credentials/em-grant-supabase.env         (SUPABASE_URL, SUPABASE_SERVICE_KEY)

Writes (Supabase REST, service role):
  app_grants, app_discovery_runs  — upsert on id, then delete rows whose
                                    sync_seq predates this run (local deletions)
  app_meta                        — lessons_md, synced_at, row counts

Cron (hourly, on the laptop):
  17 * * * * /usr/bin/python3 /home/evergreen/.openclaw/workspace/grant-app/sync_grants_to_supabase.py >> /tmp/grant-cloud-sync.log 2>&1

No output on success beyond one summary line. Non-zero exit on failure.
"""
import json
import os
import sqlite3
import sys
import time
import urllib.request
import urllib.error

BASE = os.path.expanduser('~/.openclaw/workspace/vault/grants')
DB_PATH = os.path.join(BASE, 'grants.db')
LESSONS_PATH = os.path.join(BASE, 'grant_lessons.md')
CREDS_PATH = os.path.expanduser('~/.openclaw/credentials/em-grant-supabase.env')
BATCH = 200


def load_creds():
    vals = {}
    with open(CREDS_PATH, encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                k, v = line.split('=', 1)
                vals[k.strip()] = v.strip().strip('"').strip("'")
    url = vals.get('SUPABASE_URL', '').rstrip('/')
    key = vals.get('SUPABASE_SERVICE_KEY', '')
    if not url or not key:
        sys.exit('missing SUPABASE_URL / SUPABASE_SERVICE_KEY in ' + CREDS_PATH)
    return url, key


def rest(url, key, method, path, payload=None, prefer=None):
    req = urllib.request.Request(url + '/rest/v1/' + path, method=method)
    req.add_header('apikey', key)
    req.add_header('Authorization', 'Bearer ' + key)
    req.add_header('Content-Type', 'application/json')
    if prefer:
        req.add_header('Prefer', prefer)
    data = json.dumps(payload).encode() if payload is not None else None
    try:
        with urllib.request.urlopen(req, data=data, timeout=60) as r:
            return r.status
    except urllib.error.HTTPError as e:
        sys.exit(f'{method} {path} -> HTTP {e.code}: {e.read()[:300]}')


def main():
    url, key = load_creds()
    seq = int(time.time())

    con = sqlite3.connect('file:' + DB_PATH + '?mode=ro', uri=True)
    con.row_factory = sqlite3.Row
    grants = [dict(r) for r in con.execute('select * from grants')]
    runs = [dict(r) for r in con.execute('select * from discovery_runs')]
    lessons = ''
    if os.path.exists(LESSONS_PATH):
        with open(LESSONS_PATH, encoding='utf-8') as f:
            lessons = f.read()

    for table, rows in (('app_grants', grants), ('app_discovery_runs', runs)):
        for row in rows:
            row['sync_seq'] = seq
        for i in range(0, len(rows), BATCH):
            rest(url, key, 'POST', table + '?on_conflict=id',
                 rows[i:i + BATCH], prefer='resolution=merge-duplicates')
        # rows not touched this run were deleted locally
        rest(url, key, 'DELETE', f'{table}?sync_seq=lt.{seq}')

    now_utc = time.strftime('%Y-%m-%d %H:%M:%S UTC', time.gmtime())
    meta = [
        {'key': 'lessons_md', 'value': lessons},
        {'key': 'synced_at', 'value': now_utc},
        {'key': 'grant_count', 'value': str(len(grants))},
        {'key': 'run_count', 'value': str(len(runs))},
    ]
    rest(url, key, 'POST', 'app_meta?on_conflict=key', meta,
         prefer='resolution=merge-duplicates')

    print(f'synced {len(grants)} grants, {len(runs)} runs, '
          f'lessons {len(lessons)} chars at {now_utc} (seq {seq})')


if __name__ == '__main__':
    main()
