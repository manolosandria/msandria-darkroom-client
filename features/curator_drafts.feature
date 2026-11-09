Feature: Independent Curator drafts
  Scenario: Switch photos and collections
    Given I have unsaved edits in a photo and two collections
    When I switch between photos, collections and Curator tabs
    Then each editor retains its own draft
    When I confirm saving one collection
    Then only that collection is saved

  Scenario: Cancel and save confirmations
    Given I have unsaved photo edits
    Then the save bar offers to save or cancel them, and Save changes and Cancel changes close the editor's form
    When I request cancellation or saving
    Then a dialog offers Accept and Cancel
    And Enter accepts while Escape cancels

  Scenario: Leave with several drafts
    Given there are unsaved photo or collection drafts
    When I follow a link out of the workspace or navigate back
    Then the dialog names the editors with unsaved changes
    And I may save all and leave, cancel, or leave without saving
    And a failed save keeps the workspace open
    When I close or reload the browser tab
    Then the native browser warning protects the drafts

  Scenario: Remember the workspace tab
    Given I last selected Collections in Curator
    When I reload the page
    Then Curator opens Collections
    And no photo or collection draft is stored in browser storage

  Scenario: A private collection entry
    Given I assign a private or reserved photo to a collection
    Then a warning explains that it will not appear publicly regardless of its order

  Scenario: A failed save says what, where and why
    Given the photo "Araña" has unsaved highlights
    When saving it fails because the API refuses the highlights
    Then the save bar says "“Araña” (Highlights) was not saved" with the API's reason
    And the drafts are still there
    When I try to leave and choose Save all and leave
    Then the dialog shows the same reason steadily while the new attempt runs

  Scenario: The save bar reads at a glance
    Given I have unsaved photo edits
    Then the save bar shows the whole "Unsaved" badge before the editor's name
    And Cancel is a cross, unlike Undo's curved arrow
    And the button that folds the bar into the corner is as large as the others
