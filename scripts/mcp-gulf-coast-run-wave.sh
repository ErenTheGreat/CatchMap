#!/usr/bin/env bash
# Prepare one wave of Gulf Coast batch SQL for MCP execute_sql.
# Usage: scripts/mcp-gulf-coast-run-wave.sh <wave_number>
set -euo pipefail
DIR="$(cd "$(dirname "$0")/.." && pwd)/.import/mcp_run/gulf_coast"
WAVE="${1:-0}"
PARALLEL=3
node "$DIR/../../scripts/mcp-import-wave.js" --dir "$DIR" --wave "$WAVE" --parallel "$PARALLEL" | node -e "
const fs=require('fs');
let d='';
process.stdin.on('data',c=>d+=c);
process.stdin.on('end',()=>{
  const j=JSON.parse(d);
  if(j.done){console.log(JSON.stringify({done:true,totalFiles:j.totalFiles}));return;}
  for(const p of j.payloads){
    const id=p.file.replace(/\\.sql$/,'').replace('batch_','');
    fs.writeFileSync(process.env.DIR+'/_mcp_query_'+id+'.txt', p.query);
    console.log(id+' '+p.query.length);
  }
  console.log('WAVE '+process.env.WAVE+' FILES '+j.files.join(','));
});
" DIR="$DIR" WAVE="$WAVE"
