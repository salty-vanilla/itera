// The contract and packages/application agree (#265 完了条件): every
// operation of the application goes to a surface of the contract and every
// read has its read there, and their outputs and results are the
// contract's types. Checked by `pnpm typecheck` (tsconfig.test.json); the
// `it`s only list them.
import type {
  BacklogData,
  Clock,
  ConditionalOperation,
  CurrentSprints,
  DayView,
  EditableArea,
  OperationName,
  OperationOutput,
  RetroData,
  SprintItem,
  SprintView,
  sprintCandidates,
} from '@itera/application';
import type { BacklogSlice, User } from '@itera/domain';
import { describe, expectTypeOf, it } from 'vitest';
import type * as Gen from './index';
import type {
  ConditionalName,
  OperationSurfaces,
  SurfaceId,
  SurfaceResponse,
} from './requests';
import type { Equal, Plain, WithNull } from './testing';

/** The operations a surface takes. */
type OperationsOf<S extends SurfaceId> = {
  [N in OperationName]: OperationSurfaces[N] extends S ? N : never;
}[OperationName];

type IsUnion<T, U = T> = T extends unknown
  ? [U] extends [T]
    ? false
    : true
  : never;

/**
 * A surface's response as the operation's output: a response without
 * content (201 for the Retro made, #295) is generated as `unknown`.
 */
type Response<S extends SurfaceId> =
  unknown extends SurfaceResponse<S> ? void : SurfaceResponse<S>;

/** The outputs of each of the operations, as a union. */
type OutputsOf<N extends OperationName> = N extends OperationName
  ? OperationOutput<N>
  : never;

/** Every key of a union of objects (not only the common ones). */
type AllKeys<T> = T extends unknown ? keyof T : never;

/**
 * The operations whose output is not their surface's response: the same
 * type where the surface takes one operation; where it takes several (made
 * told apart by the body), each output fits the response and together they
 * have its keys.
 */
type OutputMismatch = {
  [N in OperationName]: IsUnion<OperationsOf<OperationSurfaces[N]>> extends true
    ? Plain<OperationOutput<N>> extends Plain<Response<OperationSurfaces[N]>>
      ? never
      : N
    : Equal<
          Plain<OperationOutput<N>>,
          Plain<Response<OperationSurfaces[N]>>
        > extends true
      ? never
      : N;
}[OperationName];

/** The surfaces whose response has keys no operation of theirs returns. */
type ResponseKeysMismatch = {
  [S in SurfaceId]: Equal<
    AllKeys<Plain<Response<S>>>,
    AllKeys<Plain<OutputsOf<OperationsOf<S>>>>
  > extends true
    ? never
    : S;
}[SurfaceId];

/** Each read's result in packages/application, and the response's `view`. */
type ContractReads = {
  listAreas: [readonly EditableArea[], Gen.ListAreasResponse];
  getBacklog: [BacklogData, Gen.GetBacklogResponse];
  listSprints: [readonly SprintItem[], Gen.ListSprintsResponse];
  getSprint: [SprintView, Gen.GetSprintResponse];
  listSprintCandidates: [
    SprintCandidates | undefined,
    Gen.ListSprintCandidatesResponse,
  ];
  getSprintRetro: [RetroData | undefined, Gen.GetSprintRetroResponse];
  getDay: [DayView, Gen.GetDayResponse];
};

/** What `sprintCandidates` returns. */
type SprintCandidates = NonNullable<ReturnType<typeof sprintCandidates>>;

/** The reads whose result differs from the response's `view`. */
type ReadMismatch = {
  [N in keyof ContractReads]: Equal<
    Plain<WithNull<ContractReads[N][0]>>,
    Plain<ContractReads[N][1]['view']>
  > extends true
    ? never
    : N;
}[keyof ContractReads];

/** The reads whose `clock` is not the application's Clock. */
type ClockMismatch = {
  [N in keyof ContractReads]: Equal<
    Plain<Clock>,
    Plain<ContractReads[N][1]['clock']>
  > extends true
    ? never
    : N;
}[keyof ContractReads];

describe('the contract and packages/application', () => {
  it('sends every operation to a surface, and every surface takes one', () => {
    expectTypeOf<keyof OperationSurfaces>().toEqualTypeOf<OperationName>();
    expectTypeOf<OperationSurfaces[OperationName]>().toEqualTypeOf<SurfaceId>();
  });

  // Each operation's input is its request: `requestOf` and the surfaces'
  // `operation` are typed against the generated requests (requests.ts), and
  // requests.test.ts sends every input there and back.

  it("returns each operation's output as its surface's response", () => {
    expectTypeOf<OutputMismatch>().toEqualTypeOf<never>();
    expectTypeOf<ResponseKeysMismatch>().toEqualTypeOf<never>();
  });

  it("returns each read's result as the response's view, null for none", () => {
    expectTypeOf<ReadMismatch>().toEqualTypeOf<never>();
    expectTypeOf<ClockMismatch>().toEqualTypeOf<never>();
  });

  it('names the version on the surfaces of the operations the application checks (#321)', () => {
    expectTypeOf<ConditionalName>().toEqualTypeOf<ConditionalOperation>();
  });

  it("returns the person's settings as the domain's User without its ID", () => {
    expectTypeOf<
      Plain<NonNullable<Gen.GetMeResponse['settings']>>
    >().toEqualTypeOf<Plain<Omit<User, 'id'>>>();
  });

  it('returns the current Sprints and the clock with the person (#295 R1)', () => {
    expectTypeOf<
      Plain<NonNullable<Gen.GetMeResponse['sprints']>>
    >().toEqualTypeOf<Plain<CurrentSprints>>();
    expectTypeOf<
      Plain<NonNullable<Gen.GetMeResponse['clock']>>
    >().toEqualTypeOf<Plain<Clock>>();
  });

  it("takes the Backlog's filter as the read's query", () => {
    expectTypeOf<
      Plain<NonNullable<Gen.GetBacklogData['query']>>
    >().toEqualTypeOf<{ view?: BacklogSlice; area?: string }>();
  });
});
