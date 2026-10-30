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

  Scenario: Browse the archive with one Filters button
    Given I open Gallery
    Then search, a Filters button and the reset icon share one bar
    And the chosen filters and the photo count sit on its second line
    When I choose Filters
    Then one panel opens under the bar with every department as a column
    And the view options close the panel under the departments
    And a department with a chosen category is marked
    And each chosen filter shows its department beside its name
    And the Filters button counts the chosen categories
    And on a phone the departments stack in the panel

  Scenario: Browse the filters with the keyboard
    Given the focus is on the Filters button
    When I press the down arrow
    Then the panel opens and the first category of the first department takes the focus
    And the arrows move between categories and columns
    And the up arrow from the first category returns to the Filters button
    And Escape or Done closes the panel and returns to the Filters button

  Scenario: Arrange the page in cards
    Given the curator opens Curator → Gallery
    When they choose a drawing under Page layout, or join and split the blocks one by one
    Then the title, the filters and the photographs sit in one, two or three cards in that order
    When the filters follow or precede the title and Beside the title is chosen
    Then the two sit side by side, in one card or as two cards in a row
    And the title can be aligned left, centred or right
    And the bar stays at the top of the window only while it shares a card with the photographs
    And without a saved layout the title and filters share a card beside each other

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
