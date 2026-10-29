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
    And any Latin accent is ignored, and "%" or "_" match only themselves

  Scenario: Returning from a photo
    Given the visitor searched, filtered or paged through the gallery
    When they open a photo and go back
    Then the gallery shows the same page, search, filters and order
    And the URL carries the search, category, page and display so it can be shared

  Scenario: Loading the next page
    When the visitor changes page or filter
    Then the current tiles stay visible, dimmed, until the next ones arrive

  Scenario: Other public screens
    Then Home requests at most eight groups
    And a collection requests at most sixty groups per page
    And viewer arrow navigation requests only the current public photo and its neighbors
