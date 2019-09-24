const program = require('commander');
const sortAPI = require('../index');

program
  .version('0.1.0')
  .option(
    '-f, --file [file]',
    'Specify which file to be transformed',
    // default value
    'components/**/index.+(zh-CN|en-US).md'
  )
  .parse(process.argv);

sortAPI(program);
