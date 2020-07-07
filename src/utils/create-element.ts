export function createElementFromHTML(htmlString: string) {
  // Remove any html comments
  // https://stackoverflow.com/a/5654032
  const COMMENT_PSEUDO_COMMENT_OR_LT_BANG = new RegExp(
    '<!--[\\s\\S]*?(?:-->)?' +
    '<!---+>?' + // A comment with no body
      '|<!(?![dD][oO][cC][tT][yY][pP][eE]|\\[CDATA\\[)[^>]*>?' +
      '|<[?][^>]*>?', // A pseudo-comment
    'g'
  );

  const div = document.createElement('div');
  div.innerHTML = htmlString
    .trim()
    .replace(COMMENT_PSEUDO_COMMENT_OR_LT_BANG, '');

  return div.firstChild;
}
