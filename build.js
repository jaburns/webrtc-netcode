#!/usr/bin/env node
import cproc from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'
process.chdir(path.dirname(fileURLToPath(import.meta.url)))

const run = (commandArgs) => {
    console.log('==>', commandArgs.join(' '))
    const task = cproc.spawnSync(commandArgs[0], commandArgs.slice(1), {
        stdio: 'inherit',
        shell: process.platform === 'win32',
    })
    if (task.status !== 0) {
        process.exit(task.status || 1)
    }
}

run(['npx', 'tsc'])
run(['npx', 'rollup', '--config', 'rollup.config.js'])
run(['node', 'tsbuild/server/index.js'])
