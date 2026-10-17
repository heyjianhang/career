import path from 'node:path';
import { Ajv, type AnySchemaObject } from 'ajv';
import { CommandError } from '../agent-api.js';
import { root, json } from '../presentation/io.js';
import type { SchemaTypes } from './types.js';

export function fail(code: string, message: string, details: unknown = null): never {
  throw new CommandError(code, message, details);
}

const ajv = new Ajv({ allErrors: true, strict: false });
const calendarDate = (value: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  Number.isFinite(Date.parse(value)) &&
  new Date(value).toISOString().slice(0, 10) === value;

ajv.addFormat('date', calendarDate);
ajv.addFormat('date-time', value =>
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value) &&
  calendarDate(value.slice(0, 10)) && Number.isFinite(Date.parse(value)),
);
ajv.addFormat('http-url', value => {
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password;
  } catch {
    return false;
  }
});

type OpportunityContract = AnySchemaObject & {
  $defs: { [K in keyof SchemaTypes]: AnySchemaObject };
}
let schemas: OpportunityContract | undefined;

export async function contract() {
  schemas ??= await json<OpportunityContract>(path.join(root, 'schemas/opportunity.v1.schema.json'));
  return schemas;
}

// All CLI, HTTP and on-disk values enter as unknown. The existing JSON Schema is
// the runtime authority; only successfully checked values receive a domain type.
export async function validate<K extends keyof SchemaTypes>(kind: K, value: unknown): Promise<SchemaTypes[K]> {
  const schema = (await contract()).$defs[kind];
  const check = ajv.getSchema<SchemaTypes[K]>(kind) ?? ajv.compile<SchemaTypes[K]>({ ...schema, $id: kind });
  if (!check(value)) fail('INVALID_RECORD', '字段不符合 ' + kind + ' 契约', check.errors);
  return value as SchemaTypes[K];
}
