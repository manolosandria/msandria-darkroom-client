Feature: Curator workspace
  Scenario: One place for the administrator
    Given I am signed in as the administrator
    Then the header offers "Curator" instead of "Upload"
    And it shows how many comments await moderation and how many messages are unread
    When I open Curator
    Then the menu groups Sections, Palettes, Photos and Admin
    When I point at a group
    Then its tabs open under it with the open one marked
    When I scroll the menu out of view
    Then a bubble in the corner names the open tab and lists every group
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

  Scenario: Save and cancel from the corner
    Given I am signed in as the administrator
    And two editors in Curator have unsaved changes
    Then a small card in the bottom corner says that two editors have changes
    When I choose "Save all" on it
    Then both editors are saved
    When I fold the card
    Then a round button in the corner brings it back, and the choice is remembered

  Scenario: Dragging a Home slide two places
    Given I am editing Home in Curator with four slides
    When I drag the first slide past the next two
    Then it lands third and the page keeps working

  Scenario: A backdrop for Curator
    Given I am signed in as the administrator
    When I choose a backdrop at the end of Curator's menu
    Then Curator wears that gradient, still when motion is reduced
    And the choice is remembered in this browser

  Scenario: Properties in tabs beside the preview
    Given I am editing Home or Gallery in Curator
    Then their properties are grouped in one row of drawn tabs beside the preview
    And the arrow keys move between the tabs
    And Save, Cancel and Restore are colored icons beside the heading

  Scenario: Arrange the gallery filter bar
    Given I am editing Gallery in Curator
    When I choose "Arrange the filter bar"
    Then the bar appears as visitors will see it, with names over its groups and pieces
    When I drag the View options onto the first group
    Then the public gallery shows them in the bar instead of the Filters panel
    When I choose "Use the usual bar"
    Then the gallery keeps the bar it always had
