Feature: Editing the current version of a photo
  Scenario: Another editor saved first
    Given I have unsaved photo edits
    When the API reports a version conflict
    Then the card explains in English that the photo changed
    And my edits remain until I choose Reload state
    When I choose Reload state
    Then the current photo details and version replace my draft

  Scenario: Replace and revisit a private photo
    Given a private photo with categories and collection assignments
    When I replace only its file and revisit the photo in Photos
    Then the editor retains its privacy, categories, collections and new version
    And saving sends only metadata I deliberately changed

  Scenario: Find a photo in the library
    Given I am on the Photos tab as the administrator
    When I search by title or filter by category or camera
    Then the library card lists only the matching photos and how many there are
    And the list scrolls on its own while the editor stays in view

  Scenario: Save several custom highlights alongside the main shapes
    Given I am editing a photo with a square highlight
    When I add two named custom highlights with independent widths and heights
    Then both appear as selectable previews
    And the square highlight remains unchanged
    When I remove one custom highlight and save
    Then the other highlight and the main shapes remain saved

  Scenario: Duplicate a main crop into an independent detail
    Given a portrait highlight is selected
    When I duplicate it as a custom highlight and resize its width
    Then the portrait highlight keeps its original proportions
