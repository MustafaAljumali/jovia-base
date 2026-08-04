# Prototype Migration Inventory

The machine-readable inventory contains one disposition for each of the 150
source-controlled or source-like files in the external prototype. Vendor trees,
package stores, generated `dist` output, analysis caches, local tools, and the
official `jovia-base` checkout are excluded because they are not prototype source.

| Disposition | Files |
| --- | ---: |
| `refactor_before_reuse` | 80 |
| `rewrite` | 26 |
| `reject` | 35 |
| `archive_for_reference` | 9 |
| `reuse_unchanged` | 0 |
| **Total** | **150** |

No legacy file is approved for unchanged reuse. The 80 refactor candidates are
mostly presentational UI primitives and generic client utilities; each still needs
license provenance, dependency, accessibility, security, and monochrome-token
review. `rewrite` preserves product or behavioral intent without copying coupled
implementation. `reject` covers Manus runtime/branding, MySQL or TiDB persistence,
generated database snapshots, unsupported integration behavior, and unsafe build
assumptions. Archive rows are evidence only.

Every `migration_commit` is `not_migrated_in_first_batch`. A future migration must
update only the reviewed row after tests and a signed migration commit exist.

## Validation evidence

On 2026-08-04 a read-only comparison between the prototype file list and
`prototype-inventory.csv` reported:

```text
source=150 inventory=150 missing=0 extra=0 duplicates=0 unknown=0
```

The external prototype remains read-only. It is never added as a workspace package
or runtime dependency.
