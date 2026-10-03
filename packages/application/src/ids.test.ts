import { instant } from '@itera/domain';
import { describe, expect, it } from 'vitest';
import {
  createIdSource,
  decodeSuffix,
  encodeSuffix,
  idPrefix,
  parseId,
  parseTypeId,
} from './ids';
// The examples of the TypeID spec v0.3 (github.com/jetify-com/typeid,
// spec/valid.json and spec/invalid.json, Apache License 2.0).
import invalid from './testdata/typeid-invalid.json';
import valid from './testdata/typeid-valid.json';

const hex = (bytes: Uint8Array) =>
  [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
const uuidBytes = (uuid: string) =>
  Uint8Array.from(uuid.replaceAll('-', '').match(/../g) ?? [], (pair) =>
    Number.parseInt(pair, 16),
  );

const zeros = (bytes: Uint8Array) => bytes.fill(0);
const at = instant('2026-10-01T05:00:00.000Z');

describe('TypeID (spec v0.3)', () => {
  it.each(valid)('encodes and decodes $name', ({ typeid, prefix, uuid }) => {
    const suffix = typeid.slice(prefix === '' ? 0 : prefix.length + 1);
    expect(encodeSuffix(uuidBytes(uuid))).toBe(suffix);
    const parsed = parseTypeId(typeid);
    expect(parsed?.prefix).toBe(prefix);
    expect(hex(parsed?.uuid ?? new Uint8Array())).toBe(
      uuid.replaceAll('-', ''),
    );
  });

  it.each(invalid)('rejects $name', ({ typeid }) => {
    expect(parseTypeId(typeid)).toBeUndefined();
  });

  it('rejects a suffix over 128 bits', () => {
    expect(decodeSuffix('8zzzzzzzzzzzzzzzzzzzzzzzzz')).toBeUndefined();
  });
});

describe('idPrefix', () => {
  it('is the kind in snake_case (ADR 0004)', () => {
    expect(
      [
        'User',
        'Area',
        'Task',
        'Subtask',
        'EstimateSuggestion',
        'RecurrenceRule',
        'Occurrence',
        'Sprint',
        'SprintTask',
        'DailySelection',
        'InterruptNote',
        'PlanningCriterion',
      ].map(idPrefix),
    ).toEqual([
      'user',
      'area',
      'task',
      'subtask',
      'estimate_suggestion',
      'recurrence_rule',
      'occurrence',
      'sprint',
      'sprint_task',
      'daily_selection',
      'interrupt_note',
      'planning_criterion',
    ]);
  });
});

describe('createIdSource', () => {
  const random = (bytes: Uint8Array) => {
    for (let i = 0; i < bytes.length; i += 1) bytes[i] = (i * 37 + 11) % 256;
  };

  it('makes UUIDv7 TypeIDs with the kind’s prefix and the time', () => {
    const made = createIdSource(random).newId('SprintTask', at);
    expect(made).toMatch(/^sprint_task_[0-7][0-9a-hjkmnp-tv-z]{25}$/);
    expect(parseId('SprintTask', made).ok).toBe(true);
    const uuid = parseTypeId(made)?.uuid ?? new Uint8Array();
    const time = Number.parseInt(hex(uuid.slice(0, 6)), 16);
    expect(new Date(time).toISOString()).toBe(at);
  });

  it('sorts in the order made, within one millisecond and when time goes back', () => {
    const source = createIdSource(random);
    const later = instant('2026-10-01T05:00:01.000Z');
    const made = [
      source.newId('Task', at),
      source.newId('Task', at),
      source.newId('Task', later),
      source.newId('Task', at),
      source.newId('Task', later),
    ];
    expect(made.toSorted()).toEqual(made);
    expect(new Set(made).size).toBe(made.length);
  });

  it('is the same for the same times and random bytes', () => {
    const make = () => {
      const source = createIdSource(zeros);
      return [source.newId('Area', at), source.newId('Task', at)];
    };
    expect(make()).toEqual(make());
  });
});

describe('parseId', () => {
  const made = createIdSource(zeros).newId('Task', at);

  it('accepts an ID of the kind', () => {
    expect(parseId('Task', made)).toEqual({ ok: true, value: made });
  });

  it('rejects another kind, a malformed value and a UUID that is not v7', () => {
    expect(parseId('Area', made).ok).toBe(false);
    expect(parseId('Task', 'task-paper').ok).toBe(false);
    expect(parseId('Task', `${made}x`).ok).toBe(false);
    // A UUIDv4 in TypeID form.
    const v4 = `task_${encodeSuffix(uuidBytes('0190163d-8694-4e10-9a3c-6b5c1a2f3e4d'))}`;
    expect(parseTypeId(v4)).toBeDefined();
    expect(parseId('Task', v4).ok).toBe(false);
  });
});
