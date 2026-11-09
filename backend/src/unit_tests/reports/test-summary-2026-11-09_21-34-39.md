## 🧪 Test Results

| ID | Test | Status |
|----|------|--------|
| TC001 | SearchService escapeLike escapeLike_escapesPercent | ✅ Passed |
| TC002 | SearchService escapeLike escapeLike_escapesUnderscore | ✅ Passed |
| TC003 | SearchService escapeLike escapeLike_escapesBracket | ✅ Passed |
| TC004 | SearchService escapeLike escapeLike_escapesBackslash | ✅ Passed |
| TC005 | SearchService escapeLike escapeLike_leavesOrdinaryCharsAlone | ✅ Passed |
| TC006 | SearchService search - empty and filter building search_returnsEmptyResponseWhenNoMatches | ✅ Passed |
| TC007 | SearchService search - empty and filter building search_trimsQueryAndEscapesPattern | ✅ Passed |
| TC008 | SearchService search - empty and filter building search_passesAllFilterFieldsToRepository | ✅ Passed |
| TC009 | SearchService search - basic matches search_nodeHitByTitleExposesTitleMatch | ✅ Passed |
| TC010 | SearchService search - basic matches search_nodeHitByReferenceCodeExposesReferenceMatch | ✅ Passed |
| TC011 | SearchService search - basic matches search_descriptionMatchFlattensBrAndProducesSnippet | ✅ Passed |
| TC012 | SearchService search - basic matches search_propertyHitsAttachAsMatches | ✅ Passed |
| TC013 | SearchService search - basic matches search_deduplicatesNodeSeenInBothHits | ✅ Passed |
| TC014 | SearchService search - publicOnly filtering search_skipsNodeUnderUnpublishedAncestorWhenPublicOnly | ✅ Passed |
| TC015 | SearchService search - publicOnly filtering search_keepsSameNodeWhenPublicOnlyIsFalse | ✅ Passed |
| TC016 | SearchService search - path resolution search_buildsPathRootFirst | ✅ Passed |
| TC017 | SearchService search - path resolution search_skipsNodeWithBrokenParentChain | ✅ Passed |
| TC018 | SearchService search - path resolution search_skipsNodeWithParentCycle | ✅ Passed |
| TC019 | SearchService search - ranking and sorting search_exactReferenceRanksAboveExactTitle | ✅ Passed |
| TC020 | SearchService search - ranking and sorting search_titleStartsWithRanksAboveContains | ✅ Passed |
| TC021 | SearchService search - ranking and sorting search_breaksScoreTiesByTitle | ✅ Passed |
| TC022 | SearchService search - ranking and sorting search_breaksTitleTiesByNodeId | ✅ Passed |
| TC023 | SearchService search - truncation and pagination search_marksTruncatedWhenNodeHitsReachMax | ✅ Passed |
| TC024 | SearchService search - truncation and pagination search_marksTruncatedWhenValueHitsReachMax | ✅ Passed |
| TC025 | SearchService search - truncation and pagination search_respectsOffsetAndLimit | ✅ Passed |
| TC026 | SearchService search - snippet truncation search_longDescriptionIsTruncatedWithEllipses | ❌ Failed |
| — | smoke has an empty users table | ✅ Passed |
