# Graph Report - app  (2026-08-27)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 4444 nodes · 7971 edges · 300 communities (268 shown, 32 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 64 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `96b71026`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Community 0
- Community 1
- Community 2
- Community 3
- Community 4
- Community 5
- Community 6
- Community 7
- Community 8
- Community 9
- Community 10
- Community 11
- Community 12
- Community 13
- Community 14
- Community 15
- Community 16
- Community 17
- Community 18
- Community 19
- Community 20
- Community 21
- Community 22
- Community 23
- Community 24
- Community 25
- Community 26
- Community 27
- Community 28
- Community 29
- Community 30
- Community 31
- Community 32
- Community 33
- Community 34
- Community 35
- Community 36
- Community 37
- Community 38
- Community 39
- Community 40
- Community 41
- Community 42
- Community 43
- Community 44
- Community 45
- Community 46
- Community 47
- Community 48
- Community 49
- Community 50
- Community 51
- Community 52
- Community 53
- Community 54
- Community 55
- Community 56
- Community 57
- Community 58
- Community 59
- Community 60
- Community 61
- Community 62
- Community 63
- Community 64
- Community 65
- Community 66
- Community 67
- Community 68
- Community 69
- Community 70
- Community 71
- Community 72
- Community 73
- Community 74
- Community 75
- Community 76
- Community 77
- Community 78
- Community 79
- Community 80
- Community 81
- Community 82
- Community 83
- Community 84
- Community 85
- Community 86
- Community 87
- Community 88
- Community 89
- Community 90
- Community 91
- Community 92
- Community 93
- Community 94
- Community 95
- Community 96
- Community 97
- Community 98
- Community 99
- Community 100
- Community 101
- Community 102
- Community 103
- Community 104
- Community 105
- Community 106
- Community 107
- Community 108
- Community 109
- Community 110
- Community 111
- Community 112
- Community 113
- Community 114
- Community 115
- Community 116
- Community 117
- Community 118
- Community 119
- Community 120
- Community 121
- Community 122
- Community 123
- Community 124
- Community 125
- Community 126
- Community 127
- Community 128
- Community 129
- Community 130
- Community 131
- Community 132
- Community 133
- Community 134
- Community 135
- Community 136
- Community 137
- Community 138
- Community 139
- Community 140
- Community 141
- Community 142
- Community 143
- Community 144
- Community 145
- Community 146
- Community 147
- Community 148
- Community 149
- Community 150
- Community 151
- Community 152
- Community 153
- Community 154
- Community 155
- Community 156
- Community 157
- Community 158
- Community 159
- Community 160
- Community 161
- Community 162
- Community 163
- Community 164
- Community 165
- Community 166
- Community 167
- Community 168
- Community 169
- Community 170
- Community 171
- Community 172
- Community 173
- Community 174
- Community 175
- Community 176
- Community 177
- Community 178
- Community 179
- Community 180
- Community 181
- Community 182
- Community 183
- Community 184
- Community 185
- Community 186
- Community 187
- Community 188
- Community 189
- Community 190
- Community 191
- Community 192
- Community 193
- Community 194
- Community 195
- Community 196
- Community 197
- Community 198
- Community 199
- Community 200
- Community 201
- Community 202
- Community 203
- Community 204
- Community 205
- Community 206
- Community 207
- Community 208
- Community 209
- Community 210
- Community 211
- Community 212
- Community 213
- Community 214
- Community 215
- Community 216
- Community 217
- Community 218
- Community 219
- Community 220
- Community 221
- Community 222
- Community 223
- Community 224
- Community 225
- Community 226
- Community 227
- Community 228
- Community 229
- Community 230
- Community 231
- Community 232
- Community 233
- Community 234
- Community 235
- Community 236
- Community 237
- Community 238
- Community 239
- Community 240
- Community 241
- Community 242
- Community 243
- Community 244
- Community 245
- Community 246
- Community 247
- Community 248
- Community 249
- Community 250
- Community 251
- Community 252
- Community 253
- Community 254
- Community 255
- Community 256
- Community 257
- Community 258
- Community 259
- Community 260
- Community 261
- Community 262
- Community 263
- Community 264
- Community 265
- Community 266
- Community 268
- Community 269
- Community 270
- Community 271
- Community 272
- Community 273
- Community 274
- Community 275
- Community 276
- Community 277
- Community 278
- Community 279
- Community 280
- Community 281
- Community 282
- Community 283
- Community 284
- Community 285
- Community 295
- Community 296
- Community 299

## God Nodes (most connected - your core abstractions)
1. `cn()` - 273 edges
2. `cn()` - 273 edges
3. `customFetch()` - 94 edges
4. `withQueryKey()` - 46 edges
5. `db` - 45 edges
6. `usersTable` - 40 edges
7. `scripts` - 37 edges
8. `providerProfilesTable` - 36 edges
9. `useColors()` - 34 edges
10. `ROUTES` - 26 edges

## Surprising Connections (you probably didn't know these)
- `TxResult` --references--> `bookingsTable`  [EXTRACTED]
  artifacts/api-server/src/routes/bookings.ts → lib/db/src/schema/bookings.ts
- `ProviderProfile()` --calls--> `useGetProviderAvailability()`  [EXTRACTED]
  artifacts/web/src/pages/provider-profile.tsx → lib/api-client-react/src/generated/api.ts
- `ProviderProfile()` --calls--> `useGetProviderById()`  [EXTRACTED]
  artifacts/web/src/pages/provider-profile.tsx → lib/api-client-react/src/generated/api.ts
- `ProviderProfile()` --calls--> `useListProviderServices()`  [EXTRACTED]
  artifacts/web/src/pages/provider-profile.tsx → lib/api-client-react/src/generated/api.ts
- `BookingModal()` --calls--> `useGetProviderSlots()`  [EXTRACTED]
  artifacts/mobile/app/provider/[id].tsx → lib/api-client-react/src/generated/api.ts

## Import Cycles
- None detected.

## Communities (300 total, 32 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.01
Nodes (246): AcceptRescheduleRequestParams, AcceptRescheduleRequestResponse, AddMyServiceAreaPrefixBody, AddMyServiceAreaPrefixResponse, ApproveProviderApplicationBody, ApproveProviderApplicationParams, ApproveProviderApplicationResponse, CheckBookingPageServiceAreaBody (+238 more)

### Community 1 - "Community 1"
Cohesion: 0.01
Nodes (215): AcceptRescheduleRequestMutationError, AcceptRescheduleRequestMutationResult, AddMyServiceAreaPrefixMutationBody, AddMyServiceAreaPrefixMutationError, AddMyServiceAreaPrefixMutationResult, ApproveProviderApplicationMutationBody, ApproveProviderApplicationMutationError, ApproveProviderApplicationMutationResult (+207 more)

### Community 2 - "Community 2"
Cohesion: 0.01
Nodes (189): AcceptRescheduleResponse, AddServiceAreaPrefixRequest, AdminProviderApplicationResponse, AdminProviderApplicationView, AdminVerificationQueueItem, AdminVerificationQueueItemProvider, AdminVerificationQueueResponse, ApplicationCompletion (+181 more)

### Community 3 - "Community 3"
Cohesion: 0.04
Nodes (69): AccordionContent, AccordionItem, AccordionTrigger, Avatar, AvatarFallback, AvatarImage, Breadcrumb, BreadcrumbEllipsis() (+61 more)

### Community 4 - "Community 4"
Cohesion: 0.03
Nodes (43): AddServiceAreaPrefixRequest, ApproveProviderApplicationRequest, BadRequestResponse, ConflictResponse, CreateEscalationRequest, CreateRescheduleRequest, CreateReviewRequest, CreateServiceRequest (+35 more)

### Community 5 - "Community 5"
Cohesion: 0.05
Nodes (66): AccordionContent, AccordionItem, AccordionTrigger, AlertDialogOverlay, Avatar, AvatarFallback, AvatarImage, Breadcrumb (+58 more)

### Community 6 - "Community 6"
Cohesion: 0.04
Nodes (62): Booking, InsertBooking, insertBookingSchema, InsertInvoice, insertInvoiceSchema, Invoice, invoiceStatusEnum, InsertMarketplaceEvent (+54 more)

### Community 7 - "Community 7"
Cohesion: 0.03
Nodes (76): customFetch(), isRequest(), resolveMethod(), acceptRescheduleRequest(), addMyServiceAreaPrefix(), checkBookingPageServiceArea(), checkProviderServiceArea(), createProviderApplication() (+68 more)

### Community 8 - "Community 8"
Cohesion: 0.05
Nodes (46): getSecret(), JwtPayload, signToken(), verifyToken(), emitNewBooking(), NewBookingPayload, NotificationBus, NotificationPayload (+38 more)

### Community 9 - "Community 9"
Cohesion: 0.07
Nodes (36): LoginScreen(), styles, RegisterScreen(), styles, NotFoundScreen(), styles, ClientOnboardingScreen(), styles (+28 more)

### Community 10 - "Community 10"
Cohesion: 0.06
Nodes (33): ApplicationEventType, createApplicationNotification(), NOTIFICATION_CONTENT, Tx, ActivationEmissionContext, ActivationEventType, emitProviderActivationEvents(), insertEvent() (+25 more)

### Community 11 - "Community 11"
Cohesion: 0.09
Nodes (26): EligibilityResult, Props, ServiceAreaCheck(), ServiceAreaSummary, STATUS_PRESENTATION, CANADIAN_PROVINCES, SERVICE_AREA_UNAVAILABLE_MESSAGE, ProviderProfile() (+18 more)

### Community 12 - "Community 12"
Cohesion: 0.04
Nodes (48): devDependencies, babel-plugin-react-compiler, expo, expo-constants, expo-glass-effect, expo-linear-gradient, expo-linking, expo-location (+40 more)

### Community 13 - "Community 13"
Cohesion: 0.09
Nodes (24): AdminProviderApplicationResponse, AdminProviderApplicationView, ApplicationCompletion, ApplicationCompletionResponse, AuthResponse, MeResponse, MeResponseUser, OnboardingState (+16 more)

### Community 14 - "Community 14"
Cohesion: 0.07
Nodes (25): SupportContactLink(), HookResult, mockContact, VerificationStep(), FIELD_LABELS, nextRoute(), Register(), serverFieldError() (+17 more)

### Community 15 - "Community 15"
Cohesion: 0.06
Nodes (38): SheetContent, SheetContentProps, SheetDescription, SheetFooter(), SheetHeader(), SheetOverlay, SheetTitle, sheetVariants (+30 more)

### Community 16 - "Community 16"
Cohesion: 0.06
Nodes (37): SheetContent, SheetContentProps, SheetDescription, SheetFooter(), SheetHeader(), SheetOverlay, SheetTitle, sheetVariants (+29 more)

### Community 17 - "Community 17"
Cohesion: 0.06
Nodes (20): SUPPORTED_COUNTRY_CODES, ALLOWED_DOC_TYPES, ApplicationRow, BookingPageProfileRow, buildStatusView(), computeDashboardMetrics(), DASHBOARD_ACTIVE_STATUSES, DASHBOARD_ACTIVITY_TYPES (+12 more)

### Community 18 - "Community 18"
Cohesion: 0.06
Nodes (36): devDependencies, chokidar, class-variance-authority, clsx, cmdk, fast-glob, @hookform/resolvers, @radix-ui/react-tooltip (+28 more)

### Community 19 - "Community 19"
Cohesion: 0.07
Nodes (34): AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter(), AlertDialogHeader(), AlertDialogOverlay, AlertDialogTitle (+26 more)

### Community 20 - "Community 20"
Cohesion: 0.09
Nodes (25): EarningsPreview(), PerformanceMetrics(), Tone, TONE_STYLES, QuickActions(), ACTIVITY_META, RecentActivity(), SOURCE_ROWS (+17 more)

### Community 21 - "Community 21"
Cohesion: 0.07
Nodes (30): AccountRole, loadRoleState(), ProviderApplicationState, ROLE_ORDER, RoleState, router, withRoleState(), applicationStatusForProfile() (+22 more)

### Community 22 - "Community 22"
Cohesion: 0.05
Nodes (38): devDependencies, axe-core, clsx, cmdk, jsdom, react, react-icons, @replit/vite-plugin-dev-banner (+30 more)

### Community 23 - "Community 23"
Cohesion: 0.11
Nodes (19): BookingStatus, ClientCareHistoryEntry, ClientCareHistoryProvider, ClientCareHistoryResponse, ClientCareHistoryService, EscalationResponse, EscalationTicket, EscalationTicketStatus (+11 more)

### Community 24 - "Community 24"
Cohesion: 0.05
Nodes (37): scripts, backfill:role-state, build, dev, replay:prevented-bookings, seed, start, test (+29 more)

### Community 25 - "Community 25"
Cohesion: 0.12
Nodes (24): BookingPageCard(), mockGet, mockPublish, mockUnpublish, published, publishMutate, toDataURL, unpublished (+16 more)

### Community 26 - "Community 26"
Cohesion: 0.16
Nodes (16): errorStatus(), formatDateTime(), Phase, styles, SubmissionHistoryTimeline(), TimelineNode(), errorStatus(), formatDateTime() (+8 more)

### Community 27 - "Community 27"
Cohesion: 0.06
Nodes (22): Checkbox, HoverCardContent, InputOTP, InputOTPGroup, InputOTPSeparator, InputOTPSlot, Kbd(), KbdGroup() (+14 more)

### Community 28 - "Community 28"
Cohesion: 0.06
Nodes (23): Alert, AlertDescription, AlertTitle, alertVariants, Badge(), BadgeProps, badgeVariants, Calendar() (+15 more)

### Community 29 - "Community 29"
Cohesion: 0.11
Nodes (29): CANADIAN_PROVINCES, ClientLocationInput, DbExecutor, DEFAULT_TRAVEL_SETUP_BUFFER_MINUTES, deriveFsa(), evaluateBookingLocation(), evaluateServiceAreaEligibility(), FSA_LETTER_PROVINCES (+21 more)

### Community 30 - "Community 30"
Cohesion: 0.11
Nodes (22): apiError(), AvailabilityStep(), AvailabilityStepProps, DAY_NAMES, DOC_TYPES, EMPTY_SERVICE, EMPTY_SLOT, fmtTime() (+14 more)

### Community 31 - "Community 31"
Cohesion: 0.14
Nodes (25): BookingDetailScreen(), formatDate(), STATUS_META, styles, ProviderScreen(), ClientBookingStatus, STATUS_FEEDBACK, useClientBookingStatusFeedback() (+17 more)

### Community 32 - "Community 32"
Cohesion: 0.13
Nodes (23): ActivationOverview(), PilotContextCard(), ACTIVATION_STATUS_LABELS, formatPercent(), formatPilotDate(), MILESTONE_STEPS, RISK_FLAG_LABELS, riskFlagLabel() (+15 more)

### Community 33 - "Community 33"
Cohesion: 0.12
Nodes (22): ALLOWED_TRANSITIONS, BookingStatus, isTransitionAllowed(), TERMINAL_STATUSES, CANCELLATION_CATEGORIES, CancellationCategory, computeCancellationCategory(), computeFreeCancellationDeadline() (+14 more)

### Community 34 - "Community 34"
Cohesion: 0.12
Nodes (17): BookingModal(), PROVINCE_CODES, styles, toDateStr(), upcomingDays(), BookingModal(), BookingModalProps, Service (+9 more)

### Community 35 - "Community 35"
Cohesion: 0.12
Nodes (32): Button, Empty(), EmptyContent(), EmptyDescription(), EmptyHeader(), EmptyMedia(), emptyMediaVariants, EmptyTitle() (+24 more)

### Community 36 - "Community 36"
Cohesion: 0.13
Nodes (16): ButtonGroup(), ButtonGroupSeparator(), ButtonGroupText(), buttonGroupVariants, Field(), FieldContent(), FieldDescription(), FieldError() (+8 more)

### Community 37 - "Community 37"
Cohesion: 0.07
Nodes (27): TxResult, api(), createBooking(), login(), patchStatus(), propose(), api(), createBooking() (+19 more)

### Community 38 - "Community 38"
Cohesion: 0.12
Nodes (26): basePath, checkMetroHealth(), clearMetroCache(), downloadAssets(), downloadBundle(), downloadBundlesAndManifests(), downloadFile(), downloadManifest() (+18 more)

### Community 39 - "Community 39"
Cohesion: 0.06
Nodes (37): PushNotificationManager(), queryClient, ErrorBoundary, ErrorBoundaryProps, ErrorBoundaryState, ErrorFallback(), ErrorFallbackProps, styles (+29 more)

### Community 40 - "Community 40"
Cohesion: 0.10
Nodes (23): Field(), FieldContent(), FieldDescription(), FieldError(), FieldGroup(), FieldLabel(), FieldLegend(), FieldSeparator() (+15 more)

### Community 41 - "Community 41"
Cohesion: 0.12
Nodes (24): Toast, ToastAction, ToastActionElement, ToastClose, ToastDescription, ToastProps, ToastTitle, toastVariants (+16 more)

### Community 42 - "Community 42"
Cohesion: 0.19
Nodes (12): FormControl, FormDescription, FormFieldContext, FormFieldContextValue, FormItem, FormItemContext, FormItemContextValue, FormLabel (+4 more)

### Community 43 - "Community 43"
Cohesion: 0.21
Nodes (24): API, BASE, bookViaPublicPage(), checkEligibility(), ensurePilotProvider(), findBookingByInstant(), loadSlotPool(), login() (+16 more)

### Community 44 - "Community 44"
Cohesion: 0.12
Nodes (22): RescheduleModal(), Service, styles, toDateStr(), upcomingDays(), RescheduleModal(), RescheduleModalProps, Service (+14 more)

### Community 45 - "Community 45"
Cohesion: 0.12
Nodes (23): Toast, ToastAction, ToastActionElement, ToastClose, ToastDescription, ToastProps, ToastTitle, toastVariants (+15 more)

### Community 46 - "Community 46"
Cohesion: 0.50
Nodes (4): getGetMyVerificationQueryKey(), getGetMyVerificationQueryOptions(), getGetMyVerificationUrl(), getMyVerification()

### Community 47 - "Community 47"
Cohesion: 0.15
Nodes (13): ListingPreview, ListingPreviewApplicationStatus, ListingPreviewProfile, ListingPreviewResponse, ListingPreviewService, ListingPreviewSlotDay, ListingPreviewVerificationStatus, ProviderReadiness (+5 more)

### Community 48 - "Community 48"
Cohesion: 0.08
Nodes (25): workspace, compilerOptions, alwaysStrict, customConditions, incremental, isolatedModules, lib, module (+17 more)

### Community 49 - "Community 49"
Cohesion: 0.13
Nodes (22): formatInstant(), Props, RescheduleProposalCard(), styles, formatInstant(), Props, RescheduleProposalCard(), acceptMutate (+14 more)

### Community 50 - "Community 50"
Cohesion: 0.07
Nodes (33): App(), clientRoute(), providerRoute(), queryClient, Router(), LEGACY_PORTAL_REDIRECTS, Discover(), Login() (+25 more)

### Community 51 - "Community 51"
Cohesion: 0.15
Nodes (20): CancellationPolicyNotice(), AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter(), AlertDialogHeader(), AlertDialogTitle (+12 more)

### Community 52 - "Community 52"
Cohesion: 0.08
Nodes (23): dependencies, bcryptjs, cookie-parser, cors, expo-server-sdk, express, jsonwebtoken, pino (+15 more)

### Community 53 - "Community 53"
Cohesion: 0.06
Nodes (30): apiFetch(), collectSlots(), JsonBody, register(), apiFetch(), firstAvailableSlot(), JsonBody, Readiness (+22 more)

### Community 54 - "Community 54"
Cohesion: 0.15
Nodes (20): AvailabilityWindow, dayOfWeekForDate(), DEFAULT_MARKETPLACE_TIMEZONE, fieldsMatch(), GeneratedSlot, generateSlotsForDate(), getLocalFields(), getMarketplaceTimezone() (+12 more)

### Community 55 - "Community 55"
Cohesion: 0.09
Nodes (21): reactCompiler, typedRoutes, expo, android, experiments, icon, ios, name (+13 more)

### Community 56 - "Community 56"
Cohesion: 0.17
Nodes (11): PilotMetricsResponse, PilotMetricsResponsePilot, PilotMetricsResponseSourceAttributionItem, PilotMetricsResponseSummary, PilotProviderMetrics, PilotProviderMetricsActivationStatus, PilotProviderMetricsOnboardingMilestones, PilotRetentionIntent (+3 more)

### Community 57 - "Community 57"
Cohesion: 0.17
Nodes (11): ProviderActivityItem, ProviderActivityItemType, ProviderDashboardBooking, ProviderDashboardBookingStatus, ProviderDashboardResponse, ProviderDashboardResponseNextBooking, ProviderDashboardResponseNextBookingStatus, ProviderEarningsPreview (+3 more)

### Community 58 - "Community 58"
Cohesion: 0.10
Nodes (21): devDependencies, esbuild, esbuild-plugin-pino, pino-pretty, thread-stream, tsx, @types/bcryptjs, @types/cookie-parser (+13 more)

### Community 59 - "Community 59"
Cohesion: 0.13
Nodes (18): ActivationStatus, computePilotMetrics(), dateKey(), parseIsoDate(), PILOT_PROVIDER_TARGET, PILOT_WEEKS_FALLBACK, PilotMetricsResponse, PilotProviderMetrics (+10 more)

### Community 60 - "Community 60"
Cohesion: 0.15
Nodes (20): ALLOWED_PATHS, ALLOWED_TOP_LEVEL_KEYS, auditRecord(), Classification, CliParseResult, existsWithRetry(), FLAG_OPTIONS, insertWithRetry() (+12 more)

### Community 61 - "Community 61"
Cohesion: 0.12
Nodes (17): apiError(), AvailabilityStep(), DAY_NAMES, DAY_NAMES_FULL, DOC_TYPES, DocType, EMPTY_SERVICE, fmtTime() (+9 more)

### Community 62 - "Community 62"
Cohesion: 0.14
Nodes (14): expo, getExpoTokens(), PushPayload, sendPushToUser(), computeProposalDeadline(), DEFAULT_PROVIDER_PROPOSAL_LIMIT, getProviderProposalLimit(), PROPOSAL_REMINDER_LEAD_MS (+6 more)

### Community 63 - "Community 63"
Cohesion: 0.23
Nodes (13): errorStatus(), formatDateTime(), ProviderApplicationStatusScreen(), statusCopy, styles, formatDateTime(), ProviderApplicationStatus(), statusHeadline (+5 more)

### Community 64 - "Community 64"
Cohesion: 0.12
Nodes (11): api(), API_SERVER_DIR, createBooking(), login(), PAYLOAD_KEYS, runJob(), servers, sha256() (+3 more)

### Community 65 - "Community 65"
Cohesion: 0.13
Nodes (17): ButtonGroup(), ButtonGroupSeparator(), ButtonGroupText(), buttonGroupVariants, Item(), ItemActions(), ItemContent(), ItemDescription() (+9 more)

### Community 66 - "Community 66"
Cohesion: 0.18
Nodes (12): Item(), ItemActions(), ItemContent(), ItemDescription(), ItemFooter(), ItemGroup(), ItemHeader(), ItemMedia() (+4 more)

### Community 67 - "Community 67"
Cohesion: 0.13
Nodes (17): PortalServiceArea(), addMutate, configured, mockAdd, mockGet, mockRemove, mockUpdate, removeMutate (+9 more)

### Community 68 - "Community 68"
Cohesion: 0.19
Nodes (10): AcceptRescheduleResponse, Booking, BookingListResponse, BookingResponse, DeclineRescheduleResponse, RescheduleProposal, RescheduleProposalListResponse, RescheduleProposalRequesterRole (+2 more)

### Community 69 - "Community 69"
Cohesion: 0.19
Nodes (10): AdminVerificationQueueItem, AdminVerificationQueueItemProvider, AdminVerificationQueueResponse, ReviewVerificationDocRequest, ReviewVerificationDocRequestUpdateProviderStatus, VerificationDoc, VerificationDocResponse, VerificationDocStatus (+2 more)

### Community 70 - "Community 70"
Cohesion: 0.14
Nodes (16): appName, basePath, escapeHtml(), fs, http, landingPageTemplate, MIME_TYPES, path (+8 more)

### Community 71 - "Community 71"
Cohesion: 0.11
Nodes (17): aliases, components, hooks, lib, ui, utils, iconLibrary, rsc (+9 more)

### Community 72 - "Community 72"
Cohesion: 0.21
Nodes (9): BookingPageSettings, MyBookingPageResponse, ProviderApplicationProfile, ProviderListResponse, ProviderProfile, ProviderProfileResponse, ProviderSummary, PublicBookingPageProvider (+1 more)

### Community 73 - "Community 73"
Cohesion: 0.22
Nodes (9): PublicAvailabilityResponse, PublicAvailabilityWindow, PublicBookingPage, PublicBookingPageResponse, PublicCancellationPolicySummary, PublicServiceAreaSummary, Service, ServiceListResponse (+1 more)

### Community 74 - "Community 74"
Cohesion: 0.22
Nodes (15): addMoney(), assertCurrency(), assertMinorAmount(), assertSameCurrency(), createMoney(), CurrencyCode, isPaymentTransitionAllowed(), Money (+7 more)

### Community 75 - "Community 75"
Cohesion: 0.15
Nodes (6): apiFetch(), getMetrics(), JsonBody, login(), makeAdmin(), register()

### Community 76 - "Community 76"
Cohesion: 0.21
Nodes (12): apiFetch(), appFor(), approve(), fillDraft(), JsonBody, listNotifs(), login(), promoteToAdmin() (+4 more)

### Community 77 - "Community 77"
Cohesion: 0.12
Nodes (14): Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator, CommandShortcut() (+6 more)

### Community 78 - "Community 78"
Cohesion: 0.12
Nodes (16): aliases, components, hooks, lib, ui, utils, rsc, $schema (+8 more)

### Community 79 - "Community 79"
Cohesion: 0.12
Nodes (25): ClientLayout(), ProviderLayout(), ReadinessChecklist(), ReadinessSummaryCard(), Progress, NewBookingEvent, StreamEvent, useProviderNotifications() (+17 more)

### Community 80 - "Community 80"
Cohesion: 0.20
Nodes (9): DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuShortcut(), DropdownMenuSubContent (+1 more)

### Community 81 - "Community 81"
Cohesion: 0.12
Nodes (11): Menubar, MenubarCheckboxItem, MenubarContent, MenubarItem, MenubarLabel, MenubarRadioItem, MenubarSeparator, MenubarShortcut() (+3 more)

### Community 82 - "Community 82"
Cohesion: 0.12
Nodes (16): @types/node, @types/node, @types/node, drizzle-kit, devDependencies, drizzle-kit, @types/node, @types/pg (+8 more)

### Community 83 - "Community 83"
Cohesion: 0.17
Nodes (15): FLAG_OPTIONS, isValidUtcDay(), main(), parseRebuildCliOptions(), ProjectionSums, QueryClient, RangeSql, readProjectionSums() (+7 more)

### Community 84 - "Community 84"
Cohesion: 0.13
Nodes (7): TARGET_FINGERPRINT_LENGTH, API_SERVER_DIR, liveArgs(), sha256(), tmp, WRONG_FINGERPRINT, ZERO_SHA

### Community 85 - "Community 85"
Cohesion: 0.13
Nodes (7): API_SERVER_DIR, AUTHORIZED_FILES, insertFixtureMatrix(), insertSource(), MIGRATION_ARTIFACT, REPO_ROOT, WRONG_FINGERPRINT

### Community 86 - "Community 86"
Cohesion: 0.21
Nodes (11): apiFetch(), appFor(), fillDraft(), JsonBody, list(), markRead(), provisionSubmittable(), register() (+3 more)

### Community 87 - "Community 87"
Cohesion: 0.12
Nodes (15): dependencies, qrcode, qrcode, name, private, scripts, build, dev (+7 more)

### Community 88 - "Community 88"
Cohesion: 0.25
Nodes (6): DrawerContent, DrawerDescription, DrawerFooter(), DrawerHeader(), DrawerOverlay, DrawerTitle

### Community 89 - "Community 89"
Cohesion: 0.13
Nodes (14): dependencies, expo-notifications, main, name, private, scripts, build, dev (+6 more)

### Community 90 - "Community 90"
Cohesion: 0.13
Nodes (14): typescript, devDependencies, prettier, typescript, engines, node, pnpm, typescript (+6 more)

### Community 91 - "Community 91"
Cohesion: 0.40
Nodes (5): getGetProviderNotificationsQueryKey(), getGetProviderNotificationsQueryOptions(), getGetProviderNotificationsUrl(), getProviderNotifications(), useGetProviderNotifications()

### Community 92 - "Community 92"
Cohesion: 0.16
Nodes (14): applyWeekdayPreset(), DAYS, PortalAvailability(), WEEKDAYS, getGetMyAvailabilityQueryKey(), getGetMyAvailabilityQueryOptions(), getGetMyAvailabilityUrl(), getMyAvailability() (+6 more)

### Community 93 - "Community 93"
Cohesion: 0.14
Nodes (13): @workspace/db, dependencies, @workspace/db, name, private, scripts, hello, smoke:mobile-emulation (+5 more)

### Community 94 - "Community 94"
Cohesion: 0.10
Nodes (15): apiFetch(), fillDraftForSubmission(), JsonBody, markRejected(), register(), runRejectionCycle(), apiFetch(), application() (+7 more)

### Community 95 - "Community 95"
Cohesion: 0.14
Nodes (13): @tanstack/react-query, @tanstack/react-query, @tanstack/react-query, dependencies, @tanstack/react-query, exports, react, name (+5 more)

### Community 96 - "Community 96"
Cohesion: 0.21
Nodes (10): DiscoveredComponent, mockupPreviewPlugin(), discoverComponents(), generateSource(), getGeneratedModuleAbsPath(), getMockupsAbsDir(), isMockupFile(), onFileAddedOrRemoved() (+2 more)

### Community 97 - "Community 97"
Cohesion: 0.22
Nodes (11): App(), Gallery(), getBasePath(), getPreviewExamplePath(), getPreviewPath(), ModuleMap, PreviewRenderer(), loadComponent() (+3 more)

### Community 98 - "Community 98"
Cohesion: 0.14
Nodes (13): compilerOptions, allowImportingTsExtensions, esModuleInterop, incremental, jsx, noEmit, paths, tsBuildInfoFile (+5 more)

### Community 99 - "Community 99"
Cohesion: 0.19
Nodes (13): Carousel, CarouselApi, CarouselContent, CarouselContext, CarouselContextProps, CarouselItem, CarouselNext, CarouselOptions (+5 more)

### Community 100 - "Community 100"
Cohesion: 0.16
Nodes (13): AdminVerification(), FilterStatus, PROVIDER_STATUS_OPTIONS, getAdminVerificationQueue(), getGetAdminVerificationQueueQueryKey(), getGetAdminVerificationQueueQueryOptions(), getGetAdminVerificationQueueUrl(), getReviewVerificationDocMutationOptions() (+5 more)

### Community 101 - "Community 101"
Cohesion: 0.14
Nodes (14): scripts, build, build:deploy, db:push, git:check, preinstall, publish:gate, seed (+6 more)

### Community 102 - "Community 102"
Cohesion: 0.15
Nodes (12): compilerOptions, baseUrl, paths, strict, extends, include, references, expo-env.d.ts (+4 more)

### Community 103 - "Community 103"
Cohesion: 0.21
Nodes (10): InputGroup(), InputGroupAddon(), inputGroupAddonVariants, InputGroupButton(), inputGroupButtonVariants, InputGroupInput(), InputGroupText(), InputGroupTextarea() (+2 more)

### Community 104 - "Community 104"
Cohesion: 0.15
Nodes (12): exclude, build, dist, exclude, extends, include, build, dist (+4 more)

### Community 105 - "Community 105"
Cohesion: 0.18
Nodes (11): ExistingReview, InputGroup(), InputGroupAddon(), inputGroupAddonVariants, InputGroupButton(), inputGroupButtonVariants, InputGroupInput(), InputGroupText() (+3 more)

### Community 106 - "Community 106"
Cohesion: 0.18
Nodes (10): BOOKING_ATTRIBUTION_SOURCES, BookingAttributionSource, isValidBookingPageSlug(), normalizeBookingSource(), SLUG_MAX_LENGTH, SLUG_MIN_LENGTH, slugCandidate(), slugifyDisplayName() (+2 more)

### Community 107 - "Community 107"
Cohesion: 0.18
Nodes (7): apiFetch(), InsertStatus, JsonBody, now, register(), todaySafe, tomorrow

### Community 108 - "Community 108"
Cohesion: 0.20
Nodes (6): apiFetch(), getSlots(), JsonBody, MESSAGES, NOT_FOUND_BODY, register()

### Community 109 - "Community 109"
Cohesion: 0.17
Nodes (11): compilerOptions, incremental, outDir, rootDir, tsBuildInfoFile, types, extends, include (+3 more)

### Community 110 - "Community 110"
Cohesion: 0.17
Nodes (12): types, node, compilerOptions, allowImportingTsExtensions, jsx, moduleResolution, noEmit, paths (+4 more)

### Community 111 - "Community 111"
Cohesion: 0.29
Nodes (8): buildPilotMetricsCsv(), csvField(), CsvValue, downloadPilotMetricsCsv(), PILOT_CSV_HEADER, pilotMetricsCsvFilename(), row(), RFC-4180

### Community 112 - "Community 112"
Cohesion: 0.17
Nodes (11): compilerOptions, composite, declarationMap, emitDeclarationOnly, outDir, rootDir, types, extends (+3 more)

### Community 113 - "Community 113"
Cohesion: 0.27
Nodes (7): app, req(), thisDir, validatedClientRequestId(), port, logger, router

### Community 114 - "Community 114"
Cohesion: 0.22
Nodes (9): DEFAULT_MARKETPLACE_ID, DEFAULT_MARKETPLACE_SLUG, appendToDlqBestEffort(), PREVENTED_BOOKING_FAILURE_EVT, PreventedBookingEvent, PreventedBookingFailurePayload, PreventedBookingPath, recordPreventedBooking() (+1 more)

### Community 115 - "Community 115"
Cohesion: 0.24
Nodes (6): apiFetch(), configureServiceArea(), firstAvailableSlot(), JsonBody, NOT_FOUND_BODY, register()

### Community 116 - "Community 116"
Cohesion: 0.25
Nodes (9): ChartConfig, ChartContainer, ChartContext, ChartContextProps, ChartLegendContent, ChartTooltipContent, getPayloadConfigFromPayload(), THEMES (+1 more)

### Community 117 - "Community 117"
Cohesion: 0.25
Nodes (9): ChartConfig, ChartContainer, ChartContext, ChartContextProps, ChartLegendContent, ChartTooltipContent, getPayloadConfigFromPayload(), THEMES (+1 more)

### Community 118 - "Community 118"
Cohesion: 0.18
Nodes (10): build, buildCommand, builder, deploy, healthcheckPath, healthcheckTimeout, restartPolicyMaxRetries, restartPolicyType (+2 more)

### Community 119 - "Community 119"
Cohesion: 0.20
Nodes (10): drizzle-orm, drizzle-orm, drizzle-zod, dependencies, drizzle-orm, drizzle-zod, pg, zod (+2 more)

### Community 120 - "Community 120"
Cohesion: 0.29
Nodes (6): apiFetch(), createBooking(), JsonBody, login(), promoteToAdmin(), register()

### Community 121 - "Community 121"
Cohesion: 0.22
Nodes (3): apiFetch(), JsonBody, register()

### Community 122 - "Community 122"
Cohesion: 0.20
Nodes (9): name, private, scripts, build, dev, preview, typecheck, type (+1 more)

### Community 123 - "Community 123"
Cohesion: 0.20
Nodes (9): ButtonProps, Pagination(), PaginationContent, PaginationEllipsis(), PaginationItem, PaginationLink(), PaginationLinkProps, PaginationNext() (+1 more)

### Community 124 - "Community 124"
Cohesion: 0.20
Nodes (8): extends, include, src, compileOnSave, extends, files, ./tsconfig.base.json, references

### Community 125 - "Community 125"
Cohesion: 0.38
Nodes (5): MyServiceArea, MyServiceAreaBufferSource, MyServiceAreaPrefix, MyServiceAreaResponse, ServiceAreaPrefixResponse

### Community 126 - "Community 126"
Cohesion: 0.38
Nodes (5): ProviderNotification, ProviderNotificationListResponse, ProviderNotificationReadResponse, ProviderNotificationsPagination, ProviderNotificationType

### Community 127 - "Community 127"
Cohesion: 0.20
Nodes (9): compilerOptions, composite, declarationMap, emitDeclarationOnly, outDir, rootDir, extends, include (+1 more)

### Community 128 - "Community 128"
Cohesion: 0.20
Nodes (9): exports, ./schema, name, private, scripts, push, push-force, type (+1 more)

### Community 129 - "Community 129"
Cohesion: 0.33
Nodes (7): isActiveBookingDuplicateViolation(), apiFetch(), bookingPayload(), createBooking(), loadSlotPool(), login(), slotPool

### Community 130 - "Community 130"
Cohesion: 0.31
Nodes (6): apiFetch(), getSlots(), login(), putSlots(), Slot, WEEKDAYS

### Community 131 - "Community 131"
Cohesion: 0.39
Nodes (8): apiFetch(), createBooking(), getBooking(), loadSlotPool(), login(), nextAvailableSlot(), patchStatus(), slotPool

### Community 132 - "Community 132"
Cohesion: 0.22
Nodes (9): compilerOptions, composite, declarationMap, emitDeclarationOnly, lib, outDir, rootDir, dom (+1 more)

### Community 133 - "Community 133"
Cohesion: 0.22
Nodes (8): devDependencies, orval, name, private, scripts, codegen, version, orval

### Community 134 - "Community 134"
Cohesion: 0.22
Nodes (8): dependencies, zod, exports, zod, name, private, type, version

### Community 135 - "Community 135"
Cohesion: 0.22
Nodes (8): InsertProviderCoverageArea, insertProviderCoverageAreaSchema, InsertProviderServiceArea, insertProviderServiceAreaSchema, ProviderCoverageArea, providerCoverageAreasTable, ProviderServiceArea, providerServiceAreasTable

### Community 136 - "Community 136"
Cohesion: 0.22
Nodes (8): compilerOptions, outDir, rootDir, types, extends, include, node, src

### Community 137 - "Community 137"
Cohesion: 0.43
Nodes (7): apiFetch(), createBooking(), loadSlotPool(), login(), nextAvailableSlot(), patchStatus(), slotPool

### Community 138 - "Community 138"
Cohesion: 0.32
Nodes (4): apiFetch(), JsonBody, registerClient(), registerProvider()

### Community 139 - "Community 139"
Cohesion: 0.25
Nodes (6): DrawerContent, DrawerDescription, DrawerFooter(), DrawerHeader(), DrawerOverlay, DrawerTitle

### Community 140 - "Community 140"
Cohesion: 0.29
Nodes (7): Empty(), EmptyContent(), EmptyDescription(), EmptyHeader(), EmptyMedia(), emptyMediaVariants, EmptyTitle()

### Community 141 - "Community 141"
Cohesion: 0.29
Nodes (7): NavigationMenu, NavigationMenuContent, NavigationMenuIndicator, NavigationMenuList, NavigationMenuTrigger, navigationMenuTriggerStyle, NavigationMenuViewport

### Community 142 - "Community 142"
Cohesion: 0.29
Nodes (7): NavigationMenu, NavigationMenuContent, NavigationMenuIndicator, NavigationMenuList, NavigationMenuTrigger, navigationMenuTriggerStyle, NavigationMenuViewport

### Community 143 - "Community 143"
Cohesion: 0.46
Nodes (4): Invoice, InvoiceListResponse, InvoiceResponse, InvoiceStatus

### Community 144 - "Community 144"
Cohesion: 0.43
Nodes (4): UpdateEscalationRequest, UpdateEscalationRequestCorrection, UpdateEscalationRequestCorrectionStatus, UpdateEscalationRequestStatus

### Community 145 - "Community 145"
Cohesion: 0.48
Nodes (6): apiFetch(), createCompletedBooking(), loadSlotPool(), login(), nextAvailableSlot(), slotPool

### Community 146 - "Community 146"
Cohesion: 0.48
Nodes (6): apiFetch(), createCompletedBooking(), loadSlotPool(), login(), nextAvailableSlot(), slotPool

### Community 147 - "Community 147"
Cohesion: 0.29
Nodes (7): lib, dom, es2022, lib, dom, dom.iterable, esnext

### Community 148 - "Community 148"
Cohesion: 0.43
Nodes (5): ToggleGroup, ToggleGroupContext, ToggleGroupItem, Toggle, toggleVariants

### Community 149 - "Community 149"
Cohesion: 0.33
Nodes (5): "booking_outcome_history", "bookings", "public"."bookings", "public"."users", "support_tickets"

### Community 150 - "Community 150"
Cohesion: 0.33
Nodes (5): prevented_booking_records, bookings, provider_profiles, services, users

### Community 151 - "Community 151"
Cohesion: 0.47
Nodes (5): "booking_reschedule_history", "booking_reschedule_proposals", "public"."bookings", "public"."users", "public"."booking_reschedule_proposals"

### Community 152 - "Community 152"
Cohesion: 0.53
Nodes (3): CancellationPreviewResponse, CancellationPreviewResponsePreview, CancellationPreviewResponsePreviewOutcome

### Community 153 - "Community 153"
Cohesion: 0.60
Nodes (3): EarningsExportItem, EarningsExportResponse, EarningsExportResponseProvider

### Community 154 - "Community 154"
Cohesion: 0.60
Nodes (3): RegisterRequest, RegisterRequestRole, RegisterRequestRoleIntent

### Community 155 - "Community 155"
Cohesion: 0.60
Nodes (3): Review, ReviewListResponse, ReviewResponse

### Community 156 - "Community 156"
Cohesion: 0.60
Nodes (3): ServiceAreaCheckResponse, ServiceAreaEligibility, ServiceAreaEligibilityState

### Community 157 - "Community 157"
Cohesion: 0.60
Nodes (3): TravelZone, TravelZoneListResponse, TravelZoneResponse

### Community 158 - "Community 158"
Cohesion: 0.40
Nodes (5): loadProviderCoverage(), hasActiveServiceAreaCoverage(), httpError(), loadOwnedBooking(), validateProposedTime()

### Community 159 - "Community 159"
Cohesion: 0.60
Nodes (4): api(), JsonBody, login(), registerProvider()

### Community 160 - "Community 160"
Cohesion: 0.40
Nodes (5): plugins, expo-font, expo-web-browser, expo-font, expo-web-browser

### Community 161 - "Community 161"
Cohesion: 0.50
Nodes (4): Alert, AlertDescription, AlertTitle, alertVariants

### Community 162 - "Community 162"
Cohesion: 0.50
Nodes (4): getListMyServicesQueryKey(), getListMyServicesQueryOptions(), getListMyServicesUrl(), listMyServices()

### Community 163 - "Community 163"
Cohesion: 0.40
Nodes (5): getAdminPilotMetrics(), getGetAdminPilotMetricsQueryKey(), getGetAdminPilotMetricsQueryOptions(), getGetAdminPilotMetricsUrl(), useGetAdminPilotMetrics()

### Community 164 - "Community 164"
Cohesion: 0.40
Nodes (5): getApplicationAvailability(), getGetApplicationAvailabilityQueryKey(), getGetApplicationAvailabilityQueryOptions(), getGetApplicationAvailabilityUrl(), useGetApplicationAvailability()

### Community 165 - "Community 165"
Cohesion: 0.40
Nodes (5): getGetInvoiceQueryKey(), getGetInvoiceQueryOptions(), getGetInvoiceUrl(), getInvoice(), useGetInvoice()

### Community 166 - "Community 166"
Cohesion: 0.40
Nodes (5): getGetMyProviderMetricsQueryKey(), getGetMyProviderMetricsQueryOptions(), getGetMyProviderMetricsUrl(), getMyProviderMetrics(), useGetMyProviderMetrics()

### Community 167 - "Community 167"
Cohesion: 0.40
Nodes (5): getGetOutcomeHistoryQueryKey(), getGetOutcomeHistoryQueryOptions(), getGetOutcomeHistoryUrl(), getOutcomeHistory(), useGetOutcomeHistory()

### Community 168 - "Community 168"
Cohesion: 0.40
Nodes (5): getGetProviderApplicationCompletionQueryKey(), getGetProviderApplicationCompletionQueryOptions(), getGetProviderApplicationCompletionUrl(), getProviderApplicationCompletion(), useGetProviderApplicationCompletion()

### Community 169 - "Community 169"
Cohesion: 0.40
Nodes (5): getGetProviderApplicationQueryKey(), getGetProviderApplicationQueryOptions(), getGetProviderApplicationUrl(), getProviderApplication(), useGetProviderApplication()

### Community 170 - "Community 170"
Cohesion: 0.40
Nodes (5): getGetReviewQueryKey(), getGetReviewQueryOptions(), getGetReviewUrl(), getReview(), useGetReview()

### Community 171 - "Community 171"
Cohesion: 0.40
Nodes (5): getGetSupportBookingEscalationsQueryKey(), getGetSupportBookingEscalationsQueryOptions(), getGetSupportBookingEscalationsUrl(), getSupportBookingEscalations(), useGetSupportBookingEscalations()

### Community 172 - "Community 172"
Cohesion: 0.40
Nodes (5): getHealthCheckQueryKey(), getHealthCheckQueryOptions(), getHealthCheckUrl(), healthCheck(), useHealthCheck()

### Community 173 - "Community 173"
Cohesion: 0.40
Nodes (5): getListApplicationServicesQueryKey(), getListApplicationServicesQueryOptions(), getListApplicationServicesUrl(), listApplicationServices(), useListApplicationServices()

### Community 174 - "Community 174"
Cohesion: 0.40
Nodes (3): apiClientReactSrc, apiZodSrc, root

### Community 176 - "Community 176"
Cohesion: 0.50
Nodes (4): react-dom, react-dom, react-dom, react-dom

### Community 177 - "Community 177"
Cohesion: 0.50
Nodes (4): @types/react, @types/react, @types/react, @types/react

### Community 178 - "Community 178"
Cohesion: 0.50
Nodes (4): @types/react-dom, @types/react-dom, @types/react-dom, @types/react-dom

### Community 179 - "Community 179"
Cohesion: 0.67
Nodes (3): Badge(), BadgeProps, badgeVariants

### Community 180 - "Community 180"
Cohesion: 0.67
Nodes (3): "provider_coverage_areas", "provider_service_areas", "provider_profiles"

### Community 181 - "Community 181"
Cohesion: 0.50
Nodes (4): approveProviderApplication(), getApproveProviderApplicationMutationOptions(), getApproveProviderApplicationUrl(), useApproveProviderApplication()

### Community 182 - "Community 182"
Cohesion: 0.50
Nodes (4): createApplicationService(), getCreateApplicationServiceMutationOptions(), getCreateApplicationServiceUrl(), useCreateApplicationService()

### Community 183 - "Community 183"
Cohesion: 0.50
Nodes (4): deleteApplicationService(), getDeleteApplicationServiceMutationOptions(), getDeleteApplicationServiceUrl(), useDeleteApplicationService()

### Community 184 - "Community 184"
Cohesion: 0.50
Nodes (4): deleteService(), getDeleteServiceMutationOptions(), getDeleteServiceUrl(), useDeleteService()

### Community 185 - "Community 185"
Cohesion: 0.50
Nodes (4): getBooking(), getGetBookingQueryKey(), getGetBookingQueryOptions(), getGetBookingUrl()

### Community 186 - "Community 186"
Cohesion: 0.50
Nodes (4): getCancellationPreview(), getGetCancellationPreviewQueryKey(), getGetCancellationPreviewQueryOptions(), getGetCancellationPreviewUrl()

### Community 187 - "Community 187"
Cohesion: 0.50
Nodes (4): getClientCareHistory(), getGetClientCareHistoryQueryKey(), getGetClientCareHistoryQueryOptions(), getGetClientCareHistoryUrl()

### Community 188 - "Community 188"
Cohesion: 0.50
Nodes (4): getGetMeQueryKey(), getGetMeQueryOptions(), getGetMeUrl(), getMe()

### Community 189 - "Community 189"
Cohesion: 0.50
Nodes (4): getGetMyBookingPageQueryKey(), getGetMyBookingPageQueryOptions(), getGetMyBookingPageUrl(), getMyBookingPage()

### Community 190 - "Community 190"
Cohesion: 0.50
Nodes (4): getGetMyEarningsExportQueryKey(), getGetMyEarningsExportQueryOptions(), getGetMyEarningsExportUrl(), getMyEarningsExport()

### Community 191 - "Community 191"
Cohesion: 0.50
Nodes (4): getGetMyEarningsQueryKey(), getGetMyEarningsQueryOptions(), getGetMyEarningsUrl(), getMyEarnings()

### Community 192 - "Community 192"
Cohesion: 0.50
Nodes (4): getGetMyListingPreviewQueryKey(), getGetMyListingPreviewQueryOptions(), getGetMyListingPreviewUrl(), getMyListingPreview()

### Community 193 - "Community 193"
Cohesion: 0.50
Nodes (4): getGetMyProviderDashboardQueryKey(), getGetMyProviderDashboardQueryOptions(), getGetMyProviderDashboardUrl(), getMyProviderDashboard()

### Community 194 - "Community 194"
Cohesion: 0.50
Nodes (4): getGetMyProviderProfileQueryKey(), getGetMyProviderProfileQueryOptions(), getGetMyProviderProfileUrl(), getMyProviderProfile()

### Community 195 - "Community 195"
Cohesion: 0.50
Nodes (4): getGetProviderAvailabilityQueryKey(), getGetProviderAvailabilityQueryOptions(), getGetProviderAvailabilityUrl(), getProviderAvailability()

### Community 196 - "Community 196"
Cohesion: 0.50
Nodes (4): getGetProviderByIdQueryKey(), getGetProviderByIdQueryOptions(), getGetProviderByIdUrl(), getProviderById()

### Community 197 - "Community 197"
Cohesion: 0.50
Nodes (4): getGetProviderNotificationUnreadCountQueryKey(), getGetProviderNotificationUnreadCountQueryOptions(), getGetProviderNotificationUnreadCountUrl(), getProviderNotificationUnreadCount()

### Community 198 - "Community 198"
Cohesion: 0.50
Nodes (4): getGetProviderSlotsQueryKey(), getGetProviderSlotsQueryOptions(), getGetProviderSlotsUrl(), getProviderSlots()

### Community 199 - "Community 199"
Cohesion: 0.50
Nodes (4): getGetPublicBookingPageQueryKey(), getGetPublicBookingPageQueryOptions(), getGetPublicBookingPageUrl(), getPublicBookingPage()

### Community 200 - "Community 200"
Cohesion: 0.50
Nodes (4): getGetReschedulingHistoryQueryKey(), getGetReschedulingHistoryQueryOptions(), getGetReschedulingHistoryUrl(), getReschedulingHistory()

### Community 201 - "Community 201"
Cohesion: 0.50
Nodes (4): getGetSupportContactQueryKey(), getGetSupportContactQueryOptions(), getGetSupportContactUrl(), getSupportContact()

### Community 202 - "Community 202"
Cohesion: 0.50
Nodes (4): getListBookingsQueryKey(), getListBookingsQueryOptions(), getListBookingsUrl(), listBookings()

### Community 203 - "Community 203"
Cohesion: 0.50
Nodes (4): getListInvoicesQueryKey(), getListInvoicesQueryOptions(), getListInvoicesUrl(), listInvoices()

### Community 204 - "Community 204"
Cohesion: 0.50
Nodes (4): getListProviderServicesQueryKey(), getListProviderServicesQueryOptions(), getListProviderServicesUrl(), listProviderServices()

### Community 205 - "Community 205"
Cohesion: 0.50
Nodes (4): getListProvidersQueryKey(), getListProvidersQueryOptions(), getListProvidersUrl(), listProviders()

### Community 206 - "Community 206"
Cohesion: 0.50
Nodes (4): getListRescheduleRequestsQueryKey(), getListRescheduleRequestsQueryOptions(), getListRescheduleRequestsUrl(), listRescheduleRequests()

### Community 207 - "Community 207"
Cohesion: 0.50
Nodes (4): getRejectProviderApplicationMutationOptions(), getRejectProviderApplicationUrl(), rejectProviderApplication(), useRejectProviderApplication()

### Community 208 - "Community 208"
Cohesion: 0.50
Nodes (4): getSetApplicationAvailabilityMutationOptions(), getSetApplicationAvailabilityUrl(), setApplicationAvailability(), useSetApplicationAvailability()

### Community 209 - "Community 209"
Cohesion: 0.50
Nodes (4): getSubmitVerificationDocMutationOptions(), getSubmitVerificationDocUrl(), submitVerificationDoc(), useSubmitVerificationDoc()

### Community 210 - "Community 210"
Cohesion: 0.50
Nodes (4): getUpdateApplicationServiceMutationOptions(), getUpdateApplicationServiceUrl(), updateApplicationService(), useUpdateApplicationService()

### Community 211 - "Community 211"
Cohesion: 0.50
Nodes (4): getUpdatePilotProviderRetentionMutationOptions(), getUpdatePilotProviderRetentionUrl(), updatePilotProviderRetention(), useUpdatePilotProviderRetention()

### Community 212 - "Community 212"
Cohesion: 0.50
Nodes (4): getUpdateProviderApplicationMutationOptions(), getUpdateProviderApplicationUrl(), updateProviderApplication(), useUpdateProviderApplication()

### Community 213 - "Community 213"
Cohesion: 0.50
Nodes (4): getUpdateSupportEscalationMutationOptions(), getUpdateSupportEscalationUrl(), updateSupportEscalation(), useUpdateSupportEscalation()

### Community 219 - "Community 219"
Cohesion: 0.50
Nodes (3): InsertPreventedBookingsDaily, PreventedBookingsDaily, preventedBookingsDailyTable

### Community 220 - "Community 220"
Cohesion: 0.83
Nodes (3): fail(), pass(), verify-publication.sh script

### Community 224 - "Community 224"
Cohesion: 0.67
Nodes (3): date-fns, date-fns, date-fns

### Community 225 - "Community 225"
Cohesion: 0.67
Nodes (3): embla-carousel-react, embla-carousel-react, embla-carousel-react

### Community 226 - "Community 226"
Cohesion: 0.67
Nodes (3): framer-motion, framer-motion, framer-motion

### Community 227 - "Community 227"
Cohesion: 0.67
Nodes (3): input-otp, input-otp, input-otp

### Community 228 - "Community 228"
Cohesion: 0.67
Nodes (3): lucide-react, lucide-react, lucide-react

### Community 229 - "Community 229"
Cohesion: 0.67
Nodes (3): next-themes, next-themes, next-themes

### Community 230 - "Community 230"
Cohesion: 0.67
Nodes (3): @radix-ui/react-accordion, @radix-ui/react-accordion, @radix-ui/react-accordion

### Community 231 - "Community 231"
Cohesion: 0.67
Nodes (3): @radix-ui/react-alert-dialog, @radix-ui/react-alert-dialog, @radix-ui/react-alert-dialog

### Community 232 - "Community 232"
Cohesion: 0.67
Nodes (3): @radix-ui/react-aspect-ratio, @radix-ui/react-aspect-ratio, @radix-ui/react-aspect-ratio

### Community 233 - "Community 233"
Cohesion: 0.67
Nodes (3): @radix-ui/react-avatar, @radix-ui/react-avatar, @radix-ui/react-avatar

### Community 234 - "Community 234"
Cohesion: 0.67
Nodes (3): @radix-ui/react-checkbox, @radix-ui/react-checkbox, @radix-ui/react-checkbox

### Community 235 - "Community 235"
Cohesion: 0.67
Nodes (3): @radix-ui/react-collapsible, @radix-ui/react-collapsible, @radix-ui/react-collapsible

### Community 236 - "Community 236"
Cohesion: 0.67
Nodes (3): @radix-ui/react-context-menu, @radix-ui/react-context-menu, @radix-ui/react-context-menu

### Community 237 - "Community 237"
Cohesion: 0.67
Nodes (3): @radix-ui/react-dialog, @radix-ui/react-dialog, @radix-ui/react-dialog

### Community 238 - "Community 238"
Cohesion: 0.67
Nodes (3): @radix-ui/react-dropdown-menu, @radix-ui/react-dropdown-menu, @radix-ui/react-dropdown-menu

### Community 239 - "Community 239"
Cohesion: 0.67
Nodes (3): @radix-ui/react-hover-card, @radix-ui/react-hover-card, @radix-ui/react-hover-card

### Community 240 - "Community 240"
Cohesion: 0.67
Nodes (3): @radix-ui/react-label, @radix-ui/react-label, @radix-ui/react-label

### Community 241 - "Community 241"
Cohesion: 0.67
Nodes (3): @radix-ui/react-menubar, @radix-ui/react-menubar, @radix-ui/react-menubar

### Community 242 - "Community 242"
Cohesion: 0.67
Nodes (3): @radix-ui/react-navigation-menu, @radix-ui/react-navigation-menu, @radix-ui/react-navigation-menu

### Community 243 - "Community 243"
Cohesion: 0.67
Nodes (3): @radix-ui/react-popover, @radix-ui/react-popover, @radix-ui/react-popover

### Community 244 - "Community 244"
Cohesion: 0.67
Nodes (3): @radix-ui/react-progress, @radix-ui/react-progress, @radix-ui/react-progress

### Community 245 - "Community 245"
Cohesion: 0.67
Nodes (3): @radix-ui/react-radio-group, @radix-ui/react-radio-group, @radix-ui/react-radio-group

### Community 246 - "Community 246"
Cohesion: 0.67
Nodes (3): @radix-ui/react-scroll-area, @radix-ui/react-scroll-area, @radix-ui/react-scroll-area

### Community 247 - "Community 247"
Cohesion: 0.67
Nodes (3): @radix-ui/react-select, @radix-ui/react-select, @radix-ui/react-select

### Community 248 - "Community 248"
Cohesion: 0.67
Nodes (3): @radix-ui/react-slider, @radix-ui/react-slider, @radix-ui/react-slider

### Community 249 - "Community 249"
Cohesion: 0.67
Nodes (3): @radix-ui/react-slot, @radix-ui/react-slot, @radix-ui/react-slot

### Community 250 - "Community 250"
Cohesion: 0.67
Nodes (3): @radix-ui/react-switch, @radix-ui/react-switch, @radix-ui/react-switch

### Community 251 - "Community 251"
Cohesion: 0.67
Nodes (3): @radix-ui/react-tabs, @radix-ui/react-tabs, @radix-ui/react-tabs

### Community 252 - "Community 252"
Cohesion: 0.67
Nodes (3): @radix-ui/react-toast, @radix-ui/react-toast, @radix-ui/react-toast

### Community 253 - "Community 253"
Cohesion: 0.67
Nodes (3): @radix-ui/react-toggle, @radix-ui/react-toggle, @radix-ui/react-toggle

### Community 254 - "Community 254"
Cohesion: 0.67
Nodes (3): @radix-ui/react-toggle-group, @radix-ui/react-toggle-group, @radix-ui/react-toggle-group

### Community 255 - "Community 255"
Cohesion: 0.67
Nodes (3): react-day-picker, react-day-picker, react-day-picker

### Community 256 - "Community 256"
Cohesion: 0.67
Nodes (3): react-hook-form, react-hook-form, react-hook-form

### Community 257 - "Community 257"
Cohesion: 0.67
Nodes (3): react-resizable-panels, react-resizable-panels, react-resizable-panels

### Community 258 - "Community 258"
Cohesion: 0.67
Nodes (3): recharts, recharts, recharts

### Community 259 - "Community 259"
Cohesion: 0.67
Nodes (3): @replit/vite-plugin-cartographer, @replit/vite-plugin-cartographer, @replit/vite-plugin-cartographer

### Community 260 - "Community 260"
Cohesion: 0.67
Nodes (3): @replit/vite-plugin-runtime-error-modal, @replit/vite-plugin-runtime-error-modal, @replit/vite-plugin-runtime-error-modal

### Community 261 - "Community 261"
Cohesion: 0.67
Nodes (3): tailwindcss, tailwindcss, tailwindcss

### Community 262 - "Community 262"
Cohesion: 0.67
Nodes (3): @tailwindcss/vite, @tailwindcss/vite, @tailwindcss/vite

### Community 263 - "Community 263"
Cohesion: 0.67
Nodes (3): @vitejs/plugin-react, @vitejs/plugin-react, @vitejs/plugin-react

### Community 270 - "Community 270"
Cohesion: 0.67
Nodes (3): @radix-ui/react-separator, @radix-ui/react-separator, @radix-ui/react-separator

## Knowledge Gaps
- **1481 isolated node(s):** `AcceptRescheduleRequestMutationError`, `AcceptRescheduleRequestMutationResult`, `AddMyServiceAreaPrefixMutationBody`, `AddMyServiceAreaPrefixMutationError`, `AddMyServiceAreaPrefixMutationResult` (+1476 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **32 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `cn()` connect `Community 5` to `Community 66`, `Community 99`, `Community 35`, `Community 36`, `Community 105`, `Community 42`, `Community 45`, `Community 142`, `Community 79`, `Community 80`, `Community 81`, `Community 16`, `Community 51`, `Community 148`, `Community 117`, `Community 88`, `Community 123`, `Community 28`?**
  _High betweenness centrality (0.027) - this node is a cross-community bridge._
- **Why does `CreateReviewBody` connect `Community 8` to `Community 0`?**
  _High betweenness centrality (0.014) - this node is a cross-community bridge._
- **Why does `db` connect `Community 10` to `Community 8`, `Community 138`, `Community 17`, `Community 21`, `Community 29`, `Community 33`, `Community 37`, `Community 53`, `Community 59`, `Community 60`, `Community 62`, `Community 75`, `Community 76`, `Community 86`, `Community 94`, `Community 106`, `Community 107`, `Community 108`, `Community 114`, `Community 115`, `Community 120`, `Community 121`?**
  _High betweenness centrality (0.013) - this node is a cross-community bridge._
- **What connects `AcceptRescheduleRequestMutationError`, `AcceptRescheduleRequestMutationResult`, `AddMyServiceAreaPrefixMutationBody` to the rest of the system?**
  _1481 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.008097165991902834 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.009776055124892335 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.010526315789473684 - nodes in this community are weakly interconnected._