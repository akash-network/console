/**
 * Minimal CODEOWNERS matcher implementing the gitignore-style subset GitHub
 * supports (no `!` negation, no `[...]` ranges). Last matching pattern wins;
 * a pattern without owners clears ownership.
 */
function parse(content) {
  const rules = content
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line && !line.startsWith("#"))
    .map(line => {
      const [pattern, ...owners] = line.split(/\s+/);
      return { regex: patternToRegex(pattern), hasOwners: owners.length > 0 };
    });

  return {
    isOwned(filePath) {
      let owned = false;
      for (const rule of rules) {
        if (rule.regex.test(filePath)) {
          owned = rule.hasOwners;
        }
      }
      return owned;
    }
  };
}

function patternToRegex(pattern) {
  const matchesDirContentsOnly = pattern.endsWith("/");
  let body = matchesDirContentsOnly ? pattern.slice(0, -1) : pattern;
  const anchored = body.startsWith("/") || body.includes("/");
  if (body.startsWith("/")) {
    body = body.slice(1);
  }

  const prefix = anchored ? "^" : "^(?:.*/)?";
  const suffix = matchesDirContentsOnly ? "/.+$" : "(?:/.*)?$";
  return new RegExp(prefix + translateGlob(body) + suffix);
}

function translateGlob(body) {
  let source = "";
  let i = 0;
  while (i < body.length) {
    if (body.startsWith("**/", i)) {
      source += "(?:.*/)?";
      i += 3;
    } else if (body.startsWith("**", i)) {
      source += ".*";
      i += 2;
    } else if (body[i] === "*") {
      source += "[^/]*";
      i += 1;
    } else if (body[i] === "?") {
      source += "[^/]";
      i += 1;
    } else {
      source += body[i].replace(/[.+^${}()|[\]\\]/, "\\$&");
      i += 1;
    }
  }
  return source;
}

module.exports = { parse };
