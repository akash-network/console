const bip39 = require("bip39");

const MNEMONIC_WORD_COUNTS = [12, 24];
const englishWordlist = new Set(bip39.wordlists.english);

const messages = {
  MNEMONIC_FOUND: {
    en: () =>
      "Hardcoded mnemonic phrase detected. " +
      "Don't hardcode mnemonic phrases because it's impossible to distinguish whether it's production or test mnemonic. " +
      "Use generated mnemonic for test purposes and hide production mnemonic in secret store."
  }
};

function isSeparatedOnlyByWhitespace(content, previousWord, word) {
  if (!previousWord) {
    return true;
  }
  const gap = content.slice(previousWord.index + previousWord[0].length, word.index);
  return /^\s*$/.test(gap);
}

function findMnemonics(content) {
  const mnemonics = [];
  let wordlistRun = [];

  const closeRun = () => {
    const phrase = wordlistRun.map(word => word[0]).join(" ");
    if (MNEMONIC_WORD_COUNTS.includes(wordlistRun.length) && bip39.validateMnemonic(phrase)) {
      const firstWord = wordlistRun[0];
      const lastWord = wordlistRun[wordlistRun.length - 1];
      mnemonics.push({
        phrase,
        start: firstWord.index,
        end: lastWord.index + lastWord[0].length
      });
    }
    wordlistRun = [];
  };

  for (const word of content.matchAll(/[A-Za-z]+/g)) {
    if (!isSeparatedOnlyByWhitespace(content, wordlistRun[wordlistRun.length - 1], word)) {
      closeRun();
    }
    if (englishWordlist.has(word[0])) {
      wordlistRun.push(word);
    } else {
      closeRun();
    }
  }
  closeRun();

  return mnemonics;
}

const creator = {
  messages,
  meta: {
    id: "secretlint-rule-akash-no-mnemonic",
    recommended: true,
    type: "scanner",
    supportedContentTypes: ["text"],
    docs: {
      url: "https://github.com/akash-network/console"
    }
  },
  create(context, options) {
    const t = context.createTranslator(messages);
    const allows = options.allows ?? [];
    return {
      file(source) {
        for (const mnemonic of findMnemonics(source.content)) {
          if (allows.includes(mnemonic.phrase)) {
            continue;
          }
          context.report({
            message: t("MNEMONIC_FOUND"),
            range: [mnemonic.start, mnemonic.end]
          });
        }
      }
    };
  }
};

module.exports = { creator };
