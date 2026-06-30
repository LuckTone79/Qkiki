import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const root = process.cwd();
const srcRoot = path.join(root, "src");
const cachePath = path.join(root, "scripts", "i18n-translation-cache.json");
const generatedPath = path.join(srcRoot, "lib", "i18n-translations.ts");
const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });

const SKIP_VALUES = new Set([
  "",
  "en",
  "ko",
  "ja",
  "es",
  "en-US",
  "ko-KR",
  "ja-JP",
  "es-ES",
  "B",
  "KB",
  "MB",
  "GB",
  "GPT",
  "Claude",
  "Gemini",
  "Grok",
  "Yapp",
  "API",
  "JSON",
  "PDF",
  "Word",
]);

const MANUAL_OVERRIDES = {
  English: { ja: "英語", es: "Inglés" },
  Korean: { ja: "韓国語", es: "Coreano" },
  Japanese: { ja: "日本語", es: "Japonés" },
  Spanish: { ja: "スペイン語", es: "Español" },
  "English, Korean, Japanese & Spanish (switchable anytime)": {
    ja: "英語、韓国語、日本語、スペイン語（いつでも切り替え可能）",
    es: "Inglés, coreano, japonés y español (se puede cambiar en cualquier momento)",
  },
  Close: { ja: "閉じる", es: "Cerrar" },
  Run: { ja: "実行", es: "Ejecutar" },
  "▶ Run": { ja: "▶ 実行", es: "▶ Ejecutar" },
  "Loading...": { ja: "読み込み中...", es: "Cargando..." },
  "Saving...": { ja: "保存中...", es: "Guardando..." },
  "Saving…": { ja: "保存中…", es: "Guardando…" },
  "Uploading...": { ja: "アップロード中...", es: "Subiendo..." },
  "Submitting...": { ja: "送信中...", es: "Enviando..." },
  "Sending...": { ja: "送信中...", es: "Enviando..." },
  "Sharing...": { ja: "共有中...", es: "Compartiendo..." },
  "Stopping...": { ja: "停止中...", es: "Deteniendo..." },
  "Recent work": { ja: "最近の作業", es: "Trabajo reciente" },
  Workbench: { ja: "ワークベンチ", es: "Espacio de trabajo" },
  "New workbench": { ja: "新しいワークベンチ", es: "Nuevo espacio de trabajo" },
  "Orchestration Workbench": { ja: "オーケストレーション・ワークベンチ", es: "Espacio de orquestación" },
  "Yapp Orchestration Workbench": { ja: "Yapp オーケストレーション・ワークベンチ", es: "Espacio de orquestación de Yapp" },
  "New to Yapp?": { ja: "Yapp は初めてですか？", es: "¿Primera vez en Yapp?" },
  "Yapp runs one task through multiple models, compares their answers, and lets every result become the source for a next review, critique, improvement, or summary.": {
    ja: "Yapp は1つのタスクを複数のモデルで実行し、回答を比較し、各結果を次のレビュー、批評、改善、要約の入力として利用できます。",
    es: "Yapp ejecuta una tarea en varios modelos, compara sus respuestas y permite usar cada resultado como punto de partida para la siguiente revisión, crítica, mejora o resumen.",
  },
  Presets: { ja: "プリセット", es: "Ajustes preestablecidos" },
  Feedback: { ja: "フィードバック", es: "Comentarios" },
  "Sign out": { ja: "サインアウト", es: "Cerrar sesión" },
  "Final only": { ja: "最終結果のみ", es: "Solo finales" },
  "Branches only": { ja: "分岐のみ", es: "Solo ramas" },
  "Failed first": { ja: "失敗を優先", es: "Fallidos primero" },
};

function sourceFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(fullPath);
    return /\.(?:ts|tsx)$/.test(entry.name) && !entry.name.endsWith(".test.mjs")
      ? [fullPath]
      : [];
  });
}

function parse(filePath) {
  const source = fs.readFileSync(filePath, "utf8");
  const sourceFile = ts.createSourceFile(
    filePath,
    source,
    ts.ScriptTarget.Latest,
    true,
    filePath.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  return { source, sourceFile };
}

function unwrapExpression(node) {
  return ts.isAsExpression(node) || ts.isSatisfiesExpression(node)
    ? unwrapExpression(node.expression)
    : node;
}

function propertyName(node, sourceFile) {
  return node.name?.getText(sourceFile).replace(/^['"]|['"]$/g, "") ?? "";
}

function findNamedObject(sourceFile, variableName, objectKey) {
  let result = null;
  sourceFile.forEachChild((node) => {
    if (!ts.isVariableStatement(node)) return;
    for (const declaration of node.declarationList.declarations) {
      if (declaration.name.getText(sourceFile) !== variableName || !declaration.initializer) {
        continue;
      }
      const object = unwrapExpression(declaration.initializer);
      if (!ts.isObjectLiteralExpression(object)) continue;
      const property = object.properties.find(
        (candidate) => propertyName(candidate, sourceFile) === objectKey,
      );
      if (property && ts.isPropertyAssignment(property)) {
        result = unwrapExpression(property.initializer);
      }
    }
  });
  return result;
}

function languageCondition(node, sourceFile) {
  if (!ts.isConditionalExpression(node)) {
    return null;
  }
  if (ts.isIdentifier(node.condition) && node.condition.text === "ko") {
    return "language";
  }
  if (!ts.isBinaryExpression(node.condition)) return null;
  const condition = node.condition;
  if (
    condition.operatorToken.kind !== ts.SyntaxKind.EqualsEqualsEqualsToken &&
    condition.operatorToken.kind !== ts.SyntaxKind.EqualsEqualsToken
  ) {
    return null;
  }
  if (ts.isStringLiteral(condition.right) && condition.right.text === "ko") {
    return condition.left.getText(sourceFile);
  }
  if (ts.isStringLiteral(condition.left) && condition.left.text === "ko") {
    return condition.right.getText(sourceFile);
  }
  return null;
}

function shouldTranslate(value) {
  if (SKIP_VALUES.has(value) || !/[A-Za-z]/.test(value)) return false;
  if (/^[A-Z0-9_]+$/.test(value)) return false;
  if (/^(?:https?:|\/|#)/.test(value)) return false;
  if (/^[a-z0-9_-]+\.[a-z0-9_.-]+$/i.test(value)) return false;
  if (/^[\w-]+\/[\w+.-]+$/.test(value)) return false;
  if (/^(?:flex|grid|block|hidden|absolute|relative|fixed|sticky)(?:\s|$)/.test(value)) {
    return false;
  }
  return true;
}

function collectStrings(node, output, sourceFile, parentKey = "") {
  if (!node) return;
  if (
    (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) &&
    !["icon", "num", "href", "key"].includes(parentKey) &&
    shouldTranslate(node.text)
  ) {
    output.add(node.text);
  }
  if (ts.isTemplateExpression(node)) {
    if (shouldTranslate(node.head.text)) output.add(node.head.text);
    for (const span of node.templateSpans) {
      collectStrings(span.expression, output, sourceFile, parentKey);
      if (shouldTranslate(span.literal.text)) output.add(span.literal.text);
    }
    return;
  }
  if (ts.isPropertyAssignment(node)) {
    collectStrings(node.initializer, output, sourceFile, propertyName(node, sourceFile));
    return;
  }
  ts.forEachChild(node, (child) => collectStrings(child, output, sourceFile, parentKey));
}

function collectConditionalStrings(sourceFile, output) {
  function visit(node) {
    if (languageCondition(node, sourceFile)) {
      collectStrings(node.whenFalse, output, sourceFile);
      return;
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
}

function twoLanguageObject(node, sourceFile) {
  if (!ts.isObjectLiteralExpression(node)) return null;
  const properties = Object.fromEntries(
    node.properties
      .filter(ts.isPropertyAssignment)
      .map((property) => [propertyName(property, sourceFile), property.initializer]),
  );
  const keys = Object.keys(properties);
  return keys.length === 2 && properties.en && properties.ko ? properties : null;
}

function collectTwoLanguageObjectStrings(sourceFile, output) {
  function visit(node) {
    const properties = twoLanguageObject(node, sourceFile);
    if (properties) {
      collectStrings(properties.en, output, sourceFile);
      return;
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
}

async function translate(value, language, attempt = 0) {
  const url = new URL("https://translate.googleapis.com/translate_a/single");
  url.searchParams.set("client", "gtx");
  url.searchParams.set("sl", "en");
  url.searchParams.set("tl", language);
  url.searchParams.set("dt", "t");
  url.searchParams.set("q", value);
  const response = await fetch(url, { signal: AbortSignal.timeout(20_000) });
  if (!response.ok) {
    if (attempt < 3) {
      await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** attempt));
      return translate(value, language, attempt + 1);
    }
    throw new Error(`Translation failed (${response.status}) for ${value}`);
  }
  const payload = await response.json();
  return payload[0].map((segment) => segment[0]).join("");
}

async function buildCache(values) {
  const cache = fs.existsSync(cachePath)
    ? JSON.parse(fs.readFileSync(cachePath, "utf8"))
    : {};
  const pending = [...values].filter((value) => !cache[value]?.ja || !cache[value]?.es);
  let cursor = 0;
  async function worker() {
    while (cursor < pending.length) {
      const index = cursor++;
      const value = pending[index];
      cache[value] = {
        ja: await translate(value, "ja"),
        es: await translate(value, "es"),
      };
      if ((index + 1) % 25 === 0 || index + 1 === pending.length) {
        console.log(`translated ${index + 1}/${pending.length}`);
      }
    }
  }
  await Promise.all(Array.from({ length: 6 }, () => worker()));
  Object.assign(cache, MANUAL_OVERRIDES);
  const sorted = Object.fromEntries(
    Object.entries(cache).sort(([left], [right]) => left.localeCompare(right)),
  );
  fs.writeFileSync(cachePath, `${JSON.stringify(sorted, null, 2)}\n`);
  return sorted;
}

function createGeneratedCatalog(cache) {
  const entries = Object.entries(cache)
    .map(
      ([english, translations]) =>
        `  ${JSON.stringify(english)}: { ja: ${JSON.stringify(translations.ja)}, es: ${JSON.stringify(translations.es)} },`,
    )
    .join("\n");
  fs.writeFileSync(
    generatedPath,
    `// Generated by scripts/localize-ja-es.mjs.\nexport const UI_TRANSLATIONS = {\n${entries}\n} as const;\n`,
  );
}

function translatedExpression(node, language, cache, sourceFile) {
  const transformer = () => {
    const visit = (current) => {
      if (ts.isStringLiteral(current) && cache[current.text]?.[language]) {
        return ts.factory.createStringLiteral(cache[current.text][language]);
      }
      if (ts.isNoSubstitutionTemplateLiteral(current) && cache[current.text]?.[language]) {
        return ts.factory.createNoSubstitutionTemplateLiteral(cache[current.text][language]);
      }
      if (ts.isTemplateExpression(current)) {
        const head = cache[current.head.text]?.[language] ?? current.head.text;
        const spans = current.templateSpans.map((span, index) => {
          const text = cache[span.literal.text]?.[language] ?? span.literal.text;
          const literal = index === current.templateSpans.length - 1
            ? ts.factory.createTemplateTail(text)
            : ts.factory.createTemplateMiddle(text);
          return ts.factory.createTemplateSpan(ts.visitNode(span.expression, visit), literal);
        });
        return ts.factory.createTemplateExpression(ts.factory.createTemplateHead(head), spans);
      }
      if (ts.isConditionalExpression(current)) {
        return ts.factory.createConditionalExpression(
          current.condition,
          current.questionToken,
          ts.visitNode(current.whenTrue, visit),
          current.colonToken,
          ts.visitNode(current.whenFalse, visit),
        );
      }
      if (
        ts.isBinaryExpression(current) &&
        current.operatorToken.kind === ts.SyntaxKind.PlusToken
      ) {
        return ts.factory.createBinaryExpression(
          ts.visitNode(current.left, visit),
          current.operatorToken,
          ts.visitNode(current.right, visit),
        );
      }
      if (ts.isParenthesizedExpression(current)) {
        return ts.factory.createParenthesizedExpression(
          ts.visitNode(current.expression, visit),
        );
      }
      if (ts.isArrayLiteralExpression(current)) {
        return ts.factory.createArrayLiteralExpression(
          current.elements.map((element) => ts.visitNode(element, visit)),
        );
      }
      return current;
    };
    return (rootNode) => ts.visitNode(rootNode, visit);
  };
  const result = ts.transform(node, [transformer]);
  const transformed = result.transformed[0];
  const text = printer.printNode(ts.EmitHint.Expression, transformed, sourceFile);
  result.dispose();
  return text;
}

function ensureLocalizeImport(source) {
  if (!source.includes("localize(")) return source;
  if (/import\s*\{[^}]*\blocalize\b[^}]*\}\s*from\s*["'][^"']*i18n(?:\.ts)?["']/.test(source)) {
    return source;
  }
  const importLine = 'import { localize } from "@/lib/i18n";\n';
  return source.startsWith('"use client";')
    ? source.replace(/"use client";\r?\n/, (match) => `${match}\n${importLine}`)
    : `${importLine}${source}`;
}

function ensureNamedI18nImport(source, importedName) {
  const existingPattern = new RegExp(
    `import\\s*\\{[^}]*\\b${importedName}\\b[^}]*\\}\\s*from\\s*["'][^"']*i18n(?:\\.ts)?["']`,
  );
  if (existingPattern.test(source)) return source;
  const importLine = `import { ${importedName} } from "@/lib/i18n";\n`;
  return source.startsWith('"use client";')
    ? source.replace(/"use client";\r?\n/, (match) => `${match}\n${importLine}`)
    : `${importLine}${source}`;
}

function transformTwoLanguageObjects(filePath) {
  const { source, sourceFile } = parse(filePath);
  const replacements = [];
  function visit(node) {
    if (twoLanguageObject(node, sourceFile)) {
      if (
        ts.isCallExpression(node.parent) &&
        node.parent.expression.getText(sourceFile) === "withAdditionalLanguages"
      ) {
        return;
      }
      replacements.push({
        start: node.getStart(sourceFile),
        end: node.getEnd(),
        value: `withAdditionalLanguages(${node.getText(sourceFile)})`,
      });
      return;
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  if (!replacements.length) return;
  let next = source;
  for (const replacement of replacements.sort((left, right) => right.start - left.start)) {
    next = next.slice(0, replacement.start) + replacement.value + next.slice(replacement.end);
  }
  next = ensureNamedI18nImport(next, "withAdditionalLanguages");
  fs.writeFileSync(filePath, next);
}

function collapseNestedLanguageHelpers(filePath) {
  const { source, sourceFile } = parse(filePath);
  const replacements = [];
  function visit(node) {
    if (
      ts.isCallExpression(node) &&
      node.expression.getText(sourceFile) === "withAdditionalLanguages" &&
      node.arguments.length === 1 &&
      ts.isCallExpression(node.arguments[0]) &&
      node.arguments[0].expression.getText(sourceFile) === "withAdditionalLanguages"
    ) {
      replacements.push({
        start: node.getStart(sourceFile),
        end: node.getEnd(),
        value: node.arguments[0].getText(sourceFile),
      });
      return;
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  if (!replacements.length) return;
  let next = source;
  for (const replacement of replacements.sort((left, right) => right.start - left.start)) {
    next = next.slice(0, replacement.start) + replacement.value + next.slice(replacement.end);
  }
  fs.writeFileSync(filePath, next);
}

function broadenLanguageTypes(filePath) {
  const source = fs.readFileSync(filePath, "utf8");
  if (!source.includes('"en" | "ko"')) return;
  let next = source.replaceAll('"en" | "ko"', "AppLanguage");
  next = ensureNamedI18nImport(next, "type AppLanguage");
  fs.writeFileSync(filePath, next);
}

function stripInvalidConstAssertions(filePath) {
  const { source, sourceFile } = parse(filePath);
  const replacements = [];
  function visit(node) {
    if (
      ts.isAsExpression(node) &&
      node.type.kind === ts.SyntaxKind.ConstKeyword &&
      ts.isCallExpression(node.expression) &&
      node.expression.expression.getText(sourceFile) === "withAdditionalLanguages"
    ) {
      replacements.push({
        start: node.getStart(sourceFile),
        end: node.getEnd(),
        value: node.expression.getText(sourceFile),
      });
      return;
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  if (!replacements.length) {
    if (source.includes("withAdditionalLanguages(") && source.includes("}) as const;")) {
      fs.writeFileSync(filePath, source.replaceAll("}) as const;", "});"));
    }
    return;
  }
  let next = source;
  for (const replacement of replacements.sort((left, right) => right.start - left.start)) {
    next = next.slice(0, replacement.start) + replacement.value + next.slice(replacement.end);
  }
  fs.writeFileSync(filePath, next);
}

function repairLocalizeCalls(filePath, cache) {
  const { source, sourceFile } = parse(filePath);
  const replacements = [];
  function visit(node) {
    if (
      ts.isCallExpression(node) &&
      node.expression.getText(sourceFile) === "localize" &&
      node.arguments.length === 2 &&
      ts.isObjectLiteralExpression(node.arguments[1])
    ) {
      const copy = node.arguments[1];
      const properties = Object.fromEntries(
        copy.properties
          .filter(ts.isPropertyAssignment)
          .map((property) => [propertyName(property, sourceFile), property.initializer]),
      );
      if (properties.en && properties.ko && properties.ja && properties.es) {
        replacements.push({
          start: node.getStart(sourceFile),
          end: node.getEnd(),
          value:
            `localize(${node.arguments[0].getText(sourceFile)}, { ` +
            `en: ${properties.en.getText(sourceFile)}, ` +
            `ko: ${properties.ko.getText(sourceFile)}, ` +
            `ja: ${translatedExpression(properties.en, "ja", cache, sourceFile)}, ` +
            `es: ${translatedExpression(properties.en, "es", cache, sourceFile)} })`,
        });
        return;
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  let next = source;
  for (const replacement of replacements.sort((left, right) => right.start - left.start)) {
    next = next.slice(0, replacement.start) + replacement.value + next.slice(replacement.end);
  }
  next = ensureLocalizeImport(next);
  if (next !== source) fs.writeFileSync(filePath, next);
}

function transformFile(filePath, cache) {
  const { source, sourceFile } = parse(filePath);
  const replacements = [];
  function visit(node) {
    const language = languageCondition(node, sourceFile);
    if (language) {
      replacements.push({
        start: node.getStart(sourceFile),
        end: node.getEnd(),
        value:
          `localize(${language}, { ` +
          `en: ${node.whenFalse.getText(sourceFile)}, ` +
          `ko: ${node.whenTrue.getText(sourceFile)}, ` +
          `ja: ${translatedExpression(node.whenFalse, "ja", cache, sourceFile)}, ` +
          `es: ${translatedExpression(node.whenFalse, "es", cache, sourceFile)} })`,
      });
      return;
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  if (!replacements.length) return false;
  let next = source;
  for (const replacement of replacements.sort((left, right) => right.start - left.start)) {
    next = next.slice(0, replacement.start) + replacement.value + next.slice(replacement.end);
  }
  next = ensureLocalizeImport(next);
  fs.writeFileSync(filePath, next);
  return true;
}

const files = sourceFiles(srcRoot).filter(
  (filePath) => !filePath.endsWith(path.join("lib", "i18n-translations.ts")),
);
const values = new Set();
for (const filePath of files) {
  const { sourceFile } = parse(filePath);
  collectConditionalStrings(sourceFile, values);
  collectTwoLanguageObjectStrings(sourceFile, values);
  if (filePath.endsWith(path.join("components", "i18n", "LanguageProvider.tsx"))) {
    collectStrings(findNamedObject(sourceFile, "dictionaries", "en"), values, sourceFile);
  }
  if (filePath.endsWith(path.join("app", "guide", "page.tsx"))) {
    collectStrings(findNamedObject(sourceFile, "guide", "en"), values, sourceFile);
  }
}

console.log(`translation strings: ${values.size}`);
const cache = await buildCache(values);
createGeneratedCatalog(cache);
for (const filePath of files) transformTwoLanguageObjects(filePath);
for (const filePath of files) broadenLanguageTypes(filePath);
for (const filePath of files) stripInvalidConstAssertions(filePath);
for (const filePath of files) collapseNestedLanguageHelpers(filePath);
let changed = 0;
for (const filePath of files) {
  if (transformFile(filePath, cache)) changed += 1;
}
for (const filePath of files) repairLocalizeCalls(filePath, cache);
console.log(`localized files: ${changed}`);
