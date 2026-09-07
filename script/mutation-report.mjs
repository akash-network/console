import { readFileSync } from "node:fs";

const [reportPath, ...flags] = process.argv.slice(2);
const minScore = Number(flags[flags.indexOf("--min") + 1] ?? 0);
const reproduceCommand = flags.includes("--reproduce") ? flags[flags.indexOf("--reproduce") + 1] : null;

if (!reportPath) {
  process.stderr.write("usage: node script/mutation-report.mjs <stryker-report.json> --min <score> [--reproduce <command>]\n");
  process.exit(2);
}

const MAX_SURVIVOR_ROWS = 50;
const KILLED = ["Killed", "Timeout"];
const UNREACHED = ["NoCoverage", "Ignored", "CompileError", "RuntimeError"];

const mutants = readMutants(reportPath);
const killed = mutants.filter(({ status }) => KILLED.includes(status));
const survived = mutants.filter(({ status }) => !KILLED.includes(status) && !UNREACHED.includes(status));
const unreached = mutants.filter(({ status }) => UNREACHED.includes(status));
const reached = killed.length + survived.length;
/** Scored over reached mutants only: an untested file has nothing to say about test quality, and coverage is measured elsewhere. */
const score = reached === 0 ? null : (killed.length / reached) * 100;

process.stdout.write(summary());
process.exit(score !== null && score < minScore ? 1 : 0);

function readMutants(path) {
  let report;

  try {
    report = JSON.parse(readFileSync(path, "utf8"));
  } catch {
    process.stdout.write("Stryker produced no report; see the step log.\n");
    process.exit(1);
  }

  return Object.entries(report.files ?? {}).flatMap(([file, { mutants = [] }]) => mutants.map(mutant => ({ ...mutant, file })));
}

function summary() {
  const lines = [
    score === null
      ? `No mutant on the changed lines was reached by a unit test, so there is no score to judge. ${mutants.length} mutant(s) were generated.`
      : `Mutation score **${score.toFixed(1)}%** over ${reached} reached mutant(s) — ${killed.length} killed, ${survived.length} survived. Minimum is ${minScore}%.`
  ];

  if (survived.length > 0) {
    lines.push("", "| survivor | mutator | replacement |", "| --- | --- | --- |");
    lines.push(
      ...survived
        .slice(0, MAX_SURVIVOR_ROWS)
        .map(({ file, location, mutatorName, replacement }) => `| \`${file}:${location.start.line}\` | ${mutatorName} | ${replacementCell(replacement)} |`)
    );

    if (survived.length > MAX_SURVIVOR_ROWS) lines.push(`| _and ${survived.length - MAX_SURVIVOR_ROWS} more_ | | |`);
  }

  if (unreached.length > 0) {
    lines.push("", `${unreached.length} mutant(s) were never reached by a unit test and do not count towards the score: ${fileList(unreached)}.`);
  }

  if (survived.length > 0 && reproduceCommand) {
    lines.push("", "Reproduce with:", "", "```", reproduceCommand, "```");
  }

  return `${lines.join("\n")}\n`;
}

function fileList(mutants) {
  const files = [...new Set(mutants.map(({ file }) => file))];

  return (
    files
      .slice(0, 10)
      .map(file => `\`${file}\``)
      .join(", ") + (files.length > 10 ? ` and ${files.length - 10} more` : "")
  );
}

/** An HTML code element keeps the raw replacement intact where a markdown code span cannot: backticks stay literal and the entity keeps a pipe from ending the cell. */
function replacementCell(replacement) {
  return `<code>${truncate(replacement).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\|/g, "&#124;")}</code>`;
}

function truncate(replacement = "") {
  const singleLine = replacement.replace(/\s+/g, " ");

  return singleLine.length > 80 ? `${singleLine.slice(0, 77)}...` : singleLine;
}
