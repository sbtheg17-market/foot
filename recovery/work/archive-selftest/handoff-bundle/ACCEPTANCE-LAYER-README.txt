ACCEPTANCE LAYER — read this first

This directory contains the owner-supplied handoff supply set (verified byte-identical
against MANIFEST.sha256, unchanged) PLUS one clearly labeled addition:

  acceptance/   — ACCEPTANCE ARTIFACTS ONLY (recovery matrix, evidence-ceiling
                  declaration, exact missing-file list). These are NOT historical
                  evidence and are NOT covered by the original MANIFEST.sha256.
                  They are checksummed separately in acceptance/ACCEPTANCE.sha256
                  and rolled up in ACCEPTANCE-MANIFEST.sha256.

This is NOT a "complete" handoff bundle. 55 unique files (75 manifest entries)
listed in acceptance/MISSING_FILES_55.txt remain unrecovered. 149/149 and 80/80
are NOT claimed. See acceptance/ACCEPTANCE_RECORD.md for the evidence ceiling,
candidate blocks, and the import procedure for later-supplied files.
