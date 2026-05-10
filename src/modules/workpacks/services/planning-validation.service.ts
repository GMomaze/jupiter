import {
  WorkpackPreviewItem,
  WorkpackPreviewResult,
} from './workpack-preview.service.js';

export class PlanningValidationError extends Error {
  declare errors: string[];

  constructor(errors: string[]) {
    super('PLANNING_VALIDATION_FAILED');
    this.name = 'PlanningValidationError';
    this.errors = errors;
  }
}

export class PlanningValidationService {
  static validate(params: {
    preview: Pick<WorkpackPreviewResult, 'blocking_errors' | 'items'>;
    rawSelectedItemIds?: string[];
    selectedItemIds: string[];
  }) {
    const preview = params.preview;
    const items = Array.isArray(preview?.items) ? preview.items : [];
    const rawSelectedItemIds = Array.isArray(params.rawSelectedItemIds)
      ? params.rawSelectedItemIds
      : [];
    const selectedItemIds = Array.isArray(params.selectedItemIds)
      ? params.selectedItemIds
      : [];
    const errors: string[] = [];
    const candidateItemIds = items
      .map((item) => String(item.template_item_id || '').trim())
      .filter(Boolean);
    const candidateIdSet = new Set(candidateItemIds);
    const selectedIdSet = new Set(
      selectedItemIds.map((itemId) => String(itemId || '').trim()).filter(Boolean)
    );

    for (const error of this.mapBlockingErrors(preview.blocking_errors || [])) {
      this.pushUnique(errors, error);
    }

    const duplicateCandidateErrors = this.findDuplicateCandidateErrors(items);
    for (const error of duplicateCandidateErrors) {
      this.pushUnique(errors, error);
    }

    const duplicateSelectedIds = this.findDuplicateSelectedIds(rawSelectedItemIds);
    for (const itemId of duplicateSelectedIds) {
      const item = items.find(
        (candidate) => String(candidate.template_item_id || '').trim() === itemId
      );
      this.pushUnique(
        errors,
        `Duplicate selected planning item detected: ${this.describeItem(item, itemId)}.`
      );
    }

    if (selectedIdSet.size === 0) {
      this.pushUnique(
        errors,
        'Select at least one planning item before marking the session ready or generating a workpack.'
      );
    }

    for (const selectedItemId of selectedIdSet) {
      if (!candidateIdSet.has(selectedItemId)) {
        this.pushUnique(
          errors,
          `Selected planning item reference is invalid or missing: ${selectedItemId}.`
        );
      }
    }

    for (const item of items) {
      if (item.is_required && !selectedIdSet.has(String(item.template_item_id || '').trim())) {
        this.pushUnique(
          errors,
          `Required planning item is not selected: ${this.describeItem(item)}.`
        );
      }
    }

    for (const item of items) {
      const itemId = String(item.template_item_id || '').trim();
      if (!itemId || !selectedIdSet.has(itemId)) {
        continue;
      }

      if (String(item.validation_status || '').trim().toUpperCase() === 'BLOCKED') {
        this.pushUnique(
          errors,
          `Selected planning item has invalid or missing source data: ${this.describeItem(item)}.`
        );
      }

      for (const validationError of this.mapItemValidationErrors(item)) {
        this.pushUnique(errors, validationError);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  static assertValid(params: {
    preview: Pick<WorkpackPreviewResult, 'blocking_errors' | 'items'>;
    rawSelectedItemIds?: string[];
    selectedItemIds: string[];
  }) {
    const validation = this.validate(params);
    if (!validation.isValid) {
      throw new PlanningValidationError(validation.errors);
    }
    return validation;
  }

  private static findDuplicateCandidateErrors(items: WorkpackPreviewItem[]) {
    const errors: string[] = [];
    const seenTemplateItemIds = new Set<string>();
    const seenSourceKeys = new Set<string>();

    for (const item of items) {
      const templateItemId = String(item.template_item_id || '').trim();
      const sourceKey = `${String(item.item_type || '').trim()}:${String(item.source_id || '').trim()}`;

      if (templateItemId) {
        if (seenTemplateItemIds.has(templateItemId)) {
          this.pushUnique(
            errors,
            `Duplicate planning candidate detected: ${this.describeItem(item, templateItemId)}.`
          );
        }
        seenTemplateItemIds.add(templateItemId);
      }

      if (sourceKey !== ':') {
        if (seenSourceKeys.has(sourceKey)) {
          this.pushUnique(
            errors,
            `Duplicate planning source detected: ${this.describeItem(item)}.`
          );
        }
        seenSourceKeys.add(sourceKey);
      }
    }

    return errors;
  }

  private static findDuplicateSelectedIds(rawSelectedItemIds: string[]) {
    const seen = new Set<string>();
    const duplicates = new Set<string>();

    for (const rawItemId of rawSelectedItemIds) {
      const itemId = String(rawItemId || '').trim();
      if (!itemId) {
        continue;
      }
      if (seen.has(itemId)) {
        duplicates.add(itemId);
        continue;
      }
      seen.add(itemId);
    }

    return Array.from(duplicates);
  }

  private static mapBlockingErrors(blockingErrors: string[]) {
    return blockingErrors
      .map((error) => String(error || '').trim())
      .filter(Boolean)
      .map((error) => this.describeBlockingError(error));
  }

  private static mapItemValidationErrors(item: WorkpackPreviewItem) {
    const itemLabel = this.describeItem(item);
    return (Array.isArray(item.validation_errors) ? item.validation_errors : [])
      .map((error) => String(error || '').trim())
      .filter(Boolean)
      .map((error) => this.describeItemValidationError(error, itemLabel));
  }

  private static describeBlockingError(error: string) {
    if (error === 'TEMPLATE_NOT_FOUND') {
      return 'The selected maintenance template could not be found.';
    }
    if (error === 'TEMPLATE_INACTIVE') {
      return 'The selected maintenance template is inactive.';
    }
    if (error === 'AIRCRAFT_NOT_FOUND') {
      return 'The selected aircraft could not be found.';
    }
    if (error === 'TEMPLATE_MODEL_NOT_SET') {
      return 'Template applicability could not be resolved because the template model is not set.';
    }
    if (error === 'AIRCRAFT_MODEL_NOT_RESOLVED') {
      return 'Applicability could not be resolved because the aircraft model is missing.';
    }
    if (error === 'TEMPLATE_MODEL_MISMATCH') {
      return 'Template applicability does not match the selected aircraft model.';
    }
    if (error === 'TEMPLATE_HAS_NO_ITEMS') {
      return 'The selected template does not contain any planning items.';
    }
    if (error === 'TEMPLATE_HAS_NO_APPLICABLE_ITEMS') {
      return 'No applicable planning items were found for the selected aircraft, model, or installed components.';
    }
    if (error === 'SOURCE_RECORD_MISSING') {
      return 'One or more planning items reference missing or invalid source records.';
    }

    return error;
  }

  private static describeItemValidationError(error: string, itemLabel: string) {
    if (error.startsWith('TEMPLATE_ITEM_SOURCE_NOT_FOUND:')) {
      return `Planning item reference is invalid or missing: ${itemLabel}.`;
    }
    if (error.startsWith('TEMPLATE_ITEM_SOURCE_ID_MISSING:')) {
      return `Planning item source reference is missing: ${itemLabel}.`;
    }
    if (error.startsWith('UNSUPPORTED_TEMPLATE_ITEM_TYPE:')) {
      return `Planning item type is not supported: ${itemLabel}.`;
    }
    if (error.startsWith('STANDARD_TASK_INACTIVE:')) {
      return `Selected standard task is inactive: ${itemLabel}.`;
    }
    if (error.startsWith('SID_INACTIVE:')) {
      return `Selected SID is inactive: ${itemLabel}.`;
    }
    if (error.startsWith('SOURCE_TITLE_MISSING:')) {
      return `Planning item is missing a title: ${itemLabel}.`;
    }
    if (error.startsWith('SOURCE_DESCRIPTION_MISSING:')) {
      return `Planning item is missing a description: ${itemLabel}.`;
    }

    return `${itemLabel}: ${error}`;
  }

  private static describeItem(item?: WorkpackPreviewItem | null, fallback?: string) {
    if (!item) {
      return fallback || 'Unknown planning item';
    }

    const sourceRef = String(item.source_reference || '').trim();
    const title = String(item.title || '').trim();

    if (sourceRef && title) {
      return `${sourceRef} - ${title}`;
    }
    if (sourceRef) {
      return sourceRef;
    }
    if (title) {
      return title;
    }
    return fallback || String(item.template_item_id || '').trim() || 'Unknown planning item';
  }

  private static pushUnique(target: string[], value: string) {
    const normalizedValue = String(value || '').trim();
    if (!normalizedValue || target.includes(normalizedValue)) {
      return;
    }
    target.push(normalizedValue);
  }
}
