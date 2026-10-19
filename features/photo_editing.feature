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
