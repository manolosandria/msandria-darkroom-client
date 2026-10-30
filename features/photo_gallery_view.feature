Feature: Photo fetching view state
  As a visitor
  I want clear loading, error and success states while photos are fetched
  So that I always understand what the page is doing

  Scenario: Photos load successfully
    Given a photo fetcher that resolves with 3 photos
    When the view mounts
    Then a loading indicator is shown first
    And afterwards the 3 photos are displayed
    And no error message is shown

  Scenario: No photos are found
    Given a photo fetcher that resolves with no photos
    When the view mounts
    Then an error message "No photos found" is shown

  Scenario: Fetching photos fails
    Given a photo fetcher that rejects with an error
    When the view mounts
    Then an error message is shown
    And a retry action is available

  Scenario: Retrying after a failure
    Given the view is showing an error after a failed fetch
    When the visitor triggers the retry action
    Then the fetch is attempted again

  Scenario: Browse the archive like the departments of a shop
    Given I open Gallery
    Then search, the departments and the reset icon share one bar
    And the chosen filters, the photo count and the display options sit on its second line
    And the bar stays at the top of the window while I scroll
    When I hover over or choose a department
    Then one panel opens under the bar with every department as a column
    And the chosen department's column is marked
    When I move to another column or tab
    Then the panel stays open and marks that department instead
    And each chosen filter shows its department beside its name
    And on a phone the panel shows only the chosen department

  Scenario: Browse departments with the keyboard
    Given the focus is on a department
    When I press the left or right arrow
    Then the focus moves to the neighbouring department
    When I press the down arrow
    Then the panel opens and the first category of that department takes the focus
    And the arrows move between categories and columns
    And Escape or Done closes the panel and returns to the department

  Scenario: Arrange the departments in Curator
    Given I am editing Gallery as the administrator
    Then Filter departments shows the departments in the bar's order, starting from the suggested ones
    When I drag a department by its grip or press up or down on it
    Then the departments change order in the preview
    When I drag a category, or press the arrows on its grip
    Then it changes place within its department or moves to another one
    And a category left unsorted closes the bar under Other
    When I rename, add or remove a department
    Then the preview follows, and a removed department leaves its categories unsorted
    And Use suggested departments returns to the built-in grouping
    And nothing is published until Save gallery
