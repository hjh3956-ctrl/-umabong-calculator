import {spawnSync} from 'node:child_process';
const files=['validate.mjs','validate-recommendation.mjs','validate-auto-traits.mjs','validate-photo-view.mjs','validate-partial-input.mjs','validate-photo-balance.mjs','validate-strategy.mjs','validate-interface.mjs'];
for(const file of files){const r=spawnSync(process.execPath,[new URL(file,import.meta.url).pathname],{stdio:'inherit'});if(r.status!==0)process.exit(r.status||1);}
console.log('All portable checks passed. Browser rendering and unavailable source photo fixtures are not included.');
