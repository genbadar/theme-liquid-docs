import {
  getLanguageService,
  Diagnostic,
  TextDocument,
  LanguageService,
  Hover,
  CompletionList,
} from 'vscode-json-languageservice';
import * as fs from 'node:fs';
import * as path from 'node:path';

export const CURSOR = '█';
const rootURI = 'https://raw.githubusercontent.com/Shopify/theme-liquid-docs/main/schemas';

export interface SchemaDefinition {
  uri: string;
  fileMatch?: string[];
  schema: string;
}

export const loadFixture = (fixtureName: string): string =>
  fs.readFileSync(path.resolve(__dirname, './fixtures/', fixtureName), 'utf8');

export const loadSchema = (relativePath: string): string => {
  return fs.readFileSync(path.resolve(__dirname, '../schemas', relativePath), 'utf8');
};

export const getService = (manifestName = 'manifest_theme.json') => {
  const manifestPath = path.resolve(__dirname, '../schemas', manifestName);
  const manifest = require(manifestPath);
  const schemas = manifest.schemas.map(
    (schema): SchemaDefinition => ({
      uri: `${rootURI}/${schema.uri}`,
      fileMatch: schema.fileMatch,
      schema: loadSchema(schema.uri),
    }),
  );
  const service = getLanguageService({
    async schemaRequestService(uri) {
      const schemaDefinition = schemas.find((sd) => sd.uri === uri);
      return schemaDefinition?.schema ?? `Could not find a schema for ${uri}`;
    },
    workspaceContext: {
      resolveRelativePath: (relativePath, resource) => {
        const url = new URL(relativePath, resource);
        return url.toString();
      },
    },
  });

  service.configure({
    schemas: schemas.map((sd) => ({ uri: sd.uri, fileMatch: sd.fileMatch })),
  });

  return service;
};

export const validateSchema = (manifestName = 'manifest_theme.json') => {
  const service = getService(manifestName);

  return async (filePath: string, jsonContent: any): Promise<Diagnostic[]> => {
    if (typeof jsonContent !== 'string') {
      jsonContent = JSON.stringify(jsonContent);
    }

    const textDocument = TextDocument.create('file:/' + filePath, 'json', 0, jsonContent);
    const jsonDocument = service.parseJSONDocument(textDocument);
    const diagnostics = await service.doValidation(textDocument, jsonDocument, {
      schemaValidation: 'error',
      comments: 'error',
      trailingCommas: 'error',
    });

    return diagnostics;
  };
};

export const hover = async (
  service: LanguageService,
  filePath: string,
  jsonContent: string,
): Promise<Hover | null> => {
  const offset = jsonContent.indexOf(CURSOR);
  jsonContent = jsonContent.replace(CURSOR, '');

  const textDocument = TextDocument.create('file:/' + filePath, 'json', 0, jsonContent);
  const position = textDocument.positionAt(offset);
  const jsonDocument = service.parseJSONDocument(textDocument);
  return service.doHover(textDocument, position, jsonDocument);
};

export const complete = async (
  service: LanguageService,
  filePath: string,
  jsonContent: string,
): Promise<CompletionList | null> => {
  const offset = jsonContent.indexOf(CURSOR);
  jsonContent = jsonContent.replace(CURSOR, '');

  const textDocument = TextDocument.create('file:/' + filePath, 'json', 0, jsonContent);
  const position = textDocument.positionAt(offset);
  const jsonDocument = service.parseJSONDocument(textDocument);
  return service.doComplete(textDocument, position, jsonDocument);
};
