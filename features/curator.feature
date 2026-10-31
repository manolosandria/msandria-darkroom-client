Feature: Curator workspace
  Scenario: One place for the administrator
    Given I am signed in as the administrator
    Then the header offers "Curator" instead of "Upload"
    And it shows how many comments await moderation and how many messages are unread
    When I open Curator
    Then the menu groups Sections, Palettes, Photos and Admin
    And Dashboard counts what waits and opens each tab
    And a section I visited keeps its unsaved state while I look at another

  Scenario: Upload one or all
    Given I added several photos to the upload workshop
    Then each card has its own Upload button at its bottom right
    And "Upload All (n)" appears above and below the cards
    When I upload one card
    Then only that photo is published

  Scenario: Classify while uploading or editing
    Given a photo card or a published photo in Photos
    Then it starts as public unless I choose private, select or collections only
    When I type a category, existing ones are suggested
    And a comma closes the category as a chip
    When I add the photo to collections
    Then I choose its position in each one

  Scenario: Compose a collection
    Given collections appear as cards with their title and cover photo
    When I open one and untick photos
    Then they are marked to be removed but stay in place
    And nothing changes until I save the whole collection at once

  Scenario: Private photos stay private
    Given a photo is private
    Then the public gallery never lists it
    And its images reach me through the API, never as a public image URL

  Scenario: Save and cancel from either end
    Given I am signed in as the administrator
    And two editors in Curator have unsaved changes
    Then a bar at the top and another at the bottom say that two editors have changes
    When I choose "Save all" in either bar
    Then both editors are saved
    When I hide the bars
    Then a small tab brings them back, and the choice is remembered

  Scenario: Properties in tabs beside the preview
    Given I am editing Home or Gallery in Curator
    Then their properties are grouped in tabs beside the preview
    And the arrow keys move between the tabs

  Scenario: Arrange the gallery filter bar
    Given I am editing Gallery in Curator
    When I choose "Arrange the filter bar"
    Then the usual bar appears as groups and pieces
    When I drag the View options into the first group
    Then the public gallery shows them in the bar instead of the Filters panel
    When I choose "Use the usual bar"
    Then the gallery keeps the bar it always had
