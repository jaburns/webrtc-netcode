import { nodeResolve } from '@rollup/plugin-node-resolve';

export default {
  input: 'tsbuild/client/index.js',
  output: {
    file: 'client-build/bundle.js',
    format: 'iife',
    name: 'x',
  },
  plugins: [nodeResolve()]
}
