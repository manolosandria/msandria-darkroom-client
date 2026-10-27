Feature: Reliable catalog editing and browsing
  Scenario: A stale collection draft is rejected
    Given an edited collection whose saved composition changed elsewhere
    When the curator saves it
    Then the draft remains available without an automatic retry
    And reloading the saved state asks before discarding the draft

  Scenario: Several upload cards need classification suggestions
    Given several photographs prepared in one upload workspace
    When their classification fields mount
    Then they share one catalog request
    And a catalog change refreshes their suggestions

  Scenario: An obsolete listing finishes after a filter change
    Given two requests for different listing filters
    When the current request finishes before the obsolete one
    Then the current filter keeps its result

  Scenario: Browsing collection covers
    Given multiple public collections
    When their cards are displayed
    Then their public covers are loaded together
    And collection contents are requested only when a collection is opened
