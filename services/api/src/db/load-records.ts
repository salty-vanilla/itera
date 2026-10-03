import type { UserId } from '@itera/domain';
import { eq, inArray } from 'drizzle-orm';
import type { Database } from './database';
import { recordsFromRows, RowSet } from './record-rows';
import type { LoadedRecords } from './records';
import {
  actualTime,
  area,
  criterionUse,
  dailySelection,
  estimateSuggestion,
  estimateSuggestionUncertainty,
  interruptNote,
  occurrence,
  planningCriterion,
  recordRevision,
  recurrenceRule,
  recurrenceRuleVersion,
  recurrenceRuleVersionDay,
  retro,
  retroPin,
  sprint,
  sprintAreaSnapshot,
  sprintGoal,
  sprintTask,
  sprintTaskOccurrence,
  subtask,
  task,
  userSettings,
} from './schema';

/**
 * All of the user's records except Activity, with their revision, read in
 * one batch (ADR 0004 「操作と読み取りの処理」). Root records come in ID order,
 * which is creation order for TypeIDs; the parts of an aggregate come in
 * their saved order.
 */
export async function loadRecords(
  db: Database,
  userId: UserId,
): Promise<LoadedRecords> {
  const ownTasks = db
    .select({ id: task.id })
    .from(task)
    .where(eq(task.userId, userId));
  const ownSuggestions = db
    .select({ id: estimateSuggestion.id })
    .from(estimateSuggestion)
    .where(inArray(estimateSuggestion.taskId, ownTasks));
  const ownRules = db
    .select({ id: recurrenceRule.id })
    .from(recurrenceRule)
    .where(eq(recurrenceRule.userId, userId));
  const ownSprints = db
    .select({ id: sprint.id })
    .from(sprint)
    .where(eq(sprint.userId, userId));
  const ownSprintTasks = db
    .select({ id: sprintTask.id })
    .from(sprintTask)
    .where(inArray(sprintTask.sprintId, ownSprints));

  const [
    revisions,
    settingsRows,
    areaRows,
    taskRows,
    subtaskRows,
    suggestionRows,
    uncertaintyRows,
    ruleRows,
    versionRows,
    dayRows,
    occurrenceRows,
    criterionRows,
    sprintRows,
    goalRows,
    snapshotRows,
    useRows,
    sprintTaskRows,
    linkRows,
    selectionRows,
    actualRows,
    interruptRows,
    retroRows,
    pinRows,
  ] = await db.batch([
    db
      .select({ revision: recordRevision.revision })
      .from(recordRevision)
      .where(eq(recordRevision.userId, userId)),
    db.select().from(userSettings).where(eq(userSettings.userId, userId)),
    db.select().from(area).where(eq(area.userId, userId)).orderBy(area.id),
    db.select().from(task).where(eq(task.userId, userId)).orderBy(task.id),
    db
      .select()
      .from(subtask)
      .where(inArray(subtask.taskId, ownTasks))
      .orderBy(subtask.taskId, subtask.position),
    db
      .select()
      .from(estimateSuggestion)
      .where(inArray(estimateSuggestion.taskId, ownTasks))
      .orderBy(estimateSuggestion.taskId, estimateSuggestion.position),
    db
      .select()
      .from(estimateSuggestionUncertainty)
      .where(
        inArray(estimateSuggestionUncertainty.suggestionId, ownSuggestions),
      )
      .orderBy(
        estimateSuggestionUncertainty.suggestionId,
        estimateSuggestionUncertainty.position,
      ),
    db
      .select()
      .from(recurrenceRule)
      .where(eq(recurrenceRule.userId, userId))
      .orderBy(recurrenceRule.id),
    db
      .select()
      .from(recurrenceRuleVersion)
      .where(inArray(recurrenceRuleVersion.ruleId, ownRules))
      .orderBy(recurrenceRuleVersion.ruleId, recurrenceRuleVersion.position),
    db
      .select()
      .from(recurrenceRuleVersionDay)
      .where(inArray(recurrenceRuleVersionDay.ruleId, ownRules))
      .orderBy(
        recurrenceRuleVersionDay.ruleId,
        recurrenceRuleVersionDay.version,
        recurrenceRuleVersionDay.position,
      ),
    db
      .select()
      .from(occurrence)
      .where(eq(occurrence.userId, userId))
      .orderBy(occurrence.id),
    db
      .select()
      .from(planningCriterion)
      .where(eq(planningCriterion.userId, userId))
      .orderBy(planningCriterion.id),
    db
      .select()
      .from(sprint)
      .where(eq(sprint.userId, userId))
      .orderBy(sprint.id),
    db
      .select()
      .from(sprintGoal)
      .where(inArray(sprintGoal.sprintId, ownSprints))
      .orderBy(sprintGoal.sprintId, sprintGoal.position),
    db
      .select()
      .from(sprintAreaSnapshot)
      .where(inArray(sprintAreaSnapshot.sprintId, ownSprints))
      .orderBy(sprintAreaSnapshot.sprintId, sprintAreaSnapshot.position),
    db
      .select()
      .from(criterionUse)
      .where(inArray(criterionUse.sprintId, ownSprints)),
    db
      .select()
      .from(sprintTask)
      .where(inArray(sprintTask.sprintId, ownSprints))
      .orderBy(sprintTask.sprintId, sprintTask.position),
    db
      .select()
      .from(sprintTaskOccurrence)
      .where(inArray(sprintTaskOccurrence.sprintTaskId, ownSprintTasks))
      .orderBy(
        sprintTaskOccurrence.sprintTaskId,
        sprintTaskOccurrence.position,
      ),
    db
      .select()
      .from(dailySelection)
      .where(inArray(dailySelection.sprintId, ownSprints))
      .orderBy(dailySelection.sprintId, dailySelection.position),
    db
      .select()
      .from(actualTime)
      .where(inArray(actualTime.sprintId, ownSprints))
      .orderBy(actualTime.sprintId, actualTime.position),
    db
      .select()
      .from(interruptNote)
      .where(inArray(interruptNote.sprintId, ownSprints))
      .orderBy(interruptNote.sprintId, interruptNote.position),
    db.select().from(retro).where(inArray(retro.sprintId, ownSprints)),
    db
      .select()
      .from(retroPin)
      .where(inArray(retroPin.sprintId, ownSprints))
      .orderBy(retroPin.sprintId, retroPin.position),
  ]);

  const rows = new RowSet();
  rows.add(userSettings, ...settingsRows);
  rows.add(area, ...areaRows);
  rows.add(task, ...taskRows);
  rows.add(subtask, ...subtaskRows);
  rows.add(estimateSuggestion, ...suggestionRows);
  rows.add(estimateSuggestionUncertainty, ...uncertaintyRows);
  rows.add(recurrenceRule, ...ruleRows);
  rows.add(recurrenceRuleVersion, ...versionRows);
  rows.add(recurrenceRuleVersionDay, ...dayRows);
  rows.add(occurrence, ...occurrenceRows);
  rows.add(planningCriterion, ...criterionRows);
  rows.add(sprint, ...sprintRows);
  rows.add(sprintGoal, ...goalRows);
  rows.add(sprintAreaSnapshot, ...snapshotRows);
  rows.add(criterionUse, ...useRows);
  rows.add(sprintTask, ...sprintTaskRows);
  rows.add(sprintTaskOccurrence, ...linkRows);
  rows.add(dailySelection, ...selectionRows);
  rows.add(actualTime, ...actualRows);
  rows.add(interruptNote, ...interruptRows);
  rows.add(retro, ...retroRows);
  rows.add(retroPin, ...pinRows);

  return {
    revision: revisions[0]?.revision ?? 0,
    records: recordsFromRows(rows),
  };
}
