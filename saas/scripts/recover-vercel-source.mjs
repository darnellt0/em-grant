#!/usr/bin/env node
// Recover the source files of a Vercel CLI deployment.
//
// CLI deployments (`vercel --prod` from a working directory) upload their
// source files to Vercel, so the code can be downloaded even if no machine
// still has the working tree. This recovers the June 10, 2026 production
// deployment of the em-grant web app, whose commits were never pushed to
// GitHub.
//
// Usage:
//   VERCEL_TOKEN=xxxx node recover-vercel-source.mjs [deploymentId] [outDir]
//
// Create a token at https://vercel.com/account/tokens (scope: darnellt0's
// projects). Default deployment is the June 10 2026 prod deploy
// ("Multi-agent integration: auto-draft on Pursue, Joy voice polish,
// Angela financials").

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join, normalize } from "node:path";

const token = process.env.VERCEL_TOKEN;
if (!token) {
  console.error("Set VERCEL_TOKEN (create one at https://vercel.com/account/tokens)");
  process.exit(1);
}

const deploymentId = process.argv[2] ?? "dpl_74PK1qxGdiEc8FJ42uJabMntKbAY";
const teamId = "team_RrhHLSvKmgAeJiAxpLnnuRzV";
const outDir = process.argv[3] ?? "recovered-src";

const api = (path) =>
  fetch(`https://api.vercel.com${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

const treeRes = await api(`/v6/deployments/${deploymentId}/files?teamId=${teamId}`);
if (!treeRes.ok) {
  console.error(`Listing files failed: ${treeRes.status} ${await treeRes.text()}`);
  process.exit(1);
}
const tree = await treeRes.json();

const files = [];
function walk(nodes, prefix) {
  for (const n of nodes ?? []) {
    const p = prefix ? `${prefix}/${n.name}` : n.name;
    if (n.type === "directory") walk(n.children, p);
    else if (n.type === "file" && n.uid) files.push({ path: p, uid: n.uid });
  }
}
walk(tree, "");

console.log(`Found ${files.length} source files in ${deploymentId}`);

for (const f of files) {
  const res = await api(`/v7/deployments/${deploymentId}/files/${f.uid}?teamId=${teamId}`);
  if (!res.ok) {
    console.error(`  FAILED ${f.path}: ${res.status}`);
    continue;
  }
  const contentType = res.headers.get("content-type") ?? "";
  let buf;
  if (contentType.includes("application/json")) {
    const body = await res.json();
    buf = Buffer.from(body.data, "base64");
  } else {
    buf = Buffer.from(await res.arrayBuffer());
  }
  const dest = normalize(join(outDir, f.path));
  if (!dest.startsWith(normalize(outDir))) continue; // path traversal guard
  await mkdir(dirname(dest), { recursive: true });
  await writeFile(dest, buf);
  console.log(`  ${dest}`);
}

console.log("\nDone. Compare against saas/apps/web and merge the newer code in.");
