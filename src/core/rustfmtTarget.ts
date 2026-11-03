/**
 * Pure rustfmt target resolution shared by the panel command and its tests.
 *
 * Kept free of `vscode` imports so it runs under plain Node; callers pass the
 * project model's root and member list.
 */

export type RustfmtScope = 'workspace' | 'member';

export interface RustfmtTargetModel {
  root: string;
  members: readonly { name: string; dir: string }[];
}

export interface RustfmtTarget {
  scope: RustfmtScope;
  /** Resolved member (requested name, otherwise the first member). */
  member?: { name: string; dir: string };
  /** Directory whose rustfmt.toml this target edits. */
  dir: string;
  /**
   * True when member scope was requested but the model has no members at all.
   * Callers must refuse to write in this case instead of falling back to the
   * workspace root.
   */
  missingMember: boolean;
}

/**
 * Resolve the directory rustfmt should read/write for a scope.
 *
 * In member scope the member is looked up by name and falls back to
 * `members[0]`, matching the panel's active-member behaviour.
 */
export function resolveRustfmtTarget(
  model: RustfmtTargetModel,
  scope: RustfmtScope,
  memberName?: string,
): RustfmtTarget {
  const member = model.members.find((entry) => entry.name === memberName) ?? model.members[0];
  if (scope === 'member') {
    return member
      ? { scope, member, dir: member.dir, missingMember: false }
      : { scope, dir: model.root, missingMember: true };
  }
  return { scope: 'workspace', member, dir: model.root, missingMember: false };
}
