#!/usr/bin/env node
import path from 'path'
import { fileURLToPath } from 'url'
import sh from 'shelljs'
process.chdir(path.dirname(fileURLToPath(import.meta.url)))

const run = cmd => {
    console.log('==>', cmd)
    const result = sh.exec(cmd)
    if (result.code !== 0) {
        process.exit(result.code)
    }
}

run('npx eslint --fix src')
run('npx tsc')
run('npx rollup --config rollup.config.js')
run('node tsbuild/server/index.js')
