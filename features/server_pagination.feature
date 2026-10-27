Feature: Bounded public photo browsing
  Scenario: A visitor pages through two hundred photographs
    Given two hundred public gallery groups
    When the visitor opens the gallery
    Then the API returns twelve groups and the matching total
    And private photographs are excluded before pagination
    When the visitor requests the next page
    Then the same seed selects a distinct next page while the catalog is unchanged

  Scenario: A visitor changes pages repeatedly
    When a gallery page request is pending
    Then repeated pagination actions do not start another page request
    And successful page changes are at least five hundred milliseconds apart
    And the API rejects requests above its per-IP quota before querying storage

  Scenario: Search and presentation filters
    When the visitor types a search phrase
    Then the client waits for a typing pause before requesting results
    And the server applies category and crop eligibility before grouping and pagination

  Scenario: Other public screens
    Then Home requests at most eight groups
    And a collection requests at most sixty groups per page
    And viewer arrow navigation requests only the current public photo and its neighbors
