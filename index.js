const majo = require('majo');
const unified = require('unified');
const parse = require('remark-parse');
const stringify = require('remark-stringify');

const yamlConfig = require('remark-yaml-config');
const frontmatter = require('remark-frontmatter');

const remarkWithYaml = unified()
  .use(parse)
  .use(stringify, {
    paddedTable: false,
    listItemIndent: 1,
  })
  .use(frontmatter)
  .use(yamlConfig);

const stream = majo();

function getCellValue(node) {
  return node.children[0].children[0].value;
}

// from small to large
const sizeBreakPoints = ['xs', 'sm', 'md', 'lg', 'xl'];

const groups = {
  isDynamic: val => /^on[A-Z]/.test(val),
  isSize: val => sizeBreakPoints.indexOf(val) > -1,
};

function asciiSort(prev, next) {
  if (prev > next) {
    return 1;
  }

  if (prev < next) {
    return -1;
  }

  return 0;
}

// follow the alphabet order
function alphabetSort(nodes) {
  // use toLowerCase to keep `case insensitive`
  return nodes.sort((...comparison) => asciiSort(...comparison.map(val => getCellValue(val).toLowerCase())));
}

function sizeSort(nodes) {
  return nodes.sort((...comparison) => asciiSort(...comparison.map(val => sizeBreakPoints.indexOf(getCellValue(val).toLowerCase()))));
}

function isIgnorePattern(node) {
  if (!node) {
    return false;
  }

  const { type, children = [] } = node;
  const childNode = children[0];
  if (type === 'paragraph' && childNode.value === '@sorter-ignore') {
    return true;
  } else {
    return false;
  }
}

function sort(ast) {
  ast.children = ast.children.reduce((acc, child, index, children) => {
    const staticProps = [];
    // prefix with `on`
    const dynamicProps = [];
    // one of ['xs', 'sm', 'md', 'lg', 'xl']
    const sizeProps = [];

    if (isIgnorePattern(child)) {
      return acc;
    }

    // find table markdown type
    if (child.type === 'table' && !isIgnorePattern(children[index - 1])) {
      // slice will create new array, so sort can affect the original array.
      // slice(1) cut down the thead
      child.children.slice(1).forEach((node) => {
        const value = getCellValue(node);
        if (groups.isDynamic(value)) {
          dynamicProps.push(node);
        } else if (groups.isSize(value)) {
          sizeProps.push(node);
        } else {
          staticProps.push(node);
        }
      });

      child.children = [
        child.children[0],
        ...alphabetSort(staticProps),
        ...sizeSort(sizeProps),
        ...alphabetSort(dynamicProps),
      ];
    }

    acc.push(child);

    return acc;
  }, []);

  return ast;
}

function sortAPI(md) {
  return remarkWithYaml.stringify(sort(remarkWithYaml.parse(md)));
}

function sortMiddleware(ctx) {
  Object.keys(ctx.files).forEach((filename) => {
    const content = ctx.fileContents(filename);
    ctx.writeContents(filename, sortAPI(content));
  });
}

// Get the markdown file all need to be transformed
const apiSorter = ({ file, dest = '.' } = {}) => stream
  .source(file)
  .use(sortMiddleware)
  .dest(dest);

apiSorter.sort = sort;

module.exports = apiSorter;
