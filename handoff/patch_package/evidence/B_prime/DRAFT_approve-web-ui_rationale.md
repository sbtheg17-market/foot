# B' — --approve-web-ui rationale status: DRAFT ONLY (NOT an approval)

The publication gate for B' was exercised in this workspace with the rationale:

    "DRAFT-VERIFICATION (not an approval): local gate mechanics check only;
     owner rationale still required before publication"

This is explicitly NOT a publication approval. artifacts/web/** is a forbidden
path in the gate; the REAL publication run requires the owner's reviewed
`--approve-web-ui "<approver>: <reason>"` rationale, supplied inside the
approved B' publication window, after B' is re-derived on the then-current
main tip (new candidate identity).

Browser verification status in THIS workspace: NOT_RUN (ledger AC-006) —
deferred to the pre-publication window; the prior session's browser PASS claim
is non-portable evidence and is not re-asserted here. Typecheck and web build
evidence from this workspace: bprime_typecheck.log, bprime_webbuild.log (EXIT=0).
