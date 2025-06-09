const typescript = require('rollup-plugin-typescript2');

module.exports = {
  input: 'main.ts',
  output: {
    dir: '.',
    sourcemap: 'inline',
    format: 'cjs',
    exports: 'default'
  },
  external: ['obsidian'],
  plugins: [
    typescript({
      typescript: require('typescript')
    })
  ]
};

